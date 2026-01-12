import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Create a new session for an EXISTING player (player portal flow).
 * Unlike create-session, this does NOT create new players - it attaches to existing.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the auth user from the JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create a client with the user's JWT to get their identity
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized: Could not get user");
    }

    const body = await req.json();
    const { productType = "complete_review", environment = "tee" } = body;

    // Look up the player by email
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, email, level, age, phone")
      .eq("email", user.email)
      .maybeSingle();

    if (playerError) {
      console.error("Player lookup error:", playerError);
      throw new Error(`Failed to find player: ${playerError.message}`);
    }

    if (!player) {
      throw new Error("No player profile found for this account. Contact Coach Rick.");
    }

    /**
     * Swing Requirements by Product:
     * 
     * free_diagnostic: 1 swing only (teaser report, locked insights)
     * single_swing: Exactly 1 swing ($37, full 4B report)
     * complete_review: 5-15 swings ($37, full 4B report + consistency)
     * membership: 5-15 swings ($99/month ongoing coaching)
     */
    let swingsRequired: number;
    let swingsMaxAllowed: number;
    let priceCents: number;

    switch (productType) {
      case "free_diagnostic":
        swingsRequired = 1;
        swingsMaxAllowed = 1;
        priceCents = 0;
        break;
      case "single_swing":
        swingsRequired = 1;
        swingsMaxAllowed = 1;
        priceCents = 3700;
        break;
      case "complete_review":
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 3700;
        break;
      case "membership":
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 9900;
        break;
      default:
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 3700;
    }

    // Create session attached to the existing player
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        product_type: productType,
        price_cents: priceCents,
        player_id: player.id, // ATTACH TO EXISTING PLAYER
        player_name: player.name,
        player_email: player.email,
        player_phone: player.phone,
        player_age: player.age || 16,
        player_level: player.level || "hs_varsity",
        environment: environment,
        swings_required: swingsRequired,
        swings_max_allowed: swingsMaxAllowed,
        status: "pending_upload",
        user_id: user.id, // Link to auth user
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    console.log(`Created session ${session.id} for player ${player.id} (${player.name})`);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        playerId: player.id,
        playerName: player.name,
        swingsRequired,
        swingsMaxAllowed,
        status: session.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
