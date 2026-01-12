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

    // Validate product type - NO single_swing product exists
    const validProductTypes = ["free_diagnostic", "complete_review", "membership"];
    if (!validProductTypes.includes(productType)) {
      throw new Error(`Invalid product type: ${productType}. Must be one of: ${validProductTypes.join(", ")}`);
    }

    /**
     * Swing Requirements by Product:
     * 
     * free_diagnostic: 1 swing only (teaser report, locked insights) - $0
     * complete_review: 5-15 swings ($37, full 4B report + consistency analysis)
     * membership: 5-15 swings per session ($99/month ongoing coaching)
     * 
     * Note: There is NO single-swing $37 product. The $37 KRS Assessment
     * requires 5+ swings for proper consistency and pattern analysis.
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
      case "complete_review":
        // $37 KRS Assessment - requires 5+ swings for full analysis
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 3700;
        break;
      case "membership":
        // $99/month coaching - 5-15 swings per session
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 9900;
        break;
      default:
        // Default to complete_review specs
        swingsRequired = 5;
        swingsMaxAllowed = 15;
        priceCents = 3700;
    }

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
        swings_max_allowed: swingsMaxAllowed,
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
