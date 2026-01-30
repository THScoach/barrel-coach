/**
 * Send Analysis Complete Notification
 * 
 * Called by browserbase-reboot when 4B analysis is complete.
 * Sends formatted results to the player via ClawdBot.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisRequest {
  player_id: string;
  phone: string;
  is_whatsapp: boolean;
  scores: {
    brain: number;
    body: number;
    bat: number;
    ball: number;
    composite: number;
    leaks?: string[];
    motor_profile?: string;
  };
  session_id?: string;
}

function getGrade(score: number): string {
  if (score >= 70) return "Elite";
  if (score >= 60) return "Plus";
  if (score >= 50) return "Average";
  if (score >= 40) return "Below Avg";
  return "Developing";
}

function formatScoresMessage(playerName: string, scores: AnalysisRequest["scores"]): string {
  const firstName = playerName?.split(" ")[0] || "there";
  const grade = getGrade(scores.composite);
  
  let message = `🔬 ${firstName}, your 3D analysis is ready!\n\n`;
  message += `📊 4B Scores:\n`;
  message += `• Brain: ${scores.brain} (${getGrade(scores.brain)})\n`;
  message += `• Body: ${scores.body} (${getGrade(scores.body)})\n`;
  message += `• Bat: ${scores.bat} (${getGrade(scores.bat)})\n`;
  message += `• Ball: ${scores.ball} (${getGrade(scores.ball)})\n`;
  message += `\n⚡ Composite: ${scores.composite} (${grade})\n`;
  
  if (scores.motor_profile) {
    message += `\n🎯 Motor Profile: ${scores.motor_profile}\n`;
  }
  
  if (scores.leaks && scores.leaks.length > 0) {
    message += `\n⚠️ Energy Leaks Detected:\n`;
    scores.leaks.slice(0, 3).forEach(leak => {
      message += `• ${leak.replace(/_/g, " ")}\n`;
    });
  }
  
  message += `\nReply with any questions about your swing!`;
  
  return message;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const request: AnalysisRequest = await req.json();
    console.log("[Analysis Complete] Processing for player:", request.player_id);

    // Get player info
    const { data: player } = await supabase
      .from("players")
      .select("name, phone")
      .eq("id", request.player_id)
      .single();

    if (!player) {
      throw new Error("Player not found");
    }

    // Format the scores message
    const message = formatScoresMessage(player.name, request.scores);

    // Send via Twilio
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials not configured");
    }

    const fromNumber = request.is_whatsapp 
      ? `whatsapp:${TWILIO_WHATSAPP_NUMBER || TWILIO_PHONE_NUMBER}`
      : TWILIO_PHONE_NUMBER;
    
    const toNumber = request.is_whatsapp 
      ? `whatsapp:${request.phone}`
      : request.phone;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromNumber!,
        To: toNumber,
        Body: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Analysis Complete] Twilio error:", error);
      throw new Error(`Failed to send message: ${response.status}`);
    }

    // Log the message
    await supabase.from("messages").insert({
      player_id: request.player_id,
      direction: "outbound",
      channel: request.is_whatsapp ? "whatsapp" : "sms",
      body: message,
      status: "sent",
      metadata: {
        type: "analysis_complete",
        session_id: request.session_id,
        scores: request.scores,
      },
    });

    // Log activity
    await supabase.from("activity_log").insert({
      action: "analysis_sent",
      description: `3D analysis results sent via ${request.is_whatsapp ? "WhatsApp" : "SMS"}`,
      player_id: request.player_id,
      metadata: {
        scores: request.scores,
        session_id: request.session_id,
      },
    });

    console.log("[Analysis Complete] Message sent successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Analysis results sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Analysis Complete] Error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
