import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── OAuth ───────────────────────────────────────────────────────────────

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  console.log("[sync] Fetching new Reboot access token");
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: REBOOT_USERNAME, password: REBOOT_PASSWORD }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${err}`);
  }
  const data: RebootTokenResponse = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };
  return data.access_token;
}

// ── Auth ─────────────────────────────────────────────────────────────────

async function verifyAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error("Unauthorized");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Admin access required");
  return userData.user.id;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeSessionsResponse(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

/**
 * Check if a session has data for a specific player using the data_export endpoint.
 * This is the ONLY reliable way — Reboot sessions are org-wide and don't contain player IDs.
 */
async function sessionHasPlayerData(
  sessionId: string,
  orgPlayerId: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const resp = await fetch(`${REBOOT_API_BASE}/data_export`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        org_player_id: orgPlayerId,
        data_type: "momentum-energy",
        movement_type_id: 1,
      }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    // API may return download_urls (array) or download_url (string)
    return !!(
      (data.download_urls && data.download_urls.length > 0) ||
      data.download_url
    );
  } catch {
    return false;
  }
}

// ── Fetch all org sessions (paginated) ───────────────────────────────────

async function fetchAllOrgSessions(): Promise<any[]> {
  const pageSize = 200;
  const allSessions: any[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= 50; page++) {
    const url = new URL(`${REBOOT_API_BASE}/sessions`);
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page_size", pageSize.toString());
    url.searchParams.set("limit", pageSize.toString());
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());

    console.log(`[sync] Fetching sessions page ${page}`);
    const resp = await fetch(url.toString(), {
      headers: { "X-Api-Key": REBOOT_API_KEY, "Content-Type": "application/json" },
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Reboot API error (${resp.status}): ${err}`);
    }

    const raw = await resp.json();
    const pageSessions = normalizeSessionsResponse(raw);

    if (page === 1 && pageSessions.length > 0) {
      console.log("[sync] Sample session keys:", Object.keys(pageSessions[0]).join(", "));
    }

    for (const s of pageSessions) {
      const id = s?.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      allSessions.push(s);
    }

    if (pageSessions.length === 0 || pageSessions.length < pageSize) break;
  }

  return allSessions;
}

// ── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);

    const body = await req.json();
    const { player_id, since_date, max_checks: maxChecksParam } = body;

    // Default to last 6 months; override with since_date or "all"
    const defaultSince = new Date();
    defaultSince.setMonth(defaultSince.getMonth() - 6);
    const sinceDate = since_date === "all" ? null : (since_date || defaultSince.toISOString().split("T")[0]);
    const MAX_CHECKS = Math.min(maxChecksParam || 250, 500);
    console.log(`[sync] since_date=${sinceDate || "all"}, max_checks=${MAX_CHECKS}`);

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Determine which players to sync
    let playersQuery = supabase
      .from("players")
      .select("id, name, reboot_athlete_id")
      .not("reboot_athlete_id", "is", null);

    if (player_id) {
      playersQuery = playersQuery.eq("id", player_id);
    }

    const { data: players } = await playersQuery;
    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No players with Reboot athlete IDs found", new_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[sync] Syncing ${players.length} player(s)`);

    // 2. Fetch all org sessions
    const allSessions = await fetchAllOrgSessions();
    // Filter by date and status
    const processedSessions = allSessions
      .filter((s) => s?.status === "processed")
      .filter((s) => {
        if (!sinceDate) return true;
        const sd = s?.session_date;
        if (!sd) return true; // include undated
        return sd >= sinceDate;
      })
      .sort((a: any, b: any) => {
        // newest first so we prioritize recent sessions
        const aD = a?.session_date || "";
        const bD = b?.session_date || "";
        return bD.localeCompare(aD);
      });
    console.log(`[sync] ${allSessions.length} total sessions, ${processedSessions.length} processed (after date filter)`);

    // 3. Get existing imported session IDs to skip
    const { data: existingSessions } = await supabase
      .from("reboot_sessions")
      .select("reboot_session_id, player_id");

    // Map: "reboot_session_id::player_id" → true
    const existingPairs = new Set(
      (existingSessions || []).map((s: any) => `${s.reboot_session_id}::${s.player_id}`),
    );
    console.log(`[sync] ${existingPairs.size} session-player pairs already in database`);

    // 4. Get OAuth token for data_export checks
    const accessToken = await getRebootAccessToken();

    // 5. For each player, check which sessions have their data
    const sessionsToInsert: any[] = [];
    const uploadsToInsert: any[] = [];
    const perPlayer = new Map<string, number>();
    let totalChecks = 0;
    let skippedExisting = 0;

    for (const player of players) {
      const orgPlayerId = player.reboot_athlete_id;
      if (!orgPlayerId) continue;

      console.log(`[sync] Checking sessions for ${player.name} (reboot_athlete_id=${orgPlayerId})`);

      // Filter to sessions not already imported for this player, cap at MAX_CHECKS
      const candidateSessions = processedSessions
        .filter((s) => !existingPairs.has(`${s.id}::${player.id}`))
        .slice(0, Math.max(0, MAX_CHECKS - totalChecks));

      const alreadyImported = processedSessions.length - processedSessions.filter(
        (s) => !existingPairs.has(`${s.id}::${player.id}`),
      ).length;
      skippedExisting += alreadyImported;

      if (candidateSessions.length === 0) {
        console.log(`[sync] ${player.name}: 0 candidates to check (${alreadyImported} already imported)`);
        continue;
      }

      console.log(`[sync] ${player.name}: checking ${candidateSessions.length} candidates (${alreadyImported} already imported)`);

      // data_export check with higher concurrency
      const CONCURRENCY = 10;
      const matched: any[] = [];
      let cursor = 0;

      await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => {
          while (cursor < candidateSessions.length) {
            const session = candidateSessions[cursor++];
            if (!session?.id) continue;
            totalChecks++;

            const hasData = await sessionHasPlayerData(session.id, orgPlayerId, accessToken);
            if (hasData) {
              matched.push(session);
              console.log(`[sync] ✓ ${player.name} matched session ${session.id} (${session.session_date || "no date"})`);
            }
          }
        }),
      );

      console.log(`[sync] ${player.name}: ${matched.length} sessions matched via data_export`);

      for (const session of matched) {
        sessionsToInsert.push({
          player_id: player.id,
          reboot_session_id: session.id,
          reboot_player_id: orgPlayerId,
          session_date: session.session_date ? session.session_date.split("T")[0] : null,
          status: "completed",
          movement_type: "hitting",
          notes: `Imported from Reboot. ${session.completed_movements || 0} movements.`,
        });

        uploadsToInsert.push({
          player_id: player.id,
          reboot_session_id: session.id,
          session_date: session.session_date ? session.session_date.split("T")[0] : new Date().toISOString().split("T")[0],
          processing_status: "pending",
          upload_source: "reboot_import",
        });
      }

      if (matched.length > 0) {
        perPlayer.set(player.name, matched.length);
      }
    }

    console.log(`[sync] Total data_export checks: ${totalChecks}`);
    console.log(`[sync] Matched ${sessionsToInsert.length} sessions to import across ${perPlayer.size} players`);

    if (sessionsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: skippedExisting > 0
            ? "All matching sessions already synced"
            : "No sessions found matching any players via data_export",
          new_count: 0,
          total_in_reboot: processedSessions.length,
          already_imported: skippedExisting,
          data_export_checks: totalChecks,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Insert in batches
    let insertedCount = 0;
    for (let i = 0; i < sessionsToInsert.length; i += 100) {
      const batch = sessionsToInsert.slice(i, i + 100);
      const { error: insertError } = await supabase.from("reboot_sessions").insert(batch);
      if (insertError) {
        console.error(`[sync] Insert error on batch ${i}:`, insertError);
        throw new Error(`Failed to insert sessions: ${insertError.message}`);
      }
      insertedCount += batch.length;
    }

    for (let i = 0; i < uploadsToInsert.length; i += 100) {
      const batch = uploadsToInsert.slice(i, i + 100);
      const { error: uploadError } = await supabase.from("reboot_uploads").insert(batch);
      if (uploadError) {
        console.warn("[sync] Upload insert warning:", uploadError.message);
      }
    }

    console.log(`[sync] ✅ Imported ${insertedCount} sessions across ${perPlayer.size} players`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${insertedCount} session${insertedCount !== 1 ? "s" : ""} across ${perPlayer.size} player${perPlayer.size !== 1 ? "s" : ""}`,
        new_count: insertedCount,
        total_in_reboot: processedSessions.length,
        already_imported: skippedExisting,
        data_export_checks: totalChecks,
        per_player: Object.fromEntries(perPlayer),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[sync] Error:", error);
    const status = error.message === "Unauthorized" || error.message === "Admin access required" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: error.message || "Failed to sync sessions" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
