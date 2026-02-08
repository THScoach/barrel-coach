import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────────────────────

function parseMs(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizeSessionsResponse(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

/** Try to extract a player/athlete identifier from a single session object */
function extractPlayerIds(session: any): string[] {
  const ids: string[] = [];
  const candidateFields = [
    "org_player_id",
    "player_id",
    "athlete_id",
    "org_athlete_id",
    "user_id",
  ];

  for (const field of candidateFields) {
    const val = session?.[field];
    if (typeof val === "string" && val) ids.push(val);
  }

  // Check nested participants / players arrays
  for (const listField of ["participants", "players", "athletes"]) {
    const list = session?.[listField];
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (typeof entry === "string" && entry) {
          ids.push(entry);
        } else if (typeof entry === "object" && entry) {
          for (const f of ["org_player_id", "player_id", "athlete_id", "id"]) {
            if (typeof entry[f] === "string" && entry[f]) ids.push(entry[f]);
          }
        }
      }
    }
  }

  return [...new Set(ids)];
}

// ── Admin verification ───────────────────────────────────────────────

async function verifyAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  if (claimsError || !claimsData?.user) throw new Error("Unauthorized");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Admin access required");

  return claimsData.user.id;
}

// ── Paginated session fetch (org-wide, no player filter) ─────────────

async function fetchAllOrgSessions(sinceDate: string): Promise<any[]> {
  const pageSize = 200;
  const maxPages = 30;
  const sinceMs = parseMs(sinceDate) ?? 0;

  const sessions: any[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${REBOOT_API_BASE}/sessions`);
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page_size", pageSize.toString());
    url.searchParams.set("limit", pageSize.toString());
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());

    console.log(`[fetch-reboot-sessions] Fetching page ${page}: ${url.toString()}`);

    const resp = await fetch(url.toString(), {
      headers: { "X-Api-Key": REBOOT_API_KEY, "Content-Type": "application/json" },
    });

    if (!resp.ok) {
      const error = await resp.text();
      throw new Error(`Reboot API error (${resp.status}): ${error}`);
    }

    const raw = await resp.json();
    const pageSessions = normalizeSessionsResponse(raw);

    console.log(`[fetch-reboot-sessions] Page ${page}: ${pageSessions.length} sessions`);

    // Log field names from first session on first page for diagnostics
    if (page === 1 && pageSessions.length > 0) {
      const sample = pageSessions[0];
      console.log(`[fetch-reboot-sessions] SAMPLE SESSION KEYS: ${Object.keys(sample).join(", ")}`);
      console.log(`[fetch-reboot-sessions] SAMPLE SESSION (truncated): ${JSON.stringify(sample).slice(0, 1500)}`);

      // Log all player-related fields across first 3 sessions
      for (let i = 0; i < Math.min(3, pageSessions.length); i++) {
        const s = pageSessions[i];
        const playerFields: Record<string, unknown> = {};
        for (const key of Object.keys(s)) {
          const lower = key.toLowerCase();
          if (
            lower.includes("player") ||
            lower.includes("athlete") ||
            lower.includes("participant") ||
            lower.includes("user") ||
            lower.includes("org_player") ||
            lower.includes("person")
          ) {
            playerFields[key] = s[key];
          }
        }
        console.log(
          `[fetch-reboot-sessions] Session[${i}] id=${s?.id} player-fields: ${JSON.stringify(playerFields)}`
        );
      }
    }

    for (const s of pageSessions) {
      const id = s?.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      sessions.push(s);
    }

    if (pageSessions.length === 0) break;

    // Stop if we've gone past our date cutoff
    if (sinceMs) {
      let oldestMs: number | null = null;
      for (const s of pageSessions) {
        const ms = parseMs(s?.session_date);
        if (ms !== null) oldestMs = oldestMs === null ? ms : Math.min(oldestMs, ms);
      }
      if (oldestMs !== null && oldestMs < sinceMs) {
        console.log(`[fetch-reboot-sessions] Reached sessions older than ${sinceDate}; stopping`);
        break;
      }
    }

    if (pageSessions.length < pageSize) break;
  }

  console.log(`[fetch-reboot-sessions] Total org sessions fetched: ${sessions.length}`);
  return sessions;
}

// ── Main handler ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminId = await verifyAdmin(req);

    const body = await req.json();
    const orgPlayerId = body.org_player_id as string | undefined;
    const sinceDate = typeof body.since_date === "string" && body.since_date ? body.since_date : "2024-10-01";

    console.log(
      `[fetch-reboot-sessions] Request: org_player_id=${orgPlayerId ?? "(all)"}, since=${sinceDate}`
    );

    // 1) Fetch ALL org sessions (no player filter)
    const allSessions = await fetchAllOrgSessions(sinceDate);

    // 2) Filter to processed sessions within date range
    const sinceMs = parseMs(sinceDate);
    const processed = allSessions.filter((s: any) => {
      if (s?.status !== "processed" || (s?.completed_movements ?? 0) === 0) return false;
      if (!sinceMs) return true;
      const ms = parseMs(s?.session_date);
      return ms === null ? true : ms >= sinceMs;
    });

    console.log(`[fetch-reboot-sessions] ${processed.length} processed sessions in date range`);

    // 3) Group sessions by extracted player IDs
    const byPlayer = new Map<string, any[]>();
    let sessionsWithNoPlayer = 0;

    for (const s of processed) {
      const playerIds = extractPlayerIds(s);
      if (playerIds.length === 0) {
        sessionsWithNoPlayer++;
        // Put under "__unknown__" bucket
        const bucket = byPlayer.get("__unknown__") ?? [];
        bucket.push(s);
        byPlayer.set("__unknown__", bucket);
      } else {
        for (const pid of playerIds) {
          const bucket = byPlayer.get(pid) ?? [];
          bucket.push(s);
          byPlayer.set(pid, bucket);
        }
      }
    }

    console.log(
      `[fetch-reboot-sessions] Player IDs found: ${[...byPlayer.keys()].filter((k) => k !== "__unknown__").join(", ") || "(none)"}`
    );
    console.log(`[fetch-reboot-sessions] Sessions with no player ID: ${sessionsWithNoPlayer}`);

    // 4) If a specific org_player_id was requested, return just that player's sessions
    if (orgPlayerId) {
      const playerSessions = (byPlayer.get(orgPlayerId) ?? [])
        .map((s: any) => ({
          id: s.id,
          session_date: s.session_date,
          name: s.session_name || `Session ${s.session_num || ""}`.trim() || null,
          created_at: s.created_at,
          status: s.status,
          movement_count: s.completed_movements || 0,
          player_ids: extractPlayerIds(s),
        }))
        .sort((a: any, b: any) => (parseMs(b.session_date) ?? 0) - (parseMs(a.session_date) ?? 0));

      console.log(
        `[fetch-reboot-sessions] Returning ${playerSessions.length} sessions for org_player_id=${orgPlayerId}`
      );

      return new Response(
        JSON.stringify({
          sessions: playerSessions,
          all_player_ids: [...byPlayer.keys()].filter((k) => k !== "__unknown__"),
          sessions_without_player: sessionsWithNoPlayer,
          total_org_sessions: allSessions.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) No specific player requested — return grouped summary
    const grouped: Record<string, any[]> = {};
    for (const [pid, sessions] of byPlayer.entries()) {
      grouped[pid] = sessions
        .map((s: any) => ({
          id: s.id,
          session_date: s.session_date,
          name: s.session_name || `Session ${s.session_num || ""}`.trim() || null,
          created_at: s.created_at,
          status: s.status,
          movement_count: s.completed_movements || 0,
        }))
        .sort((a: any, b: any) => (parseMs(b.session_date) ?? 0) - (parseMs(a.session_date) ?? 0));
    }

    return new Response(
      JSON.stringify({
        sessions_by_player: grouped,
        all_player_ids: [...byPlayer.keys()].filter((k) => k !== "__unknown__"),
        sessions_without_player: sessionsWithNoPlayer,
        total_org_sessions: allSessions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-reboot-sessions] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
