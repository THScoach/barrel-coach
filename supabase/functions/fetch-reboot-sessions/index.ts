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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    await verifyAdmin(req);

    const { org_player_id } = await req.json();

    if (!org_player_id) {
      return new Response(
        JSON.stringify({ error: "org_player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fetch-reboot-sessions] Fetching sessions for player: "${org_player_id}"`);

    // Step 1: Fetch all sessions from the org using API key
    const sessionsUrl = `${REBOOT_API_BASE}/sessions?limit=50`;
    console.log(`[fetch-reboot-sessions] Fetching all sessions: ${sessionsUrl}`);
    
    const sessionsResponse = await fetch(sessionsUrl, {
      headers: {
        "X-Api-Key": REBOOT_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!sessionsResponse.ok) {
      const error = await sessionsResponse.text();
      throw new Error(`Reboot API error (${sessionsResponse.status}): ${error}`);
    }

    const allSessions = await sessionsResponse.json();
    console.log(`[fetch-reboot-sessions] Got ${Array.isArray(allSessions) ? allSessions.length : 'unknown'} total sessions`);

    // Step 2: Get OAuth token for data_export checks
    const accessToken = await getRebootAccessToken();

    // Step 3: Filter sessions that have data for this player
    // Only check "processed" sessions to save API calls
    const processedSessions = (Array.isArray(allSessions) ? allSessions : [])
      .filter((s: any) => s.status === "processed" && s.completed_movements > 0);
    
    console.log(`[fetch-reboot-sessions] Checking ${processedSessions.length} processed sessions for player data`);

    const playerSessions: any[] = [];
    
    // Check each processed session (limit to 10 for performance)
    const sessionsToCheck = processedSessions.slice(0, 15);
    
    for (const session of sessionsToCheck) {
      const hasData = await checkSessionHasPlayerData(session.id, org_player_id, accessToken);
      if (hasData) {
        playerSessions.push({
          id: session.id,
          session_date: session.session_date,
          name: session.session_name || `Session ${session.session_num || ''}`.trim() || null,
          created_at: session.created_at,
          status: session.status,
          movement_count: session.completed_movements || 0,
        });
        console.log(`[fetch-reboot-sessions] Session ${session.id} has data for player`);
      }
    }

    console.log(`[fetch-reboot-sessions] Found ${playerSessions.length} sessions with data for player ${org_player_id}`);

    return new Response(
      JSON.stringify({ sessions: playerSessions }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[fetch-reboot-sessions] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
