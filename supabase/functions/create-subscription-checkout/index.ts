import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Subscription Price IDs
 */
const SUBSCRIPTION_PRICES = {
  academy: "price_1Sou5UA7XlInXgw8BnazjWmP", // $99/mo - The Academy
  "inner-circle": "price_1SqbzkA7XlInXgw8apXlotOs", // $199/mo - Private Coaching (using existing price, update if different)
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { priceType, email } = await req.json();
    logStep("Request parsed", { priceType, email });

    // Get the correct price ID
    const priceId = SUBSCRIPTION_PRICES[priceType as keyof typeof SUBSCRIPTION_PRICES];
    if (!priceId) {
      throw new Error(`Invalid price type: ${priceType}`);
    }
    logStep("Price ID resolved", { priceId });

    // Try to get authenticated user first
    let userEmail = email;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      if (data.user?.email) {
        userEmail = data.user.email;
        logStep("Got user email from auth", { email: userEmail });
      }
    }

    // Check if customer already exists
    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Found existing customer", { customerId });
      }
    }

    const origin = req.headers.get("origin") || "https://barrel-coach.lovable.app";

    // Create Stripe checkout session for subscription
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/player?subscription=success`,
      cancel_url: `${origin}/?subscription=cancelled`,
      metadata: {
        price_type: priceType,
      },
      allow_promotion_codes: true,
    });

    logStep("Checkout session created", { sessionId: checkoutSession.id });

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
