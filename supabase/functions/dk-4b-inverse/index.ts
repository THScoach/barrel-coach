import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ================================
// TYPE DEFINITIONS
// ================================

interface CanonicalSwing {
  id?: string;
  bat_speed_mph: number | null;
  hand_speed_mph: number | null;
  trigger_to_impact_ms: number | null;
  attack_angle_deg: number | null;
  attack_direction_deg: number | null;
  applied_power: number | null;
  hand_to_bat_ratio: number | null;
  raw_dk_data?: {
    data?: {
      impactMomentum?: number;
      verticalBatAngle?: number;
      approachAngle?: number;
      [key: string]: unknown;
    };
  };
}

interface FourBScores {
  brain: { score: number; flags: string[]; components: Record<string, number> };
  body: { score: number; flags: string[]; components: Record<string, number> };
  bat: { score: number; flags: string[]; components: Record<string, number> };
  ball: { score: number; ghostEV: number; components: Record<string, number> };
  composite: number;
  weakestCategory: string;
  leaks: Leak[];
}

interface Leak {
  type: string;
  category: "brain" | "body" | "bat" | "ball";
  severity: "low" | "medium" | "high";
  description: string;
  metric_value: number;
  threshold: number;
}

interface SessionContext {
  environment?: "tee" | "front_toss" | "machine" | "live_pitch";
  estimatedPitchSpeed?: number;
}

// ================================
// STATISTICAL HELPERS
// ================================

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squaredDiffs));
}

function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return stdDev(values) / avg;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function to2080Scale(percentile: number): number {
  // Map 0-100 percentile to 20-80 scouting scale
  return Math.round(20 + (percentile / 100) * 60);
}

// ================================
// BRAIN SCORE - Timing Consistency
// ================================

function calculateBrainScore(swings: CanonicalSwing[]): {
  score: number;
  flags: string[];
  components: Record<string, number>;
} {
  const flags: string[] = [];
  
  // Extract trigger-to-impact times
  const timings = swings
    .map((s) => s.trigger_to_impact_ms)
    .filter((t): t is number => t !== null && t > 0);

  if (timings.length < 3) {
    return {
      score: 50, // Default neutral
      flags: ["Insufficient swings for timing analysis"],
      components: { timing_cv: 0, timing_mean: 0, timing_std_dev: 0, sample_size: timings.length },
    };
  }

  const timingMean = mean(timings);
  const timingStd = stdDev(timings);
  const timingCV = coefficientOfVariation(timings);

  // Score calculation:
  // CV < 5% = Elite (90-100)
  // CV 5-10% = Plus (70-89)
  // CV 10-15% = Average (50-69)
  // CV 15-20% = Below Average (30-49)
  // CV > 20% = Poor (<30)
  let rawScore: number;
  if (timingCV < 0.05) {
    rawScore = 90 + (0.05 - timingCV) * 200; // 90-100
  } else if (timingCV < 0.10) {
    rawScore = 70 + (0.10 - timingCV) * 400; // 70-90
  } else if (timingCV < 0.15) {
    rawScore = 50 + (0.15 - timingCV) * 400; // 50-70
  } else if (timingCV < 0.20) {
    rawScore = 30 + (0.20 - timingCV) * 400; // 30-50
  } else {
    rawScore = Math.max(20, 30 - (timingCV - 0.20) * 100);
  }

  // Flag high variance as Timing Leak
  if (timingCV > 0.12) {
    flags.push("Timing Leak");
  }
  if (timingCV > 0.18) {
    flags.push("Severe Timing Variance");
  }

  return {
    score: to2080Scale(clamp(rawScore, 0, 100)),
    flags,
    components: {
      timing_cv: Math.round(timingCV * 1000) / 10, // As percentage
      timing_mean_ms: Math.round(timingMean * 10) / 10,
      timing_std_dev_ms: Math.round(timingStd * 10) / 10,
      sample_size: timings.length,
    },
  };
}

// ================================
// BODY SCORE - Power Transfer
// ================================

function calculateBodyScore(swings: CanonicalSwing[]): {
  score: number;
  flags: string[];
  components: Record<string, number>;
} {
  const flags: string[] = [];

  // Extract impact momentum and max barrel speed
  const momentumData: { momentum: number; batSpeed: number }[] = [];

  for (const swing of swings) {
    const batSpeed = swing.bat_speed_mph;
    const rawData = swing.raw_dk_data?.data;
    const impactMomentum = rawData?.impactMomentum;

    if (batSpeed !== null && batSpeed > 0 && typeof impactMomentum === "number" && impactMomentum > 0) {
      momentumData.push({ momentum: impactMomentum, batSpeed });
    }
  }

  // Fallback to hand-to-bat ratio if momentum not available
  if (momentumData.length < 3) {
    const ratios = swings
      .map((s) => s.hand_to_bat_ratio)
      .filter((r): r is number => r !== null && r > 0);

    if (ratios.length < 3) {
      return {
        score: 50,
        flags: ["Insufficient data for power analysis"],
        components: { transfer_efficiency: 0, sample_size: 0 },
      };
    }

    const avgRatio = mean(ratios);
    // Ideal hand-to-bat ratio is around 1.4-1.6
    let rawScore: number;
    if (avgRatio >= 1.5) {
      rawScore = 80 + (avgRatio - 1.5) * 40;
    } else if (avgRatio >= 1.3) {
      rawScore = 60 + (avgRatio - 1.3) * 100;
    } else if (avgRatio >= 1.1) {
      rawScore = 40 + (avgRatio - 1.1) * 100;
    } else {
      rawScore = Math.max(20, avgRatio * 36);
    }

    if (avgRatio < 1.25) {
      flags.push("Energy Transfer Leak");
    }

    return {
      score: to2080Scale(clamp(rawScore, 0, 100)),
      flags,
      components: {
        hand_to_bat_ratio: Math.round(avgRatio * 100) / 100,
        sample_size: ratios.length,
      },
    };
  }

  // Calculate momentum-to-speed ratio for each swing
  const efficiencyRatios = momentumData.map(({ momentum, batSpeed }) => {
    // Expected momentum = batSpeed * constant (mass factor)
    // If actual momentum is low relative to speed, energy leaked early
    // Normalize: higher ratio = better retention
    const expectedMomentum = batSpeed * 0.8; // Approximation
    return momentum / expectedMomentum;
  });

  const avgEfficiency = mean(efficiencyRatios);

  // Score based on efficiency
  // > 1.1 = Elite (energy added through ground)
  // 0.95-1.1 = Good
  // 0.8-0.95 = Average
  // < 0.8 = Power leak
  let rawScore: number;
  if (avgEfficiency >= 1.1) {
    rawScore = 90 + (avgEfficiency - 1.1) * 50;
  } else if (avgEfficiency >= 0.95) {
    rawScore = 70 + (avgEfficiency - 0.95) * 133;
  } else if (avgEfficiency >= 0.8) {
    rawScore = 50 + (avgEfficiency - 0.8) * 133;
  } else {
    rawScore = Math.max(20, avgEfficiency * 62.5);
  }

  // Flag power leak if efficiency is low
  if (avgEfficiency < 0.85) {
    flags.push("Power Leak");
    flags.push("Slingshot fired too early");
  } else if (avgEfficiency < 0.95) {
    flags.push("Mild Power Leak");
  }

  return {
    score: to2080Scale(clamp(rawScore, 0, 100)),
    flags,
    components: {
      momentum_efficiency: Math.round(avgEfficiency * 100) / 100,
      avg_impact_momentum: Math.round(mean(momentumData.map((d) => d.momentum)) * 10) / 10,
      avg_bat_speed: Math.round(mean(momentumData.map((d) => d.batSpeed)) * 10) / 10,
      sample_size: momentumData.length,
    },
  };
}

// ================================
// BAT SCORE - Path Shape
// ================================

function calculateBatScore(swings: CanonicalSwing[]): {
  score: number;
  flags: string[];
  components: Record<string, number>;
} {
  const flags: string[] = [];

  // Extract vertical bat angle and approach angle
  const pathData: { verticalAngle: number; approachAngle: number; attackAngle: number }[] = [];

  for (const swing of swings) {
    const rawData = swing.raw_dk_data?.data;
    const verticalBatAngle = rawData?.verticalBatAngle;
    const approachAngle = rawData?.approachAngle ?? swing.attack_angle_deg;
    const attackAngle = swing.attack_angle_deg;

    if (typeof attackAngle === "number") {
      pathData.push({
        verticalAngle: typeof verticalBatAngle === "number" ? verticalBatAngle : 0,
        approachAngle: typeof approachAngle === "number" ? approachAngle : attackAngle,
        attackAngle,
      });
    }
  }

  if (pathData.length < 3) {
    return {
      score: 50,
      flags: ["Insufficient data for path analysis"],
      components: { attack_angle_mean: 0, sample_size: 0 },
    };
  }

  const avgAttackAngle = mean(pathData.map((d) => d.attackAngle));
  const attackAngleStdDev = stdDev(pathData.map((d) => d.attackAngle));
  const avgApproachAngle = mean(pathData.map((d) => d.approachAngle));

  // Ideal attack angle: 8-15 degrees for line drives
  // Too flat (<5) = choppers
  // Too steep (>20) = pop-ups
  let attackAngleScore: number;
  if (avgAttackAngle >= 8 && avgAttackAngle <= 15) {
    attackAngleScore = 85 + (7.5 - Math.abs(avgAttackAngle - 11.5)) * 2;
  } else if (avgAttackAngle >= 5 && avgAttackAngle <= 20) {
    attackAngleScore = 60 + (1 - Math.min(Math.abs(avgAttackAngle - 11.5), 8.5) / 8.5) * 25;
  } else if (avgAttackAngle >= 0 && avgAttackAngle <= 25) {
    attackAngleScore = 40;
  } else {
    attackAngleScore = 25;
  }

  // Path consistency bonus/penalty
  const consistencyScore = Math.max(0, 100 - attackAngleStdDev * 8);
  
  // Combine scores
  const rawScore = attackAngleScore * 0.7 + consistencyScore * 0.3;

  // Determine path shape
  let pathShape: string;
  if (avgAttackAngle < 5) {
    pathShape = "Flat/Chopper";
    flags.push("Bat Path Too Flat");
  } else if (avgAttackAngle > 20) {
    pathShape = "Uppercut/Pop-Up";
    flags.push("Bat Path Too Steep");
  } else if (avgAttackAngle >= 8 && avgAttackAngle <= 15) {
    pathShape = "Optimal Line Drive";
  } else {
    pathShape = "Acceptable";
  }

  if (attackAngleStdDev > 6) {
    flags.push("Inconsistent Bat Path");
  }

  return {
    score: to2080Scale(clamp(rawScore, 0, 100)),
    flags,
    components: {
      attack_angle_mean: Math.round(avgAttackAngle * 10) / 10,
      attack_angle_std_dev: Math.round(attackAngleStdDev * 10) / 10,
      approach_angle_mean: Math.round(avgApproachAngle * 10) / 10,
      consistency_score: Math.round(consistencyScore),
      sample_size: pathData.length,
    },
  };
}

// ================================
// BALL SCORE - Ghost Stats (Projected EV)
// ================================

function calculateBallScore(
  swings: CanonicalSwing[],
  sessionContext?: SessionContext
): {
  score: number;
  ghostEV: number;
  components: Record<string, number>;
} {
  // Extract bat speeds
  const batSpeeds = swings
    .map((s) => s.bat_speed_mph)
    .filter((s): s is number => s !== null && s > 30);

  if (batSpeeds.length === 0) {
    return {
      score: 50,
      ghostEV: 0,
      components: { sample_size: 0 },
    };
  }

  const avgBatSpeed = mean(batSpeeds);
  const maxBatSpeed = Math.max(...batSpeeds);

  // Determine pitch speed based on context
  let pitchSpeed: number;
  if (sessionContext?.estimatedPitchSpeed) {
    pitchSpeed = sessionContext.estimatedPitchSpeed;
  } else if (sessionContext?.environment === "tee") {
    pitchSpeed = 0;
  } else if (sessionContext?.environment === "front_toss") {
    pitchSpeed = 35;
  } else if (sessionContext?.environment === "machine") {
    pitchSpeed = 65;
  } else if (sessionContext?.environment === "live_pitch") {
    pitchSpeed = 75;
  } else {
    pitchSpeed = 50; // Default assumption
  }

  // Ghost Stats Formula: EV = Bat Speed × 1.2 + Pitch Speed × 0.2
  const projectedEV = maxBatSpeed * 1.2 + pitchSpeed * 0.2;
  const avgProjectedEV = avgBatSpeed * 1.2 + pitchSpeed * 0.2;

  // Score based on projected EV
  // 100+ mph = Elite
  // 95+ = Plus Plus
  // 90+ = Plus
  // 85+ = Above Average
  // 80+ = Average
  // 75+ = Below Average
  // <75 = Needs Work
  let rawScore: number;
  if (projectedEV >= 100) {
    rawScore = 95 + (projectedEV - 100) * 0.5;
  } else if (projectedEV >= 95) {
    rawScore = 85 + (projectedEV - 95) * 2;
  } else if (projectedEV >= 90) {
    rawScore = 75 + (projectedEV - 90) * 2;
  } else if (projectedEV >= 85) {
    rawScore = 60 + (projectedEV - 85) * 3;
  } else if (projectedEV >= 80) {
    rawScore = 45 + (projectedEV - 80) * 3;
  } else if (projectedEV >= 75) {
    rawScore = 30 + (projectedEV - 75) * 3;
  } else {
    rawScore = Math.max(20, projectedEV * 0.4);
  }

  return {
    score: to2080Scale(clamp(rawScore, 0, 100)),
    ghostEV: Math.round(projectedEV * 10) / 10,
    components: {
      max_bat_speed_mph: Math.round(maxBatSpeed * 10) / 10,
      avg_bat_speed_mph: Math.round(avgBatSpeed * 10) / 10,
      pitch_speed_mph: pitchSpeed,
      projected_max_ev_mph: Math.round(projectedEV * 10) / 10,
      projected_avg_ev_mph: Math.round(avgProjectedEV * 10) / 10,
      sample_size: batSpeeds.length,
    },
  };
}

// ================================
// COMPOSITE SCORING
// ================================

function calculateComposite(scores: {
  brain: number;
  body: number;
  bat: number;
  ball: number;
}): { composite: number; weakest: string } {
  // Weighted average (equal weights for now)
  const weights = { brain: 0.20, body: 0.25, bat: 0.25, ball: 0.30 };
  
  const composite = Math.round(
    scores.brain * weights.brain +
    scores.body * weights.body +
    scores.bat * weights.bat +
    scores.ball * weights.ball
  );

  // Find weakest category
  const entries = Object.entries(scores) as [string, number][];
  entries.sort((a, b) => a[1] - b[1]);
  const weakest = entries[0][0];

  return { composite, weakest };
}

// ================================
// LEAK DETECTION
// ================================

function detectLeaks(
  brainResult: ReturnType<typeof calculateBrainScore>,
  bodyResult: ReturnType<typeof calculateBodyScore>,
  batResult: ReturnType<typeof calculateBatScore>
): Leak[] {
  const leaks: Leak[] = [];

  // Brain leaks
  if (brainResult.flags.includes("Timing Leak")) {
    leaks.push({
      type: "timing_variance",
      category: "brain",
      severity: brainResult.flags.includes("Severe Timing Variance") ? "high" : "medium",
      description: "High variance in trigger-to-impact timing across swings",
      metric_value: brainResult.components.timing_cv,
      threshold: 12,
    });
  }

  // Body leaks
  if (bodyResult.flags.includes("Power Leak")) {
    leaks.push({
      type: "early_release",
      category: "body",
      severity: "high",
      description: "Slingshot fired too early - impact momentum low relative to bat speed",
      metric_value: bodyResult.components.momentum_efficiency || bodyResult.components.hand_to_bat_ratio,
      threshold: 0.85,
    });
  } else if (bodyResult.flags.includes("Mild Power Leak")) {
    leaks.push({
      type: "energy_transfer",
      category: "body",
      severity: "low",
      description: "Energy not fully transferring through kinetic chain",
      metric_value: bodyResult.components.momentum_efficiency || bodyResult.components.hand_to_bat_ratio,
      threshold: 0.95,
    });
  }

  // Bat leaks
  if (batResult.flags.includes("Bat Path Too Flat")) {
    leaks.push({
      type: "flat_path",
      category: "bat",
      severity: "medium",
      description: "Attack angle too flat - producing ground balls",
      metric_value: batResult.components.attack_angle_mean,
      threshold: 5,
    });
  }
  if (batResult.flags.includes("Bat Path Too Steep")) {
    leaks.push({
      type: "steep_path",
      category: "bat",
      severity: "medium",
      description: "Attack angle too steep - producing pop-ups",
      metric_value: batResult.components.attack_angle_mean,
      threshold: 20,
    });
  }
  if (batResult.flags.includes("Inconsistent Bat Path")) {
    leaks.push({
      type: "path_variance",
      category: "bat",
      severity: "low",
      description: "Bat path varies significantly between swings",
      metric_value: batResult.components.attack_angle_std_dev,
      threshold: 6,
    });
  }

  return leaks;
}

// ================================
// MAIN PROCESSING FUNCTION
// ================================

async function processDKSession(
  swings: CanonicalSwing[],
  sessionContext?: SessionContext
): Promise<FourBScores> {
  // Calculate each score
  const brainResult = calculateBrainScore(swings);
  const bodyResult = calculateBodyScore(swings);
  const batResult = calculateBatScore(swings);
  const ballResult = calculateBallScore(swings, sessionContext);

  // Calculate composite
  const { composite, weakest } = calculateComposite({
    brain: brainResult.score,
    body: bodyResult.score,
    bat: batResult.score,
    ball: ballResult.score,
  });

  // Detect leaks
  const leaks = detectLeaks(brainResult, bodyResult, batResult);

  return {
    brain: {
      score: brainResult.score,
      flags: brainResult.flags,
      components: brainResult.components,
    },
    body: {
      score: bodyResult.score,
      flags: bodyResult.flags,
      components: bodyResult.components,
    },
    bat: {
      score: batResult.score,
      flags: batResult.flags,
      components: batResult.components,
    },
    ball: {
      score: ballResult.score,
      ghostEV: ballResult.ghostEV,
      components: ballResult.components,
    },
    composite,
    weakestCategory: weakest,
    leaks,
  };
}

// ================================
// EDGE FUNCTION HANDLER
// ================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { session_id, swings: inlineSwings, session_context: inlineContext } = await req.json();

    let swingsToProcess: CanonicalSwing[];
    let sessionContext: SessionContext | undefined = inlineContext;

    // If swings provided inline, use those
    if (inlineSwings && Array.isArray(inlineSwings) && inlineSwings.length > 0) {
      swingsToProcess = inlineSwings;
    } else if (session_id) {
      // Fetch swings from database
      const { data: dbSwings, error } = await supabase
        .from("sensor_swings")
        .select("*")
        .eq("session_id", session_id)
        .eq("is_valid", true)
        .order("swing_number", { ascending: true });

      if (error) throw error;
      if (!dbSwings || dbSwings.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid swings found for session", session_id }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      swingsToProcess = dbSwings;

      // Fetch session context from sensor_sessions if not provided inline
      if (!sessionContext) {
        const { data: sessionData } = await supabase
          .from("sensor_sessions")
          .select("environment, estimated_pitch_speed")
          .eq("id", session_id)
          .single();

        if (sessionData) {
          sessionContext = {
            environment: sessionData.environment as SessionContext["environment"],
            estimatedPitchSpeed: sessionData.estimated_pitch_speed ?? undefined,
          };
          console.log(`Loaded session context from DB: env=${sessionContext.environment}, pitch=${sessionContext.estimatedPitchSpeed}mph`);
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Either session_id or swings array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${swingsToProcess.length} swings for 4B inverse engineering`);

    // Run 4B analysis with session context
    const results = await processDKSession(swingsToProcess, sessionContext);

    // If session_id provided, save results to player_sessions
    if (session_id) {
      const { error: updateError } = await supabase
        .from("player_sessions")
        .upsert({
          id: session_id,
          four_b_brain: results.brain.score,
          four_b_body: results.body.score,
          four_b_bat: results.bat.score,
          four_b_ball: results.ball.score,
          overall_score: results.composite,
          weakest_category: results.weakestCategory,
          leak_type: results.leaks.length > 0 ? results.leaks[0].type : null,
          leak_evidence: results.leaks.map((l) => l.description),
          sensor_analysis_json: {
            brain: results.brain,
            body: results.body,
            bat: results.bat,
            ball: results.ball,
            leaks: results.leaks,
            ghost_stats: {
              projected_ev: results.ball.ghostEV,
              formula: results.ball.components.formula,
            },
          },
          analyzed_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (updateError) {
        console.error("Failed to save 4B results:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        swing_count: swingsToProcess.length,
        scores: {
          brain: results.brain.score,
          body: results.body.score,
          bat: results.bat.score,
          ball: results.ball.score,
          composite: results.composite,
        },
        weakest_category: results.weakestCategory,
        ghost_ev: results.ball.ghostEV,
        leaks: results.leaks,
        detailed: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("4B inverse engineering error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
