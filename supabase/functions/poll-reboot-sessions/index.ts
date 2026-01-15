import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * poll-reboot-sessions
 *
 * Cron job that checks for completed Reboot sessions and triggers processing.
 * Should be scheduled to run every 5 minutes via Supabase cron or external scheduler.
 */

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RebootSession {
  id: string;
  session_id: string;
  status: string;
  org_player_id?: string;
}

interface PendingUpload {
  id: string;
  player_id: string;
  reboot_session_id: string;
  processing_status: string;
  created_at: string;
  players: {
    reboot_player_id: string;
    reboot_athlete_id: string;
    name: string;
  };
}

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get OAuth access token from Reboot
async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  console.log("[Auth] Fetching new Reboot access token");
  
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${error}`);
  }

  const data: RebootTokenResponse = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

// Get auth headers for Reboot API calls
async function getRebootHeaders(): Promise<Record<string, string>> {
  const token = await getRebootAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Verify admin user or allow cron secret
async function verifyAdminOrCron(req: Request): Promise<boolean> {
  const cronSecret = req.headers.get("X-Cron-Secret");
  if (cronSecret && cronSecret === Deno.env.get("CRON_SECRET")) {
    return true;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);

  if (claimsError || !claimsData?.user) {
    throw new Error("Unauthorized");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return true;
}

// Fetch sessions for a player from Reboot API
async function fetchRebootSessions(orgPlayerId: string): Promise<RebootSession[]> {
  const headers = await getRebootHeaders();
  
  const response = await fetch(
    `${REBOOT_API_BASE}/sessions?org_player_id=${orgPlayerId}&limit=50`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data;
  } else if (data.sessions && Array.isArray(data.sessions)) {
    return data.sessions;
  }

  return [];
}

// Get session status
async function getSessionStatus(sessionId: string, orgPlayerId: string): Promise<string | null> {
  try {
    const sessions = await fetchRebootSessions(orgPlayerId);
    const session = sessions.find(
      (s: RebootSession) => s.session_id === sessionId || s.id === sessionId
    );
    return session?.status || null;
  } catch (error) {
    console.error(`[Poll] Error checking session ${sessionId}:`, error);
    return null;
  }
}

// Trigger the process-reboot-session function
async function triggerProcessing(
  uploadId: string,
  rebootSessionId: string,
  orgPlayerId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Poll] Triggering processing for session ${rebootSessionId}`);

  try {
    const processUrl = `${SUPABASE_URL}/functions/v1/process-reboot-session`;

    const response = await fetch(processUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: rebootSessionId,
        org_player_id: orgPlayerId,
        player_id: playerId,
        upload_id: uploadId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Processing failed: ${error}` };
    }

    const result = await response.json();
    return { success: result.success, error: result.error };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifyAdminOrCron(req);

    console.log("[Poll] Starting poll for processing sessions...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: pendingUploads, error: queryError } = await supabase
      .from("reboot_uploads")
      .select(`
        id,
        player_id,
        reboot_session_id,
        processing_status,
        created_at,
        players!inner (
          reboot_player_id,
          reboot_athlete_id,
          name
        )
      `)
      .eq("processing_status", "processing")
      .not("reboot_session_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(20) as { data: PendingUpload[] | null; error: any };

    if (queryError) {
      throw new Error(`Failed to query pending uploads: ${queryError.message}`);
    }

    if (!pendingUploads || pendingUploads.length === 0) {
      console.log("[Poll] No pending sessions to check");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending sessions",
          checked: 0,
          completed: 0,
          failed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Poll] Found ${pendingUploads.length} pending sessions to check`);

    let completed = 0;
    let failed = 0;
    let stillProcessing = 0;
    const results: Array<{
      upload_id: string;
      reboot_session_id: string;
      status: string;
      message?: string;
    }> = [];

    for (const upload of pendingUploads) {
      const orgPlayerId = upload.players.reboot_player_id || upload.players.reboot_athlete_id;

      if (!orgPlayerId) {
        console.log(`[Poll] No org_player_id for upload ${upload.id}, skipping`);
        continue;
      }

      console.log(`[Poll] Checking session ${upload.reboot_session_id} for player ${upload.players.name}`);

      const status = await getSessionStatus(upload.reboot_session_id, orgPlayerId);

      if (status === "complete" || status === "completed") {
        console.log(`[Poll] Session ${upload.reboot_session_id} is complete, triggering processing`);

        const processResult = await triggerProcessing(
          upload.id,
          upload.reboot_session_id,
          orgPlayerId,
          upload.player_id
        );

        if (processResult.success) {
          await supabase
            .from("reboot_uploads")
            .update({
              processing_status: "complete",
              completed_at: new Date().toISOString(),
            })
            .eq("id", upload.id);

          completed++;
          results.push({
            upload_id: upload.id,
            reboot_session_id: upload.reboot_session_id,
            status: "completed",
            message: "Processing completed successfully",
          });

          await supabase.from("activity_log").insert({
            action: "reboot_processing_complete",
            description: `Reboot session processed: ${upload.reboot_session_id}`,
            player_id: upload.player_id,
            metadata: {
              upload_id: upload.id,
              reboot_session_id: upload.reboot_session_id,
            },
          });
        } else {
          await supabase
            .from("reboot_uploads")
            .update({
              processing_status: "failed",
              error_message: processResult.error,
            })
            .eq("id", upload.id);

          failed++;
          results.push({
            upload_id: upload.id,
            reboot_session_id: upload.reboot_session_id,
            status: "failed",
            message: processResult.error,
          });
        }

      } else if (status === "failed" || status === "error") {
        await supabase
          .from("reboot_uploads")
          .update({
            processing_status: "failed",
            error_message: "Reboot processing failed",
          })
          .eq("id", upload.id);

        failed++;
        results.push({
          upload_id: upload.id,
          reboot_session_id: upload.reboot_session_id,
          status: "failed",
          message: "Reboot processing failed",
        });

      } else if (status === "pending" || status === "processing") {
        stillProcessing++;
        results.push({
          upload_id: upload.id,
          reboot_session_id: upload.reboot_session_id,
          status: "processing",
          message: "Still processing in Reboot",
        });

      } else if (!status) {
        console.log(`[Poll] Could not get status for session ${upload.reboot_session_id}`);
        stillProcessing++;
        results.push({
          upload_id: upload.id,
          reboot_session_id: upload.reboot_session_id,
          status: "unknown",
          message: "Could not retrieve session status",
        });

        const createdAt = new Date(upload.created_at);
        const now = new Date();
        const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceCreation > 2) {
          await supabase
            .from("reboot_uploads")
            .update({
              processing_status: "failed",
              error_message: "Session processing timed out after 2 hours",
            })
            .eq("id", upload.id);

          failed++;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[Poll] Completed check: ${completed} completed, ${failed} failed, ${stillProcessing} still processing`);

    await supabase.from("activity_log").insert({
      action: "reboot_poll_completed",
      description: `Poll check: ${completed} completed, ${failed} failed, ${stillProcessing} processing`,
      metadata: {
        checked: pendingUploads.length,
        completed,
        failed,
        still_processing: stillProcessing,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        checked: pendingUploads.length,
        completed,
        failed,
        still_processing: stillProcessing,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Poll] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
