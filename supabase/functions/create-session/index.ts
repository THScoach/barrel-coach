import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { productType, player, environment } = body;

    // Validate required fields
    if (!productType || !player || !environment) {
      throw new Error("Missing required fields: productType, player, environment");
    }

    const swingsRequired = productType === "complete_review" ? 5 : 1;
    const priceCents = productType === "complete_review" ? 9700 : 3700;

    // Create session in database
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        product_type: productType,
        price_cents: priceCents,
        player_name: player.name,
        player_age: player.age,
        player_email: player.email,
        player_level: player.level,
        environment: environment,
        swings_required: swingsRequired,
        status: "pending_upload",
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        swingsRequired,
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
