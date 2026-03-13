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

// ─── Player Context Loader ───────────────────────────────────────────────────

interface FullPlayerContext {
  name: string;
  age: number | null;
  level: string | null;
  position: string | null;
  motorProfile: string | null;
  // Latest v2 session
  latestSession: {
    sessionDate: string;
    scoringVersion: string;
    score4bkrs: number | null;
    bodyScore: number | null;
    brainScore: number | null;
    batScore: number | null;
    ballScore: number | null;
    rating: string | null;
    weakestLink: string | null;
    transferRatio: number | null;
    timingGapPct: number | null;
    predictedBatSpeed: number | null;
    predictedExitVelo: number | null;
    batSpeedMph: number | null;
    batSpeedSource: string | null;
    batSpeedConfidence: string | null;
  } | null;
  // Trend: last 3 sessions
  scoreTrend: { date: string; krs: number | null; weakestLink: string | null }[];
  // Active drills
  activeDrills: { name: string; reason: string | null }[];
  // Coach notes
  coachNotes: { date: string; description: string }[];
  // Stack + Blast (legacy, keep if available)
  stackData: any | null;
  blastData: any | null;
}

async function loadFullPlayerContext(supabase: any, playerId: string): Promise<FullPlayerContext | null> {
  try {
    // Run all queries in parallel for speed
    const [playerRes, sessionsRes, drillsRes, notesRes, stackRes, blastRes] = await Promise.all([
      // Player basic info
      supabase
        .from("players")
        .select("id, name, age, level, position, motor_profile_sensor, coaching_notes")
        .eq("id", playerId)
        .single(),

      // Last 3 v2 sessions
      supabase
        .from("player_sessions")
        .select("session_date, scoring_version, score_4bkrs, body_score, brain_score, bat_score, ball_score, rating, weakest_link, transfer_ratio, timing_gap_pct, predicted_bat_speed_mph, predicted_exit_velocity_mph, bat_speed_mph, bat_speed_source, bat_speed_confidence")
        .eq("player_id", playerId)
        .order("session_date", { ascending: false })
        .limit(3),

      // Active drill prescriptions
      supabase
        .from("drill_prescriptions")
        .select("prescription_reason, drills(name)")
        .eq("is_active", true)
        .limit(5),

      // Recent activity log
      supabase
        .from("activity_log")
        .select("created_at, description")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(3),

      // Stack data
      supabase
        .from("player_stack_data")
        .select("*")
        .eq("player_id", playerId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Blast data
      supabase
        .from("player_blast_data")
        .select("*")
        .eq("player_id", playerId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const player = playerRes.data;
    if (!player) return null;

    const sessions = sessionsRes.data || [];
    const latestSession = sessions[0] || null;

    return {
      name: player.name || "Player",
      age: player.age,
      level: player.level,
      position: player.position,
      motorProfile: player.motor_profile_sensor,
      latestSession: latestSession ? {
        sessionDate: latestSession.session_date,
        scoringVersion: latestSession.scoring_version || "unknown",
        score4bkrs: latestSession.score_4bkrs,
        bodyScore: latestSession.body_score,
        brainScore: latestSession.brain_score,
        batScore: latestSession.bat_score,
        ballScore: latestSession.ball_score,
        rating: latestSession.rating,
        weakestLink: latestSession.weakest_link,
        transferRatio: latestSession.transfer_ratio,
        timingGapPct: latestSession.timing_gap_pct,
        predictedBatSpeed: latestSession.predicted_bat_speed_mph,
        predictedExitVelo: latestSession.predicted_exit_velocity_mph,
        batSpeedMph: latestSession.bat_speed_mph,
        batSpeedSource: latestSession.bat_speed_source,
        batSpeedConfidence: latestSession.bat_speed_confidence,
      } : null,
      scoreTrend: sessions.map((s: any) => ({
        date: s.session_date,
        krs: s.score_4bkrs,
        weakestLink: s.weakest_link,
      })),
      activeDrills: (drillsRes.data || []).map((d: any) => ({
        name: d.drills?.name || "Unknown",
        reason: d.prescription_reason,
      })),
      coachNotes: (notesRes.data || [])
        .filter((n: any) => n.description)
        .map((n: any) => ({
          date: n.created_at?.substring(0, 10) || "",
          description: n.description,
        })),
      stackData: stackRes.data || null,
      blastData: blastRes.data || null,
    };
  } catch (err) {
    console.error("[ContextLoader] Error loading player context:", err);
    return null;
  }
}

function formatPlayerContextBlock(ctx: FullPlayerContext): string {
  const lines: string[] = ["[PLAYER CONTEXT — loaded dynamically]", ""];

  lines.push(`Name: ${ctx.name} | Level: ${ctx.level || "Unknown"} | Position: ${ctx.position || "Unknown"}`);
  if (ctx.age) lines.push(`Age: ${ctx.age}`);
  lines.push(`Motor Profile: ${ctx.motorProfile || "Not assessed yet"}`);
  lines.push("");

  if (ctx.latestSession) {
    const s = ctx.latestSession;
    const dateStr = s.sessionDate?.substring(0, 10) || "Unknown";
    lines.push(`Latest 4B Score (${s.scoringVersion}, ${dateStr}): Body ${s.bodyScore ?? '?'} / Brain ${s.brainScore ?? '?'} / Bat ${s.batScore ?? '?'} / Ball ${s.ballScore ?? '?'} → KRS ${s.score4bkrs ?? '?'} (${s.rating || 'Unrated'})`);
    lines.push(`Weakest Link: ${s.weakestLink || "Unknown"}`);
    
    if (s.batSpeedMph !== null) {
      lines.push(`Bat Speed: ${s.batSpeedMph} mph (source: ${s.batSpeedSource || 'unknown'}, confidence: ${s.batSpeedConfidence || 'unknown'})`);
    }
    if (s.predictedBatSpeed !== null) {
      lines.push(`Predicted Bat Speed: ~${s.predictedBatSpeed} mph`);
    }
    if (s.predictedExitVelo !== null) {
      lines.push(`Predicted Exit Velo: ~${s.predictedExitVelo} mph`);
    }
    if (s.transferRatio !== null) {
      lines.push(`Transfer Ratio: ${s.transferRatio}`);
    }
    if (s.timingGapPct !== null) {
      lines.push(`Timing Gap: ${s.timingGapPct}%`);
    }
  } else {
    lines.push("No scored sessions found yet.");
  }

  if (ctx.scoreTrend.length > 0) {
    lines.push("");
    lines.push("Score Trend:");
    for (const t of ctx.scoreTrend) {
      const dateStr = t.date?.substring(0, 10) || "?";
      lines.push(`  ${dateStr}: KRS ${t.krs ?? '?'} — ${t.weakestLink || 'N/A'}`);
    }
  }

  if (ctx.activeDrills.length > 0) {
    lines.push("");
    lines.push("Active Drills:");
    for (const d of ctx.activeDrills) {
      lines.push(`  - ${d.name}${d.reason ? ` (Priority: ${d.reason})` : ""}`);
    }
  }

  if (ctx.coachNotes.length > 0) {
    lines.push("");
    lines.push("Recent Coach Notes:");
    for (const n of ctx.coachNotes) {
      lines.push(`  - ${n.date}: ${n.description}`);
    }
  }

  return lines.join("\n");
}

// ─── Vault Search ────────────────────────────────────────────────────────────

async function searchVault(supabaseUrl: string, supabaseKey: string, query: string): Promise<string> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/search-vault`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ query, maxResults: 3 }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    if (!data.success || !data.results || data.results.length === 0) return "";

    const excerpts = data.results
      .filter((r: any) => r.relevance !== "Low")
      .slice(0, 3)
      .map((r: any) => `### ${r.docTitle}\n${r.excerpt}`)
      .join("\n\n");

    return excerpts ? `\n[KNOWLEDGE BASE — from coaching vault]\n${excerpts}` : "";
  } catch (err) {
    console.error("[VaultSearch] Error:", err);
    return "";
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
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

    // ── 1. Load Player Context ──────────────────────────────────────────

    let playerContextBlock = "";
    let contextSummary: { name: string; score: number | null; weakest: string | null; scoringVersion: string | null } | null = null;

    if (isTestMode && testContext) {
      // Test mode: use provided context
      const scores = [
        { name: "Body", score: testContext.bodyScore ?? null },
        { name: "Brain", score: testContext.brainScore ?? null },
        { name: "Bat", score: testContext.batScore ?? null },
        { name: "Ball", score: testContext.ballScore ?? null },
      ].filter(s => s.score !== null);
      const lowestPillar = scores.length > 0 ? scores.reduce((min, s) => (s.score! < (min.score || Infinity)) ? s : min).name : null;

      playerContextBlock = `[PLAYER CONTEXT — test mode]
Name: ${testContext.name || "Test Player"}
Motor Profile: ${testContext.motorProfile || "Not set"}
4B Scores: Body ${testContext.bodyScore ?? '?'}, Brain ${testContext.brainScore ?? '?'}, Bat ${testContext.batScore ?? '?'}, Ball ${testContext.ballScore ?? '?'}
Priority Area: ${lowestPillar || "Unknown"}`;

      contextSummary = { name: testContext.name || "Test Player", score: null, weakest: lowestPillar, scoringVersion: "test" };

    } else if (playerId) {
      // Full player context from Supabase
      const fullCtx = await loadFullPlayerContext(supabase, playerId);
      if (fullCtx) {
        playerContextBlock = formatPlayerContextBlock(fullCtx);
        contextSummary = {
          name: fullCtx.name,
          score: fullCtx.latestSession?.score4bkrs ?? null,
          weakest: fullCtx.latestSession?.weakestLink ?? null,
          scoringVersion: fullCtx.latestSession?.scoringVersion ?? null,
        };
      }
    }

    // ── 2. Knowledge Retrieval (ILIKE + Vault) ──────────────────────────

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

    // Motor profile knowledge
    const motorProfile = contextSummary?.name ? (await supabase.from("players").select("motor_profile_sensor").eq("id", playerId).single())?.data?.motor_profile_sensor : null;
    if (motorProfile || (isTestMode && testContext?.motorProfile)) {
      const mp = motorProfile || testContext?.motorProfile;
      const { data: pk } = await supabase
        .from("clawdbot_knowledge")
        .select("title, content")
        .eq("category", "motor_profile")
        .eq("subcategory", (mp || "").toLowerCase())
        .eq("is_active", true)
        .limit(2);
      knowledge = [...knowledge, ...(pk || [])];
    }

    // Pillar knowledge
    const weakest = contextSummary?.weakest;
    if (weakest) {
      // Map weakest_link (e.g. NO_BAT_DELIVERY) to a pillar
      const pillarMap: Record<string, string> = {
        body: "body", brain: "brain", bat: "bat", ball: "ball",
      };
      const pillarKey = Object.keys(pillarMap).find(k => weakest.toLowerCase().includes(k));
      if (pillarKey) {
        const { data: pk } = await supabase
          .from("clawdbot_knowledge")
          .select("title, content")
          .eq("category", "4b_system")
          .eq("subcategory", pillarKey)
          .eq("is_active", true)
          .limit(2);
        knowledge = [...knowledge, ...(pk || [])];
      }
    }

    // Vault search (runs in parallel doesn't block)
    const vaultExcerpts = await searchVault(supabaseUrl, supabaseKey, message);

    // ── 3. Scenarios + Cues ─────────────────────────────────────────────

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

    const cueTypes = ["encouragement", "greeting"];
    const mp = motorProfile || testContext?.motorProfile;
    if (mp) cueTypes.push(`profile_${mp.toLowerCase()}`);

    const { data: cues } = await supabase
      .from("clawdbot_cues")
      .select("cue_text, cue_type, context_hint")
      .eq("is_active", true)
      .in("cue_type", cueTypes)
      .limit(10);

    // ── 4. Conversation History ─────────────────────────────────────────

    let conversationHistory: any[] = [];

    // First try to load from web_conversations linked to this player
    if (playerId && conversationId) {
      // Ensure conversation exists with player_id
      await supabase.from("web_conversations").upsert({
        id: conversationId,
        player_id: playerId,
        is_active: true,
        last_message_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }

    if (conversationId) {
      const { data: history } = await supabase
        .from("web_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(20);
      conversationHistory = (history || []).reverse();
    }

    // ── 5. Build System Prompt ──────────────────────────────────────────

    const systemPrompt = buildSystemPrompt(
      playerContextBlock,
      vaultExcerpts,
      knowledge,
      scenarios || [],
      cues || []
    );

    // ── 6. Call Claude ──────────────────────────────────────────────────

    const claudeMessages = [
      ...conversationHistory.map(m => ({
        role: (m.role === "player" || m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    console.log("Calling Claude API with", claudeMessages.length, "messages");

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
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

    // ── 7. Save Messages ────────────────────────────────────────────────

    if (conversationId) {
      // Save user message + assistant response
      const scoringVersion = contextSummary?.scoringVersion || null;
      await supabase.from("web_messages").insert([
        {
          conversation_id: conversationId,
          role: "player",
          content: message,
          metadata: playerId ? { player_id: playerId, session_context_version: scoringVersion } : null,
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: assistantMessage,
          metadata: playerId ? { player_id: playerId, session_context_version: scoringVersion } : null,
        },
      ]);

      // Update conversation timestamp
      await supabase.from("web_conversations").update({
        last_message_at: new Date().toISOString(),
        message_count: (conversationHistory.length + 2),
      }).eq("id", conversationId);
    }

    const responseTime = Date.now() - startTime;
    console.log("Coach Rick AI response generated in", responseTime, "ms");

    // ── 8. Return Response ──────────────────────────────────────────────

    const metadata = isTestMode ? {
      knowledge_used: knowledge.map(k => k.title),
      scenarios_matched: (scenarios || []).map(s => s.player_input.substring(0, 50)),
      cues_available: (cues || []).map(c => c.cue_text),
      response_time: responseTime,
      playerContext: contextSummary,
    } : undefined;

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        contextSummary: contextSummary || undefined,
        metadata,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Coach Rick AI error:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── System Prompt Builder ───────────────────────────────────────────────────

function buildSystemPrompt(
  playerContextBlock: string,
  vaultExcerpts: string,
  knowledge: any[],
  scenarios: any[],
  cues: any[]
): string {
  const knowledgeSection = knowledge.length > 0
    ? `## Your Knowledge Base:\n${knowledge.map(k => `### ${k.title}\n${k.content}`).join("\n\n")}`
    : "";

  const scenariosSection = scenarios.length > 0
    ? `## Similar Questions You've Answered Well:\n${scenarios.map(s => `Player: "${s.player_input}"\nYou said: "${s.ideal_response}"`).join("\n\n")}`
    : "";

  const cuesSection = cues.length > 0
    ? `## Your Coaching Phrases (use naturally):\n${cues.map(c => `- "${c.cue_text}" ${c.context_hint ? `(${c.context_hint})` : ""}`).join("\n")}`
    : "";

  return `${playerContextBlock ? playerContextBlock + "\n\n" : ""}You are Coach Rick, a professional baseball hitting coach known for your direct, results-focused approach. You specialize in biomechanics and data-driven training.

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

${knowledgeSection}

${vaultExcerpts}

${scenariosSection}

${cuesSection}

## Response Guidelines:
1. Keep it SHORT - 1-3 sentences maximum
2. Be direct and actionable
3. ALWAYS refer to the player by name when context is loaded
4. Ground every answer in their specific scores, metrics, and trends
5. When prescribing drills, reference their Motor Profile and weakest link
6. Use plain coaching language — no biomechanics jargon in player-facing answers
7. If a data field is null or low confidence, say so rather than guessing
8. Ask follow-up questions to diagnose issues
9. Use your coaching phrases naturally
10. Match the player's energy - casual greeting? Be casual back

Remember: You're texting with a player or their coach. Be human, be direct, be helpful.`;
}
