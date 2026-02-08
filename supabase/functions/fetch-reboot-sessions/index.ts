import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

/** Extract any player-related identifier from a raw Reboot session object */
function extractPlayerIds(session: any): string[] {
  const ids: string[] = [];
  const directFields = [
    "org_player_id", "player_id", "athlete_id",
    "org_athlete_id", "user_id",
  ];

  for (const field of directFields) {
    const val = session?.[field];
    if (typeof val === "string" && val) ids.push(val);
  }

  // Check nested arrays (participants, players, athletes, movements)
  for (const listField of ["participants", "players", "athletes", "movements"]) {
    const list = session?.[listField];
    if (!Array.isArray(list)) continue;
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

  return [...new Set(ids)];
}

// ── Admin verification ───────────────────────────────────────────────

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  if (claimsError || !claimsData?.user) throw new Error("Unauthorized");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Admin access required");

  return { userId: claimsData.user.id, supabase };
}

// ── Paginated session fetch (org-wide, NO player filter) ─────────────

async function fetchAllOrgSessions(sinceDate: string): Promise<any[]> {
  const pageSize = 200;
  const maxPages = 30;
  const sinceMs = parseMs(sinceDate) ?? 0;

  const sessions: any[] = [];
  const seenIds = new Set<string>();
  let loggedSample = false;

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${REBOOT_API_BASE}/sessions`);
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page_size", pageSize.toString());
    url.searchParams.set("limit", pageSize.toString());
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());

    console.log(`[fetch-reboot-sessions] Fetching page ${page}`);

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

    // Diagnostic: log raw structure of first few sessions (once)
    if (!loggedSample && pageSessions.length > 0) {
      loggedSample = true;
      const sample = pageSessions[0];
      console.log(`[fetch-reboot-sessions] ═══ RAW SESSION STRUCTURE ═══`);
      console.log(`[fetch-reboot-sessions] ALL KEYS: ${Object.keys(sample).sort().join(", ")}`);
      console.log(`[fetch-reboot-sessions] FULL SAMPLE: ${JSON.stringify(sample).slice(0, 2000)}`);

      // Log player-related fields from first 5 sessions
      for (let i = 0; i < Math.min(5, pageSessions.length); i++) {
        const s = pageSessions[i];
        const playerFields: Record<string, unknown> = {};
        for (const key of Object.keys(s)) {
          const lower = key.toLowerCase();
          if (
            lower.includes("player") || lower.includes("athlete") ||
            lower.includes("participant") || lower.includes("user") ||
            lower.includes("person") || lower.includes("movement")
          ) {
            playerFields[key] = s[key];
          }
        }
        const extracted = extractPlayerIds(s);
        console.log(
          `[fetch-reboot-sessions] Session[${i}] id=${s?.id} ` +
          `player-fields=${JSON.stringify(playerFields)} ` +
          `extracted-ids=[${extracted.join(",")}]`
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

    // Stop once sessions are older than cutoff
    if (sinceMs) {
      let oldestMs: number | null = null;
      for (const s of pageSessions) {
        const ms = parseMs(s?.session_date);
        if (ms !== null) oldestMs = oldestMs === null ? ms : Math.min(oldestMs, ms);
      }
      if (oldestMs !== null && oldestMs < sinceMs) {
        console.log(`[fetch-reboot-sessions] Past cutoff ${sinceDate}; stopping`);
        break;
      }
    }

    if (pageSessions.length < pageSize) break;
  }

  console.log(`[fetch-reboot-sessions] Total org sessions: ${sessions.length}`);
  return sessions;
}

// ── Main handler ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase } = await verifyAdmin(req);

    const body = await req.json();
    const targetOrgPlayerId = body.org_player_id as string | undefined;
    const sinceDate = typeof body.since_date === "string" && body.since_date
      ? body.since_date
      : "2024-10-01";

    console.log(
      `[fetch-reboot-sessions] org_player_id=${targetOrgPlayerId ?? "(all)"} since=${sinceDate}`
    );

    // 1) Fetch ALL org sessions from Reboot API
    const allSessions = await fetchAllOrgSessions(sinceDate);

    // 2) Filter to processed sessions in date range
    const sinceMs = parseMs(sinceDate);
    const processed = allSessions.filter((s: any) => {
      if (s?.status !== "processed" || (s?.completed_movements ?? 0) === 0) return false;
      if (!sinceMs) return true;
      const ms = parseMs(s?.session_date);
      return ms === null ? true : ms >= sinceMs;
    });

    console.log(`[fetch-reboot-sessions] ${processed.length} processed sessions in range`);

    // 3) Try to extract player IDs from raw Reboot response
    const apiPlayerMap = new Map<string, any[]>();
    let sessionsWithApiPlayerId = 0;

    for (const s of processed) {
      const playerIds = extractPlayerIds(s);
      if (playerIds.length > 0) sessionsWithApiPlayerId++;
      for (const pid of playerIds) {
        const bucket = apiPlayerMap.get(pid) ?? [];
        bucket.push(s);
        apiPlayerMap.set(pid, bucket);
      }
    }

    console.log(
      `[fetch-reboot-sessions] Sessions with API-embedded player IDs: ${sessionsWithApiPlayerId}/${processed.length}`
    );
    console.log(
      `[fetch-reboot-sessions] Unique player IDs from API: [${[...apiPlayerMap.keys()].join(", ")}]`
    );

    // 4) Cross-reference with our local reboot_sessions table for player mapping
    //    This is the reliable source since we created these sessions ourselves
    const rebootSessionIds = processed.map((s: any) => s.id).filter(Boolean);
    
    const localMap = new Map<string, { playerId: string; rebootPlayerId: string | null }>();
    
    if (rebootSessionIds.length > 0) {
      // Batch query in chunks of 500
      for (let i = 0; i < rebootSessionIds.length; i += 500) {
        const chunk = rebootSessionIds.slice(i, i + 500);
        const { data: localSessions } = await supabase
          .from("reboot_sessions")
          .select("reboot_session_id, player_id, reboot_player_id")
          .in("reboot_session_id", chunk);

        if (localSessions) {
          for (const ls of localSessions) {
            if (ls.reboot_session_id && ls.player_id) {
              localMap.set(ls.reboot_session_id, {
                playerId: ls.player_id,
                rebootPlayerId: ls.reboot_player_id,
              });
            }
          }
        }
      }
    }

    console.log(
      `[fetch-reboot-sessions] Local DB matches: ${localMap.size}/${processed.length} sessions`
    );

    // 5) Also load players table to map reboot_athlete_id → player info
    const { data: players } = await supabase
      .from("players")
      .select("id, first_name, last_name, reboot_athlete_id")
      .not("reboot_athlete_id", "is", null);

    const playersByRebootId = new Map<string, any>();
    const playersById = new Map<string, any>();
    if (players) {
      for (const p of players) {
        if (p.reboot_athlete_id) playersByRebootId.set(p.reboot_athlete_id, p);
        playersById.set(p.id, p);
      }
    }

    console.log(`[fetch-reboot-sessions] Players with reboot_athlete_id: ${playersByRebootId.size}`);

    // 6) Build final grouped result using BOTH sources
    const byPlayer = new Map<string, any[]>(); // keyed by our player.id
    const unmapped: any[] = [];

    for (const s of processed) {
      let mapped = false;

      // Source A: local DB mapping (most reliable)
      const local = localMap.get(s.id);
      if (local) {
        const bucket = byPlayer.get(local.playerId) ?? [];
        bucket.push(s);
        byPlayer.set(local.playerId, bucket);
        mapped = true;
      }

      // Source B: API-embedded player IDs → match via reboot_athlete_id
      if (!mapped) {
        const apiIds = extractPlayerIds(s);
        for (const apiId of apiIds) {
          const player = playersByRebootId.get(apiId);
          if (player) {
            const bucket = byPlayer.get(player.id) ?? [];
            bucket.push(s);
            byPlayer.set(player.id, bucket);
            mapped = true;
            break;
          }
        }
      }

      if (!mapped) {
        unmapped.push(s);
      }
    }

    console.log(
      `[fetch-reboot-sessions] Mapped to players: ${processed.length - unmapped.length}, unmapped: ${unmapped.length}`
    );

    // 7) Build response
    const formatSession = (s: any) => ({
      id: s.id,
      session_date: s.session_date,
      name: s.session_name || `Session ${s.session_num || ""}`.trim() || null,
      created_at: s.created_at,
      status: s.status,
      movement_count: s.completed_movements || 0,
      api_player_ids: extractPlayerIds(s),
    });

    // If a specific org_player_id was requested, find matching player and return their sessions
    if (targetOrgPlayerId) {
      // Find the player by reboot_athlete_id
      const player = playersByRebootId.get(targetOrgPlayerId);
      const playerId = player?.id;

      const sessions = playerId
        ? (byPlayer.get(playerId) ?? []).map(formatSession)
        : [];

      // Sort newest first
      sessions.sort((a, b) => (parseMs(b.session_date) ?? 0) - (parseMs(a.session_date) ?? 0));

      return new Response(
        JSON.stringify({
          sessions,
          player: player
            ? { id: player.id, name: `${player.first_name} ${player.last_name}`.trim() }
            : null,
          total_org_sessions: allSessions.length,
          processed_sessions: processed.length,
          mapped_sessions: processed.length - unmapped.length,
          unmapped_sessions: unmapped.length,
          all_player_ids_from_api: [...apiPlayerMap.keys()],
          local_db_matches: localMap.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No specific player — return everything grouped
    const sessionsByPlayer: Record<string, { player: any; sessions: any[] }> = {};
    for (const [pid, sessions] of byPlayer.entries()) {
      const player = playersById.get(pid);
      sessionsByPlayer[pid] = {
        player: player
          ? {
              id: player.id,
              name: `${player.first_name} ${player.last_name}`.trim(),
              reboot_athlete_id: player.reboot_athlete_id,
            }
          : { id: pid, name: "Unknown" },
        sessions: sessions
          .map(formatSession)
          .sort((a, b) => (parseMs(b.session_date) ?? 0) - (parseMs(a.session_date) ?? 0)),
      };
    }

    return new Response(
      JSON.stringify({
        sessions_by_player: sessionsByPlayer,
        unmapped_sessions: unmapped.map(formatSession),
        total_org_sessions: allSessions.length,
        processed_sessions: processed.length,
        mapped_count: processed.length - unmapped.length,
        unmapped_count: unmapped.length,
        all_player_ids_from_api: [...apiPlayerMap.keys()],
        local_db_matches: localMap.size,
        known_players: players?.map((p) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          reboot_athlete_id: p.reboot_athlete_id,
        })),
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
