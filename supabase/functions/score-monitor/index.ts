/**
 * Score Monitor - Automated Messaging Engine Trigger
 * 
 * This edge function monitors 4B scores and triggers AI-generated
 * coaching messages when scores drop below thresholds.
 * 
 * Can be called:
 * 1. Via cron job (scheduled)
 * 2. After session completion (realtime)
 * 3. Manually by admin
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
  LOW: 45,           // Send improvement message
  NEEDS_WORK: 50,    // Send encouragement
  STREAK_DAYS: 5,    // Days inactive before "come back" message
};

interface MonitorRequest {
  mode: "all_players" | "single_player" | "inactive_check";
  player_id?: string;
  force?: boolean; // Skip cooldown check
}

interface PlayerScores {
  id: string;
  name: string;
  email: string | null;
  latest_brain_score: number | null;
  latest_body_score: number | null;
  latest_bat_score: number | null;
  latest_ball_score: number | null;
  latest_composite_score: number | null;
  last_analysis_at: string | null;
  last_message_at: string | null;
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
      errors: [] as string[],
    };

    // Get players to check based on mode
    let playersQuery = supabase
      .from("players")
      .select(`
        id, name, email,
        latest_brain_score, latest_body_score, 
        latest_bat_score, latest_ball_score,
        latest_composite_score, last_analysis_at
      `)
      .eq("account_status", "active")
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

        // Determine if we should send a message
        if (weakest.score < SCORE_THRESHOLDS.CRITICAL) {
          triggerType = "low_score";
          customContext = `URGENT: ${player.name}'s ${weakest.category} score is critically low at ${weakest.score}. They need immediate help with targeted drills.`;
        } else if (weakest.score < SCORE_THRESHOLDS.LOW) {
          triggerType = "low_score";
          customContext = `${player.name}'s ${weakest.category} score (${weakest.score}) needs work. Suggest a specific drill to improve it.`;
        } else if (weakest.score < SCORE_THRESHOLDS.NEEDS_WORK) {
          // Only send if it's been a while since last message
          const daysSinceLastMessage = lastMessage
            ? (Date.now() - new Date(lastMessage.created_at).getTime()) / (1000 * 60 * 60 * 24)
            : 999;
          
          if (daysSinceLastMessage > 2) {
            triggerType = "drill_reminder";
            customContext = `${player.name}'s ${weakest.category} score is ${weakest.score} - close to average but room to grow. Encourage them to keep working.`;
          }
        }

        // Check for inactive players (streak mode)
        if (body.mode === "inactive_check" && player.last_analysis_at) {
          const daysSinceAnalysis = 
            (Date.now() - new Date(player.last_analysis_at).getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceAnalysis >= SCORE_THRESHOLDS.STREAK_DAYS) {
            triggerType = "streak";
            customContext = `${player.name} hasn't trained in ${Math.floor(daysSinceAnalysis)} days. Their last ${weakest.category} score was ${weakest.score}. Send a motivational message to get them back.`;
          }
        }

        // Generate message if triggered
        if (triggerType) {
          try {
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
          } catch (msgError) {
            results.errors.push(`Failed to generate message for ${player.id}: ${msgError}`);
          }
        }
      } catch (playerError) {
        results.errors.push(`Error processing player ${player.id}: ${playerError}`);
      }
    }

    console.log(`[ScoreMonitor] Complete: ${results.checked} checked, ${results.messagesGenerated} messages`);

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
