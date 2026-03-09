import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const DK_AUTH_URL = "https://diamondkinetics.us.auth0.com/oauth/token";
const DK_API_BASE = "https://api.diamondkinetics.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Create sync log entry
  const { data: syncLog } = await supabaseAdmin
    .from("dk_sync_log")
    .insert({ status: "running", triggered_by: "unknown" })
    .select("id")
    .single();
  const logId = syncLog?.id;

  try {
    // --- AUTH ---
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    let triggeredBy = "unknown";

    if (cronSecret) {
      if (cronSecret !== Deno.env.get("CRON_SECRET")) {
        return respond({ error: "Invalid cron secret" }, 401);
      }
      triggeredBy = "cron";
      console.log("[dk-machine-sync] Auth: cron");
    } else if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr) return respond({ error: "Unauthorized" }, 401);

      const userId = claims.claims.sub;
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) return respond({ error: "Admin required" }, 403);
      triggeredBy = "admin";
      console.log("[dk-machine-sync] Auth: admin JWT");
    } else {
      return respond({ error: "Unauthorized" }, 401);
    }

    if (logId) {
      await supabaseAdmin.from("dk_sync_log").update({ triggered_by: triggeredBy }).eq("id", logId);
    }

    // --- STEP 1: Get/refresh DK token ---
    let accessToken = await getCachedToken(supabaseAdmin);
    console.log("[dk-machine-sync] Token acquired");

    // --- STEP 2: Fetch ALL batting sessions with pagination ---
    let allSessions: any[] = [];
    let page = 0;
    const pageSize = 100;

    while (true) {
      let pageSessions: any[];
      try {
        pageSessions = await dkFetch(`/v6/battingSessions?page=${page}&size=${pageSize}`, accessToken);
      } catch (e: any) {
        if (e.message === "DK_401") {
          console.log("[dk-machine-sync] Token expired mid-fetch, refreshing...");
          await supabaseAdmin.from("dk_token_cache").delete().eq("id", 1);
          accessToken = await getCachedToken(supabaseAdmin);
          pageSessions = await dkFetch(`/v6/battingSessions?page=${page}&size=${pageSize}`, accessToken);
        } else throw e;
      }

      if (!Array.isArray(pageSessions) || pageSessions.length === 0) break;
      allSessions = allSessions.concat(pageSessions);
      console.log(`[dk-machine-sync] Page ${page}: ${pageSessions.length} sessions`);
      if (pageSessions.length < pageSize) break;
      page++;
    }

    console.log(`[dk-machine-sync] Total sessions from DK: ${allSessions.length}`);

    // --- STEP 3: Get existing external_session_ids to skip duplicates ---
    const { data: existingSessions } = await supabaseAdmin
      .from("sensor_sessions")
      .select("external_session_id")
      .not("external_session_id", "is", null);

    const existingIds = new Set((existingSessions || []).map((s: any) => s.external_session_id));

    // --- STEP 4: Build email→player map for matching ---
    const { data: allPlayers } = await supabaseAdmin
      .from("players")
      .select("id, name, email, dk_user_uuid");

    const emailToPlayer = new Map<string, any>();
    const uuidToPlayer = new Map<string, any>();
    for (const p of allPlayers || []) {
      if (p.email) emailToPlayer.set(p.email.toLowerCase(), p);
      if (p.dk_user_uuid) uuidToPlayer.set(p.dk_user_uuid, p);
    }

    // Cache for DK user UUID → email lookups
    const dkUserEmailCache = new Map<string, string | null>();

    let sessionsAdded = 0;
    let swingsAdded = 0;
    let playersMatched = new Set<string>();
    const errors: string[] = [];

    // --- STEP 5: Process each session ---
    for (const session of allSessions) {
      const sessionUuid = session.uuid || session.id;
      if (!sessionUuid || existingIds.has(sessionUuid)) continue;

      // Match player: first by dk_user_uuid, then by email lookup
      const userUuid = session.userUuid || session.user_uuid;
      let matchedPlayer: any = null;

      if (userUuid) {
        // Direct UUID match
        matchedPlayer = uuidToPlayer.get(userUuid);

        // If no direct match, look up DK user email and match
        if (!matchedPlayer) {
          let dkEmail = dkUserEmailCache.get(userUuid);
          if (dkEmail === undefined) {
            try {
              const dkUser = await dkFetch(`/v6/users/${userUuid}`, accessToken);
              dkEmail = dkUser?.email?.toLowerCase() || null;
              dkUserEmailCache.set(userUuid, dkEmail);

              // Also update dk_user_uuid on matched player for future direct matches
              if (dkEmail && emailToPlayer.has(dkEmail)) {
                const p = emailToPlayer.get(dkEmail);
                await supabaseAdmin.from("players").update({ dk_user_uuid: userUuid }).eq("id", p.id);
                uuidToPlayer.set(userUuid, p);
              }
            } catch (e: any) {
              console.warn(`[dk-machine-sync] Failed to look up DK user ${userUuid}: ${e.message}`);
              dkUserEmailCache.set(userUuid, null);
            }
          }

          if (dkEmail) {
            matchedPlayer = emailToPlayer.get(dkEmail);
          }
        }
      }

      if (!matchedPlayer) continue; // Can't link this session to any player

      playersMatched.add(matchedPlayer.id);

      // Insert session
      const sessionDate = session.createdAt
        ? new Date(session.createdAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const { data: newSession, error: sessErr } = await supabaseAdmin
        .from("sensor_sessions")
        .insert({
          player_id: matchedPlayer.id,
          session_date: sessionDate,
          total_swings: session.swingCount || 0,
          environment: "dk_auto_sync",
          status: "complete",
          dk_session_uuid: sessionUuid,
          external_session_id: sessionUuid,
        })
        .select("id")
        .single();

      if (sessErr) {
        console.error(`[dk-machine-sync] Session insert error:`, sessErr.message);
        errors.push(`Session ${sessionUuid}: ${sessErr.message}`);
        continue;
      }

      sessionsAdded++;

      // Fetch swings for this session
      let swings: any[];
      try {
        swings = await dkFetch(`/v6/battingSessions/${sessionUuid}/swings`, accessToken);
      } catch (e: any) {
        if (e.message === "DK_401") {
          await supabaseAdmin.from("dk_token_cache").delete().eq("id", 1);
          accessToken = await getCachedToken(supabaseAdmin);
          swings = await dkFetch(`/v6/battingSessions/${sessionUuid}/swings`, accessToken);
        } else {
          console.error(`[dk-machine-sync] Swings fetch error for ${sessionUuid}: ${e.message}`);
          continue;
        }
      }

      if (!Array.isArray(swings) || swings.length === 0) continue;

      const swingRows = swings.map((swing: any, idx: number) => ({
        session_id: newSession.id,
        player_id: matchedPlayer.id,
        swing_number: idx + 1,
        occurred_at: swing.createdAt || new Date().toISOString(),
        bat_speed_mph: swing.speedBarrelMax ?? null,
        attack_angle_deg: swing.controlApproachAngleImpact ?? null,
        hand_speed_mph: swing.speedHandsMax ?? null,
        trigger_to_impact_ms: swing.quicknessTriggerImpact ?? null,
        on_plane_pct: swing.controlOnPlaneEfficiency ?? null,
        hand_cast: swing.controlHandCast ?? null,
        vertical_bat_angle: swing.controlVerticalBatAngleImpact ?? null,
        swing_plane_steepness: swing.controlSwingPlaneSteepness ?? null,
        is_valid: true,
        raw_dk_data: swing,
      }));

      const { error: swingsErr } = await supabaseAdmin
        .from("sensor_swings")
        .insert(swingRows);

      if (swingsErr) {
        console.error(`[dk-machine-sync] Swings insert error:`, swingsErr.message);
        errors.push(`Swings for ${sessionUuid}: ${swingsErr.message}`);
      } else {
        swingsAdded += swingRows.length;
      }

      // Update session aggregates
      const validSpeeds = swingRows.filter((s: any) => s.bat_speed_mph != null).map((s: any) => s.bat_speed_mph);
      const validAngles = swingRows.filter((s: any) => s.attack_angle_deg != null).map((s: any) => s.attack_angle_deg);

      if (validSpeeds.length > 0) {
        const avgSpeed = validSpeeds.reduce((a: number, b: number) => a + b, 0) / validSpeeds.length;
        const maxSpeed = Math.max(...validSpeeds);
        const avgAngle = validAngles.length > 0
          ? validAngles.reduce((a: number, b: number) => a + b, 0) / validAngles.length
          : null;

        await supabaseAdmin
          .from("sensor_sessions")
          .update({
            bat_speed_avg: Math.round(avgSpeed * 10) / 10,
            bat_speed_max: Math.round(maxSpeed * 10) / 10,
            attack_angle_avg: avgAngle != null ? Math.round(avgAngle * 10) / 10 : null,
            total_swings: swingRows.length,
          })
          .eq("id", newSession.id);
      }
    }

    // --- STEP 6: Update sync log ---
    const result = {
      success: true,
      sessions_found: allSessions.length,
      sessions_added: sessionsAdded,
      swings_added: swingsAdded,
      players_matched: playersMatched.size,
      errors,
    };

    if (logId) {
      await supabaseAdmin.from("dk_sync_log").update({
        status: "complete",
        finished_at: new Date().toISOString(),
        sessions_found: allSessions.length,
        sessions_added: sessionsAdded,
        swings_added: swingsAdded,
        players_matched: playersMatched.size,
      }).eq("id", logId);
    }

    console.log("[dk-machine-sync] Complete:", JSON.stringify(result));
    return respond(result, 200);
  } catch (err: any) {
    console.error("[dk-machine-sync] Fatal:", err.message);
    if (logId) {
      await supabaseAdmin.from("dk_sync_log").update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: err.message,
      }).eq("id", logId);
    }
    return respond({ error: err.message }, 500);
  }
});

function respond(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCachedToken(supabase: any): Promise<string> {
  const { data: cached } = await supabase
    .from("dk_token_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  // Use cached if still valid for > 1 hour
  if (cached && new Date(cached.expires_at) > new Date(Date.now() + 3600_000)) {
    console.log("[dk-machine-sync] Using cached token");
    return cached.access_token;
  }

  console.log("[dk-machine-sync] Fetching fresh DK token");
  const res = await fetch(DK_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("DK_CLIENT_ID"),
      client_secret: Deno.env.get("DK_CLIENT_SECRET"),
      audience: "https://api.diamondkinetics.com/",
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth0 token error ${res.status}: ${text}`);
  }

  const tokenData = await res.json();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in - 3600) * 1000).toISOString();

  await supabase
    .from("dk_token_cache")
    .upsert({ id: 1, access_token: tokenData.access_token, expires_at: expiresAt });

  console.log("[dk-machine-sync] Token cached, expires:", expiresAt);
  return tokenData.access_token;
}

async function dkFetch(endpoint: string, token: string): Promise<any> {
  const url = `${DK_API_BASE}${endpoint}`;
  console.log(`[dk-machine-sync] GET ${url}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    await res.text();
    throw new Error("DK_401");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DK API ${res.status}: ${text}`);
  }

  return res.json();
}
