/**
 * supabase/functions/calculate-4b-scores/index.ts
 *
 * THE single authoritative 4B scoring engine.
 * All paths (Reboot CSV, DK sensor, manual) funnel here.
 * Returns ScoringResult — no other shape is allowed.
 *
 * Formula (v2.1):
 *   Full mode     : score_4bkrs = Body×0.45 + Brain×0.15 + Bat×0.25 + Ball×0.15
 *   Training mode : score_4bkrs = Body×0.55 + Brain×0.15 + Bat×0.30
 *
 * Body  = Creation×0.40 + Transfer×0.60
 * Brain = Tempo×0.40 + Sequence Timing×0.35 + Rhythm×0.25
 * Bat   = (Bat Speed×0.30 + Acceleration×0.25 + Lag×0.25 + Attack Angle×0.20) × transferFactor
 * Ball  = Exit Velo×0.40 + Launch Angle×0.25 + Spray×0.20 + Hard Hit×0.15
 *         (uses predicted EV when measured EV is missing)
 *
 * v2.1 additions:
 *   - transfer_efficiency (0–1): energy reaching the barrel
 *   - BAT is modulated by transfer_efficiency (poor transfer caps score)
 *   - BALL uses predicted_exit_velocity_mph when no measured EV
 *   - predicted_bat_speed_mph incorporates mass + transfer_efficiency
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ---------------------------------------------------------------------------
// TYPES (inlined — edge functions cannot import from src/)
// ---------------------------------------------------------------------------

type ScoringMode    = 'full' | 'training';
type ScoringVersion = 'v1_legacy' | 'v2';
type FourBRating    = 'Elite' | 'Good' | 'Working' | 'Priority';
type ScoreSource    = 'reboot_csv' | 'sensor' | 'manual';
type PlayerLevel    = 'youth' | 'high_school' | 'college' | 'pro';

interface FourBScores {
  score_4bkrs: number;
  mode: ScoringMode;
  version: ScoringVersion;
  body: number;
  brain: number;
  bat: number;
  ball: number | null;
  rating: FourBRating;
  color: string;
  creation: number;
  transfer: number;
  transfer_ratio: number;
  timing_gap_pct: number;
  bat_speed_mph: number | null;
  exit_velocity_mph: number | null;
}

interface ScoreCalculationInput {
  source: ScoreSource;
  pelvis_omega_peak: number;        // deg/s
  trunk_omega_peak: number;         // deg/s
  arm_omega_peak: number;           // deg/s
  bat_omega_peak?: number;          // deg/s — optional for sensor path

  pelvis_omega_time: number;        // ms from FFC
  trunk_omega_time: number;         // ms from FFC

  hip_shoulder_sep_max_deg: number;
  stride_length_rel_hip: number;
  front_foot_angle_deg: number;
  load_duration_ms: number;
  launch_duration_ms: number;
  transfer_ratio: number;

  exit_velocity_mph?: number;
  launch_angle_deg?: number;
  spray_angle_deg?: number;
  hard_hit_rate?: number;

  player_level: PlayerLevel;
  motor_profile?: string;

  // Optional ME-derived fields for future plug-in
  mass_total_kg?: number;           // total body mass from ME
  bat_energy_j?: number;            // KE at barrel from ME
  total_body_energy_j?: number;     // sum of all segment KE from ME
}

interface ScoringResult extends FourBScores {
  predicted_bat_speed_mph?: number | null;
  predicted_exit_velocity_mph?: number | null;
  predicted_entry_bucket?: string | null;
  actual_bat_speed_mph?: number | null;
  actual_exit_velocity_mph?: number | null;
  actual_entry_bucket?: string | null;
  transfer_efficiency?: number | null;
  scoring_timestamp: string;
}

// ---------------------------------------------------------------------------
// CONSTANTS  (do not change without updating KRS_CALCULATION_LOGIC.md)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  full:     { body: 0.45, brain: 0.15, bat: 0.25, ball: 0.15 },
  training: { body: 0.55, brain: 0.15, bat: 0.30, ball: 0    },
} as const;

const RATING_THRESHOLDS = { elite: 90, good: 80, working: 60 } as const;
const RATING_COLORS = { elite: '#4ecdc4', good: '#4ecdc4', working: '#ffa500', priority: '#ff6b6b' } as const;

const TRANSFER_RATIO_ELITE = { min: 1.5, max: 1.8 } as const;
const TIMING_GAP_ELITE = { min: 14, max: 18 } as const;

/** Default body mass (kg) when ME masstotal not available */
const DEFAULT_MASS_KG: Record<PlayerLevel, number> = {
  youth: 45,
  high_school: 75,
  college: 85,
  pro: 90,
};

/** Estimated pitch speed for predicted EV formula */
const EST_PITCH_SPEED_MPH: Record<PlayerLevel, number> = {
  youth: 55,
  high_school: 75,
  college: 85,
  pro: 90,
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  return clamp(outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin));
}

function toRating(score: number): FourBRating {
  if (score >= RATING_THRESHOLDS.elite)   return 'Elite';
  if (score >= RATING_THRESHOLDS.good)    return 'Good';
  if (score >= RATING_THRESHOLDS.working) return 'Working';
  return 'Priority';
}

function toColor(rating: FourBRating): string {
  if (rating === 'Elite' || rating === 'Good') return RATING_COLORS.elite;
  if (rating === 'Working') return RATING_COLORS.working;
  return RATING_COLORS.priority;
}

// ---------------------------------------------------------------------------
// STEP 1: TRANSFER EFFICIENCY (0–1)
// ---------------------------------------------------------------------------

/**
 * Compute transfer_efficiency — how much body energy reaches the barrel.
 *
 * Ideal path (when bat_energy and total_body_energy are provided from ME):
 *   transfer_efficiency = bat_energy / total_body_energy
 *
 * Proxy path (angular velocity ratios — current default):
 *   Uses the kinematic chain ratios to approximate energy transfer.
 *   A well-sequenced swing where each segment accelerates the next
 *   should show: pelvis < trunk < arm < bat omega peaks in the right ratios.
 *
 *   Key signals:
 *   - arm_to_trunk ratio: is the arm gaining speed from the torso?
 *   - bat_to_arm ratio: is the bat gaining speed from the hands?
 *   - transfer_ratio (trunk/pelvis): is energy moving up the chain?
 *   - timing: proper sequencing (pelvis peaks before trunk)
 */
function computeTransferEfficiency(input: ScoreCalculationInput): number {
  // Ideal path: real energy data from ME
  if (input.bat_energy_j != null && input.total_body_energy_j != null && input.total_body_energy_j > 0) {
    return Math.min(1, Math.max(0, input.bat_energy_j / input.total_body_energy_j));
  }

  // Proxy path: angular velocity chain ratios
  const trunkOmega  = Math.max(input.trunk_omega_peak, 1);
  const armOmega    = Math.max(input.arm_omega_peak, 1);
  const batOmega    = input.bat_omega_peak ?? armOmega * 0.9; // conservative if missing

  // Arm-to-trunk gain: ideal ~1.2–1.6 (arm should be faster than trunk)
  const armToTrunk = armOmega / trunkOmega;
  const armToTrunkScore = armToTrunk > 1.0
    ? Math.min(1, (armToTrunk - 1.0) / 0.6)  // 1.0→0, 1.6→1
    : armToTrunk * 0.3;                        // below 1.0 = very poor

  // Bat-to-arm gain: ideal > 1.0 (bat should outpace arm/hands)
  const batToArm = batOmega / armOmega;
  const batToArmScore = batToArm > 1.0
    ? Math.min(1, (batToArm - 1.0) / 0.3 * 0.5 + 0.5)  // 1.0→0.5, 1.3→1.0
    : batToArm * 0.4;                                      // below 1.0 = energy lost

  // Transfer ratio (trunk/pelvis): ideal 1.5–1.8
  const tr = input.transfer_ratio;
  const trScore = (tr >= TRANSFER_RATIO_ELITE.min && tr <= TRANSFER_RATIO_ELITE.max)
    ? 1.0
    : tr < TRANSFER_RATIO_ELITE.min
      ? lerp(tr, 0.8, TRANSFER_RATIO_ELITE.min, 0.2, 0.9) / 100 * 100 // normalize
      : lerp(tr, TRANSFER_RATIO_ELITE.max, 2.5, 0.9, 0.3) / 100 * 100;

  // Normalize trScore to 0-1 (lerp returns 0-100 range)
  const trNorm = (tr >= TRANSFER_RATIO_ELITE.min && tr <= TRANSFER_RATIO_ELITE.max)
    ? 1.0
    : tr < TRANSFER_RATIO_ELITE.min
      ? Math.max(0, Math.min(1, (tr - 0.8) / (TRANSFER_RATIO_ELITE.min - 0.8)))
      : Math.max(0, Math.min(1, 1 - (tr - TRANSFER_RATIO_ELITE.max) / (2.5 - TRANSFER_RATIO_ELITE.max)));

  // Sequencing penalty: pelvis must peak before trunk
  const sequencingBonus = input.pelvis_omega_time < input.trunk_omega_time ? 1.0 : 0.5;

  // Weighted combination
  const raw = (
    armToTrunkScore * 0.30 +
    batToArmScore   * 0.30 +
    trNorm          * 0.25 +
    sequencingBonus * 0.15
  );

  return Math.max(0, Math.min(1, raw));
}

// ---------------------------------------------------------------------------
// STEP 2: PREDICTED BAT SPEED & PREDICTED EXIT VELOCITY
// ---------------------------------------------------------------------------

/**
 * Predict bat speed from kinematics, mass, and transfer efficiency.
 * 
 * Base: angular velocity conversion (existing logic)
 * Modifiers:
 *   - mass factor: heavier players have more potential KE
 *   - transfer_efficiency: how much of that KE reaches the barrel
 *   - transfer_ratio: kinematic chain quality
 */
function predictBatSpeed(
  input: ScoreCalculationInput,
  transferEfficiency: number
): number {
  const massKg = input.mass_total_kg ?? DEFAULT_MASS_KG[input.player_level] ?? 80;

  // Base from bat omega (or arm omega proxy)
  const omega = input.bat_omega_peak ?? (input.arm_omega_peak * 1.1);
  const baseBatSpeed = omega * 0.0236; // existing conversion factor

  // Mass factor: normalized around reference mass (80kg)
  // More mass = more potential energy, but diminishing returns
  const massFactor = 0.85 + 0.15 * Math.min(1.3, massKg / 80);

  // Transfer modifier: poor transfer_efficiency significantly reduces predicted bat speed
  // Efficiency 0.3 → 0.55 multiplier; 0.8 → 1.0 multiplier
  const transferMod = 0.4 + 0.6 * Math.min(1, transferEfficiency / 0.8);

  // Transfer ratio quality bonus
  const tr = input.transfer_ratio;
  const trBonus = (tr >= 1.4 && tr <= 1.9) ? 1.0 : (tr >= 1.1 && tr <= 2.2) ? 0.92 : 0.80;

  return Math.round(baseBatSpeed * massFactor * transferMod * trBonus * 10) / 10;
}

/**
 * Predict exit velocity from predicted bat speed + transfer efficiency.
 *
 * Simple collision model:
 *   EV ≈ q × bat_speed + (1 + q) × pitch_speed × efficiency_modifier
 * where q ≈ 0.2 (coefficient of restitution proxy)
 * 
 * Transfer modifier: poor efficiency = less barrel energy at contact = lower EV
 */
function predictExitVelocity(
  predictedBatSpeed: number,
  transferEfficiency: number,
  playerLevel: PlayerLevel
): number {
  const pitchSpeed = EST_PITCH_SPEED_MPH[playerLevel] ?? 80;

  // Bat-ball collision factor
  const q = 0.20; // COR proxy for wood/composite bat
  const baseEV = q * predictedBatSpeed + (1 + q) * pitchSpeed * 0.22;

  // Primary driver: bat speed contribution (dominant factor in EV)
  const batContribution = predictedBatSpeed * 1.15;

  // Blend: collision physics + direct bat speed correlation
  const rawEV = batContribution * 0.7 + baseEV * 0.3;

  // Transfer efficiency penalty: poor transfer = weak contact
  // eff 0.3 → 0.6 mult; eff 0.8 → 1.0 mult
  const effMod = 0.45 + 0.55 * Math.min(1, transferEfficiency / 0.8);

  return Math.round(rawEV * effMod * 10) / 10;
}

// ---------------------------------------------------------------------------
// PILLAR CALCULATORS
// ---------------------------------------------------------------------------

/** BODY — Creation (40%) + Transfer (60%) */
function calculateBody(input: ScoreCalculationInput): { body: number; creation: number; transfer: number } {
  const pelvisVelScore = lerp(input.pelvis_omega_peak, 300, 900, 0, 100);
  const xFactorScore = lerp(input.hip_shoulder_sep_max_deg, 20, 55, 0, 100);
  const tempoRatio = input.load_duration_ms / Math.max(input.launch_duration_ms, 1);
  const loadScore  = lerp(tempoRatio, 1.2, 2.4, 0, 100);
  const strideScore = lerp(input.stride_length_rel_hip, 0.5, 1.4, 0, 100);

  const creation = clamp(
    pelvisVelScore * 0.35 +
    xFactorScore   * 0.25 +
    loadScore      * 0.25 +
    strideScore    * 0.15
  );

  const tr = input.transfer_ratio;
  let transferRatioScore: number;
  if (tr >= TRANSFER_RATIO_ELITE.min && tr <= TRANSFER_RATIO_ELITE.max) {
    transferRatioScore = 90 + lerp(tr, TRANSFER_RATIO_ELITE.min, TRANSFER_RATIO_ELITE.max, 0, 10);
  } else if (tr < TRANSFER_RATIO_ELITE.min) {
    transferRatioScore = lerp(tr, 0.8, TRANSFER_RATIO_ELITE.min, 20, 90);
  } else {
    transferRatioScore = lerp(tr, TRANSFER_RATIO_ELITE.max, 2.5, 90, 20);
  }

  const totalSwingMs = input.load_duration_ms + input.launch_duration_ms;
  const timingGapMs  = input.trunk_omega_time - input.pelvis_omega_time;
  const timingGapPct = totalSwingMs > 0 ? (timingGapMs / totalSwingMs) * 100 : 0;
  let timingScore: number;
  if (timingGapPct >= TIMING_GAP_ELITE.min && timingGapPct <= TIMING_GAP_ELITE.max) {
    timingScore = 95;
  } else if (timingGapPct < TIMING_GAP_ELITE.min) {
    timingScore = lerp(timingGapPct, 0, TIMING_GAP_ELITE.min, 20, 95);
  } else {
    timingScore = lerp(timingGapPct, TIMING_GAP_ELITE.max, 35, 95, 30);
  }

  const decelScore = input.pelvis_omega_time < input.trunk_omega_time ? 85 : 40;

  const transfer = clamp(
    transferRatioScore * 0.35 +
    decelScore         * 0.30 +
    timingScore        * 0.20 +
    (input.arm_omega_peak > input.trunk_omega_peak ? 85 : 50) * 0.15
  );

  const body = clamp(creation * 0.40 + transfer * 0.60);

  return { body: Math.round(body), creation: Math.round(creation), transfer: Math.round(transfer) };
}

/** BRAIN — Tempo (40%) + Sequence Timing (35%) + Rhythm (25%) */
function calculateBrain(input: ScoreCalculationInput): number {
  const tempoRatio = input.load_duration_ms / Math.max(input.launch_duration_ms, 1);
  const tempoScore = lerp(Math.abs(tempoRatio - 2.0), 0.2, 1.0, 100, 20);

  const totalSwingMs  = input.load_duration_ms + input.launch_duration_ms;
  const timingGapMs   = input.trunk_omega_time - input.pelvis_omega_time;
  const timingGapPct  = totalSwingMs > 0 ? (timingGapMs / totalSwingMs) * 100 : 0;
  const seqScore = (timingGapPct >= 14 && timingGapPct <= 18) ? 95
    : timingGapPct >= 10 && timingGapPct < 14 ? 75
    : timingGapPct > 18  && timingGapPct <= 22 ? 70
    : 40;

  const correctOrder =
    input.pelvis_omega_time < input.trunk_omega_time &&
    input.trunk_omega_time  < (input.pelvis_omega_time + totalSwingMs * 0.5);
  const rhythmScore = correctOrder ? 85 : 45;

  return Math.round(clamp(
    tempoScore  * 0.40 +
    seqScore    * 0.35 +
    rhythmScore * 0.25
  ));
}

/**
 * BAT — Bat delivery quality after energy transfer.
 *
 * Component scores: Bat Speed (30%) + Acceleration (25%) + Lag (25%) + Attack Angle (20%)
 * Then modulated by transfer_efficiency: poor transfer caps the BAT score,
 * reflecting that raw bat speed means little if energy doesn't reach the barrel.
 */
function calculateBat(
  input: ScoreCalculationInput,
  playerLevel: string,
  transferEfficiency: number,
  predictedBatSpeedMph: number
): { bat: number; bat_speed_mph: number | null; predicted_bat_speed_mph: number | null } {
  const benchmarks: Record<string, { min: number; elite: number }> = {
    youth:        { min: 40, elite: 58 },
    high_school:  { min: 58, elite: 72 },
    college:      { min: 66, elite: 80 },
    pro:          { min: 68, elite: 85 },
  };
  const bench = benchmarks[playerLevel] ?? benchmarks['high_school'];

  // Use the transfer-efficiency-aware predicted bat speed
  const bat_speed_mph = Math.round(predictedBatSpeedMph);

  const batSpeedScore = lerp(bat_speed_mph, bench.min, bench.elite, 20, 100);

  const accelScore = lerp(
    input.arm_omega_peak / Math.max(input.trunk_omega_peak, 1),
    1.0, 1.8, 40, 100
  );

  const lagScore = input.bat_omega_peak != null && input.bat_omega_peak > input.arm_omega_peak
    ? 85 : 55;

  const attackAngleProxyScore = lerp(input.front_foot_angle_deg, 10, 45, 80, 40);

  // Raw component score
  const rawBat = clamp(
    batSpeedScore         * 0.30 +
    accelScore            * 0.25 +
    lagScore              * 0.25 +
    attackAngleProxyScore * 0.20
  );

  // Modulate by transfer efficiency:
  // Very poor (<0.3) → 40% of raw score; Good (0.9+) → 100% of raw score
  const effectiveTransferFactor = lerp(transferEfficiency, 0.3, 0.9, 0.4, 1.0) / 100;
  // lerp returns 0-100 range, we need 0-1 factor. 40→0.4, 100→1.0
  const transferFactor = 0.4 + 0.6 * Math.min(1, Math.max(0, (transferEfficiency - 0.3) / 0.6));

  const bat = Math.round(clamp(rawBat * transferFactor));

  return { bat, bat_speed_mph, predicted_bat_speed_mph: Math.round(predictedBatSpeedMph * 10) / 10 };
}

/**
 * BALL — Batted ball outcome quality.
 *
 * When measured EV is available: uses actual EV.
 * When NO measured EV: uses predicted_exit_velocity_mph so that
 * players with poor transfer efficiency get a low BALL score
 * reflecting the predicted poor batted-ball outcome, rather than null.
 *
 * Exit Velo (40%) + Launch Angle (25%) + Spray (20%) + Hard Hit (15%)
 */
function calculateBall(
  input: ScoreCalculationInput,
  playerLevel: string,
  predictedExitVeloMph: number,
  transferEfficiency: number
): { ball: number; usedPrediction: boolean } {
  // Determine which EV to use for scoring
  const hasActualEV = input.exit_velocity_mph != null;
  const scoringEV = hasActualEV ? input.exit_velocity_mph! : predictedExitVeloMph;

  const evBenchmarks: Record<string, { min: number; elite: number }> = {
    youth:       { min: 40, elite: 65 },
    high_school: { min: 68, elite: 92 },
    college:     { min: 78, elite: 100 },
    pro:         { min: 85, elite: 108 },
  };
  const bench = evBenchmarks[playerLevel] ?? evBenchmarks['high_school'];
  const exitVeloScore = lerp(scoringEV, bench.min, bench.elite, 20, 100);

  // When using prediction, apply a small confidence discount (max 10%)
  // to reflect uncertainty vs. measured data
  const confidenceFactor = hasActualEV ? 1.0 : 0.90;

  const la = input.launch_angle_deg ?? (hasActualEV ? 15 : 12); // slightly pessimistic default when predicting
  const launchScore = la >= 8 && la <= 32 ? lerp(Math.abs(la - 20), 0, 12, 100, 60) : 40;

  const spray = input.spray_angle_deg ?? 0;
  const sprayScore =
    Math.abs(spray) <= 15 ? 90
    : spray > 15 && spray <= 30 ? 85
    : spray < -15 && spray >= -30 ? 95
    : Math.abs(spray) <= 45 ? 70
    : 50;

  // When predicting, use transfer efficiency to estimate hard-hit capability
  const hardHitRate = input.hard_hit_rate
    ?? (hasActualEV
      ? (input.exit_velocity_mph! >= bench.elite * 0.95 ? 80 : 40)
      : transferEfficiency * 65 + 10); // eff 0.3→~30%, eff 0.8→~62%
  const hardHitScore = lerp(hardHitRate, 20, 50, 20, 100);

  const rawBall = clamp(
    exitVeloScore * 0.40 +
    launchScore   * 0.25 +
    sprayScore    * 0.20 +
    hardHitScore  * 0.15
  );

  const ball = Math.round(clamp(rawBall * confidenceFactor));

  return { ball, usedPrediction: !hasActualEV };
}

// ---------------------------------------------------------------------------
// COMPOSITE CALCULATOR
// ---------------------------------------------------------------------------

function computeScoringResult(input: ScoreCalculationInput): ScoringResult {
  // Step 1: Transfer efficiency
  const transferEfficiency = computeTransferEfficiency(input);

  // Step 2: Predicted bat speed and exit velo (always computed)
  const predictedBatSpeedMph = predictBatSpeed(input, transferEfficiency);
  const predictedExitVeloMph = predictExitVelocity(predictedBatSpeedMph, transferEfficiency, input.player_level);

  // Pillars
  const { body, creation, transfer } = calculateBody(input);
  const brain = calculateBrain(input);
  const { bat, bat_speed_mph, predicted_bat_speed_mph } = calculateBat(input, input.player_level, transferEfficiency, predictedBatSpeedMph);
  const { ball, usedPrediction } = calculateBall(input, input.player_level, predictedExitVeloMph, transferEfficiency);

  // BALL is always computed (from actual or predicted EV).
  // Mode determines composite weights: training mode uses BALL weight = 0,
  // but BALL is still stored for diagnostics.
  const hasActualOutcome = input.exit_velocity_mph != null;
  const mode: ScoringMode = hasActualOutcome ? 'full' : 'training';
  const w = WEIGHTS[mode];

  const score_4bkrs = Math.round(clamp(
    body  * w.body  +
    brain * w.brain +
    bat   * w.bat   +
    ball  * w.ball
  ));

  const rating = toRating(score_4bkrs);
  const color  = toColor(rating);

  const totalSwingMs = input.load_duration_ms + input.launch_duration_ms;
  const timingGapMs  = input.trunk_omega_time - input.pelvis_omega_time;
  const timing_gap_pct = totalSwingMs > 0
    ? Math.round((timingGapMs / totalSwingMs) * 100 * 10) / 10
    : 0;

  return {
    score_4bkrs,
    mode,
    version:          'v2',
    body, brain, bat,
    ball,             // Always populated (from actual or predicted EV)
    rating, color,
    creation, transfer,
    transfer_ratio:    Math.round(input.transfer_ratio * 1000) / 1000,
    timing_gap_pct,
    bat_speed_mph,
    exit_velocity_mph: input.exit_velocity_mph ?? null,

    // Predictions (always populated now)
    predicted_bat_speed_mph,
    predicted_exit_velocity_mph: Math.round(predictedExitVeloMph * 10) / 10,
    predicted_entry_bucket:      null,

    // Actuals
    actual_bat_speed_mph:        input.exit_velocity_mph != null ? bat_speed_mph : null,
    actual_exit_velocity_mph:    input.exit_velocity_mph ?? null,
    actual_entry_bucket:         null,

    // New: transfer efficiency for diagnostics
    transfer_efficiency:         Math.round(transferEfficiency * 1000) / 1000,

    scoring_timestamp:           new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---------------------------------------------------------------------------
// EDGE FUNCTION HANDLER
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: ScoreCalculationInput = await req.json();

    // Basic validation
    const required: Array<keyof ScoreCalculationInput> = [
      'source', 'pelvis_omega_peak', 'trunk_omega_peak', 'arm_omega_peak',
      'pelvis_omega_time', 'trunk_omega_time', 'transfer_ratio', 'player_level',
    ];
    const missing = required.filter(k => input[k] == null);
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: ScoringResult = computeScoringResult(input);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[calculate-4b-scores] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal scoring error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Export for documentation purposes (actual sharing is via HTTP)
export { computeScoringResult };
export type { ScoreCalculationInput, ScoringResult };
