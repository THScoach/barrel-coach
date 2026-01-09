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

    // Format phone number if provided
    let formattedPhone = null;
    if (player.phone) {
      formattedPhone = player.phone.replace(/\D/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '+1' + formattedPhone;
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }
    }

    // Create session in database
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        product_type: productType,
        price_cents: priceCents,
        player_name: player.name,
        player_age: player.age,
        player_email: player.email,
        player_phone: formattedPhone,
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

    // Send welcome SMS if phone provided
    if (formattedPhone) {
      try {
        const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
          const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
          
          // Get the base URL for the app
          const baseUrl = SUPABASE_URL?.replace('.supabase.co', '').replace('https://', '');
          const appUrl = `https://${baseUrl}.lovableproject.com`;
          
          const welcomeMessage = `Thanks for starting your swing analysis with Catching Barrels! 🔥\n\nUpload your swing here: ${appUrl}/analyze?session=${session.id}\n\n- Coach Rick`;

          const twilioResponse = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${credentials}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: formattedPhone,
              From: TWILIO_PHONE_NUMBER,
              Body: welcomeMessage,
            }),
          });

          if (twilioResponse.ok) {
            const twilioData = await twilioResponse.json();
            // Save to messages table
            await supabase.from("messages").insert({
              session_id: session.id,
              phone_number: formattedPhone,
              direction: "outbound",
              body: welcomeMessage,
              twilio_sid: twilioData.sid,
              status: "sent",
            });
          }
        }
      } catch (smsError) {
        console.error("SMS error (non-fatal):", smsError);
        // Don't throw - session was created successfully
      }
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
