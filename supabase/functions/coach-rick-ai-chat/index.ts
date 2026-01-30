import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatRequest {
  message: string;
  conversationId: string;
  playerId?: string;
  testContext?: {
    name?: string;
    motorProfile?: string;
    bodyScore?: number;
    brainScore?: number;
    batScore?: number;
    ballScore?: number;
  };
  isTestMode?: boolean;
}

interface PlayerContext {
  name: string;
  motorProfile: string | null;
  bodyScore: number | null;
  brainScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  lowestPillar: string | null;
  recentDrills: string[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, conversationId, playerId, testContext, isTestMode } = await req.json() as ChatRequest;

    console.log("Coach Rick AI chat request:", { message: message.substring(0, 50), playerId, isTestMode });

    // 1. Get player context
    let playerContext: PlayerContext;

    if (isTestMode && testContext) {
      // Use test context
      playerContext = {
        name: testContext.name || "Test Player",
        motorProfile: testContext.motorProfile || null,
        bodyScore: testContext.bodyScore ?? null,
        brainScore: testContext.brainScore ?? null,
        batScore: testContext.batScore ?? null,
        ballScore: testContext.ballScore ?? null,
        lowestPillar: null,
        recentDrills: [],
      };

      // Calculate lowest pillar
      const scores = [
        { name: "Body", score: playerContext.bodyScore },
        { name: "Brain", score: playerContext.brainScore },
        { name: "Bat", score: playerContext.batScore },
        { name: "Ball", score: playerContext.ballScore },
      ].filter(s => s.score !== null);

      if (scores.length > 0) {
        playerContext.lowestPillar = scores.reduce((min, s) =>
          (s.score! < (min.score || Infinity)) ? s : min
        ).name;
      }
    } else if (playerId) {
      // Load real player context
      const { data: player } = await supabase
        .from("players")
        .select("id, name, motor_profile_sensor")
        .eq("id", playerId)
        .single();

      // Get latest 4B scores
      const { data: latestScores } = await supabase
        .from("swing_4b_scores")
        .select("brain_score, body_score, bat_score, ball_score")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      playerContext = {
        name: player?.name || "Player",
        motorProfile: player?.motor_profile_sensor || null,
        bodyScore: latestScores?.body_score ?? null,
        brainScore: latestScores?.brain_score ?? null,
        batScore: latestScores?.bat_score ?? null,
        ballScore: latestScores?.ball_score ?? null,
        lowestPillar: null,
        recentDrills: [],
      };

      // Calculate lowest pillar
      const scores = [
        { name: "Body", score: playerContext.bodyScore },
        { name: "Brain", score: playerContext.brainScore },
        { name: "Bat", score: playerContext.batScore },
        { name: "Ball", score: playerContext.ballScore },
      ].filter(s => s.score !== null);

      if (scores.length > 0) {
        playerContext.lowestPillar = scores.reduce((min, s) =>
          (s.score! < (min.score || Infinity)) ? s : min
        ).name;
      }

      // Get recent drill completions
      const { data: drills } = await supabase
        .from("drill_completions")
        .select("drills(name)")
        .eq("player_id", playerId)
        .order("completed_at", { ascending: false })
        .limit(5);

      playerContext.recentDrills = drills?.map((d: any) => d.drills?.name).filter(Boolean) || [];
    } else {
      // Guest context
      playerContext = {
        name: "Guest",
        motorProfile: null,
        bodyScore: null,
        brainScore: null,
        batScore: null,
        ballScore: null,
        lowestPillar: null,
        recentDrills: [],
      };
    }

    console.log("Player context loaded:", playerContext);

    // 2. Search relevant knowledge using simple ILIKE search
    const searchTerms = message.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    let knowledge: any[] = [];
    
    if (searchTerms.length > 0) {
      const { data: knowledgeData } = await supabase
        .from("clawdbot_knowledge")
        .select("title, content, category, subcategory")
        .eq("is_active", true)
        .or(searchTerms.map(term => `title.ilike.%${term}%,content.ilike.%${term}%`).join(","))
        .limit(5);
      knowledge = knowledgeData || [];
    }

    // Also get profile-specific knowledge if we know their motor profile
    let profileKnowledge: any[] = [];
    if (playerContext.motorProfile) {
      const { data: pk } = await supabase
        .from("clawdbot_knowledge")
        .select("title, content")
        .eq("category", "motor_profile")
        .eq("subcategory", playerContext.motorProfile.toLowerCase())
        .eq("is_active", true)
        .limit(2);
      profileKnowledge = pk || [];
    }

    // Get lowest pillar knowledge
    let pillarKnowledge: any[] = [];
    if (playerContext.lowestPillar) {
      const { data: pk } = await supabase
        .from("clawdbot_knowledge")
        .select("title, content")
        .eq("category", "4b_system")
        .eq("subcategory", playerContext.lowestPillar.toLowerCase())
        .eq("is_active", true)
        .limit(2);
      pillarKnowledge = pk || [];
    }

    // 3. Find matching scenarios using simple search
    let scenarios: any[] = [];
    if (searchTerms.length > 0) {
      const { data: scenarioData } = await supabase
        .from("clawdbot_scenarios")
        .select("player_input, ideal_response")
        .eq("is_active", true)
        .or(searchTerms.map(term => `player_input.ilike.%${term}%`).join(","))
        .limit(3);
      scenarios = scenarioData || [];
    }

    // 4. Get relevant cues
    const cueTypes = ["encouragement", "greeting"];
    if (playerContext.motorProfile) {
      cueTypes.push(`profile_${playerContext.motorProfile.toLowerCase()}`);
    }

    const { data: cues } = await supabase
      .from("clawdbot_cues")
      .select("cue_text, cue_type, context_hint")
      .eq("is_active", true)
      .in("cue_type", cueTypes)
      .limit(10);

    // 5. Get conversation history (last 10 messages)
    let conversationHistory: any[] = [];
    if (conversationId) {
      const { data: history } = await supabase
        .from("web_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(10);
      conversationHistory = (history || []).reverse();
    }

    // 6. Build system prompt
    const allKnowledge = [...knowledge, ...profileKnowledge, ...pillarKnowledge];
    const systemPrompt = buildSystemPrompt(
      playerContext,
      allKnowledge,
      scenarios || [],
      cues || []
    );

    // 7. Build messages array for Claude
    const claudeMessages = [
      ...conversationHistory.map(m => ({
        role: (m.role === "player" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    console.log("Calling Claude API with", claudeMessages.length, "messages");

    // 8. Call Claude API
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Claude API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Claude API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.content?.[0]?.text || "Sorry, I couldn't process that. Try again!";

    const responseTime = Date.now() - startTime;
    console.log("Coach Rick AI response generated in", responseTime, "ms");

    // 9. Return response with metadata for test mode
    const metadata = {
      knowledge_used: allKnowledge.map(k => k.title),
      scenarios_matched: (scenarios || []).map(s => s.player_input.substring(0, 50)),
      cues_available: (cues || []).map(c => c.cue_text),
      response_time: responseTime,
      playerContext: {
        motorProfile: playerContext.motorProfile,
        lowestPillar: playerContext.lowestPillar,
      },
    };

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        metadata: isTestMode ? metadata : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Coach Rick AI error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildSystemPrompt(
  player: PlayerContext,
  knowledge: any[],
  scenarios: any[],
  cues: any[]
): string {
  const knowledgeSection = knowledge.length > 0
    ? `## Your Knowledge Base:
${knowledge.map(k => `### ${k.title}\n${k.content}`).join("\n\n")}`
    : "";

  const scenariosSection = scenarios.length > 0
    ? `## Similar Questions You've Answered Well:
${scenarios.map(s => `Player: "${s.player_input}"\nYou said: "${s.ideal_response}"`).join("\n\n")}`
    : "";

  const cuesSection = cues.length > 0
    ? `## Your Coaching Phrases (use naturally):
${cues.map(c => `- "${c.cue_text}" ${c.context_hint ? `(${c.context_hint})` : ""}`).join("\n")}`
    : "";

  const playerSection = `## This Player:
- Name: ${player.name}
${player.motorProfile ? `- Motor Profile: ${player.motorProfile}` : "- Motor Profile: Not assessed yet"}
${player.bodyScore !== null ? `- 4B Scores: Body ${player.bodyScore}, Brain ${player.brainScore}, Bat ${player.batScore}, Ball ${player.ballScore}` : "- 4B Scores: Not assessed yet"}
${player.lowestPillar ? `- Priority Area: ${player.lowestPillar} (lowest score)` : ""}
${player.recentDrills.length > 0 ? `- Recent Drills: ${player.recentDrills.join(", ")}` : ""}`;

  return `You are Coach Rick, a professional baseball hitting coach known for your direct, results-focused approach. You specialize in biomechanics and data-driven training.

## Your Personality:
- Direct and confident, but encouraging
- Use casual, relatable language (5th-8th grade reading level)
- Keep responses SHORT: 1-3 sentences max
- Focus on actionable advice
- Reference the 4B System (Body, Brain, Bat, Ball) naturally
- Know your player's Motor Profile and adapt accordingly

## Core Philosophy:
- "We don't add, we unlock" - players already have the ability, we remove restrictions
- "Barrels not biceps" - focus on contact quality over raw strength
- "Hunt barrels" - every swing should seek optimal contact

${playerSection}

${knowledgeSection}

${scenariosSection}

${cuesSection}

## Response Guidelines:
1. Keep it SHORT - 1-3 sentences maximum
2. Be direct and actionable
3. Reference player's data when relevant (their scores, profile)
4. Ask follow-up questions to diagnose issues
5. Prescribe specific drills when appropriate
6. Use your coaching phrases naturally
7. Match the player's energy - casual greeting? Be casual back
8. If you don't know something about the player, ask them

Remember: You're texting with a player. Be human, be direct, be helpful.`;
}
