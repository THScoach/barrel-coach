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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, body, sessionId, triggerName, useTemplate } = await req.json();
    
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine the app URL
    const baseUrl = SUPABASE_URL?.replace('.supabase.co', '').replace('https://', '');
    const appUrl = `https://${baseUrl}.lovableproject.com`;

    let messageBody = body;
    let phoneNumber = to;
    let session: any = null;

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
        console.log(`Template not found or inactive: ${triggerName}`);
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
      
      if (!phoneNumber) {
        console.log("No phone number for session");
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

    // Format phone number (ensure it starts with +1 for US)
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

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
      console.error("Twilio error:", twilioData);
      throw new Error(twilioData.message || "Failed to send SMS");
    }

    // Log to sms_logs table
    const { error: logError } = await supabase.from("sms_logs").insert({
      session_id: sessionId || null,
      phone_number: formattedPhone,
      trigger_name: triggerName || "manual",
      message_sent: messageBody,
      twilio_sid: twilioData.sid,
      status: "sent",
    });

    if (logError) {
      console.error("Failed to log SMS:", logError);
    }

    // Also save to messages table for conversation view
    const { error: msgError } = await supabase.from("messages").insert({
      session_id: sessionId || null,
      phone_number: formattedPhone,
      direction: "outbound",
      body: messageBody,
      twilio_sid: twilioData.sid,
      status: twilioData.status,
    });

    if (msgError) {
      console.error("Database error:", msgError);
    }

    return new Response(
      JSON.stringify({ success: true, sid: twilioData.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Send SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
