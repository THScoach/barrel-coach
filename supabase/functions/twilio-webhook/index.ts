/**
 * Twilio Webhook Handler
 * 
 * Receives inbound SMS from players and:
 * 1. Handles opt-out/opt-in keywords (STOP/START)
 * 2. Logs messages to database
 * 3. Triggers AI-powered Coach Rick responses using Gemini with player's 4B scores context
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Check if message is an opt-out keyword
function isOptOut(message: string): boolean {
  const optOutKeywords = ["stop", "unsubscribe", "cancel", "quit", "end"];
  return optOutKeywords.includes(message.toLowerCase().trim());
}

// Generate Coach Rick AI response with player's 4B scores context
async function generateAIResponse(
  playerName: string,
  incomingMessage: string,
  scores: {
    brain: number | null;
    body: number | null;
    bat: number | null;
    ball: number | null;
    composite: number | null;
  },
  conversationHistory: { role: string; content: string }[],
  apiKey: string
): Promise<string> {
  const firstName = playerName?.split(" ")[0] || "there";
  
  const systemPrompt = `You are Coach Rick, the "Swing Rehab Coach" at Catching Barrels. You're having an SMS conversation with ${firstName}.

Their current 4B scores (20-80 MLB Scout Scale):
- BRAIN: ${scores.brain ?? "Not measured"} (decision-making, timing)
- BODY: ${scores.body ?? "Not measured"} (mechanics, rotation)
- BAT: ${scores.bat ?? "Not measured"} (bat speed, path)
- BALL: ${scores.ball ?? "Not measured"} (exit velo, contact)
- COMPOSITE: ${scores.composite ?? "Not measured"}

Score Context:
- 70+: Plus-Plus (elite)
- 60-69: Plus (above avg)
- 50-59: Average
- 40-49: Below average
- Below 40: Needs work

Conversation Rules:
1. Keep responses SHORT - this is texting, not email (2-3 sentences max)
2. Be encouraging but real - reference their actual scores when relevant
3. Use baseball slang naturally (barrel, rip, zone, oppo, etc.)
4. Sound like a cool older brother who played college ball
5. If they mention a problem, relate it to their 4B scores and suggest specific fixes
6. Don't be preachy - be conversational and supportive
7. Use emojis sparingly but naturally 💪
8. If they ask about drills, tell them to check their "locker" in the app

Remember: You're their coach via text. Keep it short, personal, and actionable.`;

  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-6), // Keep last 6 messages for context
          { role: "user", content: incomingMessage },
        ],
        max_tokens: 150, // Short responses for SMS
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Twilio Webhook] AI error:", errorText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "Got your message! 💪 Check your locker for your next drill.";
  } catch (error) {
    console.error("[Twilio Webhook] AI error:", error);
    return "Thanks for the message! Let me think on that. Check your locker for your latest drills 🎯";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    
    // Check if this is a status callback (delivery receipt)
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    
    // Handle status callback updates
    if (messageStatus && messageSid && !formData.get("Body")) {
      console.log("[Twilio Webhook] Status update:", messageSid, "->", messageStatus);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Update message status in database
      const { error } = await supabase
        .from("messages")
        .update({ 
          status: messageStatus,
          updated_at: new Date().toISOString()
        })
        .eq("twilio_sid", messageSid);
      
      if (error) {
        console.error("[Twilio Webhook] Failed to update status:", error);
      } else {
        console.log("[Twilio Webhook] Status updated successfully");
      }
      
      // Also update sms_logs for consistency
      await supabase
        .from("sms_logs")
        .update({ status: messageStatus })
        .eq("twilio_sid", messageSid);
      
      return new Response("OK", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
        status: 200,
      });
    }
    
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;

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
    await supabase.from("messages").insert({
      player_id: playerId,
      session_id: session?.id || null,
      phone_number: from,
      direction: "inbound",
      body: body,
      twilio_sid: messageSid,
      status: "received",
      trigger_type: "reply",
    });

    // If we found a player, generate AI reply with their 4B scores
    if (playerId) {
      console.log("[Twilio Webhook] Generating AI reply for player:", playerId);
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (!LOVABLE_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.error("[Twilio Webhook] Missing credentials for AI reply");
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Get player info with 4B scores
      const { data: player } = await supabase
        .from("players")
        .select("id, name, phone, latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score, latest_composite_score")
        .eq("id", playerId)
        .single();

      if (!player) {
        console.error("[Twilio Webhook] Player not found after ID lookup");
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Get recent conversation history for context
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("direction, body")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(10);

      const conversationHistory = (recentMessages || [])
        .reverse()
        .map(msg => ({
          role: msg.direction === "inbound" ? "user" : "assistant",
          content: msg.body || "",
        }));

      // Generate AI response with player's 4B scores context
      const aiReply = await generateAIResponse(
        player.name || "there",
        body,
        {
          brain: player.latest_brain_score,
          body: player.latest_body_score,
          bat: player.latest_bat_score,
          ball: player.latest_ball_score,
          composite: player.latest_composite_score,
        },
        conversationHistory,
        LOVABLE_API_KEY
      );

      console.log("[Twilio Webhook] AI reply:", aiReply.slice(0, 50) + "...");

      // Format phone
      let formattedPhone = from.replace(/\D/g, "");
      if (formattedPhone.length === 10) {
        formattedPhone = "+1" + formattedPhone;
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + formattedPhone;
      }

      // Send AI reply via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

      const twilioResponse = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: TWILIO_PHONE_NUMBER,
          Body: aiReply,
        }),
      });

      const twilioData = await twilioResponse.json();

      if (twilioResponse.ok) {
        console.log("[Twilio Webhook] AI reply sent:", twilioData.sid);

        // Log outbound message
        await supabase.from("messages").insert({
          player_id: playerId,
          session_id: session?.id || null,
          phone_number: formattedPhone,
          direction: "outbound",
          body: aiReply,
          twilio_sid: twilioData.sid,
          status: "sent",
          trigger_type: "ai_reply",
          ai_generated: true,
        });

        // Log to sms_logs
        await supabase.from("sms_logs").insert({
          session_id: session?.id || null,
          phone_number: formattedPhone,
          trigger_name: "ai_conversation",
          message_sent: aiReply,
          twilio_sid: twilioData.sid,
          status: "sent",
        });
      } else {
        console.error("[Twilio Webhook] Failed to send AI reply:", twilioData);
      }
    } else {
      console.log("[Twilio Webhook] No player found for phone:", from);
    }

    // Return empty TwiML - we've already sent the reply via API
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
