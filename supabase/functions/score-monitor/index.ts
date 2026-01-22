/**
 * Score Monitor - Automated Messaging Engine Trigger
 * 
 * This edge function monitors 4B scores and triggers AI-generated
 * coaching messages when scores drop below thresholds.
 * 
 * Features:
 * - Leak detection with video prescription from drill_videos
 * - SMS notification: "I noticed a leak in your [Category] score. I put a fix in your locker: [Link]"
 * - Cooldown to prevent spam
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Thresholds for triggering messages
const SCORE_THRESHOLDS = {
  CRITICAL: 35,      // Send urgent alert
  LEAK: 50,          // Any score below 50 is considered a leak
  STREAK_DAYS: 5,    // Days inactive before "come back" message
};

// Map 4B categories to video tags/categories
const CATEGORY_TAG_MAP: Record<string, string[]> = {
  brain: ["brain", "timing", "decision", "pitch recognition", "mental"],
  body: ["body", "rotation", "hip", "ground force", "kinetic", "separation"],
  bat: ["bat", "bat path", "barrel", "bat speed", "hand speed", "whip"],
  ball: ["ball", "contact", "exit velo", "launch angle", "barrel rate"],
};

interface MonitorRequest {
  mode: "all_players" | "single_player" | "inactive_check";
  player_id?: string;
  force?: boolean;
}

interface PlayerScores {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sms_opt_in: boolean | null;
  latest_brain_score: number | null;
  latest_body_score: number | null;
  latest_bat_score: number | null;
  latest_ball_score: number | null;
  latest_composite_score: number | null;
  last_sensor_session_date: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: MonitorRequest = await req.json().catch(() => ({ mode: "all_players" }));

    const results = {
      checked: 0,
      messagesGenerated: 0,
      smsSent: 0,
      videosPrescribed: 0,
      errors: [] as string[],
    };

    // Get players to check based on mode
    let playersQuery = supabase
      .from("players")
      .select(`
        id, name, email, phone, sms_opt_in,
        latest_brain_score, latest_body_score, 
        latest_bat_score, latest_ball_score,
        latest_composite_score, last_sensor_session_date
      `)
      .in("account_status", ["active", "beta"])
      .not("latest_composite_score", "is", null);

    if (body.mode === "single_player" && body.player_id) {
      playersQuery = playersQuery.eq("id", body.player_id);
    }

    const { data: players, error: playersError } = await playersQuery.limit(100);

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No players to check", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check each player's scores
    for (const player of players as PlayerScores[]) {
      results.checked++;

      try {
        // Get the last message sent to this player (cooldown check)
        const { data: lastMessage } = await supabase
          .from("locker_room_messages")
          .select("created_at, trigger_reason")
          .eq("player_id", player.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Cooldown: Don't spam - wait at least 4 hours between auto messages
        if (!body.force && lastMessage) {
          const hoursSinceLastMessage = 
            (Date.now() - new Date(lastMessage.created_at).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastMessage < 4) {
            continue;
          }
        }

        // Analyze scores
        const scores = {
          brain: player.latest_brain_score,
          body: player.latest_body_score,
          bat: player.latest_bat_score,
          ball: player.latest_ball_score,
        };

        const validScores = Object.entries(scores)
          .filter(([, v]) => v !== null)
          .map(([k, v]) => ({ category: k, score: v as number }));

        if (validScores.length === 0) continue;

        // Find the weakest category
        const weakest = validScores.reduce((min, curr) => 
          curr.score < min.score ? curr : min
        );

        let triggerType: string | null = null;
        let customContext = "";
        let prescribedVideo: { title: string; url: string; thumbnail_url: string | null } | null = null;

        // Determine if we should send a message - ANY score below 50 is a LEAK
        if (weakest.score < SCORE_THRESHOLDS.LEAK) {
          triggerType = "low_score";

          // Query drill_videos for matching leak category
          const categoryTags = CATEGORY_TAG_MAP[weakest.category] || [weakest.category];
          console.log(`[ScoreMonitor] Searching videos for ${weakest.category} leak (score: ${weakest.score}), tags:`, categoryTags);

          // Build the OR filter for matching videos
          const orFilters = [
            ...categoryTags.map(tag => `four_b_category.ilike.%${tag}%`),
            ...categoryTags.map(tag => `title.ilike.%${tag}%`),
          ].join(",");

          // Search drill_videos for matching category or tags
          let matchingVideos: { id: string; title: string; video_url: string; gumlet_playback_url: string | null; thumbnail_url: string | null; four_b_category: string | null }[] | null = null;
          
          const { data: categoryVideos } = await supabase
            .from("drill_videos")
            .select("id, title, video_url, gumlet_playback_url, thumbnail_url, four_b_category")
            .in("status", ["published", "ready_for_review"])
            .or(orFilters)
            .order("created_at", { ascending: false })
            .limit(5);
          
          matchingVideos = categoryVideos;

          // FALLBACK: If no exact category match, get any published video
          if (!matchingVideos || matchingVideos.length === 0) {
            console.log(`[ScoreMonitor] No exact ${weakest.category} videos found, using fallback`);
            const { data: fallbackVideos } = await supabase
              .from("drill_videos")
              .select("id, title, video_url, gumlet_playback_url, thumbnail_url, four_b_category")
              .in("status", ["published", "ready_for_review"])
              .order("created_at", { ascending: false })
              .limit(10);
            matchingVideos = fallbackVideos;
          }

          if (matchingVideos && matchingVideos.length > 0) {
            // Pick a random video from matching ones
            const video = matchingVideos[Math.floor(Math.random() * matchingVideos.length)];
            prescribedVideo = {
              title: video.title,
              url: video.gumlet_playback_url || video.video_url,
              thumbnail_url: video.thumbnail_url,
            };
            results.videosPrescribed++;
            console.log(`[ScoreMonitor] Prescribing video: ${video.title} (category: ${video.four_b_category})`);

            // Store video prescription for player (upsert pattern)
            await supabase
              .from("player_video_prescriptions")
              .upsert({
                player_id: player.id,
                video_id: video.id,
                prescribed_reason: `Leak detected in ${weakest.category} (score: ${weakest.score})`,
                four_b_category: weakest.category,
              }, { onConflict: "player_id,video_id" });
          } else {
            console.log(`[ScoreMonitor] No videos available to prescribe for ${player.name}`);
          }

          if (weakest.score < SCORE_THRESHOLDS.CRITICAL) {
            customContext = `URGENT: ${player.name}'s ${weakest.category} score is critically low at ${weakest.score}. They need immediate help with targeted drills.`;
          } else {
            customContext = `${player.name}'s ${weakest.category} score (${weakest.score}) is below average and needs work. Suggest a specific drill to improve it.`;
          }
        }

        // Check for inactive players (streak mode)
        if (body.mode === "inactive_check" && player.last_sensor_session_date) {
          const daysSinceAnalysis = 
            (Date.now() - new Date(player.last_sensor_session_date).getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceAnalysis >= SCORE_THRESHOLDS.STREAK_DAYS) {
            triggerType = "streak";
            customContext = `${player.name} hasn't trained in ${Math.floor(daysSinceAnalysis)} days. Their last ${weakest.category} score was ${weakest.score}.`;
          }
        }

        // Generate message and send SMS if triggered
        if (triggerType) {
          try {
            // Generate Coach Rick message
            await supabase.functions.invoke("generate-coach-message", {
              body: {
                player_id: player.id,
                trigger_type: triggerType,
                four_b_scores: scores,
                custom_context: customContext,
              },
            });
            results.messagesGenerated++;
            console.log(`[ScoreMonitor] Message generated for ${player.name} (${triggerType})`);

            // Send SMS with leak notification if player has phone and video was prescribed
            if (player.phone && player.sms_opt_in !== false && prescribedVideo) {
              const firstName = player.name?.split(" ")[0] || "there";
              const categoryLabel = weakest.category.charAt(0).toUpperCase() + weakest.category.slice(1);
              
              // Create video link - use dashboard or direct video URL
              const videoLink = `https://barrel-coach.lovable.app/player/drills?video=${encodeURIComponent(prescribedVideo.title)}`;
              
              // The magic SMS format: "I noticed a leak in your [Category] score. I put a fix in your locker: [Link]"
              const smsMessage = `Hey ${firstName}! 🎯 I noticed a leak in your ${categoryLabel} score (${weakest.score}). I put a fix in your locker:\n\n"${prescribedVideo.title}"\n${videoLink}\n\n– Coach Rick`;

              // Send via Twilio directly (avoid circular invoke)
              const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
              const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
              const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

              if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
                // Format phone
                let formattedPhone = player.phone.replace(/\D/g, "");
                if (formattedPhone.length === 10) {
                  formattedPhone = "+1" + formattedPhone;
                } else if (!formattedPhone.startsWith("+")) {
                  formattedPhone = "+" + formattedPhone;
                }

                const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
                const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

                const twilioResponse = await fetch(twilioUrl, {
                  method: "POST",
                  headers: {
                    Authorization: `Basic ${credentials}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({
                    To: formattedPhone,
                    From: TWILIO_PHONE_NUMBER,
                    Body: smsMessage,
                  }),
                });

                const twilioData = await twilioResponse.json();

                if (twilioResponse.ok) {
                  results.smsSent++;
                  console.log(`[ScoreMonitor] SMS sent to ${formattedPhone}`);

                  // Log to sms_logs
                  await supabase.from("sms_logs").insert({
                    phone_number: formattedPhone,
                    trigger_name: "leak_detection",
                    message_sent: smsMessage,
                    twilio_sid: twilioData.sid,
                    status: "sent",
                  });

                  // Log to messages table
                  await supabase.from("messages").insert({
                    player_id: player.id,
                    phone_number: formattedPhone,
                    direction: "outbound",
                    body: smsMessage,
                    twilio_sid: twilioData.sid,
                    status: "sent",
                    trigger_type: "leak_detection",
                    ai_generated: false,
                  });
                } else {
                  console.error(`[ScoreMonitor] Twilio error:`, twilioData);
                }
              }
            }
          } catch (msgError) {
            results.errors.push(`Failed to generate message for ${player.id}: ${msgError}`);
          }
        }
      } catch (playerError) {
        results.errors.push(`Error processing player ${player.id}: ${playerError}`);
      }
    }

    console.log(`[ScoreMonitor] Complete: ${results.checked} checked, ${results.messagesGenerated} messages, ${results.smsSent} SMS sent, ${results.videosPrescribed} videos prescribed`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[ScoreMonitor] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
