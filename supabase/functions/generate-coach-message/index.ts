import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface GenerateMessageRequest {
  player_id: string;
  trigger_type: "low_score" | "session_complete" | "streak" | "drill_reminder" | "welcome";
  four_b_scores?: {
    brain?: number | null;
    body?: number | null;
    bat?: number | null;
    ball?: number | null;
    composite?: number | null;
  };
  session_id?: string;
  custom_context?: string;
}

const COACH_RICK_PROMPT = `You are Coach Rick, the "Swing Rehab Coach" at Catching Barrels. You speak in an encouraging, 8th-grade reading level style that's direct but supportive. You understand the 4B Bio scoring system deeply:

- BRAIN (20-80): Decision-making, pitch selection, game IQ
- BODY (20-80): Physical mechanics, rotation, ground force, kinetic chain
- BAT (20-80): Bat speed, bat path, barrel control
- BALL (20-80): Exit velocity, launch angle, contact quality

Score ranges:
- 70+: Plus-Plus (elite)
- 60-69: Plus (above average)
- 50-59: Average
- 40-49: Below Average
- Below 40: Needs serious work

Your job is to generate SHORT, ACTIONABLE coaching messages. Each message should:
1. Be 1-3 sentences max
2. Reference specific 4B scores when available
3. Include encouragement but also honest feedback
4. When mentioning a drill, use the format: [DRILL:drill_name] so it can be auto-linked
5. Use baseball slang naturally (barrel, rip, zone, etc.)

Available drills to reference:
- Hip Hinge Flow (Body)
- Ground Force Stomp (Body)
- Separation Twist (Body)
- Tempo Tee Work (Brain)
- Pitch Recognition (Brain)
- Bat Path Mirror (Bat)
- Whip Drill (Bat)
- Contact Point Tee (Ball)
- Exit Velo Challenge (Ball)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: GenerateMessageRequest = await req.json();

    // Get player info
    const { data: player } = await supabase
      .from("players")
      .select("id, name, level, latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score")
      .eq("id", body.player_id)
      .single();

    if (!player) {
      throw new Error("Player not found");
    }

    // Build context based on trigger type
    let userPrompt = "";
    const scores = body.four_b_scores || {
      brain: player.latest_brain_score,
      body: player.latest_body_score,
      bat: player.latest_bat_score,
      ball: player.latest_ball_score,
    };

    const firstName = player.name?.split(" ")[0] || "Athlete";
    const weakestScore = Math.min(
      scores.brain ?? 100,
      scores.body ?? 100,
      scores.bat ?? 100,
      scores.ball ?? 100
    );
    const weakestCategory = 
      weakestScore === scores.brain ? "Brain" :
      weakestScore === scores.body ? "Body" :
      weakestScore === scores.bat ? "Bat" : "Ball";

    switch (body.trigger_type) {
      case "low_score":
        userPrompt = `${firstName}'s latest scores: Brain=${scores.brain || 'N/A'}, Body=${scores.body || 'N/A'}, Bat=${scores.bat || 'N/A'}, Ball=${scores.ball || 'N/A'}. Their weakest area is ${weakestCategory} at ${weakestScore}. Generate an encouraging but direct message about improving their ${weakestCategory} score. Reference a specific drill they should do.`;
        break;
      case "session_complete":
        userPrompt = `${firstName} just finished a training session with scores: Brain=${scores.brain || 'N/A'}, Body=${scores.body || 'N/A'}, Bat=${scores.bat || 'N/A'}, Ball=${scores.ball || 'N/A'}. Generate a brief "good work" message that highlights one positive and one thing to work on. Keep it hype but real.`;
        break;
      case "streak":
        userPrompt = `${firstName} hasn't trained in a few days. Their last scores were: Brain=${scores.brain || 'N/A'}, Body=${scores.body || 'N/A'}, Bat=${scores.bat || 'N/A'}, Ball=${scores.ball || 'N/A'}. Generate a motivational message to get them back in the cage. Be encouraging, not guilt-trippy.`;
        break;
      case "drill_reminder":
        userPrompt = `${firstName} was assigned drills for their ${weakestCategory} score (currently ${weakestScore}). Generate a quick reminder to complete their drills today. Make it feel personal, not automated.`;
        break;
      case "welcome":
        userPrompt = `${firstName} just joined Catching Barrels at level ${player.level || 'unknown'}. Generate a warm welcome message that sets expectations and gets them excited about the 4B system. Keep it short and hype.`;
        break;
      default:
        userPrompt = body.custom_context || `Generate a general coaching message for ${firstName}.`;
    }

    // Call Lovable AI (Gemini)
    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: COACH_RICK_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", errorText);
      throw new Error("Failed to generate AI message");
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Extract drill links
    const drillLinks: { drill_name: string; video_url?: string }[] = [];
    const drillPattern = /\[DRILL:([^\]]+)\]/g;
    let match;
    while ((match = drillPattern.exec(content)) !== null) {
      const drillName = match[1].trim();
      // Look up drill in database
      const { data: drill } = await supabase
        .from("drills")
        .select("id, name, video_url")
        .ilike("name", `%${drillName}%`)
        .limit(1)
        .single();

      if (drill) {
        drillLinks.push({
          drill_name: drill.name,
          video_url: drill.video_url || undefined,
        });
        // Replace [DRILL:name] with just the name in content
        content = content.replace(match[0], drill.name);
      } else {
        content = content.replace(match[0], drillName);
      }
    }

    // Generate a 1-sentence summary
    const summaryResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Summarize this coaching message in exactly one short sentence (under 60 chars) for a notification preview. Be direct." },
          { role: "user", content: content },
        ],
        max_tokens: 50,
      }),
    });

    let summary = content.slice(0, 60) + "...";
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      summary = summaryData.choices?.[0]?.message?.content?.trim() || summary;
    }

    // Insert message into database
    const { data: message, error: insertError } = await supabase
      .from("locker_room_messages")
      .insert({
        player_id: body.player_id,
        message_type: body.trigger_type === "low_score" ? "score_alert" :
                      body.trigger_type === "session_complete" ? "coaching" :
                      body.trigger_type === "streak" ? "motivation" :
                      body.trigger_type === "drill_reminder" ? "drill_reminder" : "coaching",
        trigger_reason: body.trigger_type,
        content,
        summary,
        drill_links: drillLinks.length > 0 ? drillLinks : null,
        four_b_context: scores,
        ai_model: "gemini-3-flash-preview",
        session_id: body.session_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to save message");
    }

    console.log(`[Coach Message] Generated for ${player.name}: ${summary}`);

    return new Response(
      JSON.stringify({
        success: true,
        message,
        content,
        summary,
        drill_links: drillLinks,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating coach message:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
