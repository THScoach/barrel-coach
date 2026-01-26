/**
 * Get Player Context for Coach Rick AI
 * =====================================
 * Looks up a player by phone number and returns all context needed
 * for Coach Rick to have an informed conversation.
 * 
 * POST /get-player-context
 * Body: { phone: "+1234567890" }
 * 
 * Returns: Player info, assessment, prescription, compliance, history
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlayerContext {
  found: boolean;
  player: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    age: number | null;
    level: string | null;
    handedness: string | null;
    position: string | null;
    createdAt: string;
  } | null;
  assessment: {
    date: string;
    motorProfile: string | null;
    fourB: {
      body: number | null;
      brain: number | null;
      bat: number | null;
      ball: number | null;
      composite: number | null;
    };
    leaks: string[];
    priorityFocus: string | null;
    kineticPotential: number | null;
    timingGap: number | null;
    transferRatio: number | null;
  } | null;
  prescription: {
    weekNumber: number;
    focus: string;
    drills: {
      name: string;
      sets: number;
      reps: number;
      frequency: string;
      targetLeak: string;
    }[];
    startDate: string;
  } | null;
  compliance: {
    thisWeek: {
      prescribed: number;
      completed: number;
      percentage: number;
    };
    lastMessage: string | null;
    lastVideoDate: string | null;
    streak: number;
  };
  recentMessages: {
    date: string;
    direction: "in" | "out";
    summary: string;
  }[];
  progressSummary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove spaces, ensure +)
    const normalizedPhone = phone.replace(/\s/g, "").replace(/^(\d)/, "+$1");
    
    console.log(`[Context] Looking up player: ${normalizedPhone}`);

    // 1. Find player by phone
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .or(`phone.eq.${normalizedPhone},phone.eq.${normalizedPhone.replace("+1", "")}`)
      .limit(1)
      .maybeSingle();

    if (playerError) {
      console.error("[Context] Player lookup error:", playerError);
    }

    if (!player) {
      // New player - return minimal context
      return new Response(
        JSON.stringify({
          found: false,
          player: null,
          assessment: null,
          prescription: null,
          compliance: { thisWeek: { prescribed: 0, completed: 0, percentage: 0 }, streak: 0, lastMessage: null, lastVideoDate: null },
          recentMessages: [],
          progressSummary: "New player - no history yet. Start with an assessment!",
          isNewPlayer: true,
          suggestedAction: "introduce_and_assess",
        } as PlayerContext),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Context] Found player: ${player.name} (${player.id})`);

    // 2. Get latest assessment (from swing_4b_scores)
    const { data: latestScore } = await supabase
      .from("swing_4b_scores")
      .select("*")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Get motor profile from player or score
    const motorProfile = player.motor_profile || latestScore?.motor_profile || null;

    // 4. Get current leaks
    const leaks: string[] = [];
    if (latestScore?.primary_issue_category) leaks.push(latestScore.primary_issue_category);
    if (latestScore?.weakest_link) leaks.push(latestScore.weakest_link);

    // 5. Get prescribed drills (from player_prescriptions or locker_room_messages)
    const { data: prescriptions } = await supabase
      .from("locker_room_messages")
      .select("*")
      .eq("player_id", player.id)
      .eq("message_type", "drill_reminder")
      .order("created_at", { ascending: false })
      .limit(5);

    // 6. Get compliance (check drill completions this week)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    const { data: completions } = await supabase
      .from("drill_completions")
      .select("*")
      .eq("player_id", player.id)
      .gte("completed_at", weekStart.toISOString());

    const prescribedThisWeek = 7; // Assume daily drill
    const completedThisWeek = completions?.length || 0;

    // 7. Get recent video uploads
    const { data: recentVideos } = await supabase
      .from("video_2d_sessions")
      .select("created_at")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(1);

    // 8. Get recent messages
    const { data: messages } = await supabase
      .from("locker_room_messages")
      .select("*")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // 9. Calculate progress summary
    let progressSummary = "";
    if (latestScore) {
      const composite = latestScore.composite_score || 0;
      if (composite >= 60) {
        progressSummary = `${player.name} is progressing well (Composite: ${composite}). `;
      } else if (composite >= 45) {
        progressSummary = `${player.name} is developing (Composite: ${composite}). `;
      } else {
        progressSummary = `${player.name} is early in development (Composite: ${composite}). `;
      }
      
      if (leaks.length > 0) {
        progressSummary += `Current focus: ${leaks[0]}. `;
      }
      
      if (motorProfile) {
        progressSummary += `Motor Profile: ${motorProfile}. `;
      }
    } else {
      progressSummary = `${player.name} needs an assessment to get started. `;
    }

    // 10. Determine suggested action
    let suggestedAction = "continue_program";
    if (!latestScore) {
      suggestedAction = "request_assessment";
    } else if (completedThisWeek === 0 && prescribedThisWeek > 0) {
      suggestedAction = "check_compliance";
    } else if (recentVideos && recentVideos.length === 0) {
      suggestedAction = "request_video";
    }

    const context: PlayerContext = {
      found: true,
      player: {
        id: player.id,
        name: player.name,
        phone: player.phone,
        email: player.email,
        age: player.age,
        level: player.level,
        handedness: player.handedness,
        position: player.position,
        createdAt: player.created_at,
      },
      assessment: latestScore ? {
        date: latestScore.created_at,
        motorProfile,
        fourB: {
          body: latestScore.body_score,
          brain: latestScore.brain_score,
          bat: latestScore.bat_score,
          ball: latestScore.ball_score,
          composite: latestScore.composite_score,
        },
        leaks,
        priorityFocus: latestScore.primary_issue_category || leaks[0] || null,
        kineticPotential: latestScore.kinetic_potential_ev,
        timingGap: latestScore.timing_gap_pct,
        transferRatio: latestScore.transfer_ratio,
      } : null,
      prescription: prescriptions && prescriptions.length > 0 ? {
        weekNumber: 1, // TODO: Track actual week
        focus: leaks[0] || "General development",
        drills: (prescriptions[0]?.drill_links as any[] || []).map((d: any) => ({
          name: d.drill_name || "Drill",
          sets: 3,
          reps: 10,
          frequency: "daily",
          targetLeak: leaks[0] || "general",
        })),
        startDate: prescriptions[0]?.created_at || new Date().toISOString(),
      } : null,
      compliance: {
        thisWeek: {
          prescribed: prescribedThisWeek,
          completed: completedThisWeek,
          percentage: prescribedThisWeek > 0 ? Math.round((completedThisWeek / prescribedThisWeek) * 100) : 0,
        },
        lastMessage: messages?.[0]?.created_at || null,
        lastVideoDate: recentVideos?.[0]?.created_at || null,
        streak: completedThisWeek, // Simplified
      },
      recentMessages: (messages || []).map(m => ({
        date: m.created_at,
        direction: "out" as const,
        summary: m.summary || m.content?.substring(0, 100) || "",
      })),
      progressSummary,
    };

    console.log(`[Context] Returning context for ${player.name}: Profile=${motorProfile}, Composite=${latestScore?.composite_score}`);

    return new Response(
      JSON.stringify({
        ...context,
        suggestedAction,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Context] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
