/**
 * Reboot Poll Status Edge Function
 * Polls Reboot Motion for session processing status using /data_export
 * as the completion signal (the /mocap_session endpoint doesn't exist).
 *
 * Logic: attempt a metadata /data_export call.
 *   - If download_urls are returned → session is complete → trigger reboot-export-data
 *   - If empty/error → still processing → schedule retry with backoff
 *
 * POST /functions/v1/reboot-poll-status
 * Body: {
 *   session_id: string,    // Reboot session ID
 *   player_id: string,     // Our internal player ID
 *   attempt: number        // Current attempt number (for backoff)
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  rebootFetch,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/rebootAuth.ts";

interface PollStatusRequest {
  session_id: string;
  player_id: string;
  attempt: number;
}

// Configuration
const MAX_ATTEMPTS = 60; // ~5 hour window

/**
 * Backoff schedule:
 *   Attempt 1  → 1 min
 *   Attempt 2  → 2 min
 *   Attempt 3+ → 5 min (capped)
 */
function getDelayMs(attempt: number): number {
  if (attempt <= 1) return 60_000;    // 1 min
  if (attempt === 2) return 120_000;  // 2 min
  return 300_000;                     // 5 min
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: PollStatusRequest = await req.json();

    if (!body.session_id || !body.player_id) {
      return errorResponse("session_id and player_id are required", 400);
    }

    const attempt = body.attempt || 1;
    console.log(`[poll] Attempt ${attempt} for session ${body.session_id}, player ${body.player_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Look up org_player_id from player record ──
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("reboot_player_id, reboot_athlete_id, name, phone")
      .eq("id", body.player_id)
      .single();

    if (playerError || !player) {
      return errorResponse(`Player not found: ${body.player_id}`, 404);
    }

    const orgPlayerId = player.reboot_player_id || player.reboot_athlete_id;
    if (!orgPlayerId) {
      return errorResponse("Player has no Reboot org_player_id configured.", 400);
    }

    // ── Completion check: try /data_export with metadata ──
    const isComplete = await checkSessionComplete(body.session_id, orgPlayerId);

    // Update last_polled_at regardless
    await supabase
      .from("reboot_sessions")
      .update({ last_polled_at: new Date().toISOString() })
      .eq("reboot_session_id", body.session_id);

    if (isComplete) {
      console.log(`[poll] ✅ Session ${body.session_id} is COMPLETE — triggering export+scoring`);

      await supabase
        .from("reboot_sessions")
        .update({ status: "exporting" })
        .eq("reboot_session_id", body.session_id);

      // Trigger reboot-export-data (which handles CSV download + 4B scoring)
      const exportUrl = `${supabaseUrl}/functions/v1/reboot-export-data`;
      const exportResponse = await fetch(exportUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: body.session_id,
          player_id: body.player_id,
          trigger_analysis: true,
        }),
      });

      let exportResult = null;
      if (exportResponse.ok) {
        exportResult = await exportResponse.json();
        console.log("[poll] Export + scoring pipeline complete");
      } else {
        const errText = await exportResponse.text();
        console.error(`[poll] Export failed: ${errText.substring(0, 500)}`);

        await supabase
          .from("reboot_sessions")
          .update({ status: "error", error_message: `Export failed: ${errText.substring(0, 200)}` })
          .eq("reboot_session_id", body.session_id);
      }

      // Notify player via SMS
      await notifyPlayer(supabase, supabaseUrl, supabaseServiceKey, body.player_id, player, exportResult);

      return jsonResponse({
        success: true,
        session_id: body.session_id,
        status: "complete",
        message: "Processing complete. Export + scoring triggered.",
        export_result: exportResult,
      });
    }

    // ── Still processing — check if we've hit max attempts ──
    if (attempt >= MAX_ATTEMPTS) {
      console.error(`[poll] Max attempts (${MAX_ATTEMPTS}) reached for session ${body.session_id}`);

      await supabase
        .from("reboot_sessions")
        .update({ status: "timeout", error_message: "Polling timeout after max attempts" })
        .eq("reboot_session_id", body.session_id);

      return jsonResponse({
        success: false,
        session_id: body.session_id,
        status: "timeout",
        message: "Polling timeout — processing took too long",
      });
    }

    // ── Fire next poll immediately (fire-and-forget, no await) ──
    // setTimeout doesn't work in Deno edge functions — the process
    // terminates after returning the Response. Instead we fire the
    // next invocation without awaiting it, then return immediately.
    console.log(`[poll] Still processing. Firing next poll (attempt ${attempt + 1}) immediately.`);

    await supabase
      .from("reboot_sessions")
      .update({ status: "processing" })
      .eq("reboot_session_id", body.session_id);

    // Fire-and-forget: do NOT await this fetch
    fetch(`${supabaseUrl}/functions/v1/reboot-poll-status`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: body.session_id,
        player_id: body.player_id,
        attempt: attempt + 1,
      }),
    }).catch(err => console.error("[poll] Failed to schedule next poll:", err));

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      status: "processing",
      attempt,
      message: "Still processing. Next poll fired.",
    });

  } catch (error) {
    console.error("[poll] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});

// ============================================================================
// Check if Reboot has finished processing by probing /data_export
// ============================================================================
async function checkSessionComplete(sessionId: string, orgPlayerId: string): Promise<boolean> {
  try {
    const payload = {
      session_id: sessionId,
      org_player_id: orgPlayerId,
      movement_type_id: 1,
      data_type: "metadata",
      data_format: "csv",
      aggregate: true,
    };

    console.log(`[poll] Probing /data_export for session ${sessionId}...`);
    const res = await rebootFetch("/data_export", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`[poll] /data_export returned ${res.status}: ${errText.substring(0, 200)}`);
      return false;
    }

    const data = await res.json();
    const urls = data.download_urls || [];
    console.log(`[poll] /data_export returned ${urls.length} download URL(s)`);

    return urls.length > 0;
  } catch (err) {
    console.error("[poll] Error probing /data_export:", err);
    return false;
  }
}

// ============================================================================
// Notify player that their analysis is ready
// ============================================================================
async function notifyPlayer(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  playerId: string,
  player: { name: string | null; phone: string | null },
  exportResult: any
) {
  try {
    if (!player?.phone) {
      console.log("[poll] No phone number for player, skipping notification");
      return;
    }

    const firstName = player.name?.split(" ")[0] || "there";
    const analysisResult = exportResult?.analysis_result;
    let message = `🎯 Hey ${firstName}! Your 3D swing analysis is ready!\n\n`;

    if (analysisResult) {
      if (analysisResult.composite_score) {
        message += `⚡ Composite Score: ${analysisResult.composite_score}\n`;
      }
      if (analysisResult.four_b_brain) {
        message += `📊 4B Scores:\n`;
        message += `• Brain: ${analysisResult.four_b_brain}\n`;
        message += `• Body: ${analysisResult.four_b_body}\n`;
        message += `• Bat: ${analysisResult.four_b_bat}\n`;
        message += `• Ball: ${analysisResult.four_b_ball}\n`;
      }
    }

    message += `\nReply "details" for a full breakdown or "compare" to see how you stack up against the pros!`;

    await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: player.phone,
        message,
        player_id: playerId,
      }),
    });

    console.log("[poll] Player notified via SMS");
  } catch (err) {
    console.error("[poll] Failed to notify player:", err);
  }
}
