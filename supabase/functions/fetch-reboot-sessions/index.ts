import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
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

function normalizeList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

/** Extract any player-related identifier from a raw session object */
function extractPlayerIds(session: any): string[] {
  const ids: string[] = [];
  for (const f of ["org_player_id", "player_id", "athlete_id", "org_athlete_id", "user_id"]) {
    const val = session?.[f];
    if (typeof val === "string" && val) ids.push(val);
  }
  for (const listField of ["participants", "players", "athletes", "movements"]) {
    const list = session?.[listField];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry === "string" && entry) ids.push(entry);
      else if (typeof entry === "object" && entry) {
        for (const f of ["org_player_id", "player_id", "athlete_id", "id"]) {
          if (typeof entry[f] === "string" && entry[f]) ids.push(entry[f]);
        }
      }
    }
  }
  return [...new Set(ids)];
}

// ── OAuth token ──────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) return cachedToken.token;
  const resp = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: REBOOT_USERNAME, password: REBOOT_PASSWORD }),
  });
  if (!resp.ok) throw new Error(`OAuth failed (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// ── Admin verification ───────────────────────────────────────────────

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: cd, error: ce } = await supabase.auth.getUser(token);
  if (ce || !cd?.user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Admin access required");
  return { userId: cd.user.id, supabase };
}

// ── Fetch all org sessions (API-key, no player filter) ───────────────

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
    if (!resp.ok) throw new Error(`Reboot API error (${resp.status}): ${await resp.text()}`);

    const raw = await resp.json();
    const pageSessions = normalizeList(raw);
    console.log(`[fetch-reboot-sessions] Page ${page}: ${pageSessions.length} sessions`);

    // Diagnostic logging for first page
    if (!loggedSample && pageSessions.length > 0) {
      loggedSample = true;
      const sample = pageSessions[0];
      console.log(`[fetch-reboot-sessions] ═══ RAW SESSION KEYS ═══ ${Object.keys(sample).sort().join(", ")}`);
      console.log(`[fetch-reboot-sessions] ═══ FULL SAMPLE ═══ ${JSON.stringify(sample).slice(0, 2000)}`);

      for (let i = 0; i < Math.min(5, pageSessions.length); i++) {
        const s = pageSessions[i];
        const pf: Record<string, unknown> = {};
        for (const key of Object.keys(s)) {
          const lk = key.toLowerCase();
          if (lk.includes("player") || lk.includes("athlete") || lk.includes("participant") ||
              lk.includes("user") || lk.includes("person") || lk.includes("movement")) {
            pf[key] = s[key];
          }
        }
        console.log(`[fetch-reboot-sessions] Session[${i}] id=${s?.id} player-fields=${JSON.stringify(pf)} extracted=[${extractPlayerIds(s).join(",")}]`);
      }
    }

    for (const s of pageSessions) {
      const id = s?.id;
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      sessions.push(s);
    }

    if (pageSessions.length === 0) break;
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

// ── Fetch sessions for a specific player via OAuth (multiple endpoints) ──

async function fetchPlayerSessionsViaOAuth(orgPlayerId: string, sinceDate: string): Promise<any[]> {
  const oauthToken = await getOAuthToken();
  const oauthHeaders = {
    "Authorization": `Bearer ${oauthToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const sessions: any[] = [];
  const seenIds = new Set<string>();
  const sinceMs = parseMs(sinceDate) ?? 0;
  const pageSize = 200;
  const maxPages = 20;

  // The working endpoint is /sessions?org_player_id=... with pagination
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${REBOOT_API_BASE}/sessions`);
    url.searchParams.set("org_player_id", orgPlayerId);
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page_size", pageSize.toString());
    url.searchParams.set("limit", pageSize.toString());
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());

    console.log(`[fetch-reboot-sessions] OAuth player page ${page}: ${url.toString()}`);

    try {
      const resp = await fetch(url.toString(), { headers: oauthHeaders });

      if (!resp.ok) {
        const body = await resp.text();
        console.log(`[fetch-reboot-sessions] OAuth ${resp.status}: ${body.slice(0, 200)}`);
        // If first page fails, try alternative endpoints
        if (page === 1) {
          console.log(`[fetch-reboot-sessions] Primary endpoint failed, trying alternatives...`);
          for (const altEndpoint of [
            `${REBOOT_API_BASE}/mocap-sessions?org_player_id=${orgPlayerId}&limit=${pageSize}`,
            `${REBOOT_API_BASE}/players/${orgPlayerId}/sessions`,
          ]) {
            try {
              console.log(`[fetch-reboot-sessions] Trying: ${altEndpoint}`);
              const altResp = await fetch(altEndpoint, { headers: oauthHeaders });
              if (altResp.ok) {
                const altRaw = await altResp.json();
                const altList = normalizeList(altRaw);
                console.log(`[fetch-reboot-sessions] ✅ Alt endpoint returned ${altList.length} sessions`);
                for (const s of altList) {
                  const id = s?.id;
                  if (id && !seenIds.has(id)) { seenIds.add(id); sessions.push(s); }
                }
                if (sessions.length > 0) break;
              } else {
                console.log(`[fetch-reboot-sessions] Alt ${altResp.status}: ${(await altResp.text()).slice(0, 100)}`);
              }
            } catch (e) { console.log(`[fetch-reboot-sessions] Alt error: ${e}`); }
          }
        }
        break;
      }

      const raw = await resp.json();
      const pageSessions = normalizeList(raw);
      console.log(`[fetch-reboot-sessions] OAuth page ${page}: ${pageSessions.length} sessions`);

      if (page === 1 && pageSessions.length > 0) {
        console.log(`[fetch-reboot-sessions] OAuth keys: ${Object.keys(pageSessions[0]).sort().join(", ")}`);
      }

      for (const s of pageSessions) {
        const id = s?.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        sessions.push(s);
      }

      if (pageSessions.length === 0) break;

      // Stop if we've gone past the date cutoff
      if (sinceMs) {
        let oldestMs: number | null = null;
        for (const s of pageSessions) {
          const ms = parseMs(s?.session_date);
          if (ms !== null) oldestMs = oldestMs === null ? ms : Math.min(oldestMs, ms);
        }
        if (oldestMs !== null && oldestMs < sinceMs) {
          console.log(`[fetch-reboot-sessions] OAuth past cutoff ${sinceDate}; stopping`);
          break;
        }
      }

      if (pageSessions.length < pageSize) break;
    } catch (err) {
      console.log(`[fetch-reboot-sessions] OAuth page ${page} error: ${err}`);
      break;
    }
  }

  console.log(`[fetch-reboot-sessions] OAuth total sessions for player: ${sessions.length}`);
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
    const sinceDate = typeof body.since_date === "string" && body.since_date ? body.since_date : "2024-01-01";

    console.log(`[fetch-reboot-sessions] org_player_id=${targetOrgPlayerId ?? "(all)"} since=${sinceDate}`);

    // Load players table for mapping
    const { data: players } = await supabase
      .from("players")
      .select("id, name, reboot_athlete_id, reboot_player_id")
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

    // ── Strategy 1: If specific player requested, try OAuth player-specific endpoints first ──
    if (targetOrgPlayerId) {
      console.log(`[fetch-reboot-sessions] Trying player-specific OAuth endpoints for ${targetOrgPlayerId}`);
      const oauthSessions = await fetchPlayerSessionsViaOAuth(targetOrgPlayerId, sinceDate);

      if (oauthSessions.length > 0) {
        const sinceMs = parseMs(sinceDate);
        const filtered = oauthSessions
          .filter((s: any) => {
            if (s?.status !== "processed" && s?.status !== "Completed") return false;
            if ((s?.completed_movements ?? s?.num_movements ?? 0) === 0) return false;
            if (!sinceMs) return true;
            const ms = parseMs(s?.session_date);
            return ms === null ? true : ms >= sinceMs;
          })
          .map((s: any) => ({
            id: s.id,
            session_date: s.session_date,
            name: s.session_name || s.session_label || `Session ${s.session_num || ""}`.trim() || null,
            created_at: s.created_at,
            status: s.status,
            movement_count: s.completed_movements || s.num_movements || 0,
            api_player_ids: extractPlayerIds(s),
          }))
          .sort((a: any, b: any) => (parseMs(b.session_date) ?? 0) - (parseMs(a.session_date) ?? 0));

        const player = playersByRebootId.get(targetOrgPlayerId);

        return new Response(
          JSON.stringify({
            sessions: filtered,
            source: "oauth_player_endpoint",
            player: player ? { id: player.id, name: player.name } : null,
            total_from_api: oauthSessions.length,
            filtered_count: filtered.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Strategy 2: Fetch ALL org sessions and cross-reference ──
    console.log(`[fetch-reboot-sessions] Falling back to full org session fetch`);
    const allSessions = await fetchAllOrgSessions(sinceDate);

    const sinceMs = parseMs(sinceDate);
    const processed = allSessions.filter((s: any) => {
      const validStatus = s?.status === "processed" || s?.status === "Completed";
      if (!validStatus || (s?.completed_movements ?? 0) === 0) return false;
      if (!sinceMs) return true;
      const ms = parseMs(s?.session_date);
      return ms === null ? true : ms >= sinceMs;
    });

    console.log(`[fetch-reboot-sessions] ${processed.length} processed sessions in range`);

    // Extract player IDs from API response
    const apiPlayerMap = new Map<string, any[]>();
    let sessionsWithApiPlayerId = 0;
    for (const s of processed) {
      const pids = extractPlayerIds(s);
      if (pids.length > 0) sessionsWithApiPlayerId++;
      for (const pid of pids) {
        const bucket = apiPlayerMap.get(pid) ?? [];
        bucket.push(s);
        apiPlayerMap.set(pid, bucket);
      }
    }

    console.log(`[fetch-reboot-sessions] API-embedded player IDs: ${sessionsWithApiPlayerId}/${processed.length}`);
    console.log(`[fetch-reboot-sessions] Unique API IDs: [${[...apiPlayerMap.keys()].join(", ")}]`);

    // Cross-reference with local reboot_sessions table
    const rebootSessionIds = processed.map((s: any) => s.id).filter(Boolean);
    const localMap = new Map<string, { playerId: string; rebootPlayerId: string | null }>();

    if (rebootSessionIds.length > 0) {
      for (let i = 0; i < rebootSessionIds.length; i += 500) {
        const chunk = rebootSessionIds.slice(i, i + 500);
        const { data: localSessions } = await supabase
          .from("reboot_sessions")
          .select("reboot_session_id, player_id, reboot_player_id")
          .in("reboot_session_id", chunk);
        if (localSessions) {
          for (const ls of localSessions) {
            if (ls.reboot_session_id && ls.player_id) {
              localMap.set(ls.reboot_session_id, { playerId: ls.player_id, rebootPlayerId: ls.reboot_player_id });
            }
          }
        }
      }
    }

    console.log(`[fetch-reboot-sessions] Local DB matches: ${localMap.size}/${processed.length}`);

    // Group sessions by player
    const byPlayer = new Map<string, any[]>();
    const unmapped: any[] = [];

    for (const s of processed) {
      let mapped = false;

      // Source A: local DB
      const local = localMap.get(s.id);
      if (local) {
        const bucket = byPlayer.get(local.playerId) ?? [];
        bucket.push(s);
        byPlayer.set(local.playerId, bucket);
        mapped = true;
      }

      // Source B: API player IDs → reboot_athlete_id
      if (!mapped) {
        for (const apiId of extractPlayerIds(s)) {
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

      if (!mapped) unmapped.push(s);
    }

    console.log(`[fetch-reboot-sessions] Mapped: ${processed.length - unmapped.length}, unmapped: ${unmapped.length}`);

    const formatSession = (s: any) => ({
      id: s.id,
      session_date: s.session_date,
      name: s.session_name || `Session ${s.session_num || ""}`.trim() || null,
      created_at: s.created_at,
      status: s.status,
      movement_count: s.completed_movements || 0,
      api_player_ids: extractPlayerIds(s),
    });

    if (targetOrgPlayerId) {
      const player = playersByRebootId.get(targetOrgPlayerId);
      const playerId = player?.id;
      const sessions = playerId ? (byPlayer.get(playerId) ?? []).map(formatSession) : [];
      sessions.sort((a, b) => (parseMs(b.session_date) ?? 0) - (parseMs(a.session_date) ?? 0));

      return new Response(
        JSON.stringify({
          sessions,
          source: "org_wide_crossref",
          player: player ? { id: player.id, name: player.name } : null,
          total_org_sessions: allSessions.length,
          processed_sessions: processed.length,
          mapped_count: processed.length - unmapped.length,
          unmapped_count: unmapped.length,
          all_player_ids_from_api: [...apiPlayerMap.keys()],
          local_db_matches: localMap.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return all grouped
    const sessionsByPlayer: Record<string, { player: any; sessions: any[] }> = {};
    for (const [pid, sessions] of byPlayer.entries()) {
      const player = playersById.get(pid);
      sessionsByPlayer[pid] = {
        player: player
          ? { id: player.id, name: player.name, reboot_athlete_id: player.reboot_athlete_id }
          : { id: pid, name: "Unknown" },
        sessions: sessions.map(formatSession)
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
          id: p.id, name: p.name, reboot_athlete_id: p.reboot_athlete_id,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-reboot-sessions] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
