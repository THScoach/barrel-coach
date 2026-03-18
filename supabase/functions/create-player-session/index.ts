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

    // Look up the player_profile by email (sessions.player_id FK references player_profiles)
    const { data: profile, error: profileError } = await supabase
      .from("player_profiles")
      .select("id, first_name, last_name, email, level, age, phone")
      .eq("email", user.email)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      throw new Error(`Failed to find player: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error("No player profile found for this account. Contact Coach Rick.");
    }

    /**
     * Swing Requirements by Product:
     * 
     * free_diagnostic: 1 swing only (teaser report, locked insights) - $0
     * academy: 5-15 swings per session ($99/month ongoing coaching)
     * private_coaching: 5-15 swings per session ($199/month 1-on-1 coaching)
     * 
     * Legacy products (complete_review) redirect to academy pricing.
     */
    let swingsRequired: number;
    let swingsMaxAllowed: number;
    let priceCents: number;

    switch (productType) {
      case "free_diagnostic":
        // Free teaser - single swing only
        swingsRequired = 1;
        swingsMaxAllowed = 1;
        priceCents = 0;
        break;
      case "academy":
      case "complete_review": // Legacy, now treated as academy
        // $99/month Academy - 5-15 swings per session
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 0; // Sessions included with membership
        break;
      case "private_coaching":
      case "membership": // Legacy, now treated as private_coaching
        // $199/month Private Coaching - 5-15 swings per session
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 0; // Sessions included with membership
        break;
      default:
        // Default to academy specs
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 0;
    }

    // Map product types to DB-allowed values (constraint: single_swing, complete_review)
    const dbProductType = productType === "free_diagnostic" || productType === "single_swing" 
      ? "single_swing" 
      : "complete_review";

    const playerName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown";

    // Create session attached to the existing player profile
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        product_type: dbProductType,
        price_cents: priceCents,
        player_id: profile.id, // FK references player_profiles
        player_name: playerName,
        player_email: profile.email,
        player_phone: profile.phone,
        player_age: Math.max(5, Math.min(50, profile.age || 16)),
        player_level: profile.level || "hs_varsity",
        environment: environment,
        swings_required: swingsRequired,
        swings_max_allowed: swingsMaxAllowed,
        status: "pending_upload",
        user_id: user.id,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    console.log(`Created session ${session.id} for profile ${profile.id} (${playerName})`);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        playerId: profile.id,
        playerName: playerName,
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
