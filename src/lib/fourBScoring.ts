// ============================================================================
// 4B SCORING LOGIC v2.2 - Momentum-Based Transfer Scoring
// For Catching Barrels / Lovable Implementation
// ============================================================================

// MLB Averages (from Reboot) - used as baseline
const MLB_AVERAGES = {
  pelvis_velocity: 639.8,    // °/s
  torso_velocity: 803.9,     // °/s
  arms_velocity: 1070.7,     // °/s
  x_factor: 40.7,            // degrees
  tp_velocity_ratio: 1.26,   // torso/pelvis
  at_velocity_ratio: 1.33,   // arms/torso
};

// Age-based caps for youth players (% of MLB)
const AGE_CAPS: Record<string, { pelvis: number; torso: number; arms: number; exit_velo: number }> = {
  '10U': { pelvis: 0.35, torso: 0.35, arms: 0.40, exit_velo: 55 },
  '11U': { pelvis: 0.40, torso: 0.40, arms: 0.45, exit_velo: 60 },
  '12U': { pelvis: 0.45, torso: 0.45, arms: 0.50, exit_velo: 65 },
  '13U': { pelvis: 0.52, torso: 0.55, arms: 0.55, exit_velo: 72 },
  '14U': { pelvis: 0.58, torso: 0.60, arms: 0.62, exit_velo: 78 },
  '15U': { pelvis: 0.65, torso: 0.68, arms: 0.70, exit_velo: 83 },
  '16U': { pelvis: 0.72, torso: 0.75, arms: 0.78, exit_velo: 88 },
  '17U': { pelvis: 0.80, torso: 0.82, arms: 0.85, exit_velo: 92 },
  '18U': { pelvis: 0.85, torso: 0.88, arms: 0.90, exit_velo: 95 },
  'College': { pelvis: 0.90, torso: 0.92, arms: 0.95, exit_velo: 100 },
  'Pro': { pelvis: 1.0, torso: 1.0, arms: 1.0, exit_velo: 110 },
};

// Types
export interface SwingMetrics {
  pelvis_momentum_peak: number;
  torso_momentum_peak: number;
  arms_momentum_peak: number;
  pelvis_peak_frame: number;
  torso_peak_frame: number;
  arms_peak_frame: number;
  contact_frame: number;
  pelvis_decel_pct: number;
  torso_decel_pct: number;
  drift_timing: number;
  bat_direction_std: number;
  exit_velo_avg: number;
  exit_velo_max: number;
  exit_velo_cv: number;
  barrel_rate: number;
  hard_hit_rate: number;
  mishit_rate: number;
  pelvis_velocity?: number;
  torso_velocity?: number;
  arms_velocity?: number;
}

export interface FourBScores {
  body: number;
  brain: number;
  bat: number;
  ball: number;
  composite: number;
  body_components: {
    transfer_efficiency: number;
    stability: number;
    velocity_pct: number;
  };
  brain_components: {
    timing: number;
    consistency: number;
  };
  bat_components: {
    at_ratio: number;
    torso_decel: number;
    path_consistency: number;
  };
  ball_components: {
    exit_velo: number;
    barrel_rate: number;
    hard_hit: number;
  };
  raw_metrics: {
    tp_momentum_ratio: number;
    at_momentum_ratio: number;
    torso_decel_pct: number;
    drift_timing: number;
    bat_direction_std: number;
    timing_gap_pct: number;
  };
  grade: string;
  grade_color: string;
}

// Scoring Functions
function scoreATRatio(atRatio: number): number {
  if (atRatio >= 1.5 && atRatio <= 1.8) return 95;
  if (atRatio >= 1.3 && atRatio < 1.5) return 80;
  if (atRatio > 1.8 && atRatio <= 2.0) return 80;
  if (atRatio >= 1.1 && atRatio < 1.3) return 65;
  if (atRatio > 2.0 && atRatio <= 2.3) return 55;
  if (atRatio < 1.1) return 45;
  return 40;
}

function scoreTPRatio(tpRatio: number): number {
  if (tpRatio >= 4.0 && tpRatio <= 5.5) return 95;
  if (tpRatio > 5.5 && tpRatio <= 6.5) return 80;
  if (tpRatio >= 3.5 && tpRatio < 4.0) return 80;
  if (tpRatio > 6.5 && tpRatio <= 7.5) return 65;
  if (tpRatio > 7.5 && tpRatio <= 9.0) return 50;
  if (tpRatio < 3.5) return 55;
  return 40;
}

function scoreTimingGap(gapPct: number): number {
  if (gapPct >= 8 && gapPct <= 15) return 90;
  if (gapPct >= 5 && gapPct < 8) return 75;
  if (gapPct > 15 && gapPct <= 20) return 75;
  if (gapPct >= 0 && gapPct < 5) return 55;
  if (gapPct > 20 && gapPct <= 25) return 55;
  if (gapPct < 0) return 40;
  return 45;
}

function scoreTorsoDecel(decelPct: number): number {
  if (decelPct >= 45) return 95;
  if (decelPct >= 40 && decelPct < 45) return 85;
  if (decelPct >= 35 && decelPct < 40) return 75;
  if (decelPct >= 30 && decelPct < 35) return 65;
  if (decelPct >= 25 && decelPct < 30) return 55;
  return 45;
}

function scoreStability(driftTiming: number, exitVeloCV: number): number {
  let base = 100;
  if (driftTiming > 0.65) base -= 35;
  else if (driftTiming > 0.55) base -= 20;
  else if (driftTiming < 0.35) base -= 10;
  const volatilityPenalty = Math.min(25, exitVeloCV);
  base -= volatilityPenalty;
  return Math.max(30, base);
}

function scoreBatPathConsistency(batDirStd: number): number {
  if (batDirStd < 10) return 95;
  if (batDirStd >= 10 && batDirStd < 15) return 85;
  if (batDirStd >= 15 && batDirStd < 25) return 70;
  if (batDirStd >= 25 && batDirStd < 35) return 50;
  if (batDirStd >= 35 && batDirStd < 50) return 35;
  return 25;
}

function scoreExitVelo(evAvg: number, ageCap: number): number {
  const pct = evAvg / ageCap;
  if (pct >= 1.0) return 95;
  if (pct >= 0.90) return 85;
  if (pct >= 0.80) return 75;
  if (pct >= 0.70) return 65;
  if (pct >= 0.60) return 55;
  return 45;
}

function scoreBarrelRate(barrelRate: number): number {
  if (barrelRate >= 25) return 95;
  if (barrelRate >= 20) return 85;
  if (barrelRate >= 15) return 75;
  if (barrelRate >= 10) return 65;
  if (barrelRate >= 5) return 55;
  return 45;
}

function scoreHardHitRate(hardHitRate: number): number {
  if (hardHitRate >= 50) return 95;
  if (hardHitRate >= 40) return 85;
  if (hardHitRate >= 30) return 75;
  if (hardHitRate >= 20) return 65;
  if (hardHitRate >= 10) return 55;
  return 45;
}

function getGrade(score: number): { grade: string; color: string } {
  if (score >= 80) return { grade: 'Plus-Plus', color: '#4ecdc4' };
  if (score >= 70) return { grade: 'Plus', color: '#4ecdc4' };
  if (score >= 60) return { grade: 'Above Average', color: '#7fd8be' };
  if (score >= 50) return { grade: 'Average', color: '#ffa500' };
  if (score >= 40) return { grade: 'Below Average', color: '#ff8c42' };
  return { grade: 'Developing', color: '#ff6b6b' };
}

// Main Calculation Function
export function calculate4BScores(
  metrics: SwingMetrics,
  ageGroup: string = '13U'
): FourBScores {
  
  const caps = AGE_CAPS[ageGroup] || AGE_CAPS['13U'];
  
  const tpMomentumRatio = metrics.torso_momentum_peak / metrics.pelvis_momentum_peak;
  const atMomentumRatio = metrics.arms_momentum_peak / metrics.torso_momentum_peak;
  const totalFrames = metrics.contact_frame;
  const timingGapPct = ((metrics.arms_peak_frame - metrics.torso_peak_frame) / totalFrames) * 100;
  
  // BODY (30%)
  const tpScore = scoreTPRatio(tpMomentumRatio);
  const atScoreForTransfer = scoreATRatio(atMomentumRatio);
  const transferEfficiency = (tpScore + atScoreForTransfer) / 2;
  const stabilityScore = scoreStability(metrics.drift_timing, metrics.exit_velo_cv);
  let velocityPctScore = 75;
  if (metrics.torso_velocity) {
    const torsoVsMLB = metrics.torso_velocity / MLB_AVERAGES.torso_velocity;
    const expectedForAge = caps.torso;
    velocityPctScore = Math.min(100, (torsoVsMLB / expectedForAge) * 100);
  }
  const bodyScore = transferEfficiency * 0.50 + stabilityScore * 0.35 + velocityPctScore * 0.15;
  
  // BRAIN (20%)
  const timingScore = scoreTimingGap(timingGapPct);
  const consistencyPenalty = Math.min(35, Math.max(0, (metrics.exit_velo_cv - 12) / 30) * 35);
  const consistencyScore = 100 - consistencyPenalty;
  const brainScore = timingScore * 0.50 + consistencyScore * 0.50;
  
  // BAT (30%)
  const atRatioScore = scoreATRatio(atMomentumRatio);
  const torsoDecelScore = scoreTorsoDecel(metrics.torso_decel_pct);
  const pathConsistencyScore = scoreBatPathConsistency(metrics.bat_direction_std);
  const batScore = atRatioScore * 0.40 + torsoDecelScore * 0.30 + pathConsistencyScore * 0.30;
  
  // BALL (20%)
  const exitVeloScore = scoreExitVelo(metrics.exit_velo_avg, caps.exit_velo);
  const barrelRateScore = scoreBarrelRate(metrics.barrel_rate);
  const hardHitScore = scoreHardHitRate(metrics.hard_hit_rate);
  const mishitPenalty = Math.max(0, (metrics.mishit_rate - 15) * 0.5);
  const ballScore = Math.max(30, exitVeloScore * 0.40 + barrelRateScore * 0.30 + hardHitScore * 0.30 - mishitPenalty);
  
  // COMPOSITE
  const composite = bodyScore * 0.30 + brainScore * 0.20 + batScore * 0.30 + ballScore * 0.20;
  const { grade, color } = getGrade(composite);
  
  return {
    body: Math.round(bodyScore),
    brain: Math.round(brainScore),
    bat: Math.round(batScore),
    ball: Math.round(ballScore),
    composite: Math.round(composite),
    body_components: {
      transfer_efficiency: Math.round(transferEfficiency),
      stability: Math.round(stabilityScore),
      velocity_pct: Math.round(velocityPctScore),
    },
    brain_components: {
      timing: Math.round(timingScore),
      consistency: Math.round(consistencyScore),
    },
    bat_components: {
      at_ratio: Math.round(atRatioScore),
      torso_decel: Math.round(torsoDecelScore),
      path_consistency: Math.round(pathConsistencyScore),
    },
    ball_components: {
      exit_velo: Math.round(exitVeloScore),
      barrel_rate: Math.round(barrelRateScore),
      hard_hit: Math.round(hardHitScore),
    },
    raw_metrics: {
      tp_momentum_ratio: Number(tpMomentumRatio.toFixed(2)),
      at_momentum_ratio: Number(atMomentumRatio.toFixed(2)),
      torso_decel_pct: metrics.torso_decel_pct,
      drift_timing: metrics.drift_timing,
      bat_direction_std: metrics.bat_direction_std,
      timing_gap_pct: Number(timingGapPct.toFixed(1)),
    },
    grade,
    grade_color: color,
  };
}
