import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_2D_PROMPT = `You are Coach Barrels, the AI diagnostic engine inside the Catching Barrels 4B swing analysis app. You analyze baseball swing video using a strict biomechanical hierarchy. You are NOT a cheerleader. You are a diagnostic tool. Your job is to find the ROOT CAUSE of energy leaks, not to comment on cosmetics.

## CRITICAL RULES

1. NEVER comment on what happens AFTER contact. The follow-through, back leg finish, and post-contact positions are IRRELEVANT. The ball is already gone. Do not mention them.

2. ALWAYS diagnose UPSTREAM FIRST. The swing is a chain. Problems flow downstream. If the hips don't lead, the torso can't amplify, the arms compensate, and the barrel arrives late. Find the FIRST break in the chain, not the last symptom.

3. NEVER start with a compliment unless the swing is genuinely elite (80+ grade). If the swing has a clear leak, lead with the leak. Players don't need their ego stroked — they need to know what to fix.

4. Use the 4B DIAGNOSTIC HIERARCHY. Always evaluate in this order:
   BODY (Ground → Pelvis → Torso → Brake) → BRAIN (Timing/Sequence) → BAT (Path/Delivery) → BALL (Outcome)
   The upstream metric CAUSES the downstream metric. Never diagnose downstream without checking upstream first.

5. Write at a 5th-8th grade reading level. No jargon unless you explain it immediately. Be direct. Be specific. Be Coach Rick — not a textbook.

## WHAT TO LOOK FOR (IN ORDER OF IMPORTANCE)

### PRIORITY 1: THE DELIVERY WINDOW (Foot Plant → Contact)
This is where the swing is won or lost. Focus 80% of your analysis here.

At FOOT PLANT, check:
- Are the hips already rotating, or are they still closed? (Hips closed at foot plant = good, they have room to fire)
- Is there visible separation between the hip line and the shoulder line? (Separation = stored energy)
- Where are the hands? (Still back = good, already moving forward = early, energy leak)

Between FOOT PLANT and CONTACT, check:
- Do the HIPS FIRE FIRST? This is the #1 diagnostic. If you cannot clearly see the hips leading the shoulders by at least a visible gap in time, the swing is simultaneous — flag it.
- Does the FRONT LEG BRACE? A straight, firm front leg at contact means the ground force has somewhere to go. A collapsing front leg means the brake isn't working and energy leaks into the ground.
- Does the TRUNK TILT? Elite hitters tilt the trunk away from the pitcher (toward the catcher side) during the delivery window. This sets the swing plane. If the trunk stays upright or drifts TOWARD the pitcher, the swing plane is wrong.
- Do the ARMS STAY CONNECTED or do they extend early? If the hands separate from the body before the hips and torso have fired, that's casting — the barrel takes a long, slow path to the zone.

At CONTACT, check:
- Is the HEAD STABLE? Did it stay in roughly the same position from foot plant to contact, or did it drift forward/back/down? Head drift = eyes moving = reduced contact quality.
- Is the back elbow CONNECTED to the body or flying out? Connected = short path. Flying = long path, arm-dominant.

### PRIORITY 2: THE LOAD (Setup → Foot Plant)
- Did the hitter coil into the back hip? (Visible weight shift back = energy stored)
- Is there a visible gathering of the hands back? (Hands load = more runway to accelerate)
- Did the stride land in a good position? (Open ~45-65°, not closed, not lunging)

### PRIORITY 3: WHAT TO IGNORE
- Back leg finish position after contact — IRRELEVANT
- Whether the finish is one-handed or two-handed — IRRELEVANT
- How "pretty" or "smooth" the swing looks — IRRELEVANT
- Bat angle in the stance — matters less than what happens in the delivery window
- Anything that happens after the ball leaves the bat

## LEAK DETECTION

Identify the PRIMARY leak. Choose ONE from this list, ranked by upstream priority:

### BODY LEAKS (Most upstream — fix these first)
- NO_HIP_LEAD: Hips and shoulders fire at the same time. No visible separation. This is the #1 most common leak and the most damaging. Everything downstream suffers.
- FRONT_SIDE_COLLAPSE: Front leg buckles or bends at contact. The brake fails. Energy goes into the ground instead of up the chain.
- NO_LOAD: Minimal coil into back hip. No visible weight shift. The engine has nothing to fire from.
- TRUNK_DRIFT: Upper body drifts toward the pitcher during the swing. Head moves forward. Eyes shift. Contact window shrinks.
- EARLY_WEIGHT_SHIFT: Weight moves forward before the hands fire. Lunging. The body outruns the barrel.

### BRAIN LEAKS (Timing/Rhythm)
- SIMULTANEOUS_FIRING: Everything fires at once. Technically the hips and shoulders rotate, but there's no GAP between them. The swing looks "all at once" — no whip effect.
- DISCONNECTED_SEQUENCE: Visible delay that's TOO LONG between hip turn and shoulder turn. The hitter looks like they're swinging in two pieces — hips stall, then shoulders catch up late. Momentum dies in the gap.
- RUSHED_TEMPO: The swing looks fast but frantic. No gathering, no pause at load, straight to firing. Speed without control.

### BAT LEAKS (Delivery)
- CASTING: Hands extend away from the body early in the swing. The barrel takes a long, looping path. The bat head gets away from the body before the hips and torso have done their work.
- BARREL_DUMP: Barrel drops below the hands early and has to climb back up to the zone. Deep swing bottom. Long route to the ball.
- ARM_DOMINANT: The arms are clearly doing most of the work. The body rotates but the power is coming from the hands/arms pushing the bat, not the body whipping it.

## MOTOR PROFILE ESTIMATION

Based on visible movement pattern:
- SPINNER: Compact, tight rotation. Quick hands. The hitter stays small and rotates around a tight axis. Think: Altuve, Betts. The coil is tight, the release is fast, the barrel stays close to the body.
- WHIPPER: Hip lead is obvious. Extension through contact. Leverage-based power. The swing looks like a whip cracking — slow buildup, explosive release. Think: Soto, Freeman. Visible trunk tilt.
- SLINGSHOTTER: Big linear load. Explosive forward move. Ground force dominant. The stride is aggressive, the weight transfer is visible, the power comes from the ground up. Think: Judge, Guerrero Jr.
- UNDETERMINED: If you genuinely cannot classify from the video angle, say so. Don't guess.

## SCORING RULES

### BODY Score (Range: 20-80)
Based on what you see in the DELIVERY WINDOW:
- 70-80: Clear hip lead before shoulders. Front leg braces firm. Visible trunk tilt. Head stable. Balanced finish. This is a body-driven swing.
- 55-69: Some hip lead but shoulders follow quickly. Front leg braces but not fully. Some trunk tilt. Minor head movement.
- 40-54: Hips and shoulders fire together or nearly together. Front leg soft. Trunk upright. Head drifts. Arms doing significant work.
- 20-39: Arms-first swing. No visible hip lead. Front side collapses. No trunk tilt. Head moves significantly. Body is a passenger, not the engine.

### BRAIN Score (CAPPED AT 55)
You can see sequence ORDER but cannot measure precise timing gaps from video.
- 45-55: Clear sequential firing visible — hips, then torso, then hands. Rhythmic tempo. Looks "easy" and "on time."
- 35-44: Sequence mostly correct but rushed or slightly simultaneous. Hard to see clear separation.
- 20-34: Simultaneous or inverted sequence. Everything fires at once. No visible timing.
Always append: "Timing precision requires 3D data — score capped at 55"

### BAT Score (Range: 20-80)
Based on visible barrel path and hand connection:
- 70-80: Hands stay connected. Barrel takes direct path to zone. Short, efficient swing. Barrel on plane.
- 55-69: Mostly connected. Some barrel wander but gets to zone. Slightly long path.
- 40-54: Casting visible. Barrel takes long route. Hands separate from body. Barrel dumps or loops.
- 20-39: Severe cast. Barrel way outside the body. Arms fully extended before contact. No connection.

### BALL Score (CAPPED AT 50)
No ball flight data from video alone.
- 40-50: Swing mechanics suggest solid contact potential — good sequence, connected path, braced front side
- 30-39: Swing has significant leaks that would reduce output quality — simultaneous firing, casting, soft front side
- 20-29: Major mechanical issues would severely limit contact quality and exit velocity
Always append: "Exit velocity requires sensor data — score capped at 50"

## COACH BARRELS VOICE RULES

1. Never say "great swing" unless Body score is 70+
2. Never mention the follow-through or back leg finish
3. Lead with the problem, not the praise
4. Use analogies a 12-year-old would understand
5. Be specific — "your hips and shoulders are firing at the same time" not "your timing could improve"
6. Always end with ONE thing to fix and ONE drill
7. Never use: "holistic", "cutting-edge", "next-level", "solid swing", "nice job"
8. DO use: "The engine is...", "The brake is...", "Energy is leaking because...", "Your body is telling me..."
9. Reference the 4B framework: "Your BODY score is low because..." or "The BRAIN piece here is..."
10. If the swing is genuinely good, say what SPECIFICALLY makes it good — "Your hips fire 3 frames before your shoulders, your front leg is locked, and your head doesn't move an inch. That's a body-driven swing."

## OUTPUT FORMAT

Return ONLY valid JSON. No markdown, no backticks, no preamble.

{
  "analysis_version": "2d_v4",
  "data_source": "video_2d",

  "scores": {
    "body": <integer 20-80>,
    "brain": <integer 20-55>,
    "bat": <integer 20-80>,
    "ball": <integer 20-50>,
    "composite": <integer — weighted: body*0.45 + brain*0.15 + bat*0.25 + ball*0.15>
  },

  "ratings": {
    "body": "<Elite|Good|Working|Priority>",
    "brain": "<rating — capped note>",
    "bat": "<Elite|Good|Working|Priority>",
    "ball": "<rating — capped note>"
  },

  "primary_leak": {
    "flag": "<ONE flag from the leak list above>",
    "title": "<plain language title, 3-5 words>",
    "explanation": "<2-3 sentences, 5th grade reading level. Explain WHAT is happening and WHY it matters. Use a simple analogy if it helps. Do NOT mention the follow-through.>",
    "pillar": "<BODY|BRAIN|BAT>"
  },

  "drill_prescription": {
    "primary": {
      "name": "<drill name>",
      "sets": <integer>,
      "reps": "<reps or swings>",
      "why": "<one sentence — why this drill fixes the leak>"
    },
    "secondary": {
      "name": "<drill name>",
      "sets": <integer>,
      "reps": "<reps or swings>",
      "why": "<one sentence>"
    }
  },

  "motor_profile": {
    "estimated": "<SPINNER|WHIPPER|SLINGSHOTTER|UNDETERMINED>",
    "confidence": "<HIGH|MEDIUM|LOW>",
    "note": "<1 sentence — what visible pattern led to this classification>"
  },

  "frame_analysis": {
    "load": "<1-2 sentences — what you see at load completion>",
    "foot_plant": "<1-2 sentences — hip/shoulder positions at foot plant>",
    "delivery_window": "<2-3 sentences — THE MOST IMPORTANT SECTION. What happens between foot plant and contact. Hip lead? Separation? Brake? Trunk tilt?>",
    "contact": "<1-2 sentences — front leg, head position, arm connection, trunk angle>"
  },

  "coach_barrels_take": "<3-4 sentences in Coach Barrels voice. Lead with the diagnosis, not praise. Be specific about what the body is doing wrong and why it matters. End with the one thing to fix. Do NOT mention the follow-through, back leg, or anything post-contact.>",

  "limitations": [
    "2D video estimation — Brain capped at 55, Ball capped at 50",
    "Precise timing gaps require 3D motion capture",
    "Energy distribution and transfer ratios require Reboot Motion data"
  ],

  "analysis_confidence": <float 0.0-1.0 based on video quality, angle, and visibility>
}`;


interface Video2DRequest {
  player_id: string;
  video_url: string;
  video_filename?: string;
  video_storage_path?: string;
  is_paid_user?: boolean;
  player_age?: number;
  player_level?: string;
  context?: string;
  frame_rate?: number;
  frames?: string[]; // Base64 encoded frames from client
  batch_session_id?: string; // Parent batch session
  swing_index?: number; // Swing number within batch
}

// Look up trunk stability metrics from latest Reboot analysis for this player
// deno-lint-ignore no-explicit-any
async function lookupTrunkStability(supabase: any, playerId: string): Promise<{
  trunk_tilt_std: number | null;
  trunk_ssi: number | null;
  dump_direction: string | null;
}> {
  const empty = { trunk_tilt_std: null, trunk_ssi: null, dump_direction: null };
  try {
    const { data } = await supabase
      .from("swing_analysis")
      .select("trunk_pitch_sd, trunk_lat_sd, trunk_rot_cv, trunk_ssi, dump_direction")
      .eq("player_id", playerId)
      .not("trunk_pitch_sd", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data || data.trunk_pitch_sd == null) return empty;

    // Composite trunk stability: weighted RMS in degrees (values already in degrees from v3)
    const pitchSd = data.trunk_pitch_sd ?? 0;
    const latSd = data.trunk_lat_sd ?? 0;
    const rotCv = data.trunk_rot_cv ?? 0;
    // pitchSd and latSd are degrees, rotCv is dimensionless — scale rotCv by 10 for comparable magnitude
    const composite = Math.sqrt((pitchSd ** 2 + latSd ** 2 + (rotCv * 10) ** 2) / 3);

    return {
      trunk_tilt_std: Math.round(composite * 1000) / 1000,
      trunk_ssi: data.trunk_ssi ?? null,
      dump_direction: data.dump_direction ?? null,
    };
  } catch (err) {
    console.error("[2D Analysis] Failed to lookup trunk stability:", err);
    return empty;
  }
}


async function processAnalysisInBackground(
  sessionId: string, 
  playerId: string, 
  frames: string[], 
  playerAge?: number, 
  playerLevel?: string, 
  isPaidUser: boolean = false
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[2D Analysis BG] Starting background processing for session ${sessionId}`);

    // Build context for the prompt
    const contextInfo = [];
    if (playerAge) contextInfo.push(`Player age: ${playerAge}`);
    if (playerLevel) contextInfo.push(`Player level: ${playerLevel}`);
    const contextString = contextInfo.length > 0 ? `\n\nPlayer Context:\n${contextInfo.join('\n')}` : '';

    // Build message content with all frames as images
    const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { 
        type: "text", 
        text: `Analyze these ${frames.length} key frames from a baseball swing video. They are in chronological order from the swing. Provide a comprehensive 2D analysis with scores.${contextString}` 
      }
    ];

    // Add each frame as an image
    for (let i = 0; i < frames.length; i++) {
      messageContent.push({
        type: "image_url",
        image_url: { url: frames[i] }
      });
    }

    console.log(`[2D Analysis BG] Sending ${frames.length} frames to Gemini`);

    // Call Gemini Vision for frame analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: GEMINI_2D_PROMPT },
          { role: "user", content: messageContent }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[2D Analysis BG] Gemini API error:", response.status, errorText);
      
      await supabase
        .from("video_2d_sessions")
        .update({ 
          processing_status: "failed", 
          error_message: `AI analysis failed: ${response.status} - ${errorText.substring(0, 200)}` 
        })
        .eq("id", sessionId);
      return;
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      await supabase
        .from("video_2d_sessions")
        .update({ processing_status: "failed", error_message: "No response from AI" })
        .eq("id", sessionId);
      return;
    }

    // Parse the JSON response
    let analysis;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      analysis = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("[2D Analysis BG] Failed to parse AI response:", content.substring(0, 500));
      await supabase
        .from("video_2d_sessions")
        .update({ processing_status: "failed", error_message: "Failed to parse analysis response" })
        .eq("id", sessionId);
      return;
    }

    // Extract scores from new nested v4 format (with fallback to flat format for backward compat)
    const bodyScore = analysis.scores?.body ?? analysis.body;
    const brainScore = analysis.scores?.brain ?? analysis.brain;
    const batScore = analysis.scores?.bat ?? analysis.bat;
    const ballScore = analysis.scores?.ball ?? analysis.ball;
    const compositeScore = analysis.scores?.composite ?? analysis.composite;
    const gradeLabel = analysis.ratings?.body ?? analysis.grade ?? "Working";
    const leakFlag = analysis.primary_leak?.flag ?? analysis.leak_detected ?? null;
    const leakEvidence = analysis.primary_leak?.explanation ?? analysis.leak_evidence ?? null;
    const motorProfileEst = analysis.motor_profile?.estimated ?? analysis.motor_profile ?? null;
    const motorProfileNote = analysis.motor_profile?.note ?? analysis.profile_evidence ?? null;
    const coachTake = analysis.coach_barrels_take ?? analysis.coach_rick_take ?? null;
    const drillPrimary = analysis.drill_prescription?.primary?.name ?? analysis.priority_drill ?? null;
    const analysisConfidence = analysis.analysis_confidence ?? analysis.confidence ?? 0.5;

    console.log(`[2D Analysis BG] Got scores: Body=${bodyScore}, Brain=${brainScore}, Bat=${batScore}, Ball=${ballScore}`);

    // Axis stability classification
    const cogVeloY = typeof analysis.cog_velo_y === 'number' ? analysis.cog_velo_y : (analysis.visible_metrics?.cog_velo_y ?? null);
    const pelvisAv = typeof analysis.pelvis_av === 'number' ? analysis.pelvis_av : null;
    const trunkAv = typeof analysis.trunk_av === 'number' ? analysis.trunk_av : null;
    const armAv = typeof analysis.arm_av === 'number' ? analysis.arm_av : null;
    const ptRatio = pelvisAv && trunkAv ? pelvisAv / trunkAv : null;
    const taRatio = trunkAv && armAv ? trunkAv / armAv : null;
    const transferRatio = pelvisAv && trunkAv && pelvisAv > 0 ? trunkAv / pelvisAv : null;

    let axisStabilityType = 'DEVELOPING';
    let stabilityScore = 50;
    let stabilityNote = '';
    let stabilityCue = '';

    if (cogVeloY !== null) {
      if (cogVeloY < -0.5) {
        axisStabilityType = 'BACKWARD_DRIFT';
        stabilityNote = 'Center of gravity drifting backward during swing';
        stabilityCue = 'Feel weight stay centered over belly button through contact';
      } else if (cogVeloY > 0.8) {
        axisStabilityType = 'FORWARD_SPIN';
        stabilityNote = 'Center of gravity lunging forward, losing rotational axis';
        stabilityCue = 'Brace front leg and rotate around a fixed post';
      } else if (cogVeloY >= -0.1 && cogVeloY <= 0.3) {
        axisStabilityType = 'STABLE';
        stabilityNote = 'Excellent rotational axis stability';
        stabilityCue = 'Maintain current movement pattern';
      } else {
        axisStabilityType = 'DEVELOPING';
        stabilityNote = 'Axis stability is developing - minor drift detected';
        stabilityCue = 'Focus on keeping head centered over hips through rotation';
      }
      const deviation = Math.abs(cogVeloY);
      stabilityScore = Math.max(0, Math.min(100, Math.round(100 - (deviation * 80))));
    }

    console.log(`[2D Analysis BG] Axis stability: ${axisStabilityType}, score=${stabilityScore}, cogVeloY=${cogVeloY}`);

    // Look up Reboot trunk stability data
    const trunkStability = await lookupTrunkStability(supabase, playerId);

    // Update session with analysis results
    const { data: sessionData, error: updateError } = await supabase
      .from("video_2d_sessions")
      .update({
        composite_score: compositeScore,
        body_score: bodyScore,
        brain_score: Math.min(brainScore, 55),
        bat_score: batScore,
        ball_score: Math.min(ballScore, 50),
        grade: gradeLabel,
        camera_angle: analysis.camera_angle ?? null,
        leak_detected: leakFlag,
        leak_evidence: leakEvidence,
        motor_profile: motorProfileEst,
        motor_profile_indication: motorProfileEst,
        motor_profile_evidence: motorProfileNote,
        priority_drill: drillPrimary,
        coach_rick_take: coachTake,
        analysis_json: analysis,
        analysis_confidence: analysisConfidence,
        processing_status: "complete",
        completed_at: new Date().toISOString(),
        axis_stability_type: axisStabilityType,
        axis_stability_score: stabilityScore,
        cog_velo_y: cogVeloY,
        pelvis_av: pelvisAv,
        trunk_av: trunkAv,
        arm_av: armAv,
        pt_ratio: ptRatio,
        ta_ratio: taRatio,
        transfer_ratio: transferRatio,
        ground_connection: analysis.body_components?.ground_connection ?? null,
        hip_rotation: analysis.body_components?.hip_rotation ?? null,
        sequence_quality: analysis.body_components?.sequence_quality ?? null,
        timing_estimate: analysis.brain_components?.timing_estimate ?? null,
        attack_angle: analysis.bat_components?.attack_angle ?? null,
        barrel_control: analysis.bat_components?.barrel_control ?? null,
        hand_path: analysis.bat_components?.hand_path ?? null,
        power_estimate: analysis.ball_components?.power_estimate ?? null,
        ke_shape: null,
        braking_quality: null,
        trunk_tilt_std: trunkStability.trunk_tilt_std,
        x_factor_peak: null,
        com_barrel_dist: null,
        stability_note: stabilityNote,
        stability_cue: stabilityCue,
      })
      .eq("id", sessionId)
      .select("batch_session_id")
      .single();

    if (updateError) {
      console.error("[2D Analysis BG] Failed to update session:", updateError);
      return;
    }

    // If part of a batch session, update aggregates
    if (sessionData?.batch_session_id) {
      await updateBatchSessionAggregates(supabase, sessionData.batch_session_id);
    }

    // Update player's latest scores
    await supabase
      .from("players")
      .update({
        latest_body_score: bodyScore,
        latest_brain_score: Math.min(brainScore, 55),
        latest_bat_score: batScore,
        latest_composite_score: compositeScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playerId);

    // Log activity
    await supabase.from("activity_log").insert({
      player_id: playerId,
      action: "video_2d_analyzed",
      description: `2D video analysis complete: Composite ${analysis.composite}, Leak: ${analysis.leak_detected}`,
      metadata: {
        session_id: sessionId,
        batch_session_id: sessionData?.batch_session_id,
        composite_score: analysis.composite,
        leak_detected: analysis.leak_detected,
        frames_analyzed: frames.length,
        is_paid_user: isPaidUser,
        pending_3d_analysis: isPaidUser,
      },
    });

    console.log(`[2D Analysis BG] Complete for session ${sessionId}`);
  } catch (error) {
    console.error("[2D Analysis BG] Error:", error);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase
      .from("video_2d_sessions")
      .update({ 
        processing_status: "failed", 
        error_message: error instanceof Error ? error.message : "Background processing failed" 
      })
      .eq("id", sessionId);
  }
}

// Update batch session aggregates after each swing completes
// deno-lint-ignore no-explicit-any
async function updateBatchSessionAggregates(supabase: any, batchSessionId: string) {
  console.log(`[2D Aggregation] Updating batch session ${batchSessionId}`);
  
  // Get all completed swings in this batch
  const { data: swings, error: swingsError } = await supabase
    .from("video_2d_sessions")
    .select("*")
    .eq("batch_session_id", batchSessionId)
    .eq("processing_status", "complete");
  
  if (swingsError || !swings || swings.length === 0) {
    console.log("[2D Aggregation] No completed swings found");
    return;
  }
  
  const n = swings.length;
  console.log(`[2D Aggregation] Found ${n} completed swings`);
  
  // Calculate averages
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  // deno-lint-ignore no-explicit-any
  const bodyScores = swings.map((s: any) => s.body_score).filter(Boolean) as number[];
  // deno-lint-ignore no-explicit-any
  const brainScores = swings.map((s: any) => s.brain_score).filter(Boolean) as number[];
  // deno-lint-ignore no-explicit-any
  const batScores = swings.map((s: any) => s.bat_score).filter(Boolean) as number[];
  // deno-lint-ignore no-explicit-any
  const ballScores = swings.map((s: any) => s.ball_score).filter(Boolean) as number[];
  // deno-lint-ignore no-explicit-any
  const compositeScores = swings.map((s: any) => s.composite_score).filter(Boolean) as number[];
  
  const avgBody = bodyScores.length > 0 ? avg(bodyScores) : null;
  const avgBrain = brainScores.length > 0 ? avg(brainScores) : null;
  const avgBat = batScores.length > 0 ? avg(batScores) : null;
  const avgBall = ballScores.length > 0 ? avg(ballScores) : null;
  const avgComposite = compositeScores.length > 0 ? avg(compositeScores) : null;
  
  // Calculate consistency (coefficient of variation)
  let consistencyCv: number | null = null;
  if (compositeScores.length >= 2) {
    const mean = avg(compositeScores);
    const variance = compositeScores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / compositeScores.length;
    const stdDev = Math.sqrt(variance);
    consistencyCv = mean > 0 ? (stdDev / mean) * 100 : null;
  }
  
  // Find primary leak (most common)
  const leakCounts: Record<string, number> = {};
  // deno-lint-ignore no-explicit-any
  swings.forEach((s: any) => {
    if (s.leak_detected) {
      leakCounts[s.leak_detected] = (leakCounts[s.leak_detected] || 0) + 1;
    }
  });
  
  let primaryLeak: string | null = null;
  let maxLeakCount = 0;
  for (const [leak, count] of Object.entries(leakCounts)) {
    if (count > maxLeakCount) {
      maxLeakCount = count;
      primaryLeak = leak;
    }
  }
  const leakFrequency = primaryLeak ? `${primaryLeak}: ${maxLeakCount}/${n} swings` : null;
  
  // Determine motor profile (mode with confidence)
  const profileCounts: Record<string, number> = {};
  // deno-lint-ignore no-explicit-any
  swings.forEach((s: any) => {
    const profile = s.motor_profile_indication || s.motor_profile;
    if (profile) {
      profileCounts[profile] = (profileCounts[profile] || 0) + 1;
    }
  });
  
  let dominantProfile: string | null = null;
  let maxProfileCount = 0;
  for (const [profile, count] of Object.entries(profileCounts)) {
    if (count > maxProfileCount) {
      maxProfileCount = count;
      dominantProfile = profile;
    }
  }
  const profileConfidence = dominantProfile && n > 0 ? maxProfileCount / n : null;
  
  // Check if all swings are complete
  const { count: totalSwings } = await supabase
    .from("video_2d_sessions")
    .select("*", { count: "exact", head: true })
    .eq("batch_session_id", batchSessionId);
  
  const status = n === totalSwings ? "complete" : "in_progress";
  
  // Update batch session
  const { error: updateError } = await supabase
    .from("video_2d_batch_sessions")
    .update({
      avg_composite_score: avgComposite,
      avg_body_score: avgBody,
      avg_brain_score: avgBrain,
      avg_bat_score: avgBat,
      avg_ball_score: avgBall,
      consistency_cv: consistencyCv,
      primary_leak: primaryLeak,
      leak_frequency: leakFrequency,
      motor_profile: dominantProfile,
      profile_confidence: profileConfidence,
      swing_count: n,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchSessionId);
  
  if (updateError) {
    console.error("[2D Aggregation] Failed to update batch session:", updateError);
  } else {
    console.log(`[2D Aggregation] Updated batch ${batchSessionId}: Composite=${avgComposite?.toFixed(1)}, CV=${consistencyCv?.toFixed(1)}%, Leak=${primaryLeak}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      player_id, 
      video_url, 
      video_filename,
      video_storage_path,
      is_paid_user = false, 
      player_age, 
      player_level,
      context,
      frame_rate,
      frames,
      batch_session_id,
      swing_index
    } = await req.json() as Video2DRequest;

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!frames || frames.length === 0) {
      return new Response(
        JSON.stringify({ error: "frames array is required - extract frames on client side before calling" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`[2D Analysis] Creating async session for player ${player_id} with ${frames.length} frames`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create initial record with "processing" status - return immediately
    const sessionDate = new Date().toISOString().split('T')[0];
    
    const { data: sessionRecord, error: insertError } = await supabase
      .from("video_2d_sessions")
      .insert({
        player_id,
        video_url,
        video_filename,
        video_storage_path,
        session_date: sessionDate,
        context,
        frame_rate,
        upload_source: "player_upload",
        is_paid_user,
        pending_3d_analysis: is_paid_user,
        processing_status: "processing",
        batch_session_id: batch_session_id || null,
        swing_index: swing_index || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[2D Analysis] Failed to create session:", insertError);
      throw new Error("Failed to create analysis session");
    }

    console.log(`[2D Analysis] Created session ${sessionRecord.id}, starting background processing`);

    // Start background processing - this runs AFTER we return the response
    // Using EdgeRuntime.waitUntil to keep the function running
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(
      processAnalysisInBackground(
        sessionRecord.id,
        player_id,
        frames,
        player_age,
        player_level,
        is_paid_user
      )
    );

    // Return immediately with session ID - client will poll for results
    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionRecord.id,
        status: "processing",
        frames_received: frames.length,
        message: "Analysis started. Video will be processed in the background. Check back in a few seconds for results.",
        poll_interval_ms: 3000, // Suggest client poll every 3 seconds
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[2D Analysis] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
