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

// Helper to call SMS functions
async function callSmsFunction(functionName: string, body: object) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${functionName}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    console.log(`${functionName} result:`, result);
    return result;
  } catch (error) {
    console.error(`${functionName} error:`, error);
    return null;
  }
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  // SECURITY: Reject requests without signature header
  if (!signature) {
    console.error("Missing stripe-signature header");
    return new Response("Forbidden", { status: 403 });
  }

  // SECURITY: Reject if webhook secret not configured
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured - rejecting webhook");
    return new Response("Webhook not configured", { status: 500 });
  }

  try {
    const body = await req.text();
    
    // Always verify signature - no fallback allowed
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log("Verified event:", event.type);

    if (event.type === "checkout.session.completed") {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const sessionId = checkoutSession.metadata?.session_id;
      const priceType = checkoutSession.metadata?.price_type;
      const customerEmail = checkoutSession.customer_details?.email;
      const stripeCustomerId = checkoutSession.customer as string | null;
      const stripeSubscriptionId = checkoutSession.subscription as string | null;

      // === SUBSCRIPTION CHECKOUT (has price_type, no session_id) ===
      if (priceType && customerEmail) {
        console.log("Subscription checkout completed:", { priceType, customerEmail });

        // 1. Create or get auth user
        const { data: createUserData, error: createUserError } = await supabase.auth.admin.createUser({
          email: customerEmail,
          email_confirm: true,
          user_metadata: { subscription_tier: priceType },
        });

        if (createUserError && !createUserError.message?.includes("already been registered")) {
          console.error("Failed to create user:", createUserError);
        } else {
          console.log("User created/exists:", createUserData?.user?.id || "existing");
        }

        // 2. Upsert player record
        const { error: upsertError } = await supabase
          .from("players")
          .upsert(
            {
              email: customerEmail,
              name: customerEmail.split("@")[0],
              subscription_tier: priceType,
              subscription_status: "active",
              stripe_customer_id: stripeCustomerId,
              stripe_subscription_id: stripeSubscriptionId,
            },
            { onConflict: "email" }
          );

        if (upsertError) {
          console.error("Failed to upsert player:", upsertError);
        } else {
          console.log("Player upserted successfully");
        }

        // 3. Generate magic link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: customerEmail,
        });

        if (linkError) {
          console.error("Failed to generate magic link:", linkError);
        } else {
          console.log("Magic link generated:", linkData?.properties?.action_link ? "success" : "no link");
        }
      }

      // === ONE-TIME PAYMENT CHECKOUT (has session_id) ===
      if (sessionId) {
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

        // === SMS WORKFLOW: PURCHASE COMPLETE ===
        // Send immediate purchase confirmation SMS
        await callSmsFunction("send-sms", {
          sessionId,
          triggerName: "purchase_complete",
          useTemplate: true,
        });

        // Schedule follow-up reminders
        await callSmsFunction("schedule-sms", {
          sessionId,
          triggerName: "no_upload_reminder",
        });

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
