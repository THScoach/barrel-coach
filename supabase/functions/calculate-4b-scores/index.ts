/**
 * supabase/functions/calculate-4b-scores/index.ts
 *
 * THE single authoritative 4B scoring engine.
 * All paths (Reboot CSV, DK sensor, manual) funnel here.
 * Returns ScoringResult — no other shape is allowed.
 *
 * Formula (v2.2):
 *   Full mode     : score_4bkrs = Body×0.45 + Brain×0.15 + Bat×0.25 + Ball×0.15
 *   Training mode : score_4bkrs = Body×0.55 + Brain×0.15 + Bat×0.30
 *
 * Body  = Creation×0.40 + Transfer×0.60
 * Brain = Tempo×0.40 + Sequence Timing×0.35 + Rhythm×0.25
 * Bat   = (Bat Speed×0.30 + Acceleration×0.25 + Lag×0.25 + Attack Angle×0.20) × transferFactor
 * Ball  = Exit Velo×0.40 + Launch Angle×0.25 + Spray×0.20 + Hard Hit×0.15
 *
 * v2.2 bat speed + exit velo corrections:
 *   FIX 1: Conversion constant 0.0236 → 0.02732
 *   FIX 2: Three-tier path: measured → KE-direct → estimation
 *   FIX 3: No chain modifiers on direct/measured paths
 *   FIX 4: Mass factor √(mass/80), clamped per path
 *   FIX 5: Nathan (2003) collision model for EV
 *   NEW:   bat_omega derived from bat_rot_energy KE inversion (I_BAT = 0.048)
 *   NEW:   MAX_BAT_OMEGA cap at 2800 deg/s
 *   NEW:   Hawk-Eye / DK measured bat speed as highest-priority path
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
  arm_omega_peak: number;           // deg/s — most distal IK segment (hand > arm > torso)
  arm_omega_source?: string;        // source column name (e.g. 'left_elbow', 'rhand_rot')

  // Three-tier bat speed inputs (use highest available)
  measured_bat_speed_mph?: number | null;  // Hawk-Eye or DK sensor — TIER 1
  bat_omega_from_ke?: number | null;       // From bat_rot_energy KE inversion — TIER 2
  bat_omega_peak?: number;                 // Legacy field (treated as bat_omega_from_ke)

  pelvis_omega_time: number;        // ms from FFC
  trunk_omega_time: number;         // ms from FFC

  hip_shoulder_sep_max_deg: number;
  stride_length_rel_hip: number;
  front_foot_angle_deg: number;
  load_duration_ms: number;
  launch_duration_ms: number;
  transfer_ratio: number;

  exit_velocity_mph?: number;       // Measured EV (Hawk-Eye / launch monitor)
  measured_ev_mph?: number | null;  // Alias for exit_velocity_mph
  launch_angle_deg?: number;
  spray_angle_deg?: number;
  hard_hit_rate?: number;

  player_level: PlayerLevel;
  motor_profile?: string;

  // ME-derived fields
  mass_total_kg?: number;           // total body mass from ME
  bat_energy_j?: number;            // KE at barrel from ME
  total_body_energy_j?: number;     // sum of all segment KE from ME

  // Delivery window timing (for P→T gap denominator)
  foot_plant_time_ms?: number | null;  // ms from FFC at foot-plant
  contact_time_ms?: number | null;     // ms from FFC at contact
}

/** Actual delivery duration from foot-plant to contact, falling back to 200ms */
function getDeliveryDurationMs(input: ScoreCalculationInput): number {
  if (input.foot_plant_time_ms != null && input.contact_time_ms != null) {
    const dur = input.contact_time_ms - input.foot_plant_time_ms;
    if (dur > 0) return dur;
  }
  return 200; // default ≈ typical pro delivery window
}

interface ScoringResult extends FourBScores {
  predicted_bat_speed_mph?: number | null;
  predicted_exit_velocity_mph?: number | null;
  predicted_entry_bucket?: string | null;
  actual_bat_speed_mph?: number | null;
  actual_exit_velocity_mph?: number | null;
  actual_entry_bucket?: string | null;
  transfer_efficiency?: number | null;
  bat_speed_path?: string | null;
  bat_speed_confidence?: string | null;
  scoring_timestamp: string;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const WEIGHTS = {
  full:     { body: 0.45, brain: 0.15, bat: 0.25, ball: 0.15 },
  training: { body: 0.55, brain: 0.15, bat: 0.30, ball: 0    },
} as const;

const RATING_THRESHOLDS = { elite: 90, good: 80, working: 60 } as const;
const RATING_COLORS = { elite: '#4ecdc4', good: '#4ecdc4', working: '#ffa500', priority: '#ff6b6b' } as const;

const TRANSFER_RATIO_ELITE = { min: 1.5, max: 1.8 } as const;
const TIMING_GAP_ELITE = { min: 14, max: 18 } as const;

/** v_mph = ω_deg/s × OMEGA_TO_MPH
 *  FIX 1: (π/180) × 0.70m lever × 2.23694 mph/(m/s) = 0.02732 */
const OMEGA_TO_MPH = (Math.PI / 180) * 0.70 * 2.23694; // 0.02732

/** Moment of inertia for standard wood bat (32oz) about knob: 0.048 kg·m² */
const I_BAT_KGM2 = 0.048;

/** Cap bat omega at 2800 deg/s ≈ 76.5 mph (via OMEGA_TO_MPH direct, before chain multiplier) */
const MAX_BAT_OMEGA_DEGS = 2800;

/** Default body mass (kg) when ME masstotal not available */
const DEFAULT_MASS_KG: Record<PlayerLevel, number> = {
  youth: 45,
  high_school: 75,
  college: 85,
  pro: 90,
};

/** Estimated pitch speed for Nathan collision model */
const EST_PITCH_SPEED_MPH: Record<string, number> = {
  youth: 50,
  middle_school: 60,
  high_school: 75,
  college: 82,
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

function computeTransferEfficiency(input: ScoreCalculationInput): number {
  // ── Sequence score: did pelvis peak BEFORE trunk? ──────────────────────
  const sequenceScore = input.pelvis_omega_time < input.trunk_omega_time ? 1.0 : 0.0;

  // ── Timing score: signed gap (trunk − pelvis). Negative = torso-led = 0 reward ──
  const timingGapMs = input.trunk_omega_time - input.pelvis_omega_time;

  let timingScore: number;
  if (timingGapMs <= 0) {
    // Torso-led swing — no timing credit
    timingScore = 0;
  } else {
    const deliveryDurationMs = getDeliveryDurationMs(input);
    const timingGapPct = (timingGapMs / deliveryDurationMs) * 100;
    timingScore = Math.max(0, 1 - timingGapPct / 50);
  }

  console.log(
    `[4B-Score] transferEff DEBUG: { pelvis_omega_time_ms: ${input.pelvis_omega_time.toFixed(1)}, ` +
    `trunk_omega_time_ms: ${input.trunk_omega_time.toFixed(1)}, timingGapMs: ${timingGapMs.toFixed(1)} }`
  );
  console.log(
    `[4B-Score] transferEfficiency=${(0.5 * sequenceScore + 0.5 * timingScore).toFixed(3)} ` +
    `(sequenceScore=${sequenceScore}, timingScore=${timingScore.toFixed(3)})`
  );

  const transferEfficiency = 0.5 * sequenceScore + 0.5 * timingScore;
  return Math.max(0, Math.min(1, transferEfficiency));
}

// ---------------------------------------------------------------------------
// STEP 2: BAT SPEED PREDICTION — THREE-TIER PATH
// ---------------------------------------------------------------------------

interface BatSpeedResult {
  bat_speed_mph: number;
  path: 'measured' | 'ke_direct' | 'estimation';
  confidence: 'high' | 'medium' | 'low';
  mass_mod: number;
  warning?: string;
}

/** Sanity check: does the predicted mph fall in plausible range for player level? */
function batSpeedSane(mph: number, playerLevel: string): boolean {
  const ranges: Record<string, [number, number]> = {
    youth:        [25, 55],
    high_school:  [40, 75],
    college:      [50, 82],
    pro:          [40, 90],
  };
  const [lo, hi] = ranges[playerLevel] ?? ranges.pro;
  return mph >= lo && mph <= hi;
}

function predictBatSpeed(
  input: ScoreCalculationInput,
  transferEfficiency: number
): BatSpeedResult {
  const massKg = input.mass_total_kg ?? DEFAULT_MASS_KG[input.player_level] ?? 80;

  // ── TIER 1: MEASURED (Hawk-Eye or DK sensor) ───────────────────────────
  const measuredBs = input.measured_bat_speed_mph;
  if (measuredBs != null && measuredBs > 0) {
    const massMod = 0.95 + 0.05 * Math.min(1.2, Math.sqrt(massKg / 80));
    return {
      bat_speed_mph: Math.round(measuredBs * massMod * 10) / 10,
      path: 'measured',
      confidence: 'high',
      mass_mod: Math.round(massMod * 1000) / 1000,
    };
  }

  // ── TIER 2: KE DIRECT (bat_rot_energy → omega via I_BAT) ──────────────
  const batOmegaKE = input.bat_omega_from_ke ?? input.bat_omega_peak;
  if (batOmegaKE != null && batOmegaKE > 100) {
    const cappedOmega = Math.min(batOmegaKE, MAX_BAT_OMEGA_DEGS);
    const mph = cappedOmega * OMEGA_TO_MPH;

    if (batSpeedSane(mph, input.player_level)) {
      // FIX 3: No chain modifiers — bat KE already reflects full transfer
      // FIX 4: √ scaling, range 0.95–1.01
      const massMod = 0.95 + 0.05 * Math.min(1.2, Math.sqrt(massKg / 80));
      return {
        bat_speed_mph: Math.round(mph * massMod * 10) / 10,
        path: 'ke_direct',
        confidence: 'medium',
        mass_mod: Math.round(massMod * 1000) / 1000,
      };
    }

    console.warn(
      `[bat-speed] bat_omega=${batOmegaKE} → ${Math.round(mph * 10) / 10} mph outside sane range for ${input.player_level}. Falling to estimation.`
    );
  }

  // ── TIER 3: ESTIMATION (arm IK derivative — lowest confidence) ─────────
  // OMEGA_TO_MPH uses 0.70m bat lever arm. For segment-level sources (elbow/
  // shoulder), the angular velocity is of the arm joint, NOT the bat — so the
  // 0.70m lever already overstates the arm's linear speed.  The chain
  // multiplier must therefore be modest (~1.25–1.40) rather than the prior
  // 2.10–2.40, which produced ~115 mph outputs (impossible).
  const armSpeed = input.arm_omega_peak * OMEGA_TO_MPH;

  const segmentSources = ['right_shoulder_rot', 'right_elbow', 'left_elbow', 'rshoulder_rot', 'relbow_rot', 'lelbow_rot', 'torso_fallback'];
  const isSegmentLevel = !input.arm_omega_source || segmentSources.includes(input.arm_omega_source);
  const chainMultiplier = isSegmentLevel
    ? 1.25 + 0.15 * Math.max(0, Math.min(1, transferEfficiency))   // 1.25–1.40 for segment
    : 1.10 + 0.20 * Math.max(0, Math.min(1, transferEfficiency));  // 1.10–1.30 for hand/wrist

  // FIX 4: √ scaling, range 0.80–1.15
  const massFactor = Math.max(0.80, Math.min(1.15, Math.sqrt(massKg / 80)));

  // Transfer ratio bonus
  const tr = input.transfer_ratio;
  const trBonus = (tr >= 1.3 && tr <= 2.0) ? 1.00
    : (tr >= 1.0 && tr <= 2.5) ? 0.95
    : 0.85;

  let estimated = armSpeed * chainMultiplier * massFactor * trBonus;

  // Hard clamp: no bat speed can exceed physical limits
  const HARD_MAX_BAT_SPEED: Record<string, number> = {
    youth: 55, high_school: 75, college: 82, pro: 85,
  };
  const hardMax = HARD_MAX_BAT_SPEED[input.player_level] ?? 85;
  if (estimated > hardMax) {
    console.warn(`[4B-Score] estimation clamped: ${estimated.toFixed(1)} → ${hardMax} mph (max for ${input.player_level})`);
    estimated = hardMax;
  }

  console.log(`[4B-Score] estimation: { arm_omega: ${input.arm_omega_peak.toFixed(1)}, source_column: "${input.arm_omega_source ?? 'unknown'}", chainMultiplier: ${chainMultiplier.toFixed(3)}, bat_speed_mph: ${(Math.round(estimated * 10) / 10)} }`);

  return {
    bat_speed_mph: Math.round(estimated * 10) / 10,
    path: 'estimation',
    confidence: 'low',
    mass_mod: Math.round(massFactor * 1000) / 1000,
    warning: 'Estimated from IK arm velocity — expect ±8 mph uncertainty.',
  };
}

// ---------------------------------------------------------------------------
// STEP 3: EXIT VELOCITY — Nathan (2003) collision model
// ---------------------------------------------------------------------------

interface ExitVeloResult {
  exit_velocity_mph: number;
  source: 'measured' | 'predicted';
  collision_efficiency?: number;
}

function predictExitVelocity(
  predictedBatSpeed: number,
  transferEfficiency: number,
  playerLevel: string,
  measuredEV?: number | null
): ExitVeloResult {
  // Ground truth if available
  if (measuredEV != null && measuredEV > 0) {
    return { exit_velocity_mph: Math.round(measuredEV * 10) / 10, source: 'measured' };
  }

  const pitchSpeed = EST_PITCH_SPEED_MPH[playerLevel] ?? 90;
  const collisionEff = 0.70 + 0.20 * Math.min(1, Math.max(0, transferEfficiency));
  const ev = 1.2 * predictedBatSpeed * collisionEff + 0.2 * pitchSpeed;

  console.log(
    `[4B-Score] predictExitVelocity: transferEfficiency=${transferEfficiency.toFixed(3)}, ` +
    `collisionEff=${collisionEff.toFixed(3)}, batSpeed=${predictedBatSpeed.toFixed(1)}, ` +
    `pitchSpeed=${pitchSpeed}, EV=${ev.toFixed(1)} mph`
  );

  return {
    exit_velocity_mph: Math.round(ev * 10) / 10,
    source: 'predicted',
    collision_efficiency: Math.round(collisionEff * 1000) / 1000,
  };
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

  const timingGapMs  = input.trunk_omega_time - input.pelvis_omega_time;
  const timingGapPct = (timingGapMs / 200) * 100;
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

  const timingGapMs   = input.trunk_omega_time - input.pelvis_omega_time;
  const timingGapPct  = (timingGapMs / 200) * 100;
  const seqScore = (timingGapPct >= 14 && timingGapPct <= 18) ? 95
    : timingGapPct >= 10 && timingGapPct < 14 ? 75
    : timingGapPct > 18  && timingGapPct <= 22 ? 70
    : 40;

  const correctOrder =
    input.pelvis_omega_time < input.trunk_omega_time &&
    input.trunk_omega_time  < (input.pelvis_omega_time + 200 * 0.5);
  const rhythmScore = correctOrder ? 85 : 45;

  return Math.round(clamp(
    tempoScore  * 0.40 +
    seqScore    * 0.35 +
    rhythmScore * 0.25
  ));
}

/** BAT — Bat delivery quality after energy transfer */
function calculateBat(
  input: ScoreCalculationInput,
  playerLevel: string,
  transferEfficiency: number,
  batSpeedResult: BatSpeedResult
): { bat: number; bat_speed_mph: number | null; predicted_bat_speed_mph: number | null } {
  const benchmarks: Record<string, { min: number; elite: number }> = {
    youth:        { min: 40, elite: 58 },
    high_school:  { min: 58, elite: 72 },
    college:      { min: 66, elite: 80 },
    pro:          { min: 68, elite: 85 },
  };
  const bench = benchmarks[playerLevel] ?? benchmarks['high_school'];

  const bat_speed_mph = Math.round(batSpeedResult.bat_speed_mph);
  const batSpeedScore = lerp(bat_speed_mph, bench.min, bench.elite, 20, 100);

  const accelScore = lerp(
    input.arm_omega_peak / Math.max(input.trunk_omega_peak, 1),
    1.0, 1.8, 40, 100
  );

  const effectiveBatOmega = input.bat_omega_from_ke ?? input.bat_omega_peak;
  const lagScore = effectiveBatOmega != null && effectiveBatOmega > input.arm_omega_peak
    ? 85 : 55;

  const attackAngleProxyScore = lerp(input.front_foot_angle_deg, 10, 45, 80, 40);

  const rawBat = clamp(
    batSpeedScore         * 0.30 +
    accelScore            * 0.25 +
    lagScore              * 0.25 +
    attackAngleProxyScore * 0.20
  );

  const transferFactor = 0.4 + 0.6 * Math.min(1, Math.max(0, (transferEfficiency - 0.3) / 0.6));
  const bat = Math.round(clamp(rawBat * transferFactor));

  return { bat, bat_speed_mph, predicted_bat_speed_mph: Math.round(batSpeedResult.bat_speed_mph * 10) / 10 };
}

/** BALL — Batted ball outcome quality */
function calculateBall(
  input: ScoreCalculationInput,
  playerLevel: string,
  evResult: ExitVeloResult,
  transferEfficiency: number
): { ball: number; usedPrediction: boolean } {
  const hasActualEV = evResult.source === 'measured';
  const scoringEV = evResult.exit_velocity_mph;

  const evBenchmarks: Record<string, { min: number; elite: number }> = {
    youth:       { min: 40, elite: 65 },
    high_school: { min: 68, elite: 92 },
    college:     { min: 78, elite: 100 },
    pro:         { min: 85, elite: 108 },
  };
  const bench = evBenchmarks[playerLevel] ?? evBenchmarks['high_school'];
  const exitVeloScore = lerp(scoringEV, bench.min, bench.elite, 20, 100);

  const confidenceFactor = hasActualEV ? 1.0 : 0.90;

  const la = input.launch_angle_deg ?? (hasActualEV ? 15 : 12);
  const launchScore = la >= 8 && la <= 32 ? lerp(Math.abs(la - 20), 0, 12, 100, 60) : 40;

  const spray = input.spray_angle_deg ?? 0;
  const sprayScore =
    Math.abs(spray) <= 15 ? 90
    : spray > 15 && spray <= 30 ? 85
    : spray < -15 && spray >= -30 ? 95
    : Math.abs(spray) <= 45 ? 70
    : 50;

  const hardHitRate = input.hard_hit_rate
    ?? (hasActualEV
      ? (scoringEV >= bench.elite * 0.95 ? 80 : 40)
      : transferEfficiency * 65 + 10);
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

  // Step 2: Bat speed (three-tier) and exit velo (Nathan model)
  const bsResult = predictBatSpeed(input, transferEfficiency);

  // Resolve measured EV: prefer explicit measured_ev_mph, then exit_velocity_mph
  const measuredEV = input.measured_ev_mph ?? input.exit_velocity_mph ?? null;
  const evResult = predictExitVelocity(
    bsResult.bat_speed_mph, transferEfficiency, input.player_level, measuredEV
  );

  // Pillars
  const { body, creation, transfer } = calculateBody(input);
  const brain = calculateBrain(input);
  const { bat, bat_speed_mph, predicted_bat_speed_mph } = calculateBat(
    input, input.player_level, transferEfficiency, bsResult
  );
  const { ball, usedPrediction } = calculateBall(
    input, input.player_level, evResult, transferEfficiency
  );

  const hasActualOutcome = evResult.source === 'measured';
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

  console.log(`[4B-Score] Path=${bsResult.path} Conf=${bsResult.confidence} BatSpeed=${bsResult.bat_speed_mph}mph EV=${evResult.exit_velocity_mph}mph(${evResult.source})`);

  return {
    score_4bkrs,
    mode,
    version: 'v2',
    body, brain, bat,
    ball,
    rating, color,
    creation, transfer,
    transfer_ratio:    Math.round(input.transfer_ratio * 1000) / 1000,
    timing_gap_pct,
    bat_speed_mph,
    exit_velocity_mph: evResult.source === 'measured' ? evResult.exit_velocity_mph : null,

    predicted_bat_speed_mph,
    predicted_exit_velocity_mph: evResult.source === 'predicted' ? evResult.exit_velocity_mph : null,
    predicted_entry_bucket:      null,

    actual_bat_speed_mph:        bsResult.path === 'measured' ? bsResult.bat_speed_mph : null,
    actual_exit_velocity_mph:    evResult.source === 'measured' ? evResult.exit_velocity_mph : null,
    actual_entry_bucket:         null,

    transfer_efficiency:         Math.round(transferEfficiency * 1000) / 1000,
    bat_speed_path:              bsResult.path,
    bat_speed_confidence:        bsResult.confidence,

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

export { computeScoringResult };
export type { ScoreCalculationInput, ScoringResult };
