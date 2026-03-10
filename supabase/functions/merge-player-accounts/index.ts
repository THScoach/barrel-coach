import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const { winner_id, loser_id } = await req.json();
    if (!winner_id || !loser_id) throw new Error("winner_id and loser_id required");
    if (winner_id === loser_id) throw new Error("Cannot merge a player with itself");

    // Fetch both records
    const [{ data: winner }, { data: loser }] = await Promise.all([
      supabase.from("players").select("*").eq("id", winner_id).single(),
      supabase.from("players").select("*").eq("id", loser_id).single(),
    ]);

    if (!winner) throw new Error(`Winner player not found: ${winner_id}`);
    if (!loser) throw new Error(`Loser player not found: ${loser_id}`);

    const fieldsCopied: string[] = [];
    let sessionsMoved = 0;

    // Step A: Copy email, auth_user_id from loser if winner missing
    const winnerUpdates: Record<string, unknown> = {};
    const copyIfMissing = (field: string) => {
      if (!winner[field] && loser[field]) {
        winnerUpdates[field] = loser[field];
        fieldsCopied.push(field);
      }
    };

    copyIfMissing("email");
    copyIfMissing("auth_user_id");
    copyIfMissing("phone");
    copyIfMissing("dk_user_uuid");
    copyIfMissing("dk_email");
    copyIfMissing("bbref_id");
    copyIfMissing("mlb_id");
    copyIfMissing("fangraphs_id");
    copyIfMissing("age");
    copyIfMissing("team");
    copyIfMissing("position");
    copyIfMissing("handedness");
    copyIfMissing("height_inches");
    copyIfMissing("weight_lbs");
    copyIfMissing("level");
    copyIfMissing("can_login");

    // If loser has can_login=true and winner doesn't, copy it
    if (loser.can_login === true && !winner.can_login) {
      winnerUpdates.can_login = true;
      if (!fieldsCopied.includes("can_login")) fieldsCopied.push("can_login");
    }

    if (Object.keys(winnerUpdates).length > 0) {
      winnerUpdates.updated_at = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("players")
        .update(winnerUpdates)
        .eq("id", winner_id);
      if (updateErr) throw new Error(`Failed to update winner: ${updateErr.message}`);
    }

    // Step B: Re-parent all data tables (table -> column name)
    const tablesToReparent: Array<{ table: string; column: string }> = [
      { table: "sensor_sessions", column: "player_id" },
      { table: "reboot_sessions", column: "player_id" },
      { table: "dk_accounts", column: "player_id" },
      { table: "player_sessions", column: "player_id" },
      { table: "sessions", column: "player_id" },
      { table: "sensor_swings", column: "player_id" },
      { table: "capture_sessions", column: "player_id" },
      { table: "captured_swings", column: "player_id" },
      { table: "batted_ball_events", column: "player_id" },
      { table: "hittrax_sessions", column: "player_id" },
      { table: "launch_monitor_sessions", column: "player_id" },
      { table: "ghost_sessions", column: "player_id" },
      { table: "kinetic_fingerprints", column: "player_id" },
      { table: "kinetic_fingerprint_history", column: "player_id" },
      { table: "kwon_analyses", column: "player_id" },
      { table: "athlete_krs_models", column: "player_id" },
      { table: "game_weekly_reports", column: "player_id" },
      { table: "drill_completions", column: "player_id" },
      { table: "player_drill_assignments", column: "player_id" },
      { table: "challenge_entries", column: "player_id" },
      { table: "activity_log", column: "player_id" },
      { table: "agent_actions_log", column: "player_id" },
      { table: "communication_logs", column: "player_id" },
      { table: "coach_conversations", column: "player_id" },
      { table: "chat_logs", column: "player_id" },
      { table: "player_video_prescriptions", column: "player_id" },
      { table: "player_programs", column: "player_id" },
      { table: "video_2d_sessions", column: "player_id" },
      { table: "xp_log", column: "player_id" },
      { table: "invites", column: "player_id" },
      // Tables with non-standard column names
      { table: "player_profiles", column: "players_id" },
      { table: "swing_analysis", column: "player_id" },
    ];

    for (const { table, column } of tablesToReparent) {
      try {
        const { count, error: reparentErr } = await supabase
          .from(table)
          .update({ [column]: winner_id })
          .eq(column, loser_id)
          .select("id", { count: "exact", head: true });

        if (reparentErr) {
          console.warn(`Skipping ${table}: ${reparentErr.message}`);
          continue;
        }
        if (count && count > 0) {
          sessionsMoved += count;
          console.log(`Reparented ${count} rows in ${table}`);
        }
      } catch (e) {
        console.warn(`Table ${table} reparent error:`, e);
      }
    }

    // Step C: Delete player_profiles.players_id reparent handled above now

    // Step D: Delete the loser record
    const { error: deleteErr } = await supabase
      .from("players")
      .delete()
      .eq("id", loser_id);

    if (deleteErr) {
      throw new Error(`Failed to delete loser: ${deleteErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessions_moved: sessionsMoved,
        fields_copied: fieldsCopied,
        winner_id,
        loser_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Merge error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
