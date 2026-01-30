/**
 * Reboot Motion API Authentication Helper
 * Handles OAuth token retrieval and refresh
 */

const REBOOT_API_BASE = "https://api.rebootmotion.com";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Simple in-memory token cache (per function invocation)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid access token for Reboot Motion API
 * Handles initial auth and token refresh
 */
export async function getRebootAccessToken(): Promise<string> {
  // Check if we have a valid cached token (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME");
  const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD");

  if (!REBOOT_USERNAME || !REBOOT_PASSWORD) {
    throw new Error("Reboot credentials not configured. Set REBOOT_USERNAME and REBOOT_PASSWORD in Supabase secrets.");
  }

  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reboot auth failed (${response.status}): ${errorText}`);
  }

  const data: TokenResponse = await response.json();

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };

  return data.access_token;
}

/**
 * Make an authenticated request to Reboot Motion API
 */
export async function rebootFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getRebootAccessToken();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  const url = endpoint.startsWith("http") ? endpoint : `${REBOOT_API_BASE}${endpoint}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Standard CORS headers for edge functions
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message, success: false }, status);
}
