import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    
    let event: Stripe.Event;
    
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
      console.warn("Warning: Processing webhook without signature verification");
    }

    console.log("Received event:", event.type);

    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const sessionId = checkoutSession.metadata?.session_id;

      if (!sessionId) {
        console.error("No session_id in checkout metadata");
        return new Response("Missing session_id", { status: 400 });
      }

      console.log("Payment completed for session:", sessionId);

      // Update session status to paid
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          status: "paid",
          stripe_payment_intent_id: checkoutSession.payment_intent as string,
          paid_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (updateError) {
        console.error("Failed to update session:", updateError);
        return new Response("Failed to update session", { status: 500 });
      }

      // Trigger analysis
      const analyzeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-swings`;
      const response = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        console.error("Failed to trigger analysis:", await response.text());
      } else {
        console.log("Analysis triggered successfully");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }
});
