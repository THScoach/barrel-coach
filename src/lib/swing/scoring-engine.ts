// ============================================================================
// Catching Barrels — Swing Scoring Engine v1.0
// Pure functions, no external dependencies.
// ============================================================================

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionMetrics {
  com_drift_inches: number;
  com_velocity_mps: number;
  drift_variability_inches?: number;
  pelvis_peak_deg_s: number;
  pelvis_angular_momentum?: number;
  trunk_peak_deg_s?: number;
  trunk_variability_cv: number;
  trunk_frontal_change_deg: number;
  trunk_lateral_change_deg: number;
  pelvis_torso_gap_ms: number;
  pelvis_torso_gain: number;
  torso_arm_gain: number;
  arm_bat_gain: number;
  arm_variability_cv: number;
  exit_velocity_max: number;
  exit_velocity_min: number;
  height_inches?: number | null;
  weight_lbs?: number | null;
}

export interface ComputedScores {
  platformScore: number;
  bodyScore: number;
  brainScore: number;
  batScore: number;
  ballScore: number;
  windowTimingScore: number;
  windowSpaceScore: number;
  swingWindowScore: number;
  evFloor: number;
  evGap: number;
}

export interface FullReport {
  scores: ComputedScores;
  archetype: string;
  rootIssue: string;
  beat: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function clamp(val: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, val));
}

/** 0-100 scale where floor → 0, ceiling → 100 */
export function normalize(val: number, floor: number, ceiling: number): number {
  if (ceiling === floor) return 50;
  return clamp(((val - floor) / (ceiling - floor)) * 100);
}

/** 0-100 scale where best → 100, worst → 0 */
export function normalizeInverse(val: number, best: number, worst: number): number {
  if (worst === best) return 50;
  return clamp(((worst - val) / (worst - best)) * 100);
}

// ─── Score Functions ────────────────────────────────────────────────────────

function calcPlatformScore(m: SessionMetrics): number {
  const drift = clamp(100 - m.com_drift_inches * 6);
  const velocity = clamp(100 - m.com_velocity_mps * 20);
  const trunkStab = clamp(100 - m.trunk_variability_cv * 2);
  const tiltChange = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;
  const tilt = clamp(100 - tiltChange * 3);
  return Math.round(drift * 0.35 + velocity * 0.25 + trunkStab * 0.25 + tilt * 0.15);
}

function calcBodyScore(m: SessionMetrics): number {
  const driftScore = clamp(100 - m.com_drift_inches * 6);
  const pelvisScore = normalize(m.pelvis_peak_deg_s, 300, 600);
  const trunkCvScore = normalizeInverse(m.trunk_variability_cv, 5, 30);
  const tiltChange = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;
  const tiltScore = normalizeInverse(tiltChange, 2, 15);
  return Math.round((driftScore + pelvisScore + trunkCvScore + tiltScore) / 4);
}

function calcBrainScore(m: SessionMetrics): number {
  const gap = m.pelvis_torso_gap_ms;
  let gapScore: number;
  if (gap >= 25 && gap <= 45) gapScore = 100;
  else if ((gap >= 10 && gap < 25) || (gap > 45 && gap <= 60)) gapScore = 70;
  else if (gap >= 0 && gap < 10) gapScore = 40;
  else gapScore = 25; // negative
  const armConsistency = normalizeInverse(m.arm_variability_cv, 5, 20);
  return Math.round(gapScore * 0.7 + armConsistency * 0.3);
}

function calcBatScore(m: SessionMetrics): number {
  const armBat = normalize(m.arm_bat_gain, 0.8, 1.8);
  const torsoArm = normalize(m.torso_arm_gain, 0.9, 1.6);
  return Math.round(armBat * 0.6 + torsoArm * 0.4);
}

function calcBallScore(m: SessionMetrics): number {
  const evMax = normalize(m.exit_velocity_max, 70, 105);
  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  const gapScore = normalizeInverse(evGap, 5, 20);
  return Math.round(evMax * 0.6 + gapScore * 0.4);
}

function calcWindowTimingScore(m: SessionMetrics, platformScore: number): number {
  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  let score = 100;
  if (m.pelvis_torso_gap_ms <= 5) score -= 25;
  if (platformScore < 60) score -= (60 - platformScore) * 0.7;
  if (m.trunk_variability_cv > 22) score -= (m.trunk_variability_cv - 22) * 1.5;
  if (evGap > 12) score -= (evGap - 12) * 2;
  return clamp(Math.round(score));
}

function calcWindowSpaceScore(m: SessionMetrics, platformScore: number): number {
  const tiltSum = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;
  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  let score = 100;
  if (m.arm_bat_gain < 1.0) score -= Math.min(40, (1.0 - m.arm_bat_gain) * 120);
  if (tiltSum > 10) score -= Math.min(25, (tiltSum - 10) * 2);
  if (platformScore < 60) score -= (60 - platformScore) * 0.5;
  if (evGap > 15) score -= Math.min(20, (evGap - 15) * 3);
  if (m.com_drift_inches > 8) score -= Math.min(15, (m.com_drift_inches - 8) * 3);
  return clamp(Math.round(score));
}

// ─── Classification ─────────────────────────────────────────────────────────

function classifyArchetype(m: SessionMetrics): string {
  let tags: string[] = [];
  if (m.com_drift_inches > 7) tags.push('Glider');
  if (m.pelvis_torso_gap_ms < 10) tags.push('Spinner');
  if (m.arm_bat_gain > 1.6) tags.push('Whipper');
  if (m.pelvis_peak_deg_s > 650) tags.push('Slingshotter');
  if ((m.height_inches ?? 0) >= 74 && tags.includes('Spinner')) {
    tags = ['Trapped Tilt Whipper'];
  }
  if (tags.length === 0) tags.push('Balanced');
  return tags.join('-');
}

function detectRootIssue(m: SessionMetrics): string {
  if (m.com_drift_inches > 7) return 'Glide';
  if (m.pelvis_torso_gap_ms < 10) return 'Timing collapse';
  if (m.trunk_variability_cv > 20) return 'Unstable axis';
  if (m.arm_bat_gain < 1.0) return 'Barrel pulls off';
  return 'No critical issues';
}

function classifyBeat(m: SessionMetrics): string {
  const gap = m.pelvis_torso_gap_ms;
  if (gap <= 5) return 'boom-boom-boom';
  if (gap <= 20) return 'boom…boom…boom';
  return 'boom… boom… boom';
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export function generateFullReport(metrics: SessionMetrics): FullReport {
  const platformScore = calcPlatformScore(metrics);
  const bodyScore = calcBodyScore(metrics);
  const brainScore = calcBrainScore(metrics);
  const batScore = calcBatScore(metrics);
  const ballScore = calcBallScore(metrics);
  const windowTimingScore = calcWindowTimingScore(metrics, platformScore);
  const windowSpaceScore = calcWindowSpaceScore(metrics, platformScore);
  const swingWindowScore = Math.round((windowTimingScore + windowSpaceScore) / 2);
  const evGap = metrics.exit_velocity_max - metrics.exit_velocity_min;
  const evFloor = metrics.exit_velocity_min;

  return {
    scores: {
      platformScore,
      bodyScore,
      brainScore,
      batScore,
      ballScore,
      windowTimingScore,
      windowSpaceScore,
      swingWindowScore,
      evFloor,
      evGap,
    },
    archetype: classifyArchetype(metrics),
    rootIssue: detectRootIssue(metrics),
    beat: classifyBeat(metrics),
  };
}
