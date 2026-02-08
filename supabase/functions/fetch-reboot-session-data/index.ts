import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  console.log("[fetch-reboot-session-data] Fetching new Reboot access token");

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

  const data: RebootTokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

async function verifyAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getUser(token);

  if (claimsError || !claimsData?.user) {
    throw new Error("Unauthorized");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return claimsData.user.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);

    const { reboot_session_id } = await req.json();

    if (!reboot_session_id) {
      return new Response(
        JSON.stringify({ error: "reboot_session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[fetch-reboot-session-data] Fetching data for session: ${reboot_session_id}`
    );

    const accessToken = await getRebootAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Fetch session metadata
    const sessionResponse = await fetch(
      `${REBOOT_API_BASE}/mocap-sessions/${reboot_session_id}`,
      { headers }
    );

    let sessionData = null;
    if (sessionResponse.ok) {
      sessionData = await sessionResponse.json();
      console.log(
        `[fetch-reboot-session-data] Session status: ${sessionData?.status}`
      );
    } else {
      console.warn(
        `[fetch-reboot-session-data] Session fetch failed: ${sessionResponse.status}`
      );
    }

    // Fetch movements (swings) in this session
    const movementsResponse = await fetch(
      `${REBOOT_API_BASE}/mocap-sessions/${reboot_session_id}/movements`,
      { headers }
    );

    let movements: any[] = [];
    if (movementsResponse.ok) {
      movements = await movementsResponse.json();
      console.log(
        `[fetch-reboot-session-data] Found ${movements.length} movements`
      );
    }

    // Fetch exports
    const exportsResponse = await fetch(
      `${REBOOT_API_BASE}/mocap-sessions/${reboot_session_id}/exports`,
      { headers }
    );

    let exports: any[] = [];
    if (exportsResponse.ok) {
      exports = await exportsResponse.json();
      console.log(
        `[fetch-reboot-session-data] Found ${exports.length} exports`
      );
    }

    console.log(`[fetch-reboot-session-data] ✅ Complete`);

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        movements,
        exports,
        movement_count: movements.length,
        session_status: sessionData?.status || "unknown",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[fetch-reboot-session-data] Error:", error);
    const status = error.message === "Unauthorized" || error.message === "Admin access required" ? 401 : 500;

    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch session data" }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
