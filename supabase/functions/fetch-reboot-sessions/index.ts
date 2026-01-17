import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  console.log("[fetch-reboot-sessions] Fetching new Reboot access token");
  
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

// Verify admin user
async function verifyAdmin(req: Request): Promise<string> {
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

  return claimsData.user.id;
}

// Check if a session has data for a specific player using data_export endpoint
async function checkSessionHasPlayerData(
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
        movement_type_id: 1, // Baseball hitting
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.log(`[fetch-reboot-sessions] data_export failed for session ${sessionId}: ${response.status}`);
      return false;
    }

    const data = await response.json();
    const hasData = data.download_urls && data.download_urls.length > 0;
    console.log(`[fetch-reboot-sessions] Session ${sessionId} has data: ${hasData}`);
    // If there are download_urls, the session has data for this player
    return hasData;
  } catch {
    return false;
  }
}

function parseSessionDateMs(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function compareSessionsDesc(a: any, b: any): number {
  const aDate = parseSessionDateMs(a?.session_date) ?? 0;
  const bDate = parseSessionDateMs(b?.session_date) ?? 0;
  if (aDate !== bDate) return bDate - aDate;

  const aCreated = parseSessionDateMs(a?.created_at) ?? 0;
  const bCreated = parseSessionDateMs(b?.created_at) ?? 0;
  return bCreated - aCreated;
}

function normalizeSessionsResponse(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchOrgSessionsPaged(orgPlayerId: string, sinceDate: string): Promise<any[]> {
  const pageSize = 200;
  const maxPages = 25; // safety limit
  const sinceMs = parseSessionDateMs(sinceDate) ?? 0;

  const sessions: any[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${REBOOT_API_BASE}/sessions`);
    // Try multiple pagination styles for compatibility
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page_size", pageSize.toString());
    url.searchParams.set("limit", pageSize.toString());
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());

    // Requested by user: attempt server-side filtering (may be ignored by API)
    url.searchParams.set("org_player_id", orgPlayerId);

    console.log(`[fetch-reboot-sessions] Fetching sessions page ${page}: ${url.toString()}`);

    const resp = await fetch(url.toString(), {
      headers: {
        "X-Api-Key": REBOOT_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`Reboot API error (${resp.status}): ${error}`);
    }

    const raw = await resp.json();
    const pageSessions = normalizeSessionsResponse(raw);

    console.log(
      `[fetch-reboot-sessions] Page ${page} returned ${pageSessions.length} sessions (sample ids: ${pageSessions
        .slice(0, 3)
        .map((s: any) => s?.id)
        .filter(Boolean)
        .join(", ")})`,
    );

    for (const s of pageSessions) {
      const id = s?.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      sessions.push(s);
    }

    if (pageSessions.length === 0) break;

    // Stop once this page includes dates older than our cutoff (assumes newest->oldest ordering)
    if (sinceMs) {
      let oldestMs: number | null = null;
      for (const s of pageSessions) {
        const ms = parseSessionDateMs(s?.session_date);
        if (ms === null) continue;
        oldestMs = oldestMs === null ? ms : Math.min(oldestMs, ms);
      }

      if (oldestMs !== null && oldestMs < sinceMs) {
        console.log(
          `[fetch-reboot-sessions] Reached sessions older than since_date=${sinceDate} on page ${page}; stopping pagination`,
        );
        break;
      }
    }

    // If fewer than page size returned, we've reached the end
    if (pageSessions.length < pageSize) break;
  }

  console.log(`[fetch-reboot-sessions] Total sessions fetched across pages: ${sessions.length}`);
  return sessions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    await verifyAdmin(req);

    const { org_player_id, since_date } = await req.json();

    if (!org_player_id) {
      return new Response(
        JSON.stringify({ error: "org_player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sinceDate = typeof since_date === "string" && since_date ? since_date : "2024-10-01";

    console.log(
      `[fetch-reboot-sessions] Fetching sessions for org_player_id="${org_player_id}" since_date="${sinceDate}"`,
    );

    // Step 1: Fetch sessions (paged) from the org using API key
    const allSessions = await fetchOrgSessionsPaged(org_player_id, sinceDate);

    const sortedForLog = [...allSessions].sort(compareSessionsDesc);
    console.log(
      `[fetch-reboot-sessions] Oldest fetched date: ${sortedForLog[sortedForLog.length - 1]?.session_date ?? "unknown"}; newest: ${sortedForLog[0]?.session_date ?? "unknown"}`,
    );

    // Step 2: Get OAuth token for data_export checks
    const accessToken = await getRebootAccessToken();

    // Step 3: Filter sessions that have data for this player
    const sinceMs = parseSessionDateMs(sinceDate);

    const processedSessions = (Array.isArray(allSessions) ? allSessions : [])
      .filter((s: any) => s?.status === "processed" && (s?.completed_movements ?? 0) > 0)
      .filter((s: any) => {
        if (!sinceMs) return true;
        const ms = parseSessionDateMs(s?.session_date);
        return ms === null ? true : ms >= sinceMs;
      })
      .sort(compareSessionsDesc);

    console.log(
      `[fetch-reboot-sessions] Checking ${processedSessions.length} processed sessions for player data (org_player_id=${org_player_id})`,
    );

    const MAX_EXPORT_CHECKS = 250;
    const sessionsToCheck = processedSessions.slice(0, MAX_EXPORT_CHECKS);

    console.log(
      `[fetch-reboot-sessions] Will data_export-check ${sessionsToCheck.length} sessions (max=${MAX_EXPORT_CHECKS})`,
    );

    const playerSessions: any[] = [];
    const CONCURRENCY = 6;
    let cursor = 0;

    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (cursor < sessionsToCheck.length) {
          const session = sessionsToCheck[cursor++];
          if (!session?.id) continue;

          const hasData = await checkSessionHasPlayerData(session.id, org_player_id, accessToken);
          if (!hasData) continue;

          playerSessions.push({
            id: session.id,
            session_date: session.session_date,
            name: session.session_name || `Session ${session.session_num || ""}`.trim() || null,
            created_at: session.created_at,
            status: session.status,
            movement_count: session.completed_movements || 0,
          });

          console.log(`[fetch-reboot-sessions] Session ${session.id} has data for player`);
        }
      }),
    );

    playerSessions.sort((a, b) => {
      const aDate = parseSessionDateMs(a?.session_date) ?? 0;
      const bDate = parseSessionDateMs(b?.session_date) ?? 0;
      return bDate - aDate;
    });

    console.log(
      `[fetch-reboot-sessions] Found ${playerSessions.length} sessions with data for org_player_id=${org_player_id}`,
    );

    return new Response(JSON.stringify({ sessions: playerSessions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[fetch-reboot-sessions] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
