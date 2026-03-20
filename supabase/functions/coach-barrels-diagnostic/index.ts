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
// PELVIS CLASSIFICATION LOGIC (Section A — absolute law)
// Three mutually exclusive categories:
//   DEAD PELVIS: velocity < 600°/s
//   LATE PELVIS: velocity >= 600 AND kinematic_sequence_inverted
//   EARLY PELVIS: velocity >= 600 AND pelvis_rotation_at_foot_plant > -10°
// HARD CONSTRAINT: NEVER call pelvis "dead" if velocity >= 600°/s
// ============================================================

type PelvisClassification = "dead_pelvis" | "late_pelvis" | "early_pelvis" | "healthy";

interface PelvisClassificationResult {
  classification: PelvisClassification;
  label: string;
  problem: string;
  prescription: string[];
}

function classifyPelvis(
  pelvis_angular_velocity: number,
  kinematic_sequence_inverted: boolean,
  pelvis_rotation_at_foot_plant: number | null
): PelvisClassificationResult {
  if (pelvis_angular_velocity < 600) {
    return {
      classification: "dead_pelvis",
      label: "Dead Pelvis — Insufficient Force Production",
      problem: "Pelvis velocity below 600°/s. Not enough energy created at the source.",
      prescription: [
        "Ground force drills (Pull Out of Ground band drill)",
        "Posterior chain loading",
        "Synapse pelvis-first assisted rotation",
      ],
    };
  }

  // Velocity >= 600 — NEVER call this "dead"
  if (kinematic_sequence_inverted) {
    return {
      classification: "late_pelvis",
      label: "Late Pelvis — Force Produced, Timing Wrong",
      problem: `Pelvis has real velocity (${Math.round(pelvis_angular_velocity)}°/s) but torso fires before pelvis reaches peak. Energy arrives after the delivery window.`,
      prescription: [
        "Constraint drills forcing pelvis to fire first",
        "Synapse posterior chain eccentric load",
        "Single-leg drill (produces 86ms P→T gap vs 51ms regular)",
      ],
    };
  }

  if (pelvis_rotation_at_foot_plant != null && pelvis_rotation_at_foot_plant > -10) {
    return {
      classification: "early_pelvis",
      label: "Early Pelvis — Rotation Budget Spent Before Foot Plant",
      problem: `Pelvis already open (${pelvis_rotation_at_foot_plant.toFixed(1)}° at FP). Velocity is there (${Math.round(pelvis_angular_velocity)}°/s) but spent before foot plant.`,
      prescription: [
        "Balance disc work (foot-ground stability before pelvis can fire)",
        "Synapse hip lock under eccentric load",
        "Welch's Pelvis Inward Turn cue",
        "Bosch SAVAGE chaos drills",
      ],
    };
  }

  return {
    classification: "healthy",
    label: "Pelvis Healthy",
    problem: "No pelvis classification issue detected.",
    prescription: [],
  };
}

// ============================================================
// TRANSFER RATIO INTERPRETATION (Section C)
// ============================================================

function interpretTransferRatio(ratio: number): { label: string; meaning: string } {
  if (ratio > 1.8) return { label: "Runaway torso", meaning: "Torso spinning out of control relative to pelvis — pathological spin" };
  if (ratio >= 1.5) return { label: "Elite", meaning: "Torso amplifies pelvis energy correctly; optimal whip effect" };
  if (ratio >= 1.0) return { label: "Underperforming", meaning: "Torso not amplifying enough; energy dies at the handoff" };
  return { label: "Broken handoff", meaning: "Torso is LOSING energy relative to pelvis; the handoff is broken" };
}

// ============================================================
// INTERVENTION HIERARCHY (Section H — McMillan's strict order)
// Balance → Proprioception → Sequencing → Power
// NEVER skip a step. NEVER train power when balance is broken.
// ============================================================

const INTERVENTION_HIERARCHY = [
  { step: 1, name: "Balance", description: "Foot-ground connection, unstable surface work, proprioceptive footwear", mustEstablishFirst: true },
  { step: 2, name: "Proprioception", description: "Body awareness in space, balance disc drills, reactive movements", mustEstablishFirst: true },
  { step: 3, name: "Sequencing", description: "Kinematic sequence training, constraint drills, Synapse CCR protocols", mustEstablishFirst: true },
  { step: 4, name: "Power", description: "Rate of force development, plyometrics, overspeed training — only after Steps 1-3 are solid", mustEstablishFirst: false },
];

// ============================================================
// 8 MANDATORY RULES (Section F — HARD CONSTRAINTS)
// ============================================================

const MANDATORY_RULES = `
MANDATORY RULES — These override any default reasoning. Violations produce incorrect diagnoses:

1. NEVER call the pelvis "dead" if pelvis velocity is above 600°/s. If velocity is high but sequence is inverted, it is a LATE pelvis. Dead = low velocity = train force production. Late = high velocity, wrong timing = train initiation. Early = high velocity, already open = train stability.

2. NEVER recommend front leg brace as the PRIMARY fix when the sequence is inverted. Front leg brace is downstream of pelvis initiation. Fix initiation first → brace follows naturally.

3. ALWAYS check swing duration before comparing swings. Swings over 550ms may be load/walkthrough swings. Flag them separately. Never call a walkthrough swing "the worst swing."

4. ALWAYS connect energy leaks to DIRECTION. Don't just say WHERE energy leaks: Late pelvis → energy pushes toward pull side. No front leg brace → energy leaks into ground. Simultaneous firing → block instead of wave.

5. ALWAYS reference injury history when it explains the pattern. Frame as protective pattern, not skill deficit. (e.g., S1 disc history = reason for neurological inhibition)

6. Transfer Ratio below 1.0 means the torso is LOSING energy relative to the pelvis — not "coupling." The torso should AMPLIFY pelvis energy by 1.5-1.8x.

7. NEVER comment on the follow-through. The ball is gone. Post-contact positions are irrelevant to diagnosis.

8. Use POSITIVE P→T gap for correct sequence, NEGATIVE for inverted. Be consistent. Don't mix raw milliseconds with percentages without explaining the conversion.
`;

// ============================================================
// TRUNK TILT RULE (Section J)
// ============================================================

const TRUNK_TILT_RULE = `
TRUNK TILT RULE:
- Trunk lateral tilt IS a measurement of whether the pelvis drove and the front leg braced
- Trunk lateral tilt IS NOT a coaching cue
- DO NOT CUE: "Tilt more"
- DO CUE: "Drive and brace"
- The tilt shows up on its own when the energy chain works. Artificially cranking lateral flexion into the spine is dangerous and inefficient.
- Elite target: 25-30° trunk lateral tilt at foot plant. MLB average: ~15-20°.
`;

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
// SYSTEM PROMPT — Integrates full intelligence document
// ============================================================
const COACH_BARRELS_SYSTEM_PROMPT = `You are Coach Barrels — the AI coaching intelligence inside the 4B app. You are Coach Rick Strickland's methodology encoded as an always-available coaching presence.

## A. PELVIS CLASSIFICATION LOGIC

Every swing diagnosis begins with pelvis classification. The pelvis is the engine of the swing. Classification determines the entire downstream prescription. There are exactly three categories, and they are mutually exclusive:

- DEAD PELVIS: pelvis_angular_velocity < 600°/s → Insufficient force production → Ground force drills, posterior chain loading, Synapse pelvis-first assisted rotation
- LATE PELVIS: pelvis_angular_velocity >= 600°/s AND kinematic_sequence_inverted == TRUE → Force produced but timing is wrong → Constraint drills forcing pelvis to fire first, Synapse posterior chain eccentric load, single-leg drill
- EARLY PELVIS: pelvis_angular_velocity >= 600°/s AND pelvis_rotation_at_foot_plant > -10° → Rotation budget spent before foot plant → Balance disc work, Synapse hip lock under eccentric load, Welch's Pelvis Inward Turn cue

HARD CONSTRAINT: NEVER call the pelvis "dead" if pelvis velocity is above 600°/s. Dead = low velocity = train force production. Late = high velocity, wrong timing = train initiation. Early = high velocity, already open = train stability. These are three different diagnoses with three different — and sometimes opposite — training interventions.

## B. ENERGY DELIVERY FRAMEWORK DIAGNOSTIC CHAIN

A swing is an energy delivery system. Evaluate top-down. Upstream-before-downstream rule is absolute.

STEP 1: ENERGY CREATION — Lower half produces force. Metrics: Pelvis KE, Ground Reaction Force, COG Velo Y. Broken when pelvis KE low (<100J) or COG Velo Y flat.
STEP 2: ENERGY SEQUENCING — Pelvis fires FIRST. Metrics: P→T gap, kinematic sequence. Broken when inverted or P→T gap negative.
STEP 3: ENERGY TRANSFER — Pelvis decelerates → torso accelerates (whip effect). Transfer Ratio target 1.5-1.8x. Broken when TKE plateau or double bump.
STEP 4: ENERGY DIRECTION — Energy stays on pitch plane. Metrics: SBA/BBA, COM displacement. Broken when late pelvis → pull side, no front leg brace → ground, simultaneous firing → block.
STEP 5: ENERGY CONCENTRATION — Energy funnels into narrow delivery window (8-15%). Metrics: Hand-Bat Lag. Delivery window = contact_time_ms - foot_plant_time_ms (NOT hardcoded 200ms).
STEP 6: ENERGY DELIVERY — Bat meets ball with maximum concentrated force. Metrics: Bat speed, exit velo, attack angle (target 8-15°).

CRITICAL: Always diagnose from Step 1 down. Never fix Step 6 when Step 2 is broken. If upstream step is broken, all downstream steps are contaminated.

## C. TRANSFER RATIO INTERPRETATION

Transfer Ratio = Torso Angular Velocity / Pelvis Angular Velocity
- Above 1.8: Runaway torso — spinning out of control relative to pelvis
- 1.5-1.8: Elite — Torso amplifies pelvis energy correctly; optimal whip effect
- 1.0-1.5: Underperforming — Torso not amplifying enough; energy dies at handoff
- Below 1.0: Broken handoff — Torso is LOSING energy relative to pelvis

Torso-led swings score ZERO on timing efficiency. Do NOT use Math.abs() on computeTransferEfficiency.

## D. MOTOR PROFILE CLASSIFICATION

Before prescribing, identify the motor profile. Misclassification leads to harmful prescriptions.

- Spinner: Compact rotation, quick hands. P→T gap 5-10%. Transfer Ratio 1.3-1.5. Pro model: Altuve.
- Tilt Whipper: Lateral tilt + violent brake (NO coil). P→T gap 15-22%. Transfer Ratio 1.6-1.9. Sharp single spike TKE. Pro model: Freeman.
- Load Whipper: Deep coil + violent brake. P→T gap 15-22%. Transfer Ratio 1.6-1.9. Sharp single spike TKE. Pro model: Tucker.
- Slingshotter: Ground force linear + rotational. P→T gap 12-16%. Transfer Ratio 1.4-1.6. Pro model: Judge/Guerrero.
- Titan: Raw mass + force. Variable timing. Transfer Ratio >1.8.

WARNING: Tilt Whipper vs Load Whipper share nearly identical Timing Gap and Transfer Ratio. They require OPPOSITE training prescriptions:
- Tilt Whipper: No coil, ~45° trunk tilt, ~1° BBA. Cueing "coil more" DESTROYS the pattern.
- Load Whipper: Deep coil, lower tilt, higher BBA. Cueing "tilt more" DESTROYS the pattern.

${MANDATORY_RULES}

## H. INTERVENTION HIERARCHY (McMillan's strict order)

STEP 1: Balance — Foot-ground connection, unstable surface work. MUST be established first.
STEP 2: Proprioception — Body awareness in space, balance disc drills. MUST be established before proceeding.
STEP 3: Sequencing — Kinematic sequence training, constraint drills, Synapse CCR protocols. MUST be established before proceeding.
STEP 4: Power — Rate of force development, plyometrics, overspeed. Only AFTER Steps 1-3 are solid.

Rule: Never skip a step. Never train power when balance is broken.

Foundation Principle: The pelvis is the stable PLATFORM — the spine is a passenger. Every Synapse exercise is fundamentally a pelvic stabilization exercise.

## SSL Framework (Capacity vs Recruitment)
- SSL Static Screen GREEN + Reboot broken pattern → Recruitment problem → Go straight to Synapse/constraint training
- SSL Static Screen RED + Reboot broken pattern → Capacity problem → Address mobility/strength first
- SSL consists of 5 tests: Hip IR, Oblique Twist, Thomas Test, Single-Leg Stability, Big Toe.

${TRUNK_TILT_RULE}

## K. INJURY HISTORY INTEGRATION

RULE: Always reference injury history when it explains the biomechanical pattern.
- IF player has documented injury history AND current movement pattern shows inhibition consistent with protective guarding of the injured area:
  - Frame the pattern as a PROTECTIVE PATTERN, not a skill deficit
  - Explain WHY their body hesitates
  - The neurological inhibition is a rational response from a healed injury, not laziness
  - Adjust training to gradually rebuild trust in the movement

## VOICE RULES
- 5th to 8th grade reading level. Direct. Specific to THIS player's numbers. Never generic.
- Every response must reference a specific metric from the player's data.
- Never use clinical terminology without a plain-language translation immediately after.
- Coach-like without being vague. Data-confident without being robotic.

BANNED PHRASES: "You have bad habits", "Swing harder", "Watch the ball", "You're doing it wrong", "Just relax"

RESPONSE FORMAT: When generating a voice_sample, write 2-4 sentences in the exact Coach Barrels voice: specific number, what it means, what to do next. No padding. No hedging.`;

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
  // New fields from intelligence doc
  pelvis_angular_velocity?: number;
  kinematic_sequence_inverted?: boolean;
  pelvis_rotation_at_foot_plant?: number | null;
  transfer_ratio?: number;
  swing_duration_ms?: number;
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
    const {
      player_id, krs_session_id, active_flags, injury_history, motor_profile,
      player_response, player_scores,
      pelvis_angular_velocity, kinematic_sequence_inverted, pelvis_rotation_at_foot_plant,
      transfer_ratio, swing_duration_ms,
    } = body;

    if (!player_id || !krs_session_id) {
      return new Response(JSON.stringify({ error: "player_id and krs_session_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Swing duration filter (Section E) ──
    if (swing_duration_ms != null && swing_duration_ms > 550) {
      console.log(`[Coach Barrels] Swing duration ${swing_duration_ms}ms > 550ms — flagged as load/walkthrough`);
      // Don't abort, but include this context in the AI prompt
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

    // ── Pelvis classification (Section A) ──
    let pelvisResult: PelvisClassificationResult | null = null;
    if (pelvis_angular_velocity != null) {
      pelvisResult = classifyPelvis(
        pelvis_angular_velocity,
        kinematic_sequence_inverted ?? false,
        pelvis_rotation_at_foot_plant ?? null
      );
      console.log(`[Coach Barrels] Pelvis classification: ${pelvisResult.classification} (${Math.round(pelvis_angular_velocity)}°/s)`);
    }

    // ── Transfer ratio interpretation (Section C) ──
    let trInterp: { label: string; meaning: string } | null = null;
    if (transfer_ratio != null) {
      trInterp = interpretTransferRatio(transfer_ratio);
      console.log(`[Coach Barrels] Transfer ratio ${transfer_ratio.toFixed(2)}: ${trInterp.label}`);
    }

    // Identify active (true) flags
    const activeFlags = Object.entries(active_flags)
      .filter(([_, v]) => v === true)
      .map(([k]) => k);

    if (activeFlags.length === 0) {
      const voiceSample = `${playerName}'s chain is firing clean. No active flags in the system. Maintain the current program and track consistency session over session.`;
      
      const result = {
        response_type: "classification",
        clinical_read: "No active biomechanical flags detected.",
        systems_table: [],
        pelvis_classification: pelvisResult,
        transfer_ratio_interpretation: trInterp,
        voice_sample: voiceSample,
      };

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

      const pelvisContext = pelvisResult
        ? `\nPelvis Classification: ${pelvisResult.label} — ${pelvisResult.problem}`
        : "";
      const trContext = trInterp
        ? `\nTransfer Ratio: ${transfer_ratio?.toFixed(2)} → ${trInterp.label}: ${trInterp.meaning}`
        : "";
      const injuryContext = effectiveInjuryHistory.length > 0
        ? `\nINJURY HISTORY (frame movement patterns as protective patterns, not skill deficits): ${JSON.stringify(effectiveInjuryHistory)}`
        : "";
      const durationContext = swing_duration_ms != null && swing_duration_ms > 550
        ? `\nWARNING: Swing duration is ${Math.round(swing_duration_ms)}ms (>550ms). This is a load/walkthrough swing. Do NOT compare it to competitive swings.`
        : "";

      const classificationPrompt = `Player: ${playerName} (${player?.age || "?"} yrs, ${player?.level || "?"}, ${player?.weight_lbs || "?"}lbs, ${effectiveMotorProfile} motor profile)
${injuryContext}
Scores: ${JSON.stringify(player_scores || {})}
${pelvisContext}${trContext}${durationContext}

Active Flag: ${dq.flag_label} (${flag_id})
SSL Analog: ${dq.ssl_analog}
Diagnostic Question Asked: "${dq.question_text}"
Player's Answer: "${answer}"

Capacity indicators: ${dq.capacity_keywords.join(", ")}
Recruitment indicators: ${dq.recruitment_keywords.join(", ")}

Based on the player's answer and their injury history, classify this flag as CAPACITY or RECRUITMENT.
Follow the Intervention Hierarchy: Balance → Proprioception → Sequencing → Power. Never skip a step.
If injury history explains the pattern, frame it as a protective pattern, not a skill deficit.
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
                  intervention_step: { type: "string", enum: ["balance", "proprioception", "sequencing", "power"], description: "Which step of the McMillan hierarchy this prescription targets" },
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
        pelvis_classification: pelvisResult,
        transfer_ratio_interpretation: trInterp,
        prescription: {
          flag_id,
          intervention_type: classification.intervention_type,
          intervention_step: classification.intervention_step,
          drills: classification.drills,
          tools: classification.tools,
          reasoning: classification.prescription_reasoning,
        },
        voice_sample: classification.voice_sample,
      };

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
    
    const flagClassifications: any[] = [];
    let ambiguousFlag: string | null = null;

    for (const flagId of activeFlags) {
      const dq = DIAGNOSTIC_QUESTIONS[flagId];
      if (!dq) continue;

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
        const hasActiveInjury = relevantInjuries.some((ih: any) => ih.status === "active");
        flagClassifications.push({
          flag_id: flagId,
          classification: hasActiveInjury ? "capacity" : "recruitment",
          reasoning: hasActiveInjury
            ? `Active ${relevantInjuries[0].injury} — capacity ceiling. Address mobility first.`
            : `Cleared ${relevantInjuries[0].injury} — learned neurological inhibition. This is a protective pattern, not a skill deficit. The injury is healed but the brain is still running the old protective program.`,
          intervention_path: hasActiveInjury
            ? "Address mobility/capacity first"
            : "Constraint training + Synapse — gradually rebuild trust in the movement",
        });
      } else if (!ambiguousFlag) {
        ambiguousFlag = flagId;
      } else {
        flagClassifications.push({
          flag_id: flagId,
          classification: "unknown",
          reasoning: "Requires diagnostic question — queued after primary flag resolution.",
          intervention_path: "Pending classification",
        });
      }
    }

    if (ambiguousFlag) {
      const dq = DIAGNOSTIC_QUESTIONS[ambiguousFlag];

      const pelvisContext = pelvisResult
        ? `\nPelvis Classification: ${pelvisResult.label} — ${pelvisResult.problem}`
        : "";
      const trContext = trInterp
        ? `\nTransfer Ratio: ${transfer_ratio?.toFixed(2)} → ${trInterp.label}: ${trInterp.meaning}`
        : "";
      const injuryContext = effectiveInjuryHistory.length > 0
        ? `\nInjury History (frame as protective patterns, not skill deficits): ${JSON.stringify(effectiveInjuryHistory)}`
        : "";

      const contextPrompt = `Player: ${playerName} (${player?.age || "?"} yrs, ${player?.level || "?"}, ${player?.weight_lbs || "?"}lbs, ${effectiveMotorProfile} motor profile)
Scores: ${JSON.stringify(player_scores || {})}
Active Flags: ${activeFlags.map(f => DIAGNOSTIC_QUESTIONS[f]?.flag_label || f).join(", ")}
Already Classified: ${flagClassifications.map(fc => `${fc.flag_id}: ${fc.classification}`).join(", ") || "none"}
Ambiguous Flag: ${dq.flag_label}
${pelvisContext}${trContext}${injuryContext}

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
        await aiResponse.text();
      }

      const result = {
        response_type: "question" as const,
        clinical_read: clinicalRead,
        systems_table: flagClassifications,
        pelvis_classification: pelvisResult,
        transfer_ratio_interpretation: trInterp,
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
    const pelvisContext = pelvisResult
      ? `\nPelvis Classification: ${pelvisResult.label} — ${pelvisResult.problem}\nPelvis Prescription: ${pelvisResult.prescription.join(", ")}`
      : "";
    const trContext = trInterp
      ? `\nTransfer Ratio: ${transfer_ratio?.toFixed(2)} → ${trInterp.label}: ${trInterp.meaning}`
      : "";
    const injuryContext = effectiveInjuryHistory.length > 0
      ? `\nInjury History (frame as protective patterns, not skill deficits): ${JSON.stringify(effectiveInjuryHistory)}`
      : "";

    const prescriptionPrompt = `Player: ${playerName} (${player?.age || "?"} yrs, ${player?.level || "?"}, ${player?.weight_lbs || "?"}lbs, ${effectiveMotorProfile} motor profile)
${injuryContext}
Scores: ${JSON.stringify(player_scores || {})}
${pelvisContext}${trContext}

Flag Classifications:
${flagClassifications.map(fc => `- ${fc.flag_id} (${DIAGNOSTIC_QUESTIONS[fc.flag_id]?.flag_label || fc.flag_id}): ${fc.classification} — ${fc.reasoning}`).join("\n")}

Generate a comprehensive Coach Barrels voice_sample and clinical read summarizing all classifications and the session plan.
Follow the Intervention Hierarchy: Balance → Proprioception → Sequencing → Power. Never skip a step.
Reference specific numbers. Follow upstream-before-downstream rule.
If injury history explains patterns, frame as protective patterns, not skill deficits.`;

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
      pelvis_classification: pelvisResult,
      transfer_ratio_interpretation: trInterp,
      voice_sample: voiceSample,
    };

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
