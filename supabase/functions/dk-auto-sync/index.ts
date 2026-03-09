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

  try {
    // Auth: cron secret OR admin JWT
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (cronSecret) {
      if (cronSecret !== Deno.env.get("CRON_SECRET")) {
        return new Response(JSON.stringify({ error: "Invalid cron secret" }), { status: 401, headers: corsHeaders });
      }
      console.log("[dk-auto-sync] Authenticated via cron secret");
    } else if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr) throw new Error("Unauthorized");
      
      const userId = claims.claims.sub;
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: corsHeaders });
      }
      console.log("[dk-auto-sync] Authenticated via admin JWT");
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Step 1: Get/refresh DK token
    let accessToken = await getCachedToken(supabaseAdmin);
    console.log("[dk-auto-sync] Token acquired");

    // Step 2: Get players with dk_user_uuid
    const { data: players, error: playersErr } = await supabaseAdmin
      .from("players")
      .select("id, name, email, dk_user_uuid")
      .not("dk_user_uuid", "is", null);

    if (playersErr) throw playersErr;
    console.log(`[dk-auto-sync] Found ${players?.length || 0} DK-linked players`);

    let totalSessionsAdded = 0;
    let totalSwingsAdded = 0;
    let playersSynced = 0;
    const errors: string[] = [];

    // Step 3: For each player, sync sessions
    for (const player of players || []) {
      try {
        console.log(`[dk-auto-sync] Syncing player ${player.name} (${player.dk_user_uuid})`);
        
        let sessions: any[];
        try {
          sessions = await dkFetch(`/v6/users/${player.dk_user_uuid}/battingSessions`, accessToken);
        } catch (e: any) {
          if (e.message === "DK_401") {
            console.log("[dk-auto-sync] Token expired, refreshing...");
            await supabaseAdmin.from("dk_token_cache").delete().eq("id", 1);
            accessToken = await getCachedToken(supabaseAdmin);
            sessions = await dkFetch(`/v6/users/${player.dk_user_uuid}/battingSessions`, accessToken);
          } else {
            throw e;
          }
        }

        if (!Array.isArray(sessions)) {
          console.log(`[dk-auto-sync] Unexpected sessions response for ${player.name}:`, typeof sessions);
          continue;
        }

        // Get existing dk_session_uuids for this player
        const { data: existingSessions } = await supabaseAdmin
          .from("sensor_sessions")
          .select("dk_session_uuid")
          .eq("player_id", player.id)
          .not("dk_session_uuid", "is", null);

        const existingUuids = new Set((existingSessions || []).map((s: any) => s.dk_session_uuid));

        let playerSessionsAdded = 0;
        let playerSwingsAdded = 0;

        for (const session of sessions) {
          const sessionUuid = session.uuid || session.id;
          if (!sessionUuid || existingUuids.has(sessionUuid)) continue;

          // Insert session
          const sessionDate = session.createdAt ? new Date(session.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
          const { data: newSession, error: sessErr } = await supabaseAdmin
            .from("sensor_sessions")
            .insert({
              player_id: player.id,
              session_date: sessionDate,
              total_swings: session.swingCount || 0,
              environment: "dk_auto_sync",
              status: "complete",
              dk_session_uuid: sessionUuid,
            })
            .select("id")
            .single();

          if (sessErr) {
            console.error(`[dk-auto-sync] Session insert error:`, sessErr.message);
            continue;
          }

          playerSessionsAdded++;

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
              console.error(`[dk-auto-sync] Swings fetch error for session ${sessionUuid}:`, e.message);
              continue;
            }
          }

          if (!Array.isArray(swings) || swings.length === 0) continue;

          const swingRows = swings.map((swing: any, idx: number) => ({
            session_id: newSession.id,
            player_id: player.id,
            swing_number: idx + 1,
            occurred_at: swing.createdAt || new Date().toISOString(),
            bat_speed_mph: swing.speedBarrelMax ?? null,
            attack_angle_deg: swing.controlApproachAngleImpact ?? null,
            hand_speed_mph: swing.speedHandsMax ?? null,
            trigger_to_impact_ms: swing.quicknessTriggerImpact ?? null,
            is_valid: true,
            raw_dk_data: swing,
          }));

          const { error: swingsErr } = await supabaseAdmin
            .from("sensor_swings")
            .insert(swingRows);

          if (swingsErr) {
            console.error(`[dk-auto-sync] Swings insert error:`, swingsErr.message);
          } else {
            playerSwingsAdded += swingRows.length;
          }

          // Step 4: Update session aggregates
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

        if (playerSessionsAdded > 0) {
          playersSynced++;
          totalSessionsAdded += playerSessionsAdded;
          totalSwingsAdded += playerSwingsAdded;
          console.log(`[dk-auto-sync] Player ${player.name}: +${playerSessionsAdded} sessions, +${playerSwingsAdded} swings`);
        }
      } catch (playerErr: any) {
        const msg = `Player ${player.name}: ${playerErr.message}`;
        console.error(`[dk-auto-sync] ${msg}`);
        errors.push(msg);
      }
    }

    const result = {
      success: true,
      players_synced: playersSynced,
      sessions_added: totalSessionsAdded,
      swings_added: totalSwingsAdded,
      errors,
    };
    console.log("[dk-auto-sync] Complete:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[dk-auto-sync] Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

async function getCachedToken(supabase: any): Promise<string> {
  const { data: cached } = await supabase
    .from("dk_token_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > new Date()) {
    console.log("[dk-auto-sync] Using cached token");
    return cached.access_token;
  }

  console.log("[dk-auto-sync] Fetching fresh DK token");
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

  console.log("[dk-auto-sync] Token cached, expires:", expiresAt);
  return tokenData.access_token;
}

async function dkFetch(endpoint: string, token: string): Promise<any> {
  const url = `${DK_API_BASE}${endpoint}`;
  console.log(`[dk-auto-sync] GET ${url}`);
  
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
