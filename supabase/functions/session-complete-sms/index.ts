/**
 * Session Complete SMS Trigger
 * ============================
 * Sends an SMS when a reboot_uploads session is marked 'Completed'
 * Includes Composite Score and Priority Drill
 * 
 * Branding: Catching Barrels Laboratory
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SessionCompletePayload {
  upload_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { upload_id }: SessionCompletePayload = await req.json();
    
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[Session Complete SMS] Processing upload: ${upload_id}`);

    // Fetch the reboot upload with player info
    const { data: upload, error: uploadError } = await supabase
      .from("reboot_uploads")
      .select(`
        id,
        player_id,
        composite_score,
        grade,
        brain_score,
        body_score,
        bat_score,
        priority_drill,
        leak_detected,
        motor_profile,
        weakest_link,
        session_date
      `)
      .eq("id", upload_id)
      .single();

    if (uploadError || !upload) {
      console.error("[Session Complete SMS] Upload not found:", uploadError);
      throw new Error(`Upload not found: ${upload_id}`);
    }

    if (!upload.player_id) {
      console.log("[Session Complete SMS] No player linked to upload");
      return new Response(
        JSON.stringify({ success: false, reason: "no_player" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch player phone
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, phone, sms_opt_in")
      .eq("id", upload.player_id)
      .single();

    if (playerError || !player) {
      console.error("[Session Complete SMS] Player not found:", playerError);
      throw new Error(`Player not found: ${upload.player_id}`);
    }

    if (!player.phone) {
      console.log("[Session Complete SMS] Player has no phone number");
      return new Response(
        JSON.stringify({ success: false, reason: "no_phone" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (player.sms_opt_in === false) {
      console.log("[Session Complete SMS] Player opted out of SMS");
      return new Response(
        JSON.stringify({ success: false, reason: "opted_out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the message
    const firstName = player.name?.split(" ")[0] || "there";
    const compositeScore = upload.composite_score ? Math.round(Number(upload.composite_score)) : "--";
    const priorityDrill = upload.priority_drill || "swing fundamentals";
    const grade = upload.grade || "";

    // Catching Barrels Laboratory branded message
    const messageBody = `🔬 CATCHING BARRELS LAB RESULTS

Hey ${firstName}! Your swing analysis is complete.

📊 COMPOSITE SCORE: ${compositeScore}/80 ${grade ? `(${grade})` : ""}
🎯 PRIORITY DRILL: ${priorityDrill}
${upload.leak_detected ? `⚠️ LEAK DETECTED: ${upload.leak_detected}` : ""}

Train smarter. Swing harder.
- Coach Rick @ The Lab`;

    // Format phone number
    let formattedPhone = player.phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = "+1" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

    // Send via Twilio
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
      console.error("[Session Complete SMS] Twilio error:", twilioData);
      throw new Error(twilioData.message || "Failed to send SMS");
    }

    console.log(`[Session Complete SMS] Sent to ${formattedPhone}, SID: ${twilioData.sid}`);

    // Log to messages table
    await supabase.from("messages").insert({
      player_id: player.id,
      phone_number: formattedPhone,
      direction: "outbound",
      body: messageBody,
      twilio_sid: twilioData.sid,
      status: twilioData.status,
      trigger_type: "session_complete",
      ai_generated: false,
    });

    // Log activity
    await supabase.from("activity_log").insert({
      action: "sms_sent",
      description: `Session complete SMS sent: Composite ${compositeScore}`,
      player_id: player.id,
      metadata: {
        upload_id: upload.id,
        composite_score: upload.composite_score,
        priority_drill: upload.priority_drill,
        twilio_sid: twilioData.sid,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: twilioData.sid,
        player_name: player.name,
        composite_score: compositeScore 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Session Complete SMS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
