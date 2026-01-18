import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Stripe Price IDs - Product Offerings
 * 
 * academy: $99/month for ongoing coaching
 *   - Weekly AI-guided check-ins
 *   - Ongoing data uploads
 *   - Trend tracking & benchmarks
 * 
 * private_coaching: $199/month for VIP access
 *   - Direct access to Coach Rick
 *   - 1-on-1 video feedback
 *   - Priority support
 */
const PRICES = {
  academy: "price_1Sou5UA7XlInXgw8BnazjWmP", // $99/mo - The Academy
  private_coaching: "price_1SqbzkA7XlInXgw8apXlotOs", // $199/mo - Private Coaching
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    // Fetch session details
    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      throw new Error("Session not found");
    }

    // Verify all videos are uploaded
    const { data: swings, error: swingsError } = await supabase
      .from("swings")
      .select("*")
      .eq("session_id", sessionId);

    if (swingsError) {
      throw new Error("Failed to fetch swings");
    }

    if (!swings || swings.length < session.swings_required) {
      throw new Error(
        `Please upload all ${session.swings_required} swing(s) before checkout`
      );
    }

    // Get the correct price ID
    const priceId = PRICES[session.product_type as keyof typeof PRICES];
    if (!priceId) {
      throw new Error("Invalid product type");
    }

    // Check if customer already exists
    const customers = await stripe.customers.list({
      email: session.player_email,
      limit: 1,
    });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://lovable.dev";

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : session.player_email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/analyze/processing?session_id=${sessionId}`,
      cancel_url: `${origin}/analyze?step=upload&session_id=${sessionId}`,
      metadata: {
        session_id: sessionId,
        player_name: session.player_name,
        product_type: session.product_type,
      },
    });

    // Update session with Stripe checkout ID
    await supabase
      .from("sessions")
      .update({
        stripe_checkout_session_id: checkoutSession.id,
        status: "pending_payment",
      })
      .eq("id", sessionId);

    return new Response(
      JSON.stringify({ url: checkoutSession.url }),
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
