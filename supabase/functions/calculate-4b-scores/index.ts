/**
 * supabase/functions/calculate-4b-scores/index.ts
 *
 * THE single authoritative 4B scoring engine.
 * All paths (Reboot CSV, DK sensor, manual) funnel here.
 * Returns ScoringResult — no other shape is allowed.
 *
 * Formula (v2):
 *   Full mode     : score_4bkrs = Body×0.45 + Brain×0.15 + Bat×0.25 + Ball×0.15
 *   Training mode : score_4bkrs = Body×0.55 + Brain×0.15 + Bat×0.30
 *
 * Body  = Creation×0.40 + Transfer×0.60
 * Brain = Tempo×0.40 + Sequence Timing×0.35 + Rhythm×0.25
 * Bat   = Bat Speed×0.30 + Acceleration×0.25 + Lag×0.25 + Attack Angle×0.20
 * Ball  = Exit Velo×0.40 + Launch Angle×0.25 + Spray×0.20 + Hard Hit×0.15
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  pelvis_omega_peak: number;
  trunk_omega_peak: number;
  arm_omega_peak: number;
  bat_omega_peak?: number;
  pelvis_omega_time: number;
  trunk_omega_time: number;
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
}

interface ScoringResult extends FourBScores {
  predicted_bat_speed_mph?: number | null;
  predicted_exit_velocity_mph?: number | null;
  predicted_entry_bucket?: string | null;
  actual_bat_speed_mph?: number | null;
  actual_exit_velocity_mph?: number | null;
  actual_entry_bucket?: string | null;
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

/** BAT — Bat Speed (30%) + Acceleration (25%) + Lag (25%) + Attack Angle (20%) */
function calculateBat(
  input: ScoreCalculationInput,
  playerLevel: string
): { bat: number; bat_speed_mph: number | null; predicted_bat_speed_mph: number | null } {
  const benchmarks: Record<string, { min: number; elite: number }> = {
    youth:        { min: 40, elite: 58 },
    high_school:  { min: 58, elite: 72 },
    college:      { min: 66, elite: 80 },
    pro:          { min: 68, elite: 85 },
  };
  const bench = benchmarks[playerLevel] ?? benchmarks['high_school'];

  const predicted_bat_speed_mph = input.bat_omega_peak != null
    ? Math.round(input.bat_omega_peak * 0.0236)
    : null;

  const bat_speed_mph = predicted_bat_speed_mph;

  const batSpeedScore = bat_speed_mph != null
    ? lerp(bat_speed_mph, bench.min, bench.elite, 20, 100)
    : 50;

  const accelScore = lerp(
    input.arm_omega_peak / Math.max(input.trunk_omega_peak, 1),
    1.0, 1.8, 40, 100
  );

  const lagScore = input.bat_omega_peak != null && input.bat_omega_peak > input.arm_omega_peak
    ? 85 : 55;

  const attackAngleProxyScore = lerp(input.front_foot_angle_deg, 10, 45, 80, 40);

  const bat = clamp(
    batSpeedScore         * 0.30 +
    accelScore            * 0.25 +
    lagScore              * 0.25 +
    attackAngleProxyScore * 0.20
  );

  return { bat: Math.round(bat), bat_speed_mph, predicted_bat_speed_mph };
}

/** BALL — Exit Velo (40%) + Launch Angle (25%) + Spray (20%) + Hard Hit (15%) */
function calculateBall(input: ScoreCalculationInput, playerLevel: string): number | null {
  if (input.exit_velocity_mph == null) return null;

  const evBenchmarks: Record<string, { min: number; elite: number }> = {
    youth:       { min: 40, elite: 65 },
    high_school: { min: 68, elite: 92 },
    college:     { min: 78, elite: 100 },
    pro:         { min: 85, elite: 108 },
  };
  const bench = evBenchmarks[playerLevel] ?? evBenchmarks['high_school'];
  const exitVeloScore = lerp(input.exit_velocity_mph, bench.min, bench.elite, 20, 100);

  const la = input.launch_angle_deg ?? 15;
  const launchScore = la >= 8 && la <= 32 ? lerp(Math.abs(la - 20), 0, 12, 100, 60) : 40;

  const spray = input.spray_angle_deg ?? 0;
  const sprayScore =
    Math.abs(spray) <= 15 ? 90
    : spray > 15 && spray <= 30 ? 85
    : spray < -15 && spray >= -30 ? 95
    : Math.abs(spray) <= 45 ? 70
    : 50;

  const hardHitRate = input.hard_hit_rate ?? (input.exit_velocity_mph >= bench.elite * 0.95 ? 80 : 40);
  const hardHitScore = lerp(hardHitRate, 20, 50, 20, 100);

  return Math.round(clamp(
    exitVeloScore * 0.40 +
    launchScore   * 0.25 +
    sprayScore    * 0.20 +
    hardHitScore  * 0.15
  ));
}

// ---------------------------------------------------------------------------
// COMPOSITE CALCULATOR
// ---------------------------------------------------------------------------

function computeScoringResult(input: ScoreCalculationInput): ScoringResult {
  const { body, creation, transfer } = calculateBody(input);
  const brain = calculateBrain(input);
  const { bat, bat_speed_mph, predicted_bat_speed_mph } = calculateBat(input, input.player_level);
  const ball = calculateBall(input, input.player_level);

  const mode: ScoringMode = ball !== null ? 'full' : 'training';
  const w = WEIGHTS[mode];

  const score_4bkrs = Math.round(clamp(
    body  * w.body  +
    brain * w.brain +
    bat   * w.bat   +
    (ball ?? 0) * w.ball
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
    body, brain, bat, ball,
    rating, color,
    creation, transfer,
    transfer_ratio:    Math.round(input.transfer_ratio * 1000) / 1000,
    timing_gap_pct,
    bat_speed_mph,
    exit_velocity_mph: input.exit_velocity_mph ?? null,
    predicted_bat_speed_mph,
    predicted_exit_velocity_mph: null,
    predicted_entry_bucket:      null,
    actual_bat_speed_mph:        input.exit_velocity_mph != null ? bat_speed_mph : null,
    actual_exit_velocity_mph:    input.exit_velocity_mph ?? null,
    actual_entry_bucket:         null,
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

// Export for use by compute-4b-from-csv (shared internal helper — no formula duplication)
export { computeScoringResult };
export type { ScoreCalculationInput, ScoringResult };
