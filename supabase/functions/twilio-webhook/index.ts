import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if message is an opt-out keyword
function isOptOut(message: string): boolean {
  const optOutKeywords = ["stop", "unsubscribe", "cancel", "quit", "end"];
  return optOutKeywords.includes(message.toLowerCase().trim());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    console.log("[Twilio Webhook] Received SMS from:", from, "Body:", body);

    if (!from || !body) {
      throw new Error("Missing required fields");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find player by phone number using our database function
    const { data: playerIdResult } = await supabase.rpc("find_player_by_phone", {
      phone_input: from,
    });
    
    const playerId = playerIdResult as string | null;
    console.log("[Twilio Webhook] Found player_id:", playerId);

    // Find session by phone number (legacy support)
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("player_phone", from)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check for opt-out
    if (isOptOut(body)) {
      console.log("[Twilio Webhook] Player opted out:", from);
      
      if (playerId) {
        await supabase
          .from("players")
          .update({ sms_opt_in: false })
          .eq("id", playerId);
      }
      
      // Save the opt-out message
      await supabase.from("messages").insert({
        player_id: playerId,
        session_id: session?.id || null,
        phone_number: from,
        direction: "inbound",
        body: body,
        twilio_sid: messageSid,
        status: "received",
        trigger_type: "opt_out",
      });

      // Return confirmation TwiML
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You've been unsubscribed from Coach Rick messages. Reply START to resubscribe.</Message></Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Check for opt-in (re-subscribe)
    if (body.toLowerCase().trim() === "start") {
      console.log("[Twilio Webhook] Player opted in:", from);
      
      if (playerId) {
        await supabase
          .from("players")
          .update({ sms_opt_in: true })
          .eq("id", playerId);
      }
      
      await supabase.from("messages").insert({
        player_id: playerId,
        session_id: session?.id || null,
        phone_number: from,
        direction: "inbound",
        body: body,
        twilio_sid: messageSid,
        status: "received",
        trigger_type: "opt_in",
      });

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Welcome back! You're now subscribed to Coach Rick messages. 💪</Message></Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Save inbound message
    const { error: dbError } = await supabase.from("messages").insert({
      player_id: playerId,
      session_id: session?.id || null,
      phone_number: from,
      direction: "inbound",
      body: body,
      twilio_sid: messageSid,
      status: "received",
      trigger_type: "reply",
    });

    if (dbError) {
      console.error("[Twilio Webhook] Database error:", dbError);
    }

    // If we found a player, generate AI reply
    if (playerId) {
      console.log("[Twilio Webhook] Triggering Coach Rick AI reply for player:", playerId);
      
      // Call the send-coach-rick-sms function to generate and send AI reply
      // Use EdgeRuntime.waitUntil pattern for async processing
      const sendReply = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("send-coach-rick-sms", {
            body: {
              type: "reply",
              player_id: playerId,
              incoming_message: body,
              session_id: session?.id,
            },
          });

          if (error) {
            console.error("[Twilio Webhook] Failed to send AI reply:", error);
          } else {
            console.log("[Twilio Webhook] AI reply sent:", data?.message?.slice(0, 50));
          }
        } catch (e) {
          console.error("[Twilio Webhook] Error sending AI reply:", e);
        }
      };

      // Fire and forget - don't wait for the AI reply
      // This ensures Twilio gets a response quickly
      sendReply();
    } else {
      console.log("[Twilio Webhook] No player found for phone:", from);
    }

    // Return empty TwiML - we're sending the reply async
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    
    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  } catch (error) {
    console.error("[Twilio Webhook] Error:", error);
    
    // Return empty TwiML on error to prevent Twilio retries
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  }
});
