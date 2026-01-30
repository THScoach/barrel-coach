/**
 * Reboot Poll Status Edge Function
 * Polls Reboot Motion for session processing status
 * When complete, triggers data export and notifies player via ClawdBot
 *
 * This function re-invokes itself with exponential backoff until processing completes
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

interface SessionStatusResponse {
  id: string;
  status: string;
  movement_type: string;
  session_date: string;
  processing_status?: string;
}

// Configuration
const MAX_ATTEMPTS = 60; // Max polling attempts
const BASE_DELAY_MS = 60000; // 1 minute base delay
const MAX_DELAY_MS = 300000; // 5 minute max delay

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: PollStatusRequest = await req.json();

    if (!body.session_id || !body.player_id) {
      return errorResponse("session_id and player_id are required", 400);
    }

    const attempt = body.attempt || 1;
    console.log(`[reboot-poll-status] Polling session ${body.session_id}, attempt ${attempt}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check session status in Reboot
    const statusResponse = await rebootFetch(`/mocap_session/${body.session_id}`);

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to get session status: ${errorText}`);
    }

    const sessionData: SessionStatusResponse = await statusResponse.json();
    const status = (sessionData.status || sessionData.processing_status || "").toLowerCase();

    console.log(`[reboot-poll-status] Session status: ${status}`);

    // Update our local record
    await supabase
      .from("reboot_sessions")
      .update({
        status: status,
        last_polled_at: new Date().toISOString(),
      })
      .eq("reboot_session_id", body.session_id);

    // Check if processing is complete
    if (status === "complete" || status === "ready" || status === "done" || status === "processed") {
      console.log("[reboot-poll-status] Processing complete! Triggering export...");

      // Trigger data export
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
        console.log("[reboot-poll-status] Export completed");
      } else {
        console.error("[reboot-poll-status] Export failed:", await exportResponse.text());
      }

      // Notify player via ClawdBot
      await notifyPlayer(supabase, supabaseUrl, supabaseServiceKey, body.player_id, body.session_id, exportResult);

      return jsonResponse({
        success: true,
        session_id: body.session_id,
        status: "complete",
        message: "Processing complete. Data exported and player notified.",
        export_result: exportResult,
      });
    }

    // Check if failed
    if (status === "error" || status === "failed") {
      console.error("[reboot-poll-status] Processing failed");

      // Notify player of failure
      await notifyPlayerError(supabase, supabaseUrl, supabaseServiceKey, body.player_id, body.session_id);

      return jsonResponse({
        success: false,
        session_id: body.session_id,
        status: "failed",
        message: "Video processing failed in Reboot Motion",
      });
    }

    // Still processing - schedule next poll
    if (attempt >= MAX_ATTEMPTS) {
      console.error("[reboot-poll-status] Max polling attempts reached");

      await supabase
        .from("reboot_sessions")
        .update({ status: "timeout" })
        .eq("reboot_session_id", body.session_id);

      return jsonResponse({
        success: false,
        session_id: body.session_id,
        status: "timeout",
        message: "Polling timeout - processing took too long",
      });
    }

    // Calculate delay with exponential backoff (capped at MAX_DELAY_MS)
    const delay = Math.min(BASE_DELAY_MS * Math.pow(1.2, attempt - 1), MAX_DELAY_MS);
    console.log(`[reboot-poll-status] Still processing. Next poll in ${delay / 1000}s`);

    // Schedule next poll using setTimeout
    setTimeout(async () => {
      try {
        await fetch(`${supabaseUrl}/functions/v1/reboot-poll-status`, {
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
        });
      } catch (err) {
        console.error("[reboot-poll-status] Failed to schedule next poll:", err);
      }
    }, delay);

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      status: "processing",
      attempt: attempt,
      next_poll_in_ms: delay,
      message: "Still processing. Polling will continue.",
    });

  } catch (error) {
    console.error("[reboot-poll-status] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});

/**
 * Notify player that their analysis is ready via ClawdBot
 */
async function notifyPlayer(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  playerId: string,
  sessionId: string,
  exportResult: any
) {
  try {
    // Get player phone number
    const { data: player } = await supabase
      .from("players")
      .select("phone, name")
      .eq("id", playerId)
      .single();

    if (!player?.phone) {
      console.log("[reboot-poll-status] No phone number for player, skipping notification");
      return;
    }

    // Get analysis results summary
    const analysisResult = exportResult?.analysis_result;
    let message = `🎯 Hey ${player.name?.split(" ")[0] || "there"}! Your 3D swing analysis is ready!\n\n`;

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

    // Send via send-sms function
    const smsUrl = `${supabaseUrl}/functions/v1/send-sms`;

    await fetch(smsUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: player.phone,
        message: message,
        player_id: playerId,
      }),
    });

    console.log("[reboot-poll-status] Player notified via SMS");
  } catch (err) {
    console.error("[reboot-poll-status] Failed to notify player:", err);
  }
}

/**
 * Notify player that processing failed
 */
async function notifyPlayerError(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  playerId: string,
  sessionId: string
) {
  try {
    const { data: player } = await supabase
      .from("players")
      .select("phone, name")
      .eq("id", playerId)
      .single();

    if (!player?.phone) return;

    const message = `Hey ${player.name?.split(" ")[0] || "there"}, there was an issue processing your swing video. ` +
      `Coach Rick has been notified and will follow up. ` +
      `In the meantime, try sending another video and make sure it's well-lit with a clear view of your full swing!`;

    const smsUrl = `${supabaseUrl}/functions/v1/send-sms`;

    await fetch(smsUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: player.phone,
        message: message,
        player_id: playerId,
      }),
    });

    // Also notify Coach Rick
    const coachPhone = Deno.env.get("COACH_RICK_PHONE");
    if (coachPhone) {
      await fetch(smsUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: coachPhone,
          message: `⚠️ Video processing failed for ${player.name} (session: ${sessionId}). Check Reboot dashboard.`,
        }),
      });
    }
  } catch (err) {
    console.error("[reboot-poll-status] Failed to send error notification:", err);
  }
}
