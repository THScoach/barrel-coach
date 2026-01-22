// ============================================================
// COACH RICK AI MESSAGE GENERATOR
// Swing Rehab Coach persona - Lovable AI (Gemini)
// Philosophy: "Oreo, 4B, Sequence > Effort"
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Swing Rehab Coach persona - biomechanics-focused, short, punchy
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
- "Catching barrels"

NEVER:
- Sound like marketing or a bot
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

Replying to player "Yeah I've been feeling rushed":
"That makes sense. New pressure = rushing. This week: let it come to you. Hip Lead before every AB. Trust the engine."

CURRENT CONTEXT:
{context}

CONVERSATION HISTORY:
{history}

Generate a single Coach Rick SMS response. Just the message text, nothing else.`;

interface SMSRequest {
  type: "analysis_complete" | "reply" | "check_in" | "drill_reminder" | "custom" | "leak_detection";
  player_id: string;
  incoming_message?: string;
  custom_context?: string;
  session_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, player_id, incoming_message, custom_context, session_id }: SMSRequest = await req.json();

    if (!player_id) {
      throw new Error("player_id is required");
    }

    console.log(`[coach-rick-sms] Generating ${type} message for player ${player_id}`);

    // Fetch player data
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${player_id}`);
    }

    // Check SMS opt-in
    if (player.sms_opt_in === false) {
      console.log(`[coach-rick-sms] Player ${player_id} has opted out`);
      return new Response(
        JSON.stringify({ success: false, reason: "opted_out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstName = player.name?.split(" ")[0] || "there";

    // Fetch latest analysis data
    const { data: latestUpload } = await supabase
      .from("reboot_uploads")
      .select("*")
      .eq("player_id", player_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch conversation history (last 10 messages)
    const { data: messageHistory } = await supabase
      .from("messages")
      .select("direction, body, created_at")
      .eq("player_id", player_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Build context based on type
    let context = `Player: ${firstName}\n`;
    
    if (player.level) context += `Level: ${player.level}\n`;
    if (player.team) context += `Team: ${player.team}\n`;
    if (player.motor_profile_sensor) context += `Motor Profile: ${player.motor_profile_sensor}\n`;
    
    // Add 4B scores
    context += `\n4B Scores:\n`;
    context += `- Brain: ${player.latest_brain_score || 0}\n`;
    context += `- Body: ${player.latest_body_score || 0}\n`;
    context += `- Bat: ${player.latest_bat_score || 0}\n`;
    context += `- Ball: ${player.latest_ball_score || 0}\n`;
    
    if (latestUpload) {
      context += `\nLatest Session (${latestUpload.session_date || "recent"}):\n`;
      context += `- Composite: ${latestUpload.composite_score} (${latestUpload.grade})\n`;
      if (latestUpload.weakest_link) context += `- Weakest Link: ${latestUpload.weakest_link}\n`;
      if (latestUpload.transfer_efficiency) context += `- Transfer Efficiency: ${latestUpload.transfer_efficiency}%\n`;
      if (latestUpload.consistency_grade) context += `- Consistency: ${latestUpload.consistency_grade}\n`;
    }

    if (type === "analysis_complete") {
      context += `\nMessage type: Just completed analysis - share key insight and invite conversation\n`;
    } else if (type === "leak_detection") {
      context += `\nMessage type: Detected a leak in their swing - point them to the drill in their locker\n`;
    } else if (type === "reply" && incoming_message) {
      context += `\nPlayer just texted: "${incoming_message}"\n`;
      context += `Respond naturally while staying on coaching track.\n`;
    } else if (type === "check_in") {
      const lastSession = latestUpload?.session_date;
      context += `\nMessage type: Check-in (player hasn't trained in a while)\n`;
      if (lastSession) context += `Last session: ${lastSession}\n`;
    } else if (type === "drill_reminder") {
      context += `\nMessage type: Drill reminder - encourage them to do their assigned drill\n`;
    } else if (custom_context) {
      context += `\n${custom_context}\n`;
    }

    // Format conversation history
    let historyStr = "";
    if (messageHistory && messageHistory.length > 0) {
      const reversed = [...messageHistory].reverse();
      historyStr = reversed.map(m => {
        const role = m.direction === "outbound" ? "Coach Rick" : firstName;
        return `${role}: ${m.body}`;
      }).join("\n");
    } else {
      historyStr = "(No previous conversation)";
    }

    // Build the prompt
    const prompt = SWING_REHAB_COACH_PROMPT
      .replace("{context}", context)
      .replace("{history}", historyStr);

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
          { role: "user", content: type === "reply" && incoming_message 
            ? `Player texted: "${incoming_message}". Generate Coach Rick's SMS reply.`
            : `Generate a ${type} SMS message for ${firstName}.` 
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[coach-rick-sms] AI error:", errorText);
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    let message = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Clean up any quotes that might wrap the message
    if (message.startsWith('"') && message.endsWith('"')) {
      message = message.slice(1, -1);
    }

    // Ensure message isn't too long (SMS limit considerations)
    if (message.length > 320) {
      // Try to truncate at a sentence
      const sentences = message.split(/[.!?]/);
      message = sentences.slice(0, 2).join(". ").trim();
      if (!message.endsWith(".") && !message.endsWith("!") && !message.endsWith("?")) {
        message += ".";
      }
    }

    console.log(`[coach-rick-sms] Generated message (${message.length} chars): ${message}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message,
        player_name: firstName,
        player_phone: player.phone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[coach-rick-sms] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
