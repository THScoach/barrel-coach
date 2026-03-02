/**
 * KESP Engine — Kinetic Excess Speed Potential
 *
 * Predicts batted-ball exit velocity from bat-sensor data using
 * 1-D ball-bat collision physics (Alan Nathan / Rod Cross model).
 *
 * Three operating modes:
 *   Sensor-only : bat sensor → predicted EV
 *   Full        : body mechanics → predicted bat speed → predicted EV
 *   Hybrid      : both paths + diagnostic gap
 */

// ============================================================================
// TYPES
// ============================================================================

export type BatType = 'wood' | 'bbcor' | 'usssa' | 'usa_bat';

export type PitchPreset =
  | 'tee'
  | 'front_toss'
  | 'bp_machine'
  | 'live_bp'
  | 'game_fb'
  | 'elite_fb';

export type KESPMode = 'sensor_only' | 'full' | 'hybrid';

export type PlayerLevel =
  | 'youth'
  | 'high_school'
  | 'college'
  | 'milb'
  | 'mlb';

/** Bat sensor inputs (sensor-only & hybrid) */
export interface SensorInput {
  bat_speed_mph: number;
  attack_angle_std_deg?: number | null;
  attack_angle_mean_deg?: number | null;
  impact_location_x_inches?: number | null;
  hand_to_bat_ratio?: number | null;
}

/** Body mechanics inputs (full & hybrid) */
export interface BodyInput {
  player_height_inches: number;
  player_weight_lbs: number;
  pelvis_velocity_dps?: number | null;   // deg/s
  torso_velocity_dps?: number | null;    // deg/s
  arm_velocity_dps?: number | null;      // deg/s (lead arm)
  sequence_quality?: number | null;      // 0-1 (proximal-distal timing)
  transfer_ratio?: number | null;        // torso/pelvis ratio
  level: PlayerLevel;
}

export interface KESPOptions {
  bat_type: BatType;
  pitch_preset?: PitchPreset;
  pitch_speed_mph?: number;
}

export interface KESPResult {
  mode: KESPMode;
  predicted_ev_mph: number;
  contact_quality: number;           // 0-1
  bat_speed_used_mph: number;
  pitch_speed_used_mph: number;

  // Full / Hybrid only
  predicted_bat_speed_mph?: number;
  body_bat_gap_mph?: number;         // predicted - measured (positive = leaking)

  // Diagnostic breakdown
  diagnostics: {
    e: number;                       // COR
    r: number;                       // mass ratio
    bat_coeff: number;               // effective bat multiplier
    plane_factor: number;            // attack angle consistency
    angle_factor: number;            // mean attack angle quality
    barrel_factor: number;           // impact location quality
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Bat profiles: e = COR, r = mass ratio m_ball / M_eff_bat */
const BAT_PROFILES: Record<BatType, { e: number; r: number; q: number; batCoeff: number }> = {
  wood:    { e: 0.50, r: 0.20, q: 0.25, batCoeff: 1.25 },
  bbcor:   { e: 0.50, r: 0.22, q: 0.27, batCoeff: 1.27 },
  usssa:   { e: 0.55, r: 0.25, q: 0.32, batCoeff: 1.32 },
  usa_bat: { e: 0.50, r: 0.20, q: 0.25, batCoeff: 1.24 },
};

/** Pitch speed presets (mph) */
const PITCH_PRESETS: Record<PitchPreset, number> = {
  tee: 0,
  front_toss: 45,
  bp_machine: 55,
  live_bp: 70,
  game_fb: 90,
  elite_fb: 97,
};

/**
 * Level baselines for body → bat speed prediction
 * [base_bat_speed_mph, reference_weight_lbs, reference_transfer_ratio]
 */
const LEVEL_BASELINES: Record<PlayerLevel, { base: number; refWeight: number; refTR: number }> = {
  youth:       { base: 55, refWeight: 120, refTR: 1.15 },
  high_school: { base: 64, refWeight: 170, refTR: 1.25 },
  college:     { base: 68, refWeight: 190, refTR: 1.30 },
  milb:        { base: 72, refWeight: 200, refTR: 1.32 },
  mlb:         { base: 74, refWeight: 205, refTR: 1.34 },
};

// ============================================================================
// CONTACT QUALITY — Sensor-derived sub-factors
// ============================================================================

/**
 * Attack angle consistency (stdDev).
 * ≤3° = 1.0, 3-6° linear to 0.91, 6-10° to 0.75, >10° degrades further.
 */
function planeFactor(stdDeg: number | null | undefined): number {
  if (stdDeg == null) return 0.92; // assume average if unknown
  if (stdDeg <= 3) return 1.0;
  if (stdDeg <= 6) return 1.0 - ((stdDeg - 3) / 3) * 0.09;   // → 0.91
  if (stdDeg <= 10) return 0.91 - ((stdDeg - 6) / 4) * 0.16;  // → 0.75
  return Math.max(0.50, 0.75 - ((stdDeg - 10) / 10) * 0.25);
}

/**
 * Mean attack angle quality.
 * 10° ideal = 1.0; outside that range degrades symmetrically.
 */
function angleFactor(meanDeg: number | null | undefined): number {
  if (meanDeg == null) return 0.95;
  const IDEAL = 10;
  const deviation = Math.abs(meanDeg - IDEAL);
  if (deviation <= 3) return 1.0;
  if (deviation <= 8) return 1.0 - ((deviation - 3) / 5) * 0.10;  // → 0.90
  if (deviation <= 15) return 0.90 - ((deviation - 8) / 7) * 0.15; // → 0.75
  return Math.max(0.55, 0.75 - ((deviation - 15) / 15) * 0.20);
}

/**
 * Barrel/impact location quality (distance from sweet spot in inches).
 * ≤5" = 1.0, 5-8" linear to 0.91, >8" degrades further.
 */
function barrelFactor(offsetInches: number | null | undefined): number {
  if (offsetInches == null) return 0.95;
  const dist = Math.abs(offsetInches);
  if (dist <= 5) return 1.0;
  if (dist <= 8) return 1.0 - ((dist - 5) / 3) * 0.09;   // → 0.91
  return Math.max(0.60, 0.91 - ((dist - 8) / 8) * 0.31);
}

/** Composite contact quality (geometric mean of sub-factors) */
function calculateContactQuality(sensor: SensorInput): {
  quality: number;
  plane: number;
  angle: number;
  barrel: number;
} {
  const plane = planeFactor(sensor.attack_angle_std_deg);
  const angle = angleFactor(sensor.attack_angle_mean_deg);
  const barrel = barrelFactor(sensor.impact_location_x_inches);
  const quality = Math.cbrt(plane * angle * barrel); // geometric mean
  return { quality, plane, angle, barrel };
}

// ============================================================================
// BODY → PREDICTED BAT SPEED
// ============================================================================

/**
 * Predict bat speed from body mechanics.
 *
 * bat_speed = base + mass_adj + TR_adj + AM_adj + seq_adj
 *
 * Capped: mass adjustment maxes out at ±50 lb delta from reference.
 */
function predictBatSpeedFromBody(body: BodyInput): number {
  const bl = LEVEL_BASELINES[body.level];

  // Mass adjustment: ~0.08 mph per lb, capped at ±50 lb
  const weightDelta = Math.max(-50, Math.min(50, body.player_weight_lbs - bl.refWeight));
  const massAdj = weightDelta * 0.08;

  // Transfer ratio adjustment: deviation from reference TR
  let trAdj = 0;
  if (body.transfer_ratio != null) {
    trAdj = (body.transfer_ratio - bl.refTR) * 12; // ~12 mph per unit TR
  }

  // Arm velocity contribution (lead arm angular velocity)
  let amAdj = 0;
  if (body.arm_velocity_dps != null) {
    // Normalize around ~900 dps baseline
    amAdj = ((body.arm_velocity_dps - 900) / 100) * 1.5;
  }

  // Sequence quality bonus (0-1 scale, 0.7 = neutral)
  let seqAdj = 0;
  if (body.sequence_quality != null) {
    seqAdj = (body.sequence_quality - 0.7) * 8;
  }

  return Math.round((bl.base + massAdj + trAdj + amAdj + seqAdj) * 10) / 10;
}

// ============================================================================
// STAGE 2 — COLLISION MODEL
// ============================================================================

/**
 * 1-D ball-bat collision (Nathan/Cross):
 *
 *   EV = (e × v_pitch + batCoeff × v_bat × contactQuality) / (1 + r)
 *
 * Where:
 *   e         = coefficient of restitution
 *   r         = mass ratio (m_ball / M_eff_bat)
 *   batCoeff  = effective bat contribution coefficient
 */
function collisionEV(
  vBat: number,
  vPitch: number,
  contactQuality: number,
  profile: { e: number; r: number; batCoeff: number },
): number {
  const { e, r, batCoeff } = profile;
  const ev = (e * vPitch + batCoeff * vBat * contactQuality) / (1 + r);
  return Math.round(ev * 10) / 10;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Sensor-only mode: bat sensor data → predicted EV.
 */
export function kespSensorOnly(
  sensor: SensorInput,
  opts: KESPOptions,
): KESPResult {
  const profile = BAT_PROFILES[opts.bat_type];
  const pitchMph = opts.pitch_speed_mph ?? PITCH_PRESETS[opts.pitch_preset ?? 'tee'];
  const cq = calculateContactQuality(sensor);

  const ev = collisionEV(sensor.bat_speed_mph, pitchMph, cq.quality, profile);

  return {
    mode: 'sensor_only',
    predicted_ev_mph: ev,
    contact_quality: Math.round(cq.quality * 1000) / 1000,
    bat_speed_used_mph: sensor.bat_speed_mph,
    pitch_speed_used_mph: pitchMph,
    diagnostics: {
      e: profile.e,
      r: profile.r,
      bat_coeff: profile.batCoeff,
      plane_factor: Math.round(cq.plane * 1000) / 1000,
      angle_factor: Math.round(cq.angle * 1000) / 1000,
      barrel_factor: Math.round(cq.barrel * 1000) / 1000,
    },
  };
}

/**
 * Full mode: body mechanics → predicted bat speed → predicted EV.
 */
export function kespFull(
  body: BodyInput,
  opts: KESPOptions,
): KESPResult {
  const profile = BAT_PROFILES[opts.bat_type];
  const pitchMph = opts.pitch_speed_mph ?? PITCH_PRESETS[opts.pitch_preset ?? 'tee'];
  const predictedBat = predictBatSpeedFromBody(body);

  // No sensor data → assume average contact quality
  const avgQuality = 0.92;

  const ev = collisionEV(predictedBat, pitchMph, avgQuality, profile);

  return {
    mode: 'full',
    predicted_ev_mph: ev,
    contact_quality: avgQuality,
    bat_speed_used_mph: predictedBat,
    pitch_speed_used_mph: pitchMph,
    predicted_bat_speed_mph: predictedBat,
    diagnostics: {
      e: profile.e,
      r: profile.r,
      bat_coeff: profile.batCoeff,
      plane_factor: 0.92,
      angle_factor: 0.95,
      barrel_factor: 0.95,
    },
  };
}

/**
 * Hybrid mode: both sensor + body predictions, with diagnostic gap.
 *
 * Gap = predicted_bat_speed - measured_bat_speed
 *   Positive gap → athlete is "leaking" (body should produce more speed)
 *   Negative gap → over-performing prediction (elite mechanics / sequencing)
 */
export function kespHybrid(
  sensor: SensorInput,
  body: BodyInput,
  opts: KESPOptions,
): KESPResult {
  const profile = BAT_PROFILES[opts.bat_type];
  const pitchMph = opts.pitch_speed_mph ?? PITCH_PRESETS[opts.pitch_preset ?? 'tee'];
  const cq = calculateContactQuality(sensor);
  const predictedBat = predictBatSpeedFromBody(body);

  // Use measured bat speed for EV (more accurate)
  const ev = collisionEV(sensor.bat_speed_mph, pitchMph, cq.quality, profile);

  const gap = Math.round((predictedBat - sensor.bat_speed_mph) * 10) / 10;

  return {
    mode: 'hybrid',
    predicted_ev_mph: ev,
    contact_quality: Math.round(cq.quality * 1000) / 1000,
    bat_speed_used_mph: sensor.bat_speed_mph,
    pitch_speed_used_mph: pitchMph,
    predicted_bat_speed_mph: predictedBat,
    body_bat_gap_mph: gap,
    diagnostics: {
      e: profile.e,
      r: profile.r,
      bat_coeff: profile.batCoeff,
      plane_factor: Math.round(cq.plane * 1000) / 1000,
      angle_factor: Math.round(cq.angle * 1000) / 1000,
      barrel_factor: Math.round(cq.barrel * 1000) / 1000,
    },
  };
}

// ============================================================================
// CONVENIENCE
// ============================================================================

/** Resolve a pitch preset to mph */
export function getPitchSpeed(preset: PitchPreset): number {
  return PITCH_PRESETS[preset];
}

/** Get all available pitch presets with their speeds */
export function getAllPitchPresets(): { preset: PitchPreset; mph: number }[] {
  return (Object.entries(PITCH_PRESETS) as [PitchPreset, number][]).map(
    ([preset, mph]) => ({ preset, mph }),
  );
}

/** Get bat profile constants */
export function getBatProfile(bat: BatType) {
  return { ...BAT_PROFILES[bat] };
}

/** Interpret the body-bat gap */
export function interpretGap(gapMph: number): {
  label: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  description: string;
} {
  if (gapMph <= 1) {
    return {
      label: 'Optimized',
      severity: 'none',
      description: 'Body mechanics are fully translating to bat speed.',
    };
  }
  if (gapMph <= 3) {
    return {
      label: 'Minor leak',
      severity: 'mild',
      description: 'Small energy leak in the kinetic chain — likely sequencing or connection.',
    };
  }
  if (gapMph <= 6) {
    return {
      label: 'Moderate leak',
      severity: 'moderate',
      description: 'Meaningful speed left on the table — check torso-arm connection and hand path.',
    };
  }
  return {
    label: 'Major leak',
    severity: 'severe',
    description: 'Significant kinetic chain breakdown — body is generating speed that never reaches the barrel.',
  };
}
