/**
 * supabase/functions/calculate-4b-scores/index.ts
 *
 * 4B Scoring Engine v2.0 — Energy Flow Architecture
 * Master spec: 4b_scoring_engine_v2_spec.pdf
 *
 * PRIMARY input: ME (Momentum-Energy) CSV data
 * SECONDARY input: IK CSV data (3 angle measurements only)
 * BACKWARD COMPAT: IK-only input falls back to v1 logic
 *
 * Three-Score System (player-facing):
 *   Ground Flow (Containment) — Steps 1-2
 *   Core Flow (Concentration) — Steps 3-4
 *   Arm Flow (Timing of Release) — Steps 5-6
 *
 * Six Loss Points (coach-facing diagnostics)
 * Pelvis Classification (Dead / Late / Early / Healthy)
 * TKE Shape Classification
 * Motor Profile Detection
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ===========================================================================
// TYPES
// ===========================================================================

type ScoringMethod = 'me_primary' | 'ik_fallback';
type ScoringMode = 'full' | 'training';
type FourBRating = 'Elite' | 'Good' | 'Working' | 'Priority';
type ScoreLabel = 'Elite' | 'Good' | 'Working' | 'Priority';
type PelvisClassification = 'DEAD_PELVIS' | 'SPENT_PELVIS' | 'LATE_PELVIS' | 'EARLY_PELVIS' | 'HEALTHY_PELVIS';
type Environment = 'cage' | 'game' | 'bp';
type TKEShape = 'SHARP_SPIKE' | 'PLATEAU' | 'DOUBLE_BUMP' | 'UNKNOWN';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
type MotorProfile = 'SPINNER' | 'TILT_WHIPPER' | 'LOAD_WHIPPER' | 'AMBIGUOUS_WHIPPER' | 'SLINGSHOTTER' | 'TITAN' | 'UNKNOWN';
type PlayerLevel = 'youth' | 'high_school' | 'college' | 'pro';

interface MEData {
  // Time-series arrays (frame-indexed)
  LowerTorso_Kinetic_Energy: number[];
  Torso_Kinetic_Energy?: number[];
  Arms_Kinetic_Energy: number[];
  Total_Kinetic_Energy: number[];
  Bat_Kinetic_Energy?: number[];
  LowerTorso_Angular_Momentum_Mag: number[];
  Torso_Angular_Momentum_Mag: number[];
  LowerHalf_Angular_Momentum_Proj: number[];
  Total_Angular_Momentum_Proj: number[];
  Torso_Angular_Momentum_Proj?: number[];
  Arms_Angular_Momentum_Proj?: number[];
  Center_of_Mass_Y?: number[];
  _side_max_percent?: number[];
  _side_min_percent?: number[];
  LowerTorso_vert_ang?: number[];
  Torso_vert_ang?: number[];
  // Timing
  time?: number[];           // absolute time in seconds
  norm_time?: number[];      // 0 at foot plant, 100 at contact
  rel_frame?: number[];
}

interface IKData {
  torso_side: number[];      // trunk lateral tilt (radians)
  pelvis_rot: number[];      // pelvis rotation (radians)
  torso_rot: number[];       // torso rotation relative to pelvis (radians)
  pelvis_side?: number[];
  // Event indices
  max_stride_frame?: number; // foot plant frame index
  contact_frame?: number;    // contact frame index
}

interface PlayerMetadata {
  handedness: 'left' | 'right';
  player_level: PlayerLevel;
  injury_history?: string[];
  mass_kg?: number;
  height_inches?: number;
  motor_profile_override?: string;
}

// Legacy input format (backward compat)
interface LegacyInput {
  source: string;
  pelvis_omega_peak: number;
  trunk_omega_peak: number;
  arm_omega_peak: number;
  arm_omega_source?: string;
  measured_bat_speed_mph?: number | null;
  bat_omega_from_ke?: number | null;
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
  measured_ev_mph?: number | null;
  launch_angle_deg?: number;
  spray_angle_deg?: number;
  hard_hit_rate?: number;
  player_level: PlayerLevel;
  motor_profile?: string;
  mass_total_kg?: number;
  bat_energy_j?: number;
  total_body_energy_j?: number;
  foot_plant_time_ms?: number | null;
  contact_time_ms?: number | null;
  environment?: Environment;
}

interface V2Input {
  me_data: MEData;
  ik_data?: IKData;
  player_metadata: PlayerMetadata;
  timing?: {
    swing_start_ms?: number;
    foot_plant_time_ms?: number;
    contact_time_ms?: number;
  };
  environment?: Environment;
  // Optional measured ball data
  exit_velocity_mph?: number;
  launch_angle_deg?: number;
  spray_angle_deg?: number;
}

// ===========================================================================
// OUTPUT SCHEMA
// ===========================================================================

interface ScoreComponent {
  score: number;
  color: string;
  label: ScoreLabel;
  components: Record<string, number>;
}

interface LossPoint {
  ratio?: number;
  value?: number;
  severity: Severity;
  label: string;
  gap_ms?: number;
  gap_pct?: number;
  sequence_correct?: boolean;
  cosine_efficiency?: number;
  arms_ke_ratio?: number;
  side_bleed_pct?: number;
}

interface PelvisResult {
  classification: PelvisClassification;
  problem: string | null;
  prescription: string[];
  anchor: string | null;
}

interface ScoringOutput {
  version: string;
  scoring_method: ScoringMethod;
  environment: Environment;

  pre_processing: {
    swing_duration_ms: number;
    swing_category: 'COMPETITIVE' | 'WALKTHROUGH';
    delivery_window_ms: number;
    handedness_correction_applied: boolean;
    flags: string[];
  };

  scores: {
    ground_flow: ScoreComponent;
    core_flow: ScoreComponent;
    arm_flow: ScoreComponent;
  };

  pelvis_classification: PelvisResult;

  loss_points: {
    lp1_ground_to_pelvis: LossPoint;
    lp2_transfer_ratio: LossPoint;
    lp3_sequence_timing: LossPoint;
    lp4_plane_misalignment: LossPoint;
    lp5_arms_absorbing: LossPoint;
    lp6_side_bleed: LossPoint;
  };

  tke_shape: TKEShape;
  motor_profile: MotorProfile;

  energy_ledger: {
    pelvis_ke: number;
    torso_ke: number;
    arms_ke: number;
    bat_ke: number;
    total_ke: number;
    lower_half_ke: number;
    sequence_correct: boolean;
    x_factor_degrees: number;
    trunk_tilt_degrees: number;
    pelvis_rot_at_fp_degrees: number;
    transfer_ratio: number;
    p_to_t_gap_ms: number;
    arms_ke_ratio: number;
    delivery_window_ms: number;
  };

  // Legacy 4B scores for backward compat with display components
  legacy_4b?: {
    body: number;
    brain: number;
    bat: number;
    ball: number | null;
    score_4bkrs: number;
    rating: FourBRating;
    color: string;
  };

  scoring_timestamp: string;
}

// ===========================================================================
// CONSTANTS
// ===========================================================================

const DEAD_PELVIS_KE_THRESHOLD = 120; // Joules
const SPENT_PELVIS_KE_THRESHOLD = 20; // Joules — KE remaining at contact
const EARLY_PELVIS_ROT_THRESHOLD = -10.0; // Degrees
const SWING_DURATION_WALKTHROUGH_MS = 550;
const X_FACTOR_NOISE_THRESHOLD = 60; // Degrees absolute

const SCORE_COLORS = {
  elite: '#4ecdc4',
  working: '#ffa500',
  priority: '#ff6b6b',
} as const;

const REQUIRED_ME_COLUMNS: (keyof MEData)[] = [
  'LowerTorso_Kinetic_Energy',
  'Torso_Angular_Momentum_Mag',
  'LowerTorso_Angular_Momentum_Mag',
  'LowerHalf_Angular_Momentum_Proj',
  'Total_Angular_Momentum_Proj',
  'Arms_Kinetic_Energy',
  'Total_Kinetic_Energy',
];

// ===========================================================================
// HELPERS
// ===========================================================================

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function getColor(score: number): string {
  if (score >= 80) return SCORE_COLORS.elite;
  if (score >= 60) return SCORE_COLORS.working;
  return SCORE_COLORS.priority;
}

function getLabel(score: number): ScoreLabel {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Working';
  return 'Priority';
}

function toRating(score: number): FourBRating {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Working';
  return 'Priority';
}

/** Scale a raw metric to 0-100 score using three thresholds */
function scaleToScore(
  value: number,
  thresholds: { elite: number; working: number; priority: number },
  options?: { inverted?: boolean }
): number {
  const { elite, working, priority } = thresholds;
  const inv = options?.inverted ?? false;

  if (inv) {
    // Lower value = higher score
    if (value <= elite) return 95;
    if (value <= working) return 60 + 35 * ((working - value) / (working - elite));
    if (value <= priority) return 30 + 30 * ((priority - value) / (priority - working));
    return 20;
  } else {
    // Higher value = higher score
    if (value >= elite) return 95;
    if (value >= working) return 60 + 35 * ((value - working) / (elite - working));
    if (value >= priority) return 30 + 30 * ((value - priority) / (working - priority));
    return 20;
  }
}

function getPeak(series: number[]): number {
  if (!series || series.length === 0) return 0;
  return Math.max(...series);
}

function getPeakIndex(series: number[]): number {
  if (!series || series.length === 0) return 0;
  let maxIdx = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i] > series[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

function getValueAtIndex(series: number[], idx: number): number {
  if (!series || idx < 0 || idx >= series.length) return 0;
  return series[idx];
}

/** Get IK value at a specific event frame */
function getIKValueAtEvent(ikSeries: number[], eventFrame: number): number {
  if (!ikSeries || eventFrame < 0 || eventFrame >= ikSeries.length) return 0;
  return ikSeries[eventFrame];
}

/** Find peaks in a series with minimum prominence */
function findPeaks(series: number[], minProminence = 0.1): number[] {
  if (!series || series.length < 3) return [];
  const maxVal = getPeak(series);
  if (maxVal === 0) return [];
  const threshold = maxVal * minProminence;
  const peaks: number[] = [];
  for (let i = 1; i < series.length - 1; i++) {
    if (series[i] > series[i - 1] && series[i] > series[i + 1] && series[i] > threshold) {
      peaks.push(i);
    }
  }
  return peaks;
}

/** Compute deceleration slope after peak (units per frame) */
function computeDecelerationSlope(series: number[], peakIdx: number): number {
  if (!series || peakIdx >= series.length - 2) return 0;
  const windowEnd = Math.min(peakIdx + 5, series.length - 1);
  const drop = series[peakIdx] - series[windowEnd];
  const frames = windowEnd - peakIdx;
  return frames > 0 ? drop / frames : 0;
}

/** Compute FWHM (full width at half maximum) of the peak */
function computePeakWidth(series: number[], peakIdx: number): number {
  if (!series || series.length === 0) return 0;
  const halfMax = series[peakIdx] / 2;
  let left = peakIdx;
  let right = peakIdx;
  while (left > 0 && series[left] > halfMax) left--;
  while (right < series.length - 1 && series[right] > halfMax) right++;
  return right - left;
}

/** Simple second derivative approximation */
function computeSecondDerivative(series: number[]): number[] {
  if (!series || series.length < 3) return [];
  const result: number[] = [0];
  for (let i = 1; i < series.length - 1; i++) {
    result.push(series[i + 1] - 2 * series[i] + series[i - 1]);
  }
  result.push(0);
  return result;
}

// ===========================================================================
// PRE-PROCESSING PIPELINE
// ===========================================================================

interface PreProcessed {
  swing_duration_ms: number;
  swing_category: 'COMPETITIVE' | 'WALKTHROUGH';
  delivery_window_ms: number;
  handedness_correction_applied: boolean;
  flags: string[];
  contact_frame: number;
  foot_plant_frame: number;
}

function preProcess(
  meData: MEData,
  ikData: IKData | undefined,
  metadata: PlayerMetadata,
  timing?: V2Input['timing']
): PreProcessed {
  const flags: string[] = [];
  let handednessCorrected = false;

  // Swing duration filter
  let swingDurationMs = 0;
  if (timing?.swing_start_ms != null && timing?.contact_time_ms != null) {
    swingDurationMs = timing.contact_time_ms - timing.swing_start_ms;
  } else if (meData.norm_time && meData.norm_time.length > 0) {
    // Approximate from normalized time range (0=FP, 100=contact)
    swingDurationMs = 400; // reasonable default
  }

  const swingCategory = swingDurationMs > SWING_DURATION_WALKTHROUGH_MS ? 'WALKTHROUGH' : 'COMPETITIVE';
  if (swingCategory === 'WALKTHROUGH') {
    flags.push('WALKTHROUGH_SWING');
  }

  // Delivery window (contact - foot plant)
  let deliveryWindowMs = 200; // fallback
  if (timing?.foot_plant_time_ms != null && timing?.contact_time_ms != null) {
    const dw = timing.contact_time_ms - timing.foot_plant_time_ms;
    if (dw > 0) deliveryWindowMs = dw;
  }

  // Determine contact and foot plant frames
  let contactFrame = meData.LowerTorso_Kinetic_Energy.length - 1;
  let footPlantFrame = 0;
  if (meData.norm_time) {
    for (let i = 0; i < meData.norm_time.length; i++) {
      if (meData.norm_time[i] >= 0 && footPlantFrame === 0) footPlantFrame = i;
      if (meData.norm_time[i] >= 100) { contactFrame = i; break; }
    }
  }
  if (ikData?.contact_frame != null) contactFrame = ikData.contact_frame;
  if (ikData?.max_stride_frame != null) footPlantFrame = ikData.max_stride_frame;

  // Handedness correction on IK data
  if (ikData && metadata.handedness === 'left') {
    handednessCorrected = true;
    ikData.pelvis_rot = ikData.pelvis_rot.map(v => -(v - Math.PI));
    if (ikData.pelvis_side) {
      ikData.pelvis_side = ikData.pelvis_side.map(v => -v);
    }
    ikData.torso_rot = ikData.torso_rot.map(v => -v);
  }

  // X-Factor validation
  if (ikData) {
    const xFactorDeg = getPeak(ikData.torso_rot.map(v => Math.abs(v * (180 / Math.PI))));
    if (xFactorDeg > X_FACTOR_NOISE_THRESHOLD) {
      flags.push('X_FACTOR_NOISE');
    }
  }

  // ME file column validation
  for (const col of REQUIRED_ME_COLUMNS) {
    if (!meData[col] || (meData[col] as number[]).length === 0) {
      flags.push(`MISSING_ME_COLUMN_${col}`);
    }
  }

  return {
    swing_duration_ms: swingDurationMs,
    swing_category: swingCategory,
    delivery_window_ms: deliveryWindowMs,
    handedness_correction_applied: handednessCorrected,
    flags,
    contact_frame: contactFrame,
    foot_plant_frame: footPlantFrame,
  };
}

// ===========================================================================
// PELVIS CLASSIFICATION
// ===========================================================================

function classifyPelvis(
  meData: MEData,
  ikData: IKData | undefined,
  preProc: PreProcessed
): PelvisResult {
  const pelvisKE = getPeak(meData.LowerTorso_Kinetic_Energy);

  // Sequence check from momentum peaks
  const pelvisPeakTime = getPeakIndex(meData.LowerHalf_Angular_Momentum_Proj);
  const torsoProjSeries = meData.Torso_Angular_Momentum_Proj ?? meData.Torso_Angular_Momentum_Mag;
  const torsoPeakTime = getPeakIndex(torsoProjSeries);
  const isSequenceInverted = torsoPeakTime < pelvisPeakTime;

  // Pelvis rotation at foot plant from IK
  let pelvisRotAtFP = -20; // default healthy
  if (ikData && preProc.foot_plant_frame >= 0) {
    pelvisRotAtFP = getIKValueAtEvent(ikData.pelvis_rot, preProc.foot_plant_frame) * (180 / Math.PI);
  }

  // Pelvis KE timing: when did it peak and what's left at contact?
  const pelvisKEPeakFrame = getPeakIndex(meData.LowerTorso_Kinetic_Energy);
  const pelvisKEAtContact = getValueAtIndex(meData.LowerTorso_Kinetic_Energy, preProc.contact_frame);

  // Classification tree (order matters: Dead → Spent → Late → Early → Healthy)
  if (pelvisKE < DEAD_PELVIS_KE_THRESHOLD) {
    return {
      classification: 'DEAD_PELVIS',
      problem: 'Insufficient force production — pelvis is a nearly empty fuel tank',
      prescription: [
        'Ground force drills (Pull Out of Ground band drill)',
        'Posterior chain loading',
        'Synapse pelvis-first assisted rotation',
      ],
      anchor: `Vazquez (~100J pelvis KE). Current: ${Math.round(pelvisKE)}J`,
    };
  }

  if (pelvisKEPeakFrame < preProc.foot_plant_frame && pelvisKEAtContact < SPENT_PELVIS_KE_THRESHOLD) {
    return {
      classification: 'SPENT_PELVIS',
      problem: `Pelvis had energy (peaked at ${Math.round(pelvisKE)}J during stride) but spent it before foot plant. By contact only ${Math.round(pelvisKEAtContact)}J remains. The brake never formed to catch the energy.`,
      prescription: [
        'Balance disc work (foot-ground stability before pelvis can fire)',
        'Synapse hip lock under eccentric load',
        "Welch's Pelvis Inward Turn cue",
        'Containment: keep pelvis closed longer so energy is available when the chain needs it',
      ],
      anchor: `Wilson (+7.3° at FP, peaked 60.6J during stride, 9J at contact). Current: peak ${Math.round(pelvisKE)}J → contact ${Math.round(pelvisKEAtContact)}J`,
    };
  }

  if (isSequenceInverted) {
    return {
      classification: 'LATE_PELVIS',
      problem: 'Force produced but timing is wrong — torso fires before pelvis delivers',
      prescription: [
        'Constraint drills forcing pelvis to fire first',
        'Synapse posterior chain eccentric load',
        'Single-leg drill (produces 86ms P→T gap vs 51ms regular)',
      ],
      anchor: `Huff Session 7 (pelvis velocity present, torso leads). Current pelvis KE: ${Math.round(pelvisKE)}J`,
    };
  }

  if (pelvisRotAtFP > EARLY_PELVIS_ROT_THRESHOLD) {
    return {
      classification: 'EARLY_PELVIS',
      problem: `Rotation budget spent before foot plant — pelvis already open at ${pelvisRotAtFP.toFixed(1)}° (ideal: -10° to -30°)`,
      prescription: [
        'Balance disc work (foot-ground stability before pelvis can fire)',
        'Synapse hip lock under eccentric load',
        "Welch's Pelvis Inward Turn cue",
        "Bosch's SAVAGE chaos drills",
      ],
      anchor: `Wilson (+7.3° at FP, 868°/s velocity — high but spent)`,
    };
  }

  return {
    classification: 'HEALTHY_PELVIS',
    problem: null,
    prescription: [],
    anchor: null,
  };
}

// ===========================================================================
// TKE SHAPE CLASSIFICATION
// ===========================================================================

function classifyTKEShape(tke_series: number[]): TKEShape {
  if (!tke_series || tke_series.length < 5) return 'UNKNOWN';

  const peaks = findPeaks(tke_series, 0.3);
  if (peaks.length === 0) return 'UNKNOWN';

  if (peaks.length >= 2) return 'DOUBLE_BUMP';

  // Single peak — check width
  const peakWidth = computePeakWidth(tke_series, peaks[0]);
  const totalLength = tke_series.length;
  const widthRatio = peakWidth / totalLength;

  if (widthRatio < 0.35) return 'SHARP_SPIKE';
  return 'PLATEAU';
}

// ===========================================================================
// MOTOR PROFILE DETECTION
// ===========================================================================

function detectMotorProfile(
  meData: MEData,
  ikData: IKData | undefined,
  ptGapPct: number,
  transferRatio: number,
  preProc: PreProcessed
): MotorProfile {
  const tkeShape = classifyTKEShape(meData.LowerTorso_Kinetic_Energy);

  // Spinner: compact rotation, tight gap
  if (ptGapPct >= 5 && ptGapPct <= 10 && transferRatio >= 1.3 && transferRatio <= 1.5) {
    return 'SPINNER';
  }

  // Whipper variants (wide gap + high transfer)
  if (ptGapPct >= 15 && ptGapPct <= 22 && transferRatio >= 1.6 && transferRatio <= 1.9) {
    if (ikData && tkeShape === 'SHARP_SPIKE') {
      return distinguishWhipperType(ikData, preProc);
    }
    return 'AMBIGUOUS_WHIPPER';
  }

  // Slingshotter: moderate gap, moderate transfer
  if (ptGapPct >= 12 && ptGapPct <= 16 && transferRatio >= 1.4 && transferRatio <= 1.6) {
    return 'SLINGSHOTTER';
  }

  // Titan: very high transfer
  if (transferRatio > 1.8) {
    return 'TITAN';
  }

  return 'UNKNOWN';
}

function distinguishWhipperType(ikData: IKData, preProc: PreProcessed): MotorProfile {
  // Trunk tilt: get peak in FP-to-contact window
  const fpFrame = preProc.foot_plant_frame;
  const contactFrame = preProc.contact_frame;

  let trunkTiltDeg = 0;
  if (ikData.torso_side) {
    const window = ikData.torso_side.slice(fpFrame, contactFrame + 1);
    trunkTiltDeg = getPeak(window.map(v => Math.abs(v * (180 / Math.PI))));
  }

  // X-Factor
  const xFactorDeg = getPeak(
    ikData.torso_rot.slice(fpFrame, contactFrame + 1).map(v => Math.abs(v * (180 / Math.PI)))
  );

  if (trunkTiltDeg > 35 && xFactorDeg < 25) return 'TILT_WHIPPER';
  if (trunkTiltDeg < 30 && xFactorDeg > 30) return 'LOAD_WHIPPER';
  return 'AMBIGUOUS_WHIPPER';
}

// ===========================================================================
// THREE-SCORE SYSTEM
// ===========================================================================

function calculateGroundFlow(meData: MEData, preProc: PreProcessed): ScoreComponent {
  // Component 1: Lower Half Momentum Contribution
  const lhPeakIdx = getPeakIndex(meData.LowerHalf_Angular_Momentum_Proj);
  const lhMomentumPeak = getPeak(meData.LowerHalf_Angular_Momentum_Proj);
  const totalMomentumAtLHPeak = getValueAtIndex(meData.Total_Angular_Momentum_Proj, lhPeakIdx);
  const momentumRatio = totalMomentumAtLHPeak > 0 ? lhMomentumPeak / totalMomentumAtLHPeak : 0;
  const momentumScore = scaleToScore(momentumRatio, { elite: 0.65, working: 0.45, priority: 0.30 });

  // Component 2: Pelvis KE (raw fuel)
  const pelvisKE = getPeak(meData.LowerTorso_Kinetic_Energy);
  const pelvisKEScore = scaleToScore(pelvisKE, { elite: 200, working: 120, priority: 80 });

  // Component 3: COG Vertical Control
  let cogScore = 70; // default
  if (meData.Center_of_Mass_Y && meData.Center_of_Mass_Y.length > 3) {
    const d2 = computeSecondDerivative(meData.Center_of_Mass_Y);
    const maxAccel = getPeak(d2.map(Math.abs));
    // Pattern-based: low acceleration = controlled load = good
    cogScore = scaleToScore(maxAccel, { elite: 0.001, working: 0.005, priority: 0.01 }, { inverted: true });
  }

  // Component 4: Side-to-Side Bleed (penalty)
  let bleedPenalty = 85; // default: no bleed data = assume ok
  if (meData._side_max_percent && meData._side_min_percent) {
    const sideBleed = Math.max(
      getPeak(meData._side_max_percent.map(Math.abs)),
      getPeak(meData._side_min_percent.map(Math.abs))
    );
    bleedPenalty = scaleToScore(sideBleed, { elite: 5, working: 15, priority: 25 }, { inverted: true });
  }

  const score = Math.round(clamp(
    momentumScore * 0.30 +
    pelvisKEScore * 0.35 +
    cogScore * 0.20 +
    bleedPenalty * 0.15
  ));

  return {
    score,
    color: getColor(score),
    label: getLabel(score),
    components: {
      momentum_ratio: Math.round(momentumRatio * 100) / 100,
      pelvis_ke_joules: Math.round(pelvisKE),
      cog_score: Math.round(cogScore),
      side_bleed_score: Math.round(bleedPenalty),
    },
  };
}

function calculateCoreFlow(
  meData: MEData,
  preProc: PreProcessed
): ScoreComponent & { transfer_ratio: number; pt_gap_ms: number; pt_gap_pct: number; decel_slope: number } {
  // Component 1: Transfer Ratio
  const torsoMomentumPeak = getPeak(meData.Torso_Angular_Momentum_Mag);
  const pelvisMomentumPeak = getPeak(meData.LowerTorso_Angular_Momentum_Mag);
  const transferRatio = pelvisMomentumPeak > 0 ? torsoMomentumPeak / pelvisMomentumPeak : 0;

  // CRITICAL: Do NOT apply Math.abs(). Torso-led = score zero.
  let transferScore: number;
  if (transferRatio >= 1.5 && transferRatio <= 1.8) {
    transferScore = 95;
  } else if (transferRatio > 1.8) {
    transferScore = Math.max(50, 95 - (transferRatio - 1.8) * 50); // Runaway penalty
  } else if (transferRatio >= 1.0) {
    transferScore = scaleToScore(transferRatio, { elite: 1.5, working: 1.2, priority: 1.0 });
  } else {
    transferScore = 15; // Broken handoff
  }

  // Component 2: Pelvis Deceleration Slope
  const pelvisMomSeries = meData.LowerTorso_Angular_Momentum_Mag;
  const pelvisPeakIdx = getPeakIndex(pelvisMomSeries);
  const decelSlope = computeDecelerationSlope(pelvisMomSeries, pelvisPeakIdx);
  const decelScore = scaleToScore(Math.abs(decelSlope), { elite: 500, working: 300, priority: 150 });

  // Component 3: P→T Gap Timing
  const pelvisPeakFrame = getPeakIndex(meData.LowerHalf_Angular_Momentum_Proj);
  const torsoProjSeries = meData.Torso_Angular_Momentum_Proj ?? meData.Torso_Angular_Momentum_Mag;
  const torsoPeakFrame = getPeakIndex(torsoProjSeries);

  // Convert frames to ms if time data available, otherwise use frame difference
  let ptGapMs = (torsoPeakFrame - pelvisPeakFrame); // frame difference
  if (meData.time && meData.time.length > Math.max(pelvisPeakFrame, torsoPeakFrame)) {
    ptGapMs = (meData.time[torsoPeakFrame] - meData.time[pelvisPeakFrame]) * 1000;
  }
  const ptGapPct = preProc.delivery_window_ms > 0
    ? (ptGapMs / preProc.delivery_window_ms) * 100
    : 0;

  let gapScore: number;
  if (ptGapPct >= 14 && ptGapPct <= 18) {
    gapScore = 95;
  } else if (ptGapPct > 0) {
    gapScore = scaleToScore(ptGapPct, { elite: 16, working: 10, priority: 5 });
  } else {
    gapScore = 10; // Inverted sequence
  }

  // Component 4: Rotational Plane Alignment
  let alignmentScore = 70; // default
  if (meData.LowerTorso_vert_ang && meData.Torso_vert_ang) {
    const pelvisPlane = getValueAtIndex(meData.LowerTorso_vert_ang, pelvisPeakIdx);
    const torsoPlane = getValueAtIndex(meData.Torso_vert_ang, getPeakIndex(meData.Torso_Angular_Momentum_Mag));
    const planeAngleDiff = Math.abs(pelvisPlane - torsoPlane);
    const cosineEff = Math.cos(planeAngleDiff * Math.PI / 180);
    alignmentScore = scaleToScore(cosineEff, { elite: 0.95, working: 0.85, priority: 0.70 });
  }

  const score = Math.round(clamp(
    transferScore * 0.35 +
    decelScore * 0.25 +
    gapScore * 0.25 +
    alignmentScore * 0.15
  ));

  return {
    score,
    color: getColor(score),
    label: getLabel(score),
    components: {
      transfer_ratio: Math.round(transferRatio * 100) / 100,
      decel_slope: Math.round(decelSlope),
      pt_gap_ms: Math.round(ptGapMs * 10) / 10,
      pt_gap_pct: Math.round(ptGapPct * 10) / 10,
      plane_alignment: Math.round(alignmentScore),
    },
    transfer_ratio: transferRatio,
    pt_gap_ms: ptGapMs,
    pt_gap_pct: ptGapPct,
    decel_slope: decelSlope,
  };
}

function calculateArmFlow(
  meData: MEData,
  preProc: PreProcessed
): ScoreComponent & { arms_ke_ratio: number } {
  // Component 1: Arms KE Ratio (lower is better)
  const armsKEPeak = getPeak(meData.Arms_Kinetic_Energy);
  const totalKEPeak = getPeak(meData.Total_Kinetic_Energy);
  const armsKERatio = totalKEPeak > 0 ? armsKEPeak / totalKEPeak : 0;
  const armsRatioScore = scaleToScore(armsKERatio, { elite: 0.15, working: 0.30, priority: 0.45 }, { inverted: true });

  // Component 2: Delivery Window Quality
  const dw = preProc.delivery_window_ms;
  let windowScore: number;
  if (dw >= 140 && dw <= 220) windowScore = 90;
  else if (dw >= 120 && dw <= 250) windowScore = 70;
  else windowScore = 45;

  // Component 3: Bat KE Peak Timing
  let batTimingScore = 65; // default
  if (meData.Bat_Kinetic_Energy && meData.Bat_Kinetic_Energy.length > 0) {
    const batKEPeakIdx = getPeakIndex(meData.Bat_Kinetic_Energy);
    const contactIdx = preProc.contact_frame;
    const frameOffset = Math.abs(batKEPeakIdx - contactIdx);
    batTimingScore = scaleToScore(frameOffset, { elite: 1, working: 3, priority: 6 }, { inverted: true });
  }

  const score = Math.round(clamp(
    armsRatioScore * 0.45 +
    windowScore * 0.25 +
    batTimingScore * 0.30
  ));

  return {
    score,
    color: getColor(score),
    label: getLabel(score),
    components: {
      arms_ke_ratio: Math.round(armsKERatio * 100) / 100,
      delivery_window_ms: Math.round(dw),
      bat_timing_score: Math.round(batTimingScore),
    },
    arms_ke_ratio: armsKERatio,
  };
}

// ===========================================================================
// SIX LOSS POINTS (COACH-FACING)
// ===========================================================================

function computeLossPoints(
  meData: MEData,
  coreFlow: ReturnType<typeof calculateCoreFlow>,
  armFlow: ReturnType<typeof calculateArmFlow>,
  preProc: PreProcessed
) {
  // LP1: Ground to Pelvis
  const lhPeakIdx = getPeakIndex(meData.LowerHalf_Angular_Momentum_Proj);
  const lhPeak = getPeak(meData.LowerHalf_Angular_Momentum_Proj);
  const totalAtLH = getValueAtIndex(meData.Total_Angular_Momentum_Proj, lhPeakIdx);
  const lp1Ratio = totalAtLH > 0 ? lhPeak / totalAtLH : 0;
  const lp1Severity: Severity = lp1Ratio > 0.65 ? 'LOW' : lp1Ratio > 0.45 ? 'MEDIUM' : 'HIGH';

  // LP2: Transfer Ratio
  const tr = coreFlow.transfer_ratio;
  const lp2Severity: Severity = (tr >= 1.5 && tr <= 1.8) ? 'LOW' : tr >= 1.0 ? 'MEDIUM' : 'HIGH';

  // LP3: Sequence Timing
  const ptGapMs = coreFlow.pt_gap_ms;
  const ptGapPct = coreFlow.pt_gap_pct;
  const seqCorrect = ptGapMs > 0;
  const lp3Severity: Severity = (ptGapPct >= 14 && ptGapPct <= 18 && seqCorrect) ? 'LOW' :
    (seqCorrect && ptGapPct > 0) ? 'MEDIUM' : 'HIGH';

  // LP4: Plane Misalignment
  let cosineEff = 1.0;
  if (meData.LowerTorso_vert_ang && meData.Torso_vert_ang) {
    const pelvisPlane = getValueAtIndex(meData.LowerTorso_vert_ang, getPeakIndex(meData.LowerTorso_Angular_Momentum_Mag));
    const torsoPlane = getValueAtIndex(meData.Torso_vert_ang, getPeakIndex(meData.Torso_Angular_Momentum_Mag));
    cosineEff = Math.cos(Math.abs(pelvisPlane - torsoPlane) * Math.PI / 180);
  }
  const lp4Severity: Severity = cosineEff > 0.95 ? 'LOW' : cosineEff > 0.85 ? 'MEDIUM' : 'HIGH';

  // LP5: Arms Absorbing
  const armsRatio = armFlow.arms_ke_ratio;
  const lp5Severity: Severity = armsRatio < 0.20 ? 'LOW' : armsRatio < 0.35 ? 'MEDIUM' : 'HIGH';

  // LP6: Side-to-Side Bleed
  let totalSideBleed = 0;
  if (meData._side_max_percent && meData._side_min_percent) {
    totalSideBleed = getPeak(meData._side_max_percent.map(Math.abs)) +
      getPeak(meData._side_min_percent.map(Math.abs));
  }
  const lp6Severity: Severity = totalSideBleed < 10 ? 'LOW' : totalSideBleed < 20 ? 'MEDIUM' : 'HIGH';

  return {
    lp1_ground_to_pelvis: {
      ratio: Math.round(lp1Ratio * 100) / 100,
      severity: lp1Severity,
      label: lp1Severity === 'LOW' ? 'Healthy ground connection' :
        lp1Severity === 'MEDIUM' ? 'Reduced ground force' : 'Dead pelvis — energy never entered the system',
    },
    lp2_transfer_ratio: {
      ratio: Math.round(tr * 100) / 100,
      severity: lp2Severity,
      label: tr > 1.8 ? 'Runaway torso' : tr >= 1.5 ? 'Elite transfer' :
        tr >= 1.0 ? 'Underperforming handoff' : 'Broken handoff — torso losing energy',
    },
    lp3_sequence_timing: {
      gap_ms: Math.round(ptGapMs * 10) / 10,
      gap_pct: Math.round(ptGapPct * 10) / 10,
      sequence_correct: seqCorrect,
      severity: lp3Severity,
      label: !seqCorrect ? 'Inverted sequence — torso fires before pelvis' :
        lp3Severity === 'LOW' ? 'Elite timing window' : 'Timing gap outside optimal range',
    },
    lp4_plane_misalignment: {
      cosine_efficiency: Math.round(cosineEff * 1000) / 1000,
      severity: lp4Severity,
      label: lp4Severity === 'LOW' ? 'Planes aligned' :
        lp4Severity === 'MEDIUM' ? 'Some plane misalignment' : 'Significant plane divergence',
    },
    lp5_arms_absorbing: {
      arms_ke_ratio: Math.round(armsRatio * 100) / 100,
      severity: lp5Severity,
      label: lp5Severity === 'LOW' ? 'Arms receiving efficiently' :
        lp5Severity === 'MEDIUM' ? 'Arms partially compensating' : 'Arms dominant — chain failed to deliver',
    },
    lp6_side_bleed: {
      side_bleed_pct: Math.round(totalSideBleed * 10) / 10,
      severity: lp6Severity,
      label: lp6Severity === 'LOW' ? 'Energy on pitch plane' :
        lp6Severity === 'MEDIUM' ? 'Some lateral energy loss' : 'High sideways bleed — energy leaking off plane',
    },
  };
}

// ===========================================================================
// ENERGY LEDGER
// ===========================================================================

function buildEnergyLedger(
  meData: MEData,
  ikData: IKData | undefined,
  coreFlow: ReturnType<typeof calculateCoreFlow>,
  armFlow: ReturnType<typeof calculateArmFlow>,
  preProc: PreProcessed
) {
  const pelvisKE = getPeak(meData.LowerTorso_Kinetic_Energy);
  const torsoKE = meData.Torso_Kinetic_Energy ? getPeak(meData.Torso_Kinetic_Energy) : 0;
  const armsKE = getPeak(meData.Arms_Kinetic_Energy);
  const totalKE = getPeak(meData.Total_Kinetic_Energy);
  const batKE = meData.Bat_Kinetic_Energy ? getPeak(meData.Bat_Kinetic_Energy) : 0;
  const lowerHalfKE = pelvisKE; // LowerTorso is pelvis segment

  // IK angles
  let xFactorDeg = 0;
  let trunkTiltDeg = 0;
  let pelvisRotAtFPDeg = 0;

  if (ikData) {
    const fpFrame = preProc.foot_plant_frame;
    const contactFrame = preProc.contact_frame;

    // X-Factor: peak torso_rot between FP and contact
    const xFactorWindow = ikData.torso_rot.slice(fpFrame, contactFrame + 1);
    xFactorDeg = getPeak(xFactorWindow.map(v => Math.abs(v * (180 / Math.PI))));

    // Trunk tilt at contact
    if (ikData.torso_side && contactFrame < ikData.torso_side.length) {
      trunkTiltDeg = ikData.torso_side[contactFrame] * (180 / Math.PI);
    }

    // Pelvis rotation at FP
    if (fpFrame < ikData.pelvis_rot.length) {
      pelvisRotAtFPDeg = ikData.pelvis_rot[fpFrame] * (180 / Math.PI);
    }
  }

  const seqCorrect = coreFlow.pt_gap_ms > 0;

  return {
    pelvis_ke: Math.round(pelvisKE * 10) / 10,
    torso_ke: Math.round(torsoKE * 10) / 10,
    arms_ke: Math.round(armsKE * 10) / 10,
    bat_ke: Math.round(batKE * 10) / 10,
    total_ke: Math.round(totalKE * 10) / 10,
    lower_half_ke: Math.round(lowerHalfKE * 10) / 10,
    sequence_correct: seqCorrect,
    x_factor_degrees: Math.round(xFactorDeg * 10) / 10,
    trunk_tilt_degrees: Math.round(trunkTiltDeg * 10) / 10,
    pelvis_rot_at_fp_degrees: Math.round(pelvisRotAtFPDeg * 10) / 10,
    transfer_ratio: Math.round(coreFlow.transfer_ratio * 100) / 100,
    p_to_t_gap_ms: Math.round(coreFlow.pt_gap_ms * 10) / 10,
    arms_ke_ratio: Math.round(armFlow.arms_ke_ratio * 100) / 100,
    delivery_window_ms: Math.round(preProc.delivery_window_ms),
  };
}

// ===========================================================================
// LEGACY 4B MAPPING (for backward compat with UI)
// ===========================================================================

function mapToLegacy4B(
  groundFlow: ScoreComponent,
  coreFlow: ScoreComponent,
  armFlow: ScoreComponent
): ScoringOutput['legacy_4b'] {
  // Map Ground → Body, Core → Brain, Arm → Bat
  const body = groundFlow.score;
  const brain = coreFlow.score;
  const bat = armFlow.score;
  const ball = null; // Not available without ball data

  const composite = Math.round(body * 0.40 + brain * 0.30 + bat * 0.30);
  const rating = toRating(composite);
  const color = getColor(composite);

  return { body, brain, bat, ball, score_4bkrs: composite, rating, color };
}

// ===========================================================================
// MAIN V2 SCORING PIPELINE
// ===========================================================================

function computeV2Scores(input: V2Input): ScoringOutput {
  const { me_data, ik_data, player_metadata, timing } = input;

  // Step 1: Pre-processing
  const preProc = preProcess(me_data, ik_data, player_metadata, timing);

  // Step 2: Pelvis Classification
  const pelvisResult = classifyPelvis(me_data, ik_data, preProc);

  // Step 3: Three-Score Calculation
  const groundFlow = calculateGroundFlow(me_data, preProc);
  const coreFlow = calculateCoreFlow(me_data, preProc);
  const armFlow = calculateArmFlow(me_data, preProc);

  // Step 4: TKE Shape
  const tkeShape = classifyTKEShape(me_data.LowerTorso_Kinetic_Energy);

  // Step 5: Motor Profile
  const motorProfile = detectMotorProfile(
    me_data, ik_data, coreFlow.pt_gap_pct, coreFlow.transfer_ratio, preProc
  );

  // Step 6: Loss Points
  const lossPoints = computeLossPoints(me_data, coreFlow, armFlow, preProc);

  // Step 7: Energy Ledger
  const energyLedger = buildEnergyLedger(me_data, ik_data, coreFlow, armFlow, preProc);

  // Step 8: Legacy mapping
  const legacy4B = mapToLegacy4B(groundFlow, coreFlow, armFlow);

  console.log(`[4B-v2] Ground=${groundFlow.score} Core=${coreFlow.score} Arm=${armFlow.score} ` +
    `Pelvis=${pelvisResult.classification} TKE=${tkeShape} Motor=${motorProfile} ` +
    `TR=${coreFlow.transfer_ratio.toFixed(2)} P→T=${coreFlow.pt_gap_ms.toFixed(1)}ms`);

  return {
    version: '2.0',
    scoring_method: 'me_primary',
    environment: input.environment ?? 'cage',
    pre_processing: {
      swing_duration_ms: preProc.swing_duration_ms,
      swing_category: preProc.swing_category,
      delivery_window_ms: preProc.delivery_window_ms,
      handedness_correction_applied: preProc.handedness_correction_applied,
      flags: preProc.flags,
    },
    scores: {
      ground_flow: groundFlow,
      core_flow: { score: coreFlow.score, color: coreFlow.color, label: coreFlow.label, components: coreFlow.components },
      arm_flow: { score: armFlow.score, color: armFlow.color, label: armFlow.label, components: armFlow.components },
    },
    pelvis_classification: pelvisResult,
    loss_points: lossPoints,
    tke_shape: tkeShape,
    motor_profile: motorProfile,
    energy_ledger: energyLedger,
    legacy_4b: legacy4B,
    scoring_timestamp: new Date().toISOString(),
  };
}

// ===========================================================================
// LEGACY V1 SCORING (IK FALLBACK) — preserved from previous implementation
// ===========================================================================

const LEGACY_WEIGHTS = {
  full:     { body: 0.45, brain: 0.15, bat: 0.25, ball: 0.15 },
  training: { body: 0.55, brain: 0.15, bat: 0.30, ball: 0    },
} as const;

const OMEGA_TO_MPH = (Math.PI / 180) * 0.70 * 2.23694;
const I_BAT_KGM2 = 0.048;
const MAX_BAT_OMEGA_DEGS = 2800;
const DEFAULT_MASS_KG: Record<PlayerLevel, number> = { youth: 45, high_school: 75, college: 85, pro: 90 };
const EST_PITCH_SPEED_MPH: Record<string, number> = { youth: 50, middle_school: 60, high_school: 75, college: 82, pro: 90 };

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin;
  return clamp(outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin));
}

function computeLegacyScores(input: LegacyInput): ScoringOutput {
  // Transfer efficiency
  const sequenceScore = input.pelvis_omega_time < input.trunk_omega_time ? 1.0 : 0.0;
  const timingGapMs = input.trunk_omega_time - input.pelvis_omega_time;
  let deliveryMs = 200;
  if (input.foot_plant_time_ms != null && input.contact_time_ms != null) {
    const d = input.contact_time_ms - input.foot_plant_time_ms;
    if (d > 0) deliveryMs = d;
  }

  let timingScore: number;
  if (timingGapMs <= 0) {
    timingScore = 0;
  } else {
    const gapPct = (timingGapMs / deliveryMs) * 100;
    timingScore = Math.max(0, 1 - gapPct / 50);
  }
  const transferEfficiency = 0.5 * sequenceScore + 0.5 * timingScore;

  // Body
  const pelvisVelScore = lerp(input.pelvis_omega_peak, 300, 900, 0, 100);
  const xFactorScore = lerp(input.hip_shoulder_sep_max_deg, 20, 55, 0, 100);
  const tempoRatio = input.load_duration_ms / Math.max(input.launch_duration_ms, 1);
  const loadScore = lerp(tempoRatio, 1.2, 2.4, 0, 100);
  const strideScore = lerp(input.stride_length_rel_hip, 0.5, 1.4, 0, 100);
  const creation = clamp(pelvisVelScore * 0.35 + xFactorScore * 0.25 + loadScore * 0.25 + strideScore * 0.15);

  const tr = input.transfer_ratio;
  let trScore: number;
  if (tr >= 1.5 && tr <= 1.8) trScore = 90 + lerp(tr, 1.5, 1.8, 0, 10);
  else if (tr < 1.5) trScore = lerp(tr, 0.8, 1.5, 20, 90);
  else trScore = lerp(tr, 1.8, 2.5, 90, 20);

  const bodyTimingGapPct = (timingGapMs / deliveryMs) * 100;
  let bodyTimingScore: number;
  if (bodyTimingGapPct >= 14 && bodyTimingGapPct <= 18) bodyTimingScore = 95;
  else if (bodyTimingGapPct < 14) bodyTimingScore = lerp(bodyTimingGapPct, 0, 14, 20, 95);
  else bodyTimingScore = lerp(bodyTimingGapPct, 18, 35, 95, 30);

  const decelScore = input.pelvis_omega_time < input.trunk_omega_time ? 85 : 40;
  const transfer = clamp(trScore * 0.35 + decelScore * 0.30 + bodyTimingScore * 0.20 +
    (input.arm_omega_peak > input.trunk_omega_peak ? 85 : 50) * 0.15);
  const body = Math.round(clamp(creation * 0.40 + transfer * 0.60));

  // Brain
  const brainTempoScore = lerp(Math.abs(tempoRatio - 2.0), 0.2, 1.0, 100, 20);
  const seqScore = (bodyTimingGapPct >= 14 && bodyTimingGapPct <= 18) ? 95
    : bodyTimingGapPct >= 10 && bodyTimingGapPct < 14 ? 75
    : bodyTimingGapPct > 18 && bodyTimingGapPct <= 22 ? 70 : 40;
  const correctOrder = input.pelvis_omega_time < input.trunk_omega_time;
  const rhythmScore = correctOrder ? 85 : 45;
  const brain = Math.round(clamp(brainTempoScore * 0.40 + seqScore * 0.35 + rhythmScore * 0.25));

  // Bat (simplified)
  const massKg = input.mass_total_kg ?? DEFAULT_MASS_KG[input.player_level] ?? 80;
  const batOmega = input.bat_omega_from_ke ?? input.bat_omega_peak;
  let batSpeedMph = 0;
  if (input.measured_bat_speed_mph && input.measured_bat_speed_mph > 0) {
    batSpeedMph = input.measured_bat_speed_mph;
  } else if (batOmega && batOmega > 100) {
    batSpeedMph = Math.min(batOmega, MAX_BAT_OMEGA_DEGS) * OMEGA_TO_MPH;
  } else {
    batSpeedMph = input.arm_omega_peak * OMEGA_TO_MPH * 1.3;
  }
  const batBench = { youth: { min: 40, elite: 58 }, high_school: { min: 58, elite: 72 }, college: { min: 66, elite: 80 }, pro: { min: 68, elite: 85 } };
  const b = batBench[input.player_level] ?? batBench.high_school;
  const batSpeedScore = lerp(batSpeedMph, b.min, b.elite, 20, 100);
  const bat = Math.round(clamp(batSpeedScore * 0.50 + (correctOrder ? 80 : 40) * 0.50 * Math.max(0, Math.min(1, transferEfficiency))));

  // Ball
  let ball: number | null = null;
  const measuredEV = input.measured_ev_mph ?? input.exit_velocity_mph;
  if (measuredEV && measuredEV > 0) {
    const evBench = { youth: { min: 40, elite: 65 }, high_school: { min: 68, elite: 92 }, college: { min: 78, elite: 100 }, pro: { min: 85, elite: 108 } };
    const eb = evBench[input.player_level] ?? evBench.high_school;
    ball = Math.round(lerp(measuredEV, eb.min, eb.elite, 20, 100));
  }

  const mode: ScoringMode = ball != null ? 'full' : 'training';
  const w = LEGACY_WEIGHTS[mode];
  const composite = Math.round(clamp(body * w.body + brain * w.brain + bat * w.bat + (ball ?? 0) * w.ball));
  const rating = toRating(composite);
  const color = getColor(composite);

  const timingGapPctFinal = (input.load_duration_ms + input.launch_duration_ms) > 0
    ? Math.round((timingGapMs / (input.load_duration_ms + input.launch_duration_ms)) * 100 * 10) / 10 : 0;

  // Build v2 output shape with IK fallback data
  return {
    version: '2.0',
    scoring_method: 'ik_fallback',
    environment: (body as any).environment ?? 'cage',
    pre_processing: {
      swing_duration_ms: input.load_duration_ms + input.launch_duration_ms,
      swing_category: (input.load_duration_ms + input.launch_duration_ms) > SWING_DURATION_WALKTHROUGH_MS ? 'WALKTHROUGH' : 'COMPETITIVE',
      delivery_window_ms: deliveryMs,
      handedness_correction_applied: false,
      flags: [],
    },
    scores: {
      ground_flow: { score: Math.round(creation), color: getColor(Math.round(creation)), label: getLabel(Math.round(creation)), components: { pelvis_vel_score: Math.round(pelvisVelScore), x_factor_score: Math.round(xFactorScore) } },
      core_flow: { score: Math.round(transfer), color: getColor(Math.round(transfer)), label: getLabel(Math.round(transfer)), components: { transfer_ratio: tr, timing_gap_pct: Math.round(bodyTimingGapPct * 10) / 10 } },
      arm_flow: { score: bat, color: getColor(bat), label: getLabel(bat), components: { bat_speed_mph: Math.round(batSpeedMph) } },
    },
    pelvis_classification: {
      classification: input.pelvis_omega_peak < 600 ? 'DEAD_PELVIS' :
        !correctOrder ? 'LATE_PELVIS' : 'HEALTHY_PELVIS',
      problem: null,
      prescription: [],
      anchor: null,
    },
    loss_points: {
      lp1_ground_to_pelvis: { severity: 'LOW', label: 'IK fallback — limited data' },
      lp2_transfer_ratio: { ratio: tr, severity: tr >= 1.5 ? 'LOW' : tr >= 1.0 ? 'MEDIUM' : 'HIGH', label: '' },
      lp3_sequence_timing: { gap_ms: timingGapMs, sequence_correct: correctOrder, severity: correctOrder ? 'LOW' : 'HIGH', label: '' },
      lp4_plane_misalignment: { severity: 'LOW', label: 'Not available in IK fallback' },
      lp5_arms_absorbing: { severity: 'LOW', label: 'Not available in IK fallback' },
      lp6_side_bleed: { severity: 'LOW', label: 'Not available in IK fallback' },
    },
    tke_shape: 'UNKNOWN',
    motor_profile: 'UNKNOWN',
    energy_ledger: {
      pelvis_ke: 0, torso_ke: 0, arms_ke: 0, bat_ke: 0, total_ke: 0, lower_half_ke: 0,
      sequence_correct: correctOrder,
      x_factor_degrees: input.hip_shoulder_sep_max_deg,
      trunk_tilt_degrees: 0,
      pelvis_rot_at_fp_degrees: 0,
      transfer_ratio: tr,
      p_to_t_gap_ms: timingGapMs,
      arms_ke_ratio: 0,
      delivery_window_ms: deliveryMs,
    },
    legacy_4b: { body, brain, bat, ball, score_4bkrs: composite, rating, color },
    scoring_timestamp: new Date().toISOString(),
  };
}

// ===========================================================================
// CORS
// ===========================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ===========================================================================
// EDGE FUNCTION HANDLER
// ===========================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Detect input format: V2 (has me_data) vs Legacy (has pelvis_omega_peak)
    let result: ScoringOutput;

    if (body.me_data && typeof body.me_data === 'object') {
      // V2 ME-primary path
      console.log('[4B-v2] Processing ME-primary input');
      result = computeV2Scores(body as V2Input);
    } else if (body.pelvis_omega_peak != null) {
      // Legacy IK fallback
      console.log('[4B-v2] Processing IK-fallback input');

      const required = ['source', 'pelvis_omega_peak', 'trunk_omega_peak', 'arm_omega_peak',
        'pelvis_omega_time', 'trunk_omega_time', 'transfer_ratio', 'player_level'];
      const missing = required.filter(k => body[k] == null);
      if (missing.length > 0) {
        return new Response(
          JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      result = computeLegacyScores(body as LegacyInput);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid input: provide either me_data (v2) or pelvis_omega_peak (legacy)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

export { computeV2Scores, computeLegacyScores };
export type { V2Input, LegacyInput, ScoringOutput };
