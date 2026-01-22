// ============================================================
// IN-HOUSE SMS VIA TWILIO
// Direct Twilio integration - no GHL dependency
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Variable replacement for templates
function replaceVariables(template: string, session: any, appUrl: string): string {
  const firstName = session.player_name?.split(' ')[0] || 'there';
  return template
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{upload_link\}\}/g, `${appUrl}/analyze?session=${session.id}`)
    .replace(/\{\{results_link\}\}/g, `${appUrl}/analyze?session=${session.id}`)
    .replace(/\{\{upgrade_link\}\}/g, `${appUrl}/upgrade/${session.id}`);
}

// Format phone to E.164
function formatPhone(phone: string): string {
  let formatted = phone.replace(/\D/g, '');
  if (formatted.length === 10) {
    formatted = '+1' + formatted;
  } else if (!formatted.startsWith('+')) {
    formatted = '+' + formatted;
  }
  return formatted;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, body, sessionId, triggerName, useTemplate, player_id } = await req.json();
    
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("[send-sms] Twilio credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Twilio credentials not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine the app URL
    const appUrl = "https://barrel-coach.lovable.app";

    let messageBody = body;
    let phoneNumber = to;
    let session: any = null;
    let resolvedPlayerId = player_id;

    // If using template, fetch template and session data
    if (useTemplate && triggerName && sessionId) {
      // Fetch the template
      const { data: template, error: templateError } = await supabase
        .from("sms_templates")
        .select("*")
        .eq("trigger_name", triggerName)
        .eq("is_active", true)
        .single();

      if (templateError || !template) {
        console.log(`[send-sms] Template not found or inactive: ${triggerName}`);
        return new Response(
          JSON.stringify({ success: false, message: "Template not found or inactive" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      // Fetch session data
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (sessionError || !sessionData) {
        throw new Error("Session not found");
      }

      session = sessionData;
      phoneNumber = session.player_phone;
      resolvedPlayerId = session.player_id || resolvedPlayerId;
      
      if (!phoneNumber) {
        console.log("[send-sms] No phone number for session");
        return new Response(
          JSON.stringify({ success: false, message: "No phone number" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      messageBody = replaceVariables(template.message_body, session, appUrl);
    }

    if (!phoneNumber || !messageBody) {
      throw new Error("Missing phone number or message body");
    }

    const formattedPhone = formatPhone(phoneNumber);

    console.log(`[send-sms] Sending to ${formattedPhone}: ${messageBody.substring(0, 50)}...`);

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
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
      console.error("[send-sms] Twilio error:", twilioData);
      
      // Log failure
      await supabase.from("sms_logs").insert({
        session_id: sessionId || null,
        phone_number: formattedPhone,
        trigger_name: triggerName || "manual",
        message_sent: messageBody,
        status: "failed",
      });
      
      return new Response(
        JSON.stringify({ success: false, error: twilioData.message || "Twilio send failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`[send-sms] Success! SID: ${twilioData.sid}`);

    // Log to sms_logs table
    await supabase.from("sms_logs").insert({
      session_id: sessionId || null,
      phone_number: formattedPhone,
      trigger_name: triggerName || "manual",
      message_sent: messageBody,
      twilio_sid: twilioData.sid,
      status: "sent",
    });

    // Also save to messages table for conversation view
    await supabase.from("messages").insert({
      session_id: sessionId || null,
      player_id: resolvedPlayerId || null,
      phone_number: formattedPhone,
      direction: "outbound",
      body: messageBody,
      twilio_sid: twilioData.sid,
      status: twilioData.status || "sent",
      trigger_type: triggerName || "manual",
      ai_generated: false,
    });

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[send-sms] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
