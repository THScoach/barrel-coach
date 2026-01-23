// ============================================================
// COACH RICK SMS - AI-Powered Swing Rehab Messaging via Twilio
// Uses Lovable AI (Gemini) for personalized coaching messages
// Direct Twilio integration - no GHL dependency
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Swing Rehab Coach persona - short, punchy, biomechanics-focused
const SWING_REHAB_COACH_PROMPT = `You are Coach Rick, a Swing Rehab Coach texting a player. Your philosophy: "Oreo, 4B, Sequence > Effort"

VOICE:
- Casual but knowledgeable (text message, not email)
- Biomechanics-focused: reference sequence, efficiency, transfer
- Direct and punchy - no fluff
- Use their first name
- Keep it SHORT (under 160 chars ideal, max 320 chars / 2 texts)
- Use occasional emoji sparingly (💪, ✅, 👊, 🎯)
- Reference specific numbers when available

4B SYSTEM CONTEXT:
- Brain: Timing, rhythm, intent, pitch recognition
- Body: Kinetic chain, ground force, hip-shoulder separation  
- Bat: Path, attack angle, barrel control
- Ball: Exit velo, launch angle, sweet spot contact

KEY PHRASES TO USE:
- "Let the sequence work"
- "Ground up, not arms down"
- "Transfer efficiency"
- "Oreo pattern" (load → coil → fire)
- "Feel the stretch"
- "Trust the engine"

NEVER:
- Sound like marketing
- Send walls of text
- Be generic ("keep up the good work!")
- Lecture about mechanics
- Use more than 2-3 sentences

EXAMPLES:

After session with Body leak:
"CJ - good power source but it's leaking at the hips. Check your locker - dropped a Hip Lead drill in there. 10 reps before you hit 👊"

After high score:
"61 composite - that's Plus range 💪 Transfer efficiency jumped. Whatever you're feeling, that's the move."

Check-in:
"CJ - 8 days since your last session. Ready when you are."

Drill reminder:
"Pre-swing today: Oreo Drill. Load slow, feel the stretch, let it fire. Trust the sequence."

CURRENT CONTEXT:
{context}

Generate a single Coach Rick SMS. Just the message text, nothing else.`;

interface SendRequest {
  type: "analysis_complete" | "reply" | "check_in" | "drill_reminder" | "custom" | "leak_detection";
  player_id: string;
  incoming_message?: string;
  custom_context?: string;
  session_id?: string;
  skip_ai?: boolean;
  custom_message?: string;
  video_title?: string;
  video_url?: string;
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
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("[send-coach-rick-sms] Twilio credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Twilio credentials not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      type, 
      player_id, 
      incoming_message, 
      custom_context, 
      session_id, 
      skip_ai, 
      custom_message,
      video_title,
      video_url 
    }: SendRequest = await req.json();

    if (!player_id) {
      throw new Error("player_id is required");
    }

    console.log(`[send-coach-rick-sms] Processing ${type} for player ${player_id}`);

    // Fetch player data
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, phone, sms_opt_in, level, team, latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score, motor_profile_sensor")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${player_id}`);
    }

    if (!player.phone) {
      console.log(`[send-coach-rick-sms] No phone for player ${player_id}`);
      return new Response(
        JSON.stringify({ success: false, reason: "no_phone" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (player.sms_opt_in === false) {
      console.log(`[send-coach-rick-sms] Player ${player_id} opted out`);
      return new Response(
        JSON.stringify({ success: false, reason: "opted_out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = player.name?.split(" ")[0] || "there";
    let messageBody: string;
    
    if (skip_ai && custom_message) {
      // Use custom message directly
      messageBody = custom_message;
    } else if (!LOVABLE_API_KEY) {
      // Fallback messages when AI is not available
      switch (type) {
        case "analysis_complete":
          messageBody = `${firstName} - your session is ready in the locker. Check it out 🎯`;
          break;
        case "leak_detection":
          messageBody = video_title 
            ? `${firstName} - spotted a leak. I put a fix in your locker: "${video_title}" 👊`
            : `${firstName} - spotted a leak in your swing. Check your locker for the drill.`;
          break;
        case "drill_reminder":
          messageBody = `${firstName} - don't forget your drills today. Trust the sequence 💪`;
          break;
        default:
          messageBody = `${firstName} - Coach Rick here. Let's get to work 🎯`;
      }
    } else {
      // Generate AI message
      // Fetch latest analysis data
      const { data: latestUpload } = await supabase
        .from("reboot_uploads")
        .select("*")
        .eq("player_id", player_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch weapon metrics from sensor_swings (last 20 swings for reliable averages)
      const { data: sensorSwings } = await supabase
        .from("sensor_swings")
        .select("bat_speed_mph, hand_speed_mph, attack_angle_deg, swing_plane_tilt_deg, impact_location_x, impact_location_y, applied_power, time_to_contact_ms")
        .eq("player_id", player_id)
        .order("captured_at", { ascending: false })
        .limit(20);

      // Calculate weapon metrics if we have sensor data
      let weaponContext = "";
      if (sensorSwings && sensorSwings.length >= 5) {
        // Calculate WIP Index (bat speed / hand speed ratio)
        const validWipSwings = sensorSwings.filter(s => s.bat_speed_mph && s.hand_speed_mph);
        if (validWipSwings.length >= 3) {
          const avgBatSpeed = validWipSwings.reduce((sum, s) => sum + (s.bat_speed_mph || 0), 0) / validWipSwings.length;
          const avgHandSpeed = validWipSwings.reduce((sum, s) => sum + (s.hand_speed_mph || 0), 0) / validWipSwings.length;
          const wipRatio = avgHandSpeed > 0 ? avgBatSpeed / avgHandSpeed : 0;
          // Convert to 20-80 scale (typical ratio 2.5-3.5)
          const wipScore = Math.round(Math.min(80, Math.max(20, 50 + (wipRatio - 3.0) * 30)));
          weaponContext += `\nWeapon Metrics (20-80 scale):\n`;
          weaponContext += `- WIP Index: ${wipScore} (bat whip efficiency - ${wipScore >= 55 ? 'good transfer' : 'leaking power early'})\n`;
        }

        // Calculate Plane Integrity (attack angle consistency)
        const validPlaneSwings = sensorSwings.filter(s => s.attack_angle_deg !== null);
        if (validPlaneSwings.length >= 3) {
          const angles = validPlaneSwings.map(s => s.attack_angle_deg as number);
          const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
          const stdDev = Math.sqrt(angles.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / angles.length);
          // Lower std dev = better plane integrity (target <3 deg)
          const planeScore = Math.round(Math.min(80, Math.max(20, 80 - stdDev * 6)));
          weaponContext += `- Plane Integrity: ${planeScore} (swing path consistency - ${planeScore >= 55 ? 'repeatable path' : 'path variance detected'})\n`;
        }

        // Calculate Square-Up (impact location consistency)
        const validImpactSwings = sensorSwings.filter(s => s.impact_location_x !== null && s.impact_location_y !== null);
        if (validImpactSwings.length >= 3) {
          const xVals = validImpactSwings.map(s => s.impact_location_x as number);
          const yVals = validImpactSwings.map(s => s.impact_location_y as number);
          const xMean = xVals.reduce((a, b) => a + b, 0) / xVals.length;
          const yMean = yVals.reduce((a, b) => a + b, 0) / yVals.length;
          const xStd = Math.sqrt(xVals.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0) / xVals.length);
          const yStd = Math.sqrt(yVals.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0) / yVals.length);
          const combinedStd = Math.sqrt(xStd * xStd + yStd * yStd);
          const squareUpScore = Math.round(Math.min(80, Math.max(20, 80 - combinedStd * 4)));
          weaponContext += `- Square-Up: ${squareUpScore} (barrel contact repeatability - ${squareUpScore >= 55 ? 'finding the barrel' : 'contact point wandering'})\n`;
        }
      }

      // Build context
      let context = `Player: ${firstName}\n`;
      if (player.level) context += `Level: ${player.level}\n`;
      if (player.motor_profile_sensor) context += `Motor Profile: ${player.motor_profile_sensor}\n`;
      
      context += `\n4B Scores: Brain ${player.latest_brain_score || 0}, Body ${player.latest_body_score || 0}, Bat ${player.latest_bat_score || 0}, Ball ${player.latest_ball_score || 0}\n`;
      
      // Add weapon metrics context
      if (weaponContext) {
        context += weaponContext;
      }
      
      if (latestUpload) {
        context += `\nLatest Session:\n`;
        context += `- Composite: ${latestUpload.composite_score} (${latestUpload.grade})\n`;
        if (latestUpload.weakest_link) context += `- Weakest: ${latestUpload.weakest_link}\n`;
        if (latestUpload.transfer_efficiency) context += `- Transfer Efficiency: ${latestUpload.transfer_efficiency}%\n`;
      }

      if (type === "analysis_complete") {
        context += `\nMessage type: Just completed analysis - share key insight\n`;
        if (weaponContext) context += `If weapon metrics show a weakness, mention it briefly.\n`;
      } else if (type === "leak_detection") {
        context += `\nMessage type: Detected leak in their swing\n`;
        if (video_title) context += `Prescribed drill: "${video_title}"\n`;
        if (video_url) context += `Link them to the drill in their locker\n`;
      } else if (type === "reply" && incoming_message) {
        context += `\nPlayer texted: "${incoming_message}"\nRespond naturally.\n`;
      } else if (type === "check_in") {
        context += `\nMessage type: Check-in (player hasn't trained recently)\n`;
      } else if (type === "drill_reminder") {
        context += `\nMessage type: Drill reminder\n`;
      } else if (custom_context) {
        context += `\n${custom_context}\n`;
      }

      const prompt = SWING_REHAB_COACH_PROMPT.replace("{context}", context);

      // Call Lovable AI
      const aiResponse = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: `Generate a ${type} SMS for ${firstName}.` }
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (!aiResponse.ok) {
        console.error("[send-coach-rick-sms] AI error:", await aiResponse.text());
        // Fallback
        messageBody = `${firstName} - check your locker. Got something for you 🎯`;
      } else {
        const aiData = await aiResponse.json();
        messageBody = aiData.choices?.[0]?.message?.content?.trim() || "";
        
        // Clean up quotes
        if (messageBody.startsWith('"') && messageBody.endsWith('"')) {
          messageBody = messageBody.slice(1, -1);
        }
        
        // Truncate if too long
        if (messageBody.length > 320) {
          const sentences = messageBody.split(/[.!?]/);
          messageBody = sentences.slice(0, 2).join(". ").trim();
          if (!messageBody.endsWith(".") && !messageBody.endsWith("!") && !messageBody.endsWith("?")) {
            messageBody += ".";
          }
        }
      }
    }

    if (!messageBody) {
      throw new Error("No message to send");
    }

    const formattedPhone = formatPhone(player.phone);

    console.log(`[send-coach-rick-sms] Sending to ${formattedPhone}: ${messageBody}`);

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
      console.error("[send-coach-rick-sms] Twilio error:", twilioData);
      return new Response(
        JSON.stringify({ success: false, error: twilioData.message || "Twilio send failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`[send-coach-rick-sms] Success! SID: ${twilioData.sid}`);

    // Log to messages table
    await supabase.from("messages").insert({
      player_id: player_id,
      phone_number: formattedPhone,
      direction: "outbound",
      body: messageBody,
      twilio_sid: twilioData.sid,
      status: twilioData.status || "sent",
      trigger_type: `coach_rick_${type}`,
      ai_generated: !skip_ai,
    });

    // Log to sms_logs
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
        player_name: firstName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[send-coach-rick-sms] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
