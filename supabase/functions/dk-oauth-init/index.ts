import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Diamond Kinetics OAuth configuration
// Note: These would be provided by DK when you register as a developer partner
const DK_CLIENT_ID = Deno.env.get("DK_CLIENT_ID") || "catching-barrels-app";
const DK_AUTH_URL = "https://api.diamondkinetics.com/oauth/authorize"; // Placeholder URL
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dk-oauth-callback`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { player_id } = await req.json();

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify player belongs to this user
    const { data: player, error: playerError } = await supabaseClient
      .from("players")
      .select("id, email")
      .eq("id", player_id)
      .eq("email", user.email)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: "Player not found or unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a secure state parameter to prevent CSRF
    const state = crypto.randomUUID();

    // Store the state temporarily for validation during callback
    // Using a simple approach with the player_id encoded
    const stateData = {
      player_id,
      user_id: user.id,
      timestamp: Date.now(),
    };

    // Store state in a temporary table or use a different mechanism
    // For now, we'll encode it in the state parameter (base64)
    const encodedState = btoa(JSON.stringify(stateData));

    // Build the authorization URL
    const authorizationUrl = new URL(DK_AUTH_URL);
    authorizationUrl.searchParams.set("client_id", DK_CLIENT_ID);
    authorizationUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", "read:swings read:sessions");
    authorizationUrl.searchParams.set("state", encodedState);

    console.log(`OAuth init for player ${player_id}, redirecting to DK`);

    return new Response(
      JSON.stringify({ 
        authorization_url: authorizationUrl.toString(),
        state: encodedState 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: unknown) {
    console.error("OAuth init error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
