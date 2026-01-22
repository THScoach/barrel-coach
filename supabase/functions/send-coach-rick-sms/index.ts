// ============================================================
// DISABLED: Direct Twilio SMS sending for Coach Rick messages
// Reason: Toll-free number verification issues (Error 30032)
// All SMS communications now handled via GoHighLevel Workflows
// See: sync-to-ghl function for contact/score syncing
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, player_id, custom_context } = await req.json();
    
    console.log(`[send-coach-rick-sms] DISABLED - Redirecting to GHL sync for player ${player_id}`);
    
    // Instead of sending SMS directly, sync to GHL which will trigger workflow
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Trigger GHL sync instead of direct SMS
    const GHL_WEBHOOK_URL = Deno.env.get("GHL_WEBHOOK_URL");
    
    if (GHL_WEBHOOK_URL && player_id) {
      // Fetch player data
      const { data: player } = await supabase
        .from("players")
        .select("id, name, email, phone, composite_brain, composite_body, composite_bat, composite_ball, motor_profile")
        .eq("id", player_id)
        .single();

      if (player) {
        // Send to GHL webhook - this will trigger GHL workflow for SMS
        await fetch(GHL_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "coach_rick_message",
            trigger_type: type,
            player_id: player.id,
            email: player.email,
            phone: player.phone,
            firstName: player.name?.split(" ")[0] || "",
            context: custom_context,
            scores: {
              brain: player.composite_brain,
              body: player.composite_body,
              bat: player.composite_bat,
              ball: player.composite_ball,
            },
            archetype: player.motor_profile,
            timestamp: new Date().toISOString(),
          }),
        });

        console.log("[send-coach-rick-sms] Synced to GHL for workflow trigger");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        disabled: true,
        redirected_to: "ghl_workflow",
        reason: "Direct SMS sending disabled. Twilio toll-free verification issues (Error 30032).",
        migration: "Coach Rick SMS now triggered via GoHighLevel Workflows after contact sync.",
        action: "GHL webhook called - workflow will handle SMS delivery.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[send-coach-rick-sms] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        disabled: true,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});

/* ORIGINAL IMPLEMENTATION - PRESERVED FOR REFERENCE
interface SendRequest {
  type: "analysis_complete" | "reply" | "check_in" | "drill_reminder" | "custom";
  player_id: string;
  incoming_message?: string;
  custom_context?: string;
  session_id?: string;
  skip_ai?: boolean;
  custom_message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, player_id, incoming_message, custom_context, session_id, skip_ai, custom_message }: SendRequest = await req.json();

    if (!player_id) {
      throw new Error("player_id is required");
    }

    console.log(`[Send Coach Rick SMS] Processing ${type} for player ${player_id}`);

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, phone, sms_opt_in")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${player_id}`);
    }

    if (!player.phone) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_phone" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (player.sms_opt_in === false) {
      return new Response(
        JSON.stringify({ success: false, reason: "opted_out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let messageBody: string;
    
    if (skip_ai && custom_message) {
      messageBody = custom_message;
    } else {
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke("coach-rick-sms", {
        body: { type, player_id, incoming_message, custom_context, session_id }
      });

      if (aiError || !aiResponse?.success) {
        throw new Error(aiResponse?.error || "Failed to generate AI message");
      }

      messageBody = aiResponse.message;
    }

    if (!messageBody) {
      throw new Error("No message to send");
    }

    let formattedPhone = player.phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = "+1" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

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
        Body: messageBody,
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      throw new Error(twilioData.message || "Failed to send SMS");
    }

    await supabase.from("messages").insert({
      player_id: player_id,
      phone_number: formattedPhone,
      direction: "outbound",
      body: messageBody,
      twilio_sid: twilioData.sid,
      status: twilioData.status || "sent",
      trigger_type: type,
      ai_generated: !skip_ai,
    });

    await supabase.from("sms_logs").insert({
      session_id: session_id || null,
      phone_number: formattedPhone,
      trigger_name: `coach_rick_${type}`,
      message_sent: messageBody,
      twilio_sid: twilioData.sid,
      status: "sent",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: twilioData.sid,
        message: messageBody,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
*/
