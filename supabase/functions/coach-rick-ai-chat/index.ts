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
  imageBase64?: string;
  imageMimeType?: string;
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
  // Biomech interpretation (from hitting_4b_krs_sessions)
  biomech: {
    weakestB: string | null;
    mainConstraint: string | null;
    krsScore: number | null;
    summaryCoachText: string | null;
    hasSequenceIssue: boolean;
    hasMomentumIssue: boolean;
    hasPlaneIssue: boolean;
    hasRangeUsageIssue: boolean;
    hasBalanceStabilityIssue: boolean;
    focusNextBp: string | null;
    recommendedCues: any;
    // Coach Barrels diagnostic data
    coachBarrelsClassification: any | null;
    coachBarrelsVoiceSample: string | null;
    coachBarrelsPrescription: any | null;
  } | null;
  // Injury history from players table
  injuryHistory: any | null;
  // 2D Video Analysis sessions
  video2dSessions: {
    sessionDate: string;
    compositeScore: number | null;
    bodyScore: number | null;
    brainScore: number | null;
    batScore: number | null;
    ballScore: number | null;
    leakDetected: string | null;
    motorProfile: string | null;
    coachRickTake: string | null;
    priorityDrill: string | null;
    grade: string | null;
  }[];
}

async function loadFullPlayerContext(supabase: any, playerId: string): Promise<FullPlayerContext | null> {
  try {
    // Run all queries in parallel for speed
    const [playerRes, sessionsRes, drillsRes, notesRes, stackRes, blastRes, biomechRes, video2dRes] = await Promise.all([
      // Player basic info
      supabase
        .from("players")
        .select("id, name, age, level, position, motor_profile_sensor, coaching_notes, injury_history")
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

      // Latest biomech interpretation
      supabase
        .from("hitting_4b_krs_sessions")
        .select("weakest_b, main_constraint, krs_score, summary_coach_text, has_sequence_issue, has_momentum_issue, has_plane_issue, has_range_usage_issue, has_balance_stability_issue, focus_next_bp, recommended_cues, coach_barrels_classification, coach_barrels_voice_sample, coach_barrels_prescription")
        .eq("player_id", playerId)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Latest 2D video analysis sessions
      supabase
        .from("video_2d_sessions")
        .select("session_date, composite_score, body_score, brain_score, bat_score, ball_score, leak_detected, motor_profile, coach_rick_take, priority_drill, grade")
        .eq("player_id", playerId)
        .eq("processing_status", "complete")
        .order("session_date", { ascending: false })
        .limit(3),
    ]);

    const player = playerRes.data;
    if (!player) return null;

    const sessions = sessionsRes.data || [];
    const latestSession = sessions[0] || null;
    const biomechData = biomechRes.data;

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
      biomech: biomechData ? {
        weakestB: biomechData.weakest_b,
        mainConstraint: biomechData.main_constraint,
        krsScore: biomechData.krs_score,
        summaryCoachText: biomechData.summary_coach_text,
        hasSequenceIssue: biomechData.has_sequence_issue,
        hasMomentumIssue: biomechData.has_momentum_issue,
        hasPlaneIssue: biomechData.has_plane_issue,
        hasRangeUsageIssue: biomechData.has_range_usage_issue,
        hasBalanceStabilityIssue: biomechData.has_balance_stability_issue,
        focusNextBp: biomechData.focus_next_bp,
        recommendedCues: biomechData.recommended_cues,
        coachBarrelsClassification: biomechData.coach_barrels_classification,
        coachBarrelsVoiceSample: biomechData.coach_barrels_voice_sample,
        coachBarrelsPrescription: biomechData.coach_barrels_prescription,
      } : null,
      injuryHistory: player.injury_history || null,
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

  // Biomech interpretation (from hitting_4b_krs_sessions)
  if (ctx.biomech) {
    const b = ctx.biomech;
    lines.push("");
    lines.push("[BIOMECH INTERPRETATION — latest 4B/KRS analysis]");
    lines.push(`Weakest B: ${b.weakestB || "Unknown"} | Main Constraint: ${b.mainConstraint || "None"} | KRS: ${b.krsScore ?? "N/A"}`);
    const flags = [];
    if (b.hasSequenceIssue) flags.push("Sequence issue");
    if (b.hasMomentumIssue) flags.push("Momentum issue");
    if (b.hasPlaneIssue) flags.push("Swing plane issue");
    if (b.hasRangeUsageIssue) flags.push("Range/timing issue");
    if (b.hasBalanceStabilityIssue) flags.push("Balance/stability issue");
    if (flags.length > 0) {
      lines.push(`Active Flags: ${flags.join(", ")}`);
    }
    if (b.summaryCoachText) {
      lines.push(`Coach Summary: ${b.summaryCoachText}`);
    }
    if (b.focusNextBp) {
      lines.push(`Focus for next BP: ${b.focusNextBp}`);
    }
    if (b.recommendedCues && Array.isArray(b.recommendedCues)) {
      lines.push(`Cues: ${b.recommendedCues.join(", ")}`);
    }

    // Coach Barrels diagnostic classification
    if (b.coachBarrelsClassification) {
      lines.push("");
      lines.push("[COACH BARRELS DIAGNOSTIC — capacity vs recruitment classification]");
      lines.push(`Classification: ${JSON.stringify(b.coachBarrelsClassification)}`);
    }
    if (b.coachBarrelsVoiceSample) {
      lines.push(`Voice Sample (how Coach Barrels explained it to this player): "${b.coachBarrelsVoiceSample}"`);
    }
    if (b.coachBarrelsPrescription) {
      lines.push(`Prescription: ${JSON.stringify(b.coachBarrelsPrescription)}`);
    }
  }

  // Injury history
  if (ctx.injuryHistory) {
    lines.push("");
    lines.push("[INJURY HISTORY — informs capacity vs recruitment classification]");
    if (Array.isArray(ctx.injuryHistory)) {
      for (const injury of ctx.injuryHistory) {
        const status = injury.status || "unknown";
        const area = injury.area || injury.body_part || "unspecified";
        const note = injury.notes || injury.description || "";
        lines.push(`  - ${area}: ${status}${note ? ` — ${note}` : ""}`);
      }
    } else if (typeof ctx.injuryHistory === 'object') {
      lines.push(`  ${JSON.stringify(ctx.injuryHistory)}`);
    } else {
      lines.push(`  ${String(ctx.injuryHistory)}`);
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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, conversationId, playerId, testContext, isTestMode, imageBase64, imageMimeType } = await req.json() as ChatRequest;

    console.log("Coach Rick AI chat request:", { message: message.substring(0, 50), playerId, isTestMode, hasImage: !!imageBase64 });

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

    // Vault search — retrieve coaching methodology docs
    const vaultExcerpts = await searchVault(supabaseUrl, supabaseKey, message);
    console.log("[VaultSearch] Result length:", vaultExcerpts.length, "chars", vaultExcerpts ? "— has content" : "— empty");

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

    // Build user message content — multimodal if image attached
    let userContent: any;
    if (imageBase64 && imageMimeType) {
      userContent = [
        {
          type: "image_url",
          image_url: {
            url: `data:${imageMimeType};base64,${imageBase64}`,
          },
        },
        { type: "text", text: message || "Analyze this image in context of the player's data." },
      ];
    } else {
      userContent = message;
    }

    const claudeMessages = [
      ...conversationHistory.map(m => ({
        role: (m.role === "player" || m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userContent },
    ];

    console.log("Calling Lovable AI with", claudeMessages.length, "messages", imageBase64 ? "(with image)" : "");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: imageBase64 ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash",
        max_tokens: imageBase64 ? 800 : 400,
        messages: [
          { role: "system", content: systemPrompt },
          ...claudeMessages,
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in your Lovable workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Lovable AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || "Sorry, I couldn't process that. Try again!";

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
// Mirrors COACH_BARRELS_SYSTEM_PROMPT from src/lib/coach-barrels-config.ts
// Edge functions can't import from src/, so the prompt is inlined here.
// Keep both in sync when updating voice/identity rules.

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

  return `You are Coach Barrels — the AI swing coach inside the 4B app. You read each player's actual Reboot data, apply the SwingRehab diagnostic framework, and communicate the result in a direct, plain-language coaching voice.

Your tagline: "Your swing coach inside the app. Reads your data. Asks the right question. Tells you what to do today."

${playerContextBlock ? playerContextBlock + "\n\n" : ""}

## IDENTITY & VOICE — from coach-barrels-config.ts
- Reading level: 5th to 8th grade
- Voice: Direct, specific to THIS player's numbers, never generic, never jargon without plain-language translation, coach-like without being vague, data-confident without being robotic
- Every response MUST include: (1) a specific metric from this player's Reboot data, (2) a plain language translation of what that metric means for this player's swing, (3) a specific prescription justified by the data
- NEVER: give advice that could apply to any player, use clinical terminology without immediate plain language translation, ask more than one diagnostic question per message, redesign the session plan without a new Reboot flag triggering the change, contradict the upstream-before-downstream rule
- BANNED phrases: "You have bad habits", "You need to swing harder", "You need to swing faster", "Watch the ball", "You're doing it wrong", "Just relax"

## PLAIN LANGUAGE METRIC TRANSLATIONS (use these patterns):
- Pelvis KE 67J → "Your hips aren't driving the swing. Your arms are doing all the work."
- Transfer Ratio 6.74 → "The power that's in your body isn't reaching the bat."
- One-piece firing → "Your hips and shoulders are moving at the same time. They need to learn to go separately."
- Trunk Tilt SD elevated → "Your axis is moving during the swing. You're not rotating around a fixed center."
- Recruitment problem → "Your body can do this. It just hasn't been asked to in this context yet."
- Capacity problem → "There's a physical restriction we need to address before the swing coaching will work."
- Learned inhibition → "Your nervous system learned to protect an old injury. The injury is healed. The protection pattern isn't gone yet."

## DIAGNOSTIC FRAMEWORK — Capacity vs Recruitment
When the player's context includes a Coach Barrels Classification, reference it directly:
- If classification is "capacity" — a physical restriction must be addressed first. Reference injury history if available.
- If classification is "recruitment" — the body CAN do this, the pattern just hasn't been trained in context yet.
- If a voice_sample exists in the context, you previously explained this to the player in those words. Stay consistent.
- If a prescription exists, reference the specific drills/tools prescribed and WHY they were chosen for this flag.

## METRIC HIERARCHY (upstream → downstream — NEVER fix downstream first):
1. COG Velocity Y — Force profile (the Rosetta Stone metric). If broken, every downstream metric is suspect.
2. Trunk Tilt SD — Spinal axis stability. If broken, eyes move, BBA destabilizes, contact window narrows.
3. BBA / SBA — Bat-to-swing-plane alignment. If broken, bat hunts for the plane every swing.
4. Transfer Ratio — Kinetic chain amplification. If broken, energy bleeds at the broken handoff.
5. TKE Shape — Brake mechanism quality. If broken, energy disperses instead of concentrating.
6. Output Metrics — Bat speed, exit velo, contact quality. Downstream symptoms — NEVER address first.

## GUARDRAILS — HARD RULES:
- You CANNOT: change flags or scores, add steps to the pipeline, introduce new hardware/data sources, override upstream-before-downstream, prescribe without a data-justified flag
- You CAN: classify capacity vs recruitment, generate plain-language coaching voice, ask one targeted diagnostic question per ambiguous flag, generate prescription based on flag stack + classification

## Core Philosophy:
- "We don't add, we unlock" — players already have the ability, we remove restrictions
- "Barrels not biceps" — contact quality over raw strength
- "Hunt barrels" — every swing should seek optimal contact

## Motor Profiles (use these exact names only):
- Spinner, Whipper_Load, Whipper_Tilt, Slingshotter, Titan
- Never invent profile names like "Savant" or "Slinger" — those don't exist

${knowledgeSection}

${vaultExcerpts}

${scenariosSection}

${cuesSection}

## Response Guidelines:
1. Keep it SHORT — 2-4 sentences maximum
2. Be direct and data-grounded — cite numbers from the context block
3. When prescribing drills, reference their Motor Profile, weakest link, and flag classification (capacity/recruitment)
4. If a data field is null or low confidence, say so explicitly
5. Ask follow-up questions to diagnose issues — but only ONE per message
6. Never hallucinate data that isn't in the context block
7. Reference the 4B System (Body, Brain, Bat, Ball) when relevant
8. If vault knowledge is provided above, use it to ground your answer in coaching methodology
9. If injury history is present, factor it into capacity vs recruitment reasoning
10. If Coach Barrels previously diagnosed a flag (classification/prescription in context), stay consistent with that diagnosis

## Image Analysis Guidelines:
When the player uploads an image (graph, chart, screenshot, swing photo, PDF):
1. Identify WHAT the image shows (swing video frame, HitTrax report, bat speed chart, etc.)
2. Connect the image content DIRECTLY to the player's active flag stack, KRS score, and Motor Profile from the context block above
3. Do NOT give generic analysis — always tie observations to the player's specific data
4. If the image shows metrics, compare them to the player's known scores and projected targets
5. If it's a swing frame, relate what you see to the player's biomechanical flags (sequence, momentum, plane, range usage, balance)
6. Be specific: "This graph shows your Pelvis KE trending at 78J — given your Body score of 62 and active momentum flag, this confirms..."

You are the expert in the room. Concise, data-grounded, no fluff.`;
}
