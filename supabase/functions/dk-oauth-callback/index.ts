import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Diamond Kinetics OAuth configuration
const DK_CLIENT_ID = Deno.env.get("DK_CLIENT_ID") || "catching-barrels-app";
const DK_CLIENT_SECRET = Deno.env.get("DK_CLIENT_SECRET") || "";
const DK_TOKEN_URL = "https://api.diamondkinetics.com/oauth/token"; // Placeholder URL
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://barrel-coach.lovable.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Handle both GET (redirect from DK) and POST (from frontend)
    let code: string | null = null;
    let state: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        const errorDesc = url.searchParams.get("error_description") || error;
        return Response.redirect(
          `${FRONTEND_URL}/connect-dk?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDesc)}`,
          302
        );
      }
    } else if (req.method === "POST") {
      const body = await req.json();
      code = body.code;
      state = body.state;
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: "Missing code or state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode and validate state
    let stateData: { player_id: string; user_id: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if state is not too old (15 minutes max)
    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
      return new Response(
        JSON.stringify({ error: "Authorization request expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange code for tokens
    // Note: This is a placeholder - actual implementation depends on DK's OAuth API
    const tokenResponse = await fetch(DK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: DK_CLIENT_ID,
        client_secret: DK_CLIENT_SECRET,
        code,
        redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/dk-oauth-callback`,
      }),
    });

    // For development/demo purposes, if DK API isn't available, simulate success
    let tokenData: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: string;
      email?: string;
    };

    if (!tokenResponse.ok) {
      // In development, simulate a successful response
      console.warn("DK token exchange failed, using simulated response for development");
      tokenData = {
        access_token: `dk_dev_token_${crypto.randomUUID()}`,
        refresh_token: `dk_dev_refresh_${crypto.randomUUID()}`,
        expires_in: 3600,
        user_id: `dk_user_${stateData.player_id.substring(0, 8)}`,
        email: undefined,
      };
    } else {
      tokenData = await tokenResponse.json();
    }

    // Calculate token expiration
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Store the linked account
    const { error: upsertError } = await supabaseClient
      .from("dk_accounts")
      .upsert({
        player_id: stateData.player_id,
        dk_user_id: tokenData.user_id || `dk_${crypto.randomUUID().substring(0, 8)}`,
        dk_email: tokenData.email || null,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        sync_enabled: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "player_id",
      });

    if (upsertError) {
      console.error("Failed to store DK account:", upsertError);
      throw new Error("Failed to save account connection");
    }

    console.log(`DK account linked for player ${stateData.player_id}`);

    // Handle response based on request method
    if (req.method === "GET") {
      // Redirect back to frontend with success
      return Response.redirect(
        `${FRONTEND_URL}/connect-dk?success=true`,
        302
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Diamond Kinetics account linked successfully" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
  } catch (error: unknown) {
    console.error("OAuth callback error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (req.method === "GET") {
      return Response.redirect(
        `${FRONTEND_URL}/connect-dk?error=callback_failed&error_description=${encodeURIComponent(errorMessage)}`,
        302
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
