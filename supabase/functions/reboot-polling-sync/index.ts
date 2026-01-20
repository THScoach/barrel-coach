import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// REBOOT POLLING SYNC - Automated 12-Hour Sync
// ============================================
// This function polls Reboot Motion API for new sessions,
// processes them through 4B scoring, and saves to database.
// No webhooks required - pure polling architecture.

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration
const BATCH_SIZE = 5; // Process players in batches
const MAX_SESSIONS_PER_PLAYER = 10; // Max new sessions to process per player per sync
const LOOKBACK_DAYS = 7; // Look back this many days for new sessions

interface PlayerWithReboot {
  id: string;
  name: string;
  reboot_athlete_id: string | null;
  reboot_player_id: string | null;
}

interface RebootSession {
  id: string;
  session_date: string;
  name?: string;
  status: string;
  completed_movements: number;
}

interface SyncResult {
  player_id: string;
  player_name: string;
  sessions_found: number;
  sessions_processed: number;
  errors: string[];
}

// Cache for OAuth token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get OAuth access token from Reboot
async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  console.log("[reboot-polling] Fetching new Reboot access token");
  
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${error}`);
  }

  const data = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

// Verify request is from cron or admin
async function verifyRequest(req: Request): Promise<void> {
  // Check for cron secret header
  const cronHeader = req.headers.get("x-cron-secret") || req.headers.get("authorization");
  if (cronHeader === `Bearer ${CRON_SECRET}` || cronHeader === CRON_SECRET) {
    console.log("[reboot-polling] Verified via cron secret");
    return;
  }

  // Check for admin auth
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error } = await supabase.auth.getUser(token);
    
    if (!error && claimsData?.user) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin) {
        console.log("[reboot-polling] Verified via admin auth");
        return;
      }
    }
  }

  // Allow service role key
  if (authHeader === `Bearer ${SUPABASE_SERVICE_KEY}`) {
    console.log("[reboot-polling] Verified via service role");
    return;
  }

  throw new Error("Unauthorized - requires cron secret or admin access");
}

// Fetch sessions for a player from Reboot API
async function fetchPlayerSessions(orgPlayerId: string, sinceDate: string): Promise<RebootSession[]> {
  const url = new URL(`${REBOOT_API_BASE}/sessions`);
  url.searchParams.set("org_player_id", orgPlayerId);
  url.searchParams.set("page_size", "100");
  
  const response = await fetch(url.toString(), {
    headers: {
      "X-Api-Key": REBOOT_API_KEY,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot API error: ${error}`);
  }

  const data = await response.json();
  const sessions: RebootSession[] = Array.isArray(data) ? data : 
    (data.sessions || data.data || []);

  // Filter to processed sessions after sinceDate
  const sinceMs = Date.parse(sinceDate);
  return sessions.filter(s => {
    if (s.status !== "processed") return false;
    if ((s.completed_movements || 0) < 1) return false;
    const sessionMs = Date.parse(s.session_date);
    return !isNaN(sessionMs) && sessionMs >= sinceMs;
  });
}

// Check if session has data for player
async function checkSessionHasData(
  sessionId: string, 
  orgPlayerId: string, 
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${REBOOT_API_BASE}/data_export`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        org_player_id: orgPlayerId,
        data_type: "momentum-energy",
        movement_type_id: 1,
      }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.download_urls && data.download_urls.length > 0;
  } catch {
    return false;
  }
}

// Process a single session through 4B scoring
async function processSession(
  supabase: any,
  playerId: string,
  sessionId: string,
  orgPlayerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call existing process-reboot-session function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/process-reboot-session`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        org_player_id: orgPlayerId,
        player_id: playerId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Processing failed: ${error}` };
    }

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: result.error || "Processing returned failure" };
    }

    console.log(`[reboot-polling] Processed session ${sessionId}: ${result.message}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Main sync logic for a single player
async function syncPlayer(
  supabase: any,
  player: PlayerWithReboot,
  sinceDate: string,
  accessToken: string
): Promise<SyncResult> {
  const result: SyncResult = {
    player_id: player.id,
    player_name: player.name || "Unknown",
    sessions_found: 0,
    sessions_processed: 0,
    errors: [],
  };

  const orgPlayerId = player.reboot_player_id || player.reboot_athlete_id;
  if (!orgPlayerId) {
    result.errors.push("No Reboot ID linked");
    return result;
  }

  try {
    // Fetch sessions from Reboot
    const sessions = await fetchPlayerSessions(orgPlayerId, sinceDate);
    result.sessions_found = sessions.length;

    if (sessions.length === 0) {
      return result;
    }

    // Get existing session IDs from database
    const { data: existingSessions } = await supabase
      .from("reboot_uploads")
      .select("reboot_session_id")
      .eq("player_id", player.id)
      .not("reboot_session_id", "is", null);

    const existingIds = new Set(
      (existingSessions || []).map((s: any) => s.reboot_session_id)
    );

    // Filter to new sessions only
    const newSessions = sessions.filter(s => !existingIds.has(s.id));

    if (newSessions.length === 0) {
      console.log(`[reboot-polling] ${player.name}: All ${sessions.length} sessions already processed`);
      return result;
    }

    console.log(`[reboot-polling] ${player.name}: Found ${newSessions.length} new sessions to process`);

    // Limit sessions to process
    const toProcess = newSessions.slice(0, MAX_SESSIONS_PER_PLAYER);

    // Verify each session has data before processing
    for (const session of toProcess) {
      const hasData = await checkSessionHasData(session.id, orgPlayerId, accessToken);
      if (!hasData) {
        console.log(`[reboot-polling] Session ${session.id} has no data for player`);
        continue;
      }

      const processResult = await processSession(supabase, player.id, session.id, orgPlayerId);
      
      if (processResult.success) {
        result.sessions_processed++;
      } else {
        result.errors.push(`Session ${session.id}: ${processResult.error}`);
      }

      // Small delay between sessions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return result;
  } catch (error) {
    result.errors.push(String(error));
    return result;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    await verifyRequest(req);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get OAuth token for data_export checks
    const accessToken = await getRebootAccessToken();

    // Calculate lookback date
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - LOOKBACK_DAYS);
    const sinceDateStr = sinceDate.toISOString().split("T")[0];

    console.log(`[reboot-polling] Starting sync, looking back to ${sinceDateStr}`);

    // Fetch all players with Reboot IDs
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, name, reboot_athlete_id, reboot_player_id")
      .or("reboot_athlete_id.neq.,reboot_player_id.neq.")
      .eq("account_status", "active");

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    // Filter to players with at least one Reboot ID
    const playersWithReboot = (players || []).filter(
      (p: PlayerWithReboot) => p.reboot_athlete_id || p.reboot_player_id
    );

    console.log(`[reboot-polling] Found ${playersWithReboot.length} players with Reboot IDs`);

    if (playersWithReboot.length === 0) {
      const syncLog = {
        sync_type: "reboot_polling",
        players_checked: 0,
        sessions_processed: 0,
        errors_count: 0,
        duration_ms: Date.now() - startTime,
        details: { message: "No players with Reboot IDs found" },
      };
      
      await supabase.from("sync_logs").insert(syncLog);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "No players to sync",
        ...syncLog 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process players in batches
    const results: SyncResult[] = [];

    for (let i = 0; i < playersWithReboot.length; i += BATCH_SIZE) {
      const batch = playersWithReboot.slice(i, i + BATCH_SIZE);
      
      console.log(`[reboot-polling] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(playersWithReboot.length / BATCH_SIZE)}`);

      const batchResults = await Promise.all(
        batch.map(player => syncPlayer(supabase, player, sinceDateStr, accessToken))
      );

      results.push(...batchResults);

      // Small delay between batches
      if (i + BATCH_SIZE < playersWithReboot.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Calculate totals
    const totalProcessed = results.reduce((sum, r) => sum + r.sessions_processed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    const syncLog = {
      sync_type: "reboot_polling",
      players_checked: playersWithReboot.length,
      sessions_processed: totalProcessed,
      errors_count: totalErrors,
      duration_ms: Date.now() - startTime,
      details: {
        lookback_days: LOOKBACK_DAYS,
        since_date: sinceDateStr,
        results: results.map(r => ({
          player_id: r.player_id,
          player_name: r.player_name,
          sessions_found: r.sessions_found,
          sessions_processed: r.sessions_processed,
          errors: r.errors.length > 0 ? r.errors : undefined,
        })),
      },
    };

    // Save sync log
    await supabase.from("sync_logs").insert(syncLog);

    console.log(`[reboot-polling] Sync complete: ${totalProcessed} sessions processed, ${totalErrors} errors`);

    return new Response(JSON.stringify({
      success: true,
      players_checked: playersWithReboot.length,
      sessions_processed: totalProcessed,
      errors_count: totalErrors,
      duration_ms: Date.now() - startTime,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[reboot-polling] Error:", error);
    
    // Log the error
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await supabase.from("sync_logs").insert({
      sync_type: "reboot_polling",
      players_checked: 0,
      sessions_processed: 0,
      errors_count: 1,
      duration_ms: Date.now() - startTime,
      details: { error: String(error) },
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
