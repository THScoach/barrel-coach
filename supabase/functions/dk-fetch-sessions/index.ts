// ============================================================================
// DIAMOND KINETICS SESSION FETCH EDGE FUNCTION
// Pulls batting sessions and swings from DK API using stored OAuth tokens
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DK_API_BASE = "https://api.diamondkinetics.com";
const DK_CLIENT_ID = Deno.env.get("DK_CLIENT_ID") || "";
const DK_CLIENT_SECRET = Deno.env.get("DK_CLIENT_SECRET") || "";

// Types
interface DKSession {
  uuid: string;
  created: string;
  lastUpdated: string;
  deleted: boolean;
  swings?: {
    countTotal: number;
    countViewable: number;
  };
}

interface DKSwing {
  uuid: string;
  created: string;
  lastUpdated: string;
  maxBarrelSpeed: number | null;
  maxHandSpeed: number | null;
  approachAngle: number | null;
  triggerToImpact: number | null;
  speedEfficiency: number | null;
  handCastDistance: number | null;
  distanceInZone: number | null;
  impactMomentum: number | null;
  appliedPower: number | null;
  swingPlaneHeadingAngle: number | null;
  swingPlaneTiltAngle: number | null;
  impactLocationX: number | null;
  impactLocationY: number | null;
  maxAcceleration: number | null;
}

interface DKTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { player_id, since_date, force_full_sync } = body;

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DK Fetch] Starting sync for player ${player_id}`);

    // Get DK account for player
    const { data: dkAccount, error: accountError } = await supabase
      .from("dk_accounts")
      .select("*")
      .eq("player_id", player_id)
      .single();

    if (accountError || !dkAccount) {
      return new Response(
        JSON.stringify({ error: "No Diamond Kinetics account linked", needsAuth: true }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!dkAccount.sync_enabled) {
      return new Response(
        JSON.stringify({ error: "Sync is disabled for this account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = dkAccount.access_token;

    // Check if token needs refresh
    if (dkAccount.token_expires_at) {
      const expiresAt = new Date(dkAccount.token_expires_at);
      const now = new Date();
      const bufferMinutes = 5;
      
      if (expiresAt.getTime() - now.getTime() < bufferMinutes * 60 * 1000) {
        console.log("[DK Fetch] Token expiring soon, refreshing...");
        
        try {
          const refreshed = await refreshToken(dkAccount.refresh_token);
          accessToken = refreshed.access_token;

          // Update tokens in database
          await supabase
            .from("dk_accounts")
            .update({
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token || dkAccount.refresh_token,
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", dkAccount.id);

          console.log("[DK Fetch] Token refreshed successfully");
        } catch (refreshError) {
          console.error("[DK Fetch] Token refresh failed:", refreshError);
          return new Response(
            JSON.stringify({ error: "Token refresh failed - please reconnect", needsReauth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Determine sync window
    let sinceParam = since_date;
    if (!sinceParam && !force_full_sync && dkAccount.last_sync_at) {
      sinceParam = dkAccount.last_sync_at;
    }

    // Fetch sessions from DK API
    console.log(`[DK Fetch] Fetching sessions${sinceParam ? ` since ${sinceParam}` : " (full sync)"}`);
    
    const sessions = await fetchDKSessions(accessToken, dkAccount.dk_user_id, sinceParam);
    console.log(`[DK Fetch] Found ${sessions.length} sessions to process`);

    let totalSwingsImported = 0;
    let sessionsProcessed = 0;
    const errors: string[] = [];

    // Process each session
    for (const dkSession of sessions) {
      try {
        // Skip deleted sessions
        if (dkSession.deleted) continue;

        // Check if session already exists
        const { data: existingSession } = await supabase
          .from("sensor_sessions")
          .select("id, synced_at")
          .eq("dk_session_id", dkSession.uuid)
          .eq("player_id", player_id)
          .single();

        let sessionId: string;

        if (existingSession) {
          // Check if we need to update
          const existingSync = new Date(existingSession.synced_at || 0);
          const dkUpdated = new Date(dkSession.lastUpdated);
          
          if (dkUpdated <= existingSync && !force_full_sync) {
            console.log(`[DK Fetch] Session ${dkSession.uuid} already up to date, skipping`);
            continue;
          }
          
          sessionId = existingSession.id;
        } else {
          // Create new session
          const { data: newSession, error: insertError } = await supabase
            .from("sensor_sessions")
            .insert({
              player_id,
              dk_session_id: dkSession.uuid,
              session_date: dkSession.created.split("T")[0],
              source: "diamond_kinetics",
              status: "syncing",
              created_at: dkSession.created,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error(`[DK Fetch] Failed to create session:`, insertError);
            errors.push(`Session ${dkSession.uuid}: ${insertError.message}`);
            continue;
          }

          sessionId = newSession.id;
        }

        // Fetch swings for this session
        const swings = await fetchDKSwings(accessToken, dkSession.uuid);
        console.log(`[DK Fetch] Session ${dkSession.uuid}: ${swings.length} swings`);

        // Prepare swings for insert
        const swingsToInsert = swings
          .filter(s => s.maxBarrelSpeed !== null && s.maxBarrelSpeed >= 25) // Filter waggles
          .map((swing, index) => ({
            player_id,
            session_id: sessionId,
            dk_swing_id: swing.uuid,
            occurred_at: swing.created,
            swing_number: index,
            
            bat_speed_mph: swing.maxBarrelSpeed ? Math.round(swing.maxBarrelSpeed * 10) / 10 : null,
            hand_speed_mph: swing.maxHandSpeed ? Math.round(swing.maxHandSpeed * 10) / 10 : null,
            trigger_to_impact_ms: swing.triggerToImpact ? Math.round(swing.triggerToImpact) : null,
            attack_angle_deg: swing.approachAngle ? Math.round(swing.approachAngle * 10) / 10 : null,
            attack_direction_deg: swing.swingPlaneHeadingAngle ? Math.round(swing.swingPlaneHeadingAngle * 10) / 10 : null,
            swing_plane_tilt_deg: swing.swingPlaneTiltAngle ? Math.round(swing.swingPlaneTiltAngle * 10) / 10 : null,
            
            impact_location_x: swing.impactLocationX,
            impact_location_y: swing.impactLocationY,
            
            applied_power: swing.appliedPower ? Math.round(swing.appliedPower * 10) / 10 : null,
            max_acceleration: swing.maxAcceleration ? Math.round(swing.maxAcceleration * 10) / 10 : null,
            
            hand_to_bat_ratio: swing.maxBarrelSpeed && swing.maxHandSpeed && swing.maxBarrelSpeed > 0
              ? Math.round((swing.maxHandSpeed / swing.maxBarrelSpeed) * 100) / 100
              : null,
            
            is_valid: true,
            
            raw_dk_data: {
              data: swing,
              meta: {
                synced_at: new Date().toISOString(),
                source: "dk_fetch_sessions",
              },
            },
          }));

        if (swingsToInsert.length > 0) {
          // Delete existing swings for this session (to handle updates)
          await supabase
            .from("sensor_swings")
            .delete()
            .eq("session_id", sessionId);

          // Insert new swings
          const { error: swingsError } = await supabase
            .from("sensor_swings")
            .insert(swingsToInsert);

          if (swingsError) {
            console.error(`[DK Fetch] Failed to insert swings:`, swingsError);
            errors.push(`Session ${dkSession.uuid} swings: ${swingsError.message}`);
          } else {
            totalSwingsImported += swingsToInsert.length;
          }
        }

        // Calculate session aggregates
        const batSpeeds = swingsToInsert.map(s => s.bat_speed_mph).filter((v): v is number => v !== null);
        const avgBatSpeed = batSpeeds.length > 0 
          ? Math.round((batSpeeds.reduce((a, b) => a + b, 0) / batSpeeds.length) * 10) / 10
          : null;

        // Update session status and aggregates
        await supabase
          .from("sensor_sessions")
          .update({
            status: "complete",
            total_swings: swingsToInsert.length,
            avg_bat_speed: avgBatSpeed,
            max_bat_speed: batSpeeds.length > 0 ? Math.max(...batSpeeds) : null,
            synced_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        sessionsProcessed++;
      } catch (sessionError) {
        const errorMsg = sessionError instanceof Error ? sessionError.message : "Unknown error";
        console.error(`[DK Fetch] Error processing session ${dkSession.uuid}:`, sessionError);
        errors.push(`Session ${dkSession.uuid}: ${errorMsg}`);
      }
    }

    // Update last sync timestamp
    await supabase
      .from("dk_accounts")
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", dkAccount.id);

    console.log(`[DK Fetch] Complete: ${sessionsProcessed} sessions, ${totalSwingsImported} swings imported`);

    return new Response(
      JSON.stringify({
        success: true,
        sessions_processed: sessionsProcessed,
        swings_imported: totalSwingsImported,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DK Fetch] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchDKSessions(
  accessToken: string,
  userId: string,
  since?: string
): Promise<DKSession[]> {
  const params = new URLSearchParams({
    deleted: "false",
    sort: "-created",
    perPage: "100",
  });
  
  if (since) {
    params.append("since", since);
  }

  const response = await fetch(
    `${DK_API_BASE}/v3/users/${userId}/battingSessions?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DK API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.sessions || [];
}

async function fetchDKSwings(
  accessToken: string,
  sessionUuid: string
): Promise<DKSwing[]> {
  const response = await fetch(
    `${DK_API_BASE}/v3/battingSessions/${sessionUuid}/swings`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DK API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.swings || [];
}

async function refreshToken(refreshToken: string | null): Promise<DKTokens> {
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch(`${DK_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: DK_CLIENT_ID,
      client_secret: DK_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  return response.json();
}
