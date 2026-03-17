import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// DIAGNOSTIC QUESTION MAP (hard-coded — do not drift)
// ============================================================
const DIAGNOSTIC_QUESTIONS: Record<string, {
  flag_label: string;
  ssl_analog: string;
  question_text: string;
  capacity_keywords: string[];
  recruitment_keywords: string[];
}> = {
  has_momentum_issue: {
    flag_label: "Low Pelvis KE",
    ssl_analog: "Hip IR / Modified Thomas Test",
    question_text: "When your back hip loads in the swing — does it feel like it's actually driving the swing, or does your upper body feel like it's doing all the work?",
    capacity_keywords: ["tight", "restriction", "can't", "stiff", "pain", "limited"],
    recruitment_keywords: ["disconnected", "upper body", "arms", "strong but", "no pain"],
  },
  has_sequence_issue: {
    flag_label: "One-Piece Firing",
    ssl_analog: "Oblique Twist / Hip-Shoulder Dissociation",
    question_text: "Can you rotate just your shoulders while keeping your hips completely still? Or do your hips want to move with your shoulders every time?",
    capacity_keywords: ["can't separate", "move together", "unable", "stiff", "core injury"],
    recruitment_keywords: ["can on floor", "fires at once", "no restriction", "just happens"],
  },
  has_balance_stability_issue: {
    flag_label: "COM Forward Drift / Lead Leg Braking",
    ssl_analog: "Single-Leg Balance Screen",
    question_text: "When you land on your lead leg in the swing, does it feel solid and planted, or does it feel wobbly and hard to control?",
    capacity_keywords: ["wobbly", "unstable", "ankle", "knee", "tightness", "groin"],
    recruitment_keywords: ["solid", "planted", "just drifts", "lunge", "no injury"],
  },
  has_range_usage_issue: {
    flag_label: "Trail Leg Push-Off / Timing Gap",
    ssl_analog: "Big Toe Extension / Posterior Chain Screen",
    question_text: "Can you lift just your big toe off the ground right now while keeping your other four toes flat?",
    capacity_keywords: ["can't", "numb", "weakness", "foot injury", "ankle"],
    recruitment_keywords: ["can do it", "timing", "too late", "no restriction"],
  },
  has_plane_issue: {
    flag_label: "Trunk Tilt / Swing Plane",
    ssl_analog: "Thoracic Mobility Screen",
    question_text: "When you take a full swing, do you feel your chest staying over the ball, or does it feel like your upper body is pulling away or tilting?",
    capacity_keywords: ["stiff", "upper back", "can't rotate", "rib", "thoracic"],
    recruitment_keywords: ["can rotate on floor", "arms take over", "no restriction"],
  },
};

// ============================================================
// VOICE RULES (hard-coded — do not drift)
// ============================================================
const COACH_BARRELS_SYSTEM_PROMPT = `You are Coach Barrels — the AI coaching intelligence inside the 4B app. You are Coach Rick Strickland's methodology encoded as an always-available coaching presence.

VOICE RULES:
- 5th to 8th grade reading level. Direct. Specific to THIS player's numbers. Never generic.
- Every response must reference a specific metric from the player's data.
- Never use clinical terminology without a plain-language translation immediately after.
- Coach-like without being vague. Data-confident without being robotic.

BANNED PHRASES: "You have bad habits", "Swing harder", "Watch the ball", "You're doing it wrong", "Just relax"

METRIC TRANSLATIONS (use these):
- Low Pelvis KE → "Your hips aren't driving the swing. Your arms are doing all the work."
- Low Transfer Ratio → "The power that's in your body isn't reaching the bat."
- One-piece firing → "Your hips and shoulders are moving at the same time. They need to learn to go separately."
- Trunk Tilt SD elevated → "Your axis is moving during the swing. You're not rotating around a fixed center."
- Recruitment problem → "Your body can do this. It just hasn't been asked to in this context yet."
- Capacity problem → "There's a physical restriction we need to address before the swing coaching will work."

UPSTREAM-BEFORE-DOWNSTREAM RULE: NEVER address a downstream metric when an upstream cause is unresolved. The hierarchy is:
COG Velocity Y → Trunk Tilt SD → BBA/SBA → Transfer Ratio → TKE Shape → Output Metrics

GUARDRAIL: You cannot change flags, scores, or add pipeline steps. You only classify capacity vs recruitment and generate language.

RESPONSE FORMAT:
When generating a voice_sample, write 2-4 sentences in the exact Coach Barrels voice: specific number, what it means, what to do next. No padding. No hedging. No generic encouragement.

Example: "Your pelvis KE moved — 67J to 81J. That's real. The chain is starting to fire. Keep the single-leg drill. We need 100J consistently on free swings before we move to the next flag."`;

// ============================================================
// REQUEST / RESPONSE TYPES
// ============================================================
interface CoachBarrelsRequest {
  player_id: string;
  krs_session_id: string;
  reboot_session_id?: string;
  active_flags: Record<string, boolean>;
  injury_history?: Array<{ injury: string; status: string; notes?: string }>;
  motor_profile?: string;
  player_response?: {
    flag_id: string;
    answer: string;
  };
  player_scores?: {
    body_score?: number;
    brain_score?: number;
    bat_score?: number;
    ball_score?: number;
    krs_score?: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Verify user is admin or service role
    if (token !== SUPABASE_SERVICE_KEY) {
      const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin } = await supabaseUser.rpc("is_admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body: CoachBarrelsRequest = await req.json();
    const { player_id, krs_session_id, active_flags, injury_history, motor_profile, player_response, player_scores } = body;

    if (!player_id || !krs_session_id) {
      return new Response(JSON.stringify({ error: "player_id and krs_session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get player info for context
    const { data: player } = await supabaseAdmin
      .from("players")
      .select("name, age, level, weight_lbs, handedness, injury_history, motor_profile_sensor")
      .eq("id", player_id)
      .single();

    const playerName = player?.name?.split(" ")[0] || "this player";
    const effectiveInjuryHistory = injury_history || (player?.injury_history as any[]) || [];
    const effectiveMotorProfile = motor_profile || player?.motor_profile_sensor || "unknown";

    // Identify active (true) flags
    const activeFlags = Object.entries(active_flags)
      .filter(([_, v]) => v === true)
      .map(([k]) => k);

    if (activeFlags.length === 0) {
      // No active flags — clean bill
      const voiceSample = `${playerName}'s chain is firing clean. No active flags in the system. Maintain the current program and track consistency session over session.`;
      
      const result = {
        response_type: "classification",
        clinical_read: "No active biomechanical flags detected.",
        systems_table: [],
        voice_sample: voiceSample,
      };

      // Save to DB
      await supabaseAdmin
        .from("hitting_4b_krs_sessions")
        .update({
          coach_barrels_classification: result.systems_table,
          coach_barrels_voice_sample: result.voice_sample,
        })
        .eq("id", krs_session_id);

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SECOND CALL: Player answered a diagnostic question ──
    if (player_response) {
      const { flag_id, answer } = player_response;
      const dq = DIAGNOSTIC_QUESTIONS[flag_id];
      
      if (!dq) {
        return new Response(JSON.stringify({ error: `Unknown flag_id: ${flag_id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use AI to classify based on player's answer
      const classificationPrompt = `Player: ${playerName} (${player?.age || "?"} yrs, ${player?.level || "?"}, ${player?.weight_lbs || "?"}lbs, ${effectiveMotorProfile} motor profile)
Injury History: ${JSON.stringify(effectiveInjuryHistory)}
Scores: ${JSON.stringify(player_scores || {})}

Active Flag: ${dq.flag_label} (${flag_id})
SSL Analog: ${dq.ssl_analog}
Diagnostic Question Asked: "${dq.question_text}"
Player's Answer: "${answer}"

Capacity indicators: ${dq.capacity_keywords.join(", ")}
Recruitment indicators: ${dq.recruitment_keywords.join(", ")}

Based on the player's answer and their injury history, classify this flag as CAPACITY or RECRUITMENT.
Then generate a prescription and a Coach Barrels voice_sample (2-4 sentences, specific numbers, plain language).`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: COACH_BARRELS_SYSTEM_PROMPT },
            { role: "user", content: classificationPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_classification",
              description: "Submit the capacity vs recruitment classification and prescription",
              parameters: {
                type: "object",
                properties: {
                  classification: { type: "string", enum: ["capacity", "recruitment"] },
                  reasoning: { type: "string", description: "Why this classification based on answer + injury history" },
                  intervention_type: { type: "string", enum: ["capacity", "recruitment"] },
                  drills: { type: "array", items: { type: "string" }, description: "Prescribed drills from the Cage Core system" },
                  tools: { type: "array", items: { type: "string" }, description: "Tools/equipment to use (Synapse, BOSU, bands, etc.)" },
                  prescription_reasoning: { type: "string", description: "Why these specific drills/tools for this flag" },
                  voice_sample: { type: "string", description: "2-4 sentence Coach Barrels voice sample for the player" },
                },
                required: ["classification", "reasoning", "intervention_type", "drills", "tools", "prescription_reasoning", "voice_sample"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "submit_classification" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ error: "AI classification failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      const classification = toolCall ? JSON.parse(toolCall.function.arguments) : null;

      if (!classification) {
        return new Response(JSON.stringify({ error: "AI did not return classification" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = {
        response_type: "prescription" as const,
        clinical_read: classification.reasoning,
        systems_table: [{
          flag_id,
          classification: classification.classification,
          reasoning: classification.reasoning,
          intervention_path: classification.intervention_type === "capacity" 
            ? "Address mobility/capacity first before loading the pattern"
            : "Constraint training + Synapse — pattern exists, needs activation",
        }],
        prescription: {
          flag_id,
          intervention_type: classification.intervention_type,
          drills: classification.drills,
          tools: classification.tools,
          reasoning: classification.prescription_reasoning,
        },
        voice_sample: classification.voice_sample,
      };

      // Save to DB
      await supabaseAdmin
        .from("hitting_4b_krs_sessions")
        .update({
          coach_barrels_classification: result.systems_table,
          coach_barrels_prescription: result.prescription,
          coach_barrels_voice_sample: result.voice_sample,
        })
        .eq("id", krs_session_id);

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FIRST CALL: Determine if we can classify or need to ask a question ──
    
    // Check if any flags are ambiguous (need a question)
    // A flag is "clear" if injury history directly indicates capacity or if no injury history exists for that area
    const flagClassifications: any[] = [];
    let ambiguousFlag: string | null = null;

    for (const flagId of activeFlags) {
      const dq = DIAGNOSTIC_QUESTIONS[flagId];
      if (!dq) continue;

      // Check injury history for relevant entries
      const relevantInjuries = effectiveInjuryHistory.filter((ih: any) => {
        const injuryLower = (ih.injury || "").toLowerCase();
        if (flagId === "has_momentum_issue") return injuryLower.includes("hip") || injuryLower.includes("back") || injuryLower.includes("s1") || injuryLower.includes("disc");
        if (flagId === "has_sequence_issue") return injuryLower.includes("core") || injuryLower.includes("oblique") || injuryLower.includes("abdomin");
        if (flagId === "has_balance_stability_issue") return injuryLower.includes("ankle") || injuryLower.includes("knee") || injuryLower.includes("groin") || injuryLower.includes("hip");
        if (flagId === "has_range_usage_issue") return injuryLower.includes("foot") || injuryLower.includes("ankle") || injuryLower.includes("achilles");
        if (flagId === "has_plane_issue") return injuryLower.includes("thoracic") || injuryLower.includes("rib") || injuryLower.includes("back") || injuryLower.includes("spine");
        return false;
      });

      if (relevantInjuries.length > 0) {
        // Clear classification from injury history
        const hasActiveInjury = relevantInjuries.some((ih: any) => ih.status === "active");
        flagClassifications.push({
          flag_id: flagId,
          classification: hasActiveInjury ? "capacity" : "recruitment",
          reasoning: hasActiveInjury
            ? `Active ${relevantInjuries[0].injury} — capacity ceiling. Address mobility first.`
            : `Cleared ${relevantInjuries[0].injury} — likely learned inhibition. Recruitment problem.`,
          intervention_path: hasActiveInjury
            ? "Address mobility/capacity first"
            : "Constraint training + Synapse",
        });
      } else if (!ambiguousFlag) {
        // First ambiguous flag — we'll ask about this one
        ambiguousFlag = flagId;
      } else {
        // Additional ambiguous flags — classify as unknown for now
        flagClassifications.push({
          flag_id: flagId,
          classification: "unknown",
          reasoning: "Requires diagnostic question — queued after primary flag resolution.",
          intervention_path: "Pending classification",
        });
      }
    }

    // If there's an ambiguous flag, ask the diagnostic question
    if (ambiguousFlag) {
      const dq = DIAGNOSTIC_QUESTIONS[ambiguousFlag];

      // Generate voice sample with AI
      const contextPrompt = `Player: ${playerName} (${player?.age || "?"} yrs, ${player?.level || "?"}, ${player?.weight_lbs || "?"}lbs, ${effectiveMotorProfile} motor profile)
Scores: ${JSON.stringify(player_scores || {})}
Active Flags: ${activeFlags.map(f => DIAGNOSTIC_QUESTIONS[f]?.flag_label || f).join(", ")}
Already Classified: ${flagClassifications.map(fc => `${fc.flag_id}: ${fc.classification}`).join(", ") || "none"}
Ambiguous Flag: ${dq.flag_label}

Generate a brief clinical_read (what the data is showing for this player) and a Coach Barrels voice_sample that introduces the diagnostic question naturally. The voice_sample should reference a specific metric, explain what it means in plain language, then lead into why you're asking the question. 2-4 sentences max.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: COACH_BARRELS_SYSTEM_PROMPT },
            { role: "user", content: contextPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_diagnostic_intro",
              description: "Submit the clinical read and voice sample for the diagnostic question",
              parameters: {
                type: "object",
                properties: {
                  clinical_read: { type: "string", description: "What the data shows for this player" },
                  voice_sample: { type: "string", description: "Coach Barrels voice introducing the diagnostic question" },
                },
                required: ["clinical_read", "voice_sample"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "submit_diagnostic_intro" } },
        }),
      });

      let clinicalRead = `Data shows ${dq.flag_label} flag active. Need to determine if this is a capacity or recruitment problem.`;
      let voiceSample = `Alright ${playerName}, your data is showing something I need to dig into. ${dq.question_text}`;

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          const parsed = JSON.parse(toolCall.function.arguments);
          clinicalRead = parsed.clinical_read || clinicalRead;
          voiceSample = parsed.voice_sample || voiceSample;
        }
      } else {
        await aiResponse.text(); // consume body
      }

      const result = {
        response_type: "question" as const,
        clinical_read: clinicalRead,
        systems_table: flagClassifications,
        question: {
          flag_id: ambiguousFlag,
          text: dq.question_text,
        },
        voice_sample: voiceSample,
      };

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All flags classified — generate prescription
    const prescriptionPrompt = `Player: ${playerName} (${player?.age || "?"} yrs, ${player?.level || "?"}, ${player?.weight_lbs || "?"}lbs, ${effectiveMotorProfile} motor profile)
Injury History: ${JSON.stringify(effectiveInjuryHistory)}
Scores: ${JSON.stringify(player_scores || {})}

Flag Classifications:
${flagClassifications.map(fc => `- ${fc.flag_id} (${DIAGNOSTIC_QUESTIONS[fc.flag_id]?.flag_label || fc.flag_id}): ${fc.classification} — ${fc.reasoning}`).join("\n")}

Generate a comprehensive Coach Barrels voice_sample and clinical read summarizing all classifications and the session plan. Reference specific numbers. Follow upstream-before-downstream rule.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: COACH_BARRELS_SYSTEM_PROMPT },
          { role: "user", content: prescriptionPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_summary",
            description: "Submit the full classification summary",
            parameters: {
              type: "object",
              properties: {
                clinical_read: { type: "string" },
                voice_sample: { type: "string" },
              },
              required: ["clinical_read", "voice_sample"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_summary" } },
      }),
    });

    let clinicalRead = "All active flags classified.";
    let voiceSample = `${playerName}'s flag stack is mapped. Here's the session plan.`;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const parsed = JSON.parse(toolCall.function.arguments);
        clinicalRead = parsed.clinical_read || clinicalRead;
        voiceSample = parsed.voice_sample || voiceSample;
      }
    } else {
      await aiResponse.text();
    }

    const result = {
      response_type: "classification" as const,
      clinical_read: clinicalRead,
      systems_table: flagClassifications,
      voice_sample: voiceSample,
    };

    // Save to DB
    await supabaseAdmin
      .from("hitting_4b_krs_sessions")
      .update({
        coach_barrels_classification: result.systems_table,
        coach_barrels_voice_sample: result.voice_sample,
      })
      .eq("id", krs_session_id);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Coach Barrels error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
