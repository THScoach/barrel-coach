import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompt for Coach Rick SMS personality
const COACH_RICK_SMS_PROMPT = `You are Coach Rick texting a player about their swing analysis.

VOICE:
- Casual but professional (it's a text, not an email)
- Encouraging, belief-building like Mike Adams
- Direct and action-focused like Alex Hormozi
- Use their first name
- Keep it SHORT (under 200 chars if possible, max 320 chars / 2 texts)
- Use occasional emoji sparingly (💪, ✅, 👊)
- Ask a question to invite reply when appropriate
- Reference specific numbers from their session when available

GOALS:
1. Acknowledge their effort (they uploaded, that's commitment)
2. Give ONE key insight from the analysis
3. Invite conversation (ask a question)
4. Build toward action (drill, next session)

NEVER:
- Sound like a bot
- Send walls of text
- Be generic ("keep up the good work!")
- Lecture
- Use more than 2-3 sentences

CONTEXT YOU HAVE:
- Player's name and recent analysis data
- Their 4B scores (Body, Brain, Bat, Ball)
- Detected leaks and motor profile
- Conversation history if replying

EXAMPLES:

After good session:
"CJ - 61 composite today, that's Plus range 💪 Your transfer efficiency jumped 4%. Whatever you're doing, keep doing it. What felt different?"

After session with issues:
"Hey CJ, looked at your session. Good power in the lower half but the arms are jumping early. You feeling rushed lately or is this intentional?"

Drill reminder:
"Quick reminder: Hip Lead Drill before you hit today. 10 reps, feel that stretch. Let me know how it goes 👊"

Check-in (7+ days inactive):
"CJ - haven't seen a session in 8 days. Everything good? Ready when you are."

Replying to player:
Player: "Yeah I've been feeling rushed"
Rick: "That makes sense. New pressure = rushing. This week: let it come to you. Hip Lead Drill before every AB. Trust the engine - it's there."

CURRENT CONTEXT:
{context}

CONVERSATION HISTORY:
{history}

Generate a single Coach Rick SMS response. Just the message text, nothing else.`;

interface SMSRequest {
  type: "analysis_complete" | "reply" | "check_in" | "drill_reminder" | "custom";
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

    console.log(`[Coach Rick SMS] Generating ${type} message for player ${player_id}`);

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
      console.log(`[Coach Rick SMS] Player ${player_id} has opted out of SMS`);
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
    
    if (latestUpload) {
      context += `\nLatest Session (${latestUpload.session_date || "recent"}):\n`;
      context += `- Composite: ${latestUpload.composite_score} (${latestUpload.grade})\n`;
      context += `- Body: ${latestUpload.body_score}, Brain: ${latestUpload.brain_score}, Bat: ${latestUpload.bat_score}\n`;
      if (latestUpload.weakest_link) context += `- Weakest: ${latestUpload.weakest_link}\n`;
      if (latestUpload.transfer_efficiency) context += `- Transfer Efficiency: ${latestUpload.transfer_efficiency}%\n`;
      if (latestUpload.consistency_grade) context += `- Consistency: ${latestUpload.consistency_grade}\n`;
    }

    if (type === "analysis_complete") {
      context += `\nMessage type: Just completed an analysis, share the key insight\n`;
    } else if (type === "reply" && incoming_message) {
      context += `\nPlayer just texted: "${incoming_message}"\n`;
      context += `Respond naturally to their message while staying on coaching track.\n`;
    } else if (type === "check_in") {
      const lastSession = latestUpload?.session_date;
      context += `\nMessage type: Check-in (player hasn't uploaded in a while)\n`;
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
    const prompt = COACH_RICK_SMS_PROMPT
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
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[Coach Rick SMS] AI error:", errorText);
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

    console.log(`[Coach Rick SMS] Generated message (${message.length} chars): ${message}`);

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
    console.error("[Coach Rick SMS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
