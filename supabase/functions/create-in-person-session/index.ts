import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (!roleData) throw new Error("Admin access required");

    const body = await req.json();
    const {
      first_name,
      last_name,
      email,
      phone,
      product_type,
      price_cents,
      payment_option,
      payment_method,
      player_notes,
    } = body;

    if (!first_name || !phone) {
      throw new Error("First name and phone are required");
    }

    // Determine status based on payment option
    let status = 'pending_payment';
    if (payment_option === 'already_paid') {
      status = 'paid';
    }

    // Create the session
    const playerName = last_name ? `${first_name} ${last_name}` : first_name;
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .insert({
        player_name: playerName,
        player_email: email || `${phone}@inperson.local`,
        player_phone: phone,
        player_age: 0, // Not collected for in-person
        player_level: 'unknown',
        environment: 'in_person',
        product_type,
        price_cents,
        status,
        is_in_person: true,
        payment_method: payment_option === 'already_paid' ? payment_method : null,
        player_notes,
        created_by: user.id,
        swings_required: 1,
        paid_at: payment_option === 'already_paid' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    let paymentLinkUrl = null;

    // Generate Stripe payment link if requested
    if (payment_option === 'send_link') {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) throw new Error("Stripe not configured");

      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      const origin = req.headers.get("origin") || "https://catchingbarrels.io";

      // Create a price for the custom amount
      const price = await stripe.prices.create({
        unit_amount: price_cents,
        currency: 'usd',
        product_data: {
          name: `Swing Assessment - ${playerName}`,
        },
      });

      // Create payment link
      const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: {
          session_id: session.id,
          player_name: playerName,
          player_phone: phone,
        },
        after_completion: {
          type: 'redirect',
          redirect: { url: `${origin}/upload/${session.id}?paid=true` },
        },
        payment_method_types: ['card', 'cashapp', 'link'],
      });

      paymentLinkUrl = paymentLink.url;

      // Update session with payment link
      await supabaseAdmin
        .from("sessions")
        .update({
          payment_link_id: paymentLink.id,
          payment_link_url: paymentLinkUrl,
        })
        .eq("id", session.id);

      // Send SMS with payment link
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (twilioSid && twilioToken && twilioPhone) {
        const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
        const messageBody = `Hey ${first_name}! Here's your payment link for your Swing Assessment with Coach Rick:\n\n${paymentLinkUrl}\n\nPay with card, Apple Pay, Google Pay, or Cash App.`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const twilioAuth = btoa(`${twilioSid}:${twilioToken}`);

        await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: twilioPhone,
            Body: messageBody,
          }),
        });

        // Log the SMS
        await supabaseAdmin.from("sms_logs").insert({
          session_id: session.id,
          phone_number: formattedPhone,
          trigger_name: 'payment_link',
          message_sent: messageBody,
          status: 'sent',
        });
      }
    }

    return new Response(
      JSON.stringify({
        session_id: session.id,
        payment_link_url: paymentLinkUrl,
        redirect_url: `/admin/analyzer`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
