// ============================================================================
// 4B SCORING FROM SENSOR
// Body, Brain, Bat, Ball - with explicit confidence levels
// ============================================================================

import type {
  SensorFacts,
  BatScore,
  BrainScore,
  BodyScore,
  BallScore,
  FourBFromSensor,
  PopulationBaseline,
  TrunkStabilityData,
} from './types';
import { calculatePercentile } from './extract-facts';
import { kespSensorOnly } from '@/lib/kesp-engine';
import type { BatType, PitchPreset } from '@/lib/kesp-engine';

// ============================================================================
// BAT SCORE (HIGH confidence - direct from sensor)
// ============================================================================

/**
 * Calculate BAT score from sensor data
 * HIGH confidence - these are direct measurements
 */
export function calculateBatScore(
  facts: SensorFacts,
  baseline: PopulationBaseline
): BatScore {
  // Bat speed component (40% weight)
  const batSpeedPercentile = calculatePercentile(
    facts.batSpeedMax,
    baseline.batSpeed.p10,
    baseline.batSpeed.p50,
    baseline.batSpeed.p90
  );

  // Hand speed component (25% weight)
  const handSpeedPercentile = calculatePercentile(
    facts.handSpeedMax,
    baseline.handSpeed.p10,
    baseline.handSpeed.p50,
    baseline.handSpeed.p90
  );

  // Release quality component (35% weight) - hand-to-bat ratio
  const releasePercentile = calculatePercentile(
    facts.handToBatRatio,
    baseline.handToBatRatio.p10,
    baseline.handToBatRatio.p50,
    baseline.handToBatRatio.p90
  );

  // Acceleration component (optional)
  let accelerationScore: number | undefined;
  if (facts.rotationalAccelerationMean !== undefined) {
    // Normalize to 0-100 scale (assuming typical range 10000-25000)
    accelerationScore = Math.min(100, Math.max(0,
      (facts.rotationalAccelerationMean - 10000) / 150
    ));
  }

  // Calculate weighted overall
  const overall = Math.round(
    batSpeedPercentile * 0.4 +
    handSpeedPercentile * 0.25 +
    releasePercentile * 0.35
  );

  return {
    overall: clamp(overall, 0, 100),
    batSpeedScore: Math.round(batSpeedPercentile),
    handSpeedScore: Math.round(handSpeedPercentile),
    releaseScore: Math.round(releasePercentile),
    accelerationScore,
    confidence: 'high',
  };
}

// ============================================================================
// BRAIN SCORE (MEDIUM confidence - inferred from patterns)
// ============================================================================

/**
 * Calculate BRAIN score from sensor patterns
 * MEDIUM confidence - inferred from variance and consistency metrics
 */
export function calculateBrainScore(
  facts: SensorFacts,
  baseline: PopulationBaseline,
  trunkData?: TrunkStabilityData | null,
): BrainScore {
  // Timing consistency
  const timingCV = facts.timingCV;
  const timingScore = Math.max(0, Math.min(100, 100 - (timingCV * 1000)));

  // Path consistency
  const pathStdDev = facts.attackAngleStdDev;
  const pathScore = Math.max(0, Math.min(100, 100 - (pathStdDev * 5)));

  // Zone adaptability
  const directionRange = facts.attackDirectionStdDev;
  let adaptabilityScore: number;
  if (directionRange < 3) {
    adaptabilityScore = 60;
  } else if (directionRange <= 12) {
    adaptabilityScore = 80 + (directionRange - 3) * 2;
  } else {
    adaptabilityScore = Math.max(40, 100 - (directionRange - 12) * 3);
  }

  // Trunk consistency from ssi_bandwidth (20% weight when available)
  // bandwidth 0 = perfect consistency (100), bandwidth >= 50 = no consistency (0)
  const hasTrunkConsistency = trunkData?.ssi_bandwidth != null;
  let trunkConsistencyScore: number | undefined;

  let overall: number;
  if (hasTrunkConsistency) {
    const bw = trunkData!.ssi_bandwidth!;
    trunkConsistencyScore = Math.round(clamp((1 - Math.min(bw, 50) / 50) * 100, 0, 100));
    // Redistribute: timing 32%, path 24%, adaptability 24%, trunk 20%
    overall = Math.round(
      timingScore * 0.32 +
      pathScore * 0.24 +
      adaptabilityScore * 0.24 +
      trunkConsistencyScore * 0.20
    );
  } else {
    // Original weights: timing 40%, path 30%, adaptability 30%
    overall = Math.round(
      timingScore * 0.4 +
      pathScore * 0.3 +
      adaptabilityScore * 0.3
    );
  }

  return {
    overall: clamp(overall, 0, 100),
    timingConsistency: Math.round(timingScore),
    pathConsistency: Math.round(pathScore),
    zoneAdaptability: Math.round(adaptabilityScore),
    trunkConsistency: trunkConsistencyScore,
    confidence: 'medium',
    reasoning: `BRAIN score inferred from timing CV (${(timingCV * 100).toFixed(1)}%), ` +
      `attack angle variance (${pathStdDev.toFixed(1)}°), and direction range ` +
      `(${directionRange.toFixed(1)}°).` +
      (hasTrunkConsistency ? ` Trunk consistency (SSI bandwidth ${trunkData!.ssi_bandwidth!.toFixed(1)}) added at 20% weight.` : '') +
      ` Timing and path consistency are measurable, ` +
      `but pitch recognition and decision-making require video/game data.`,
  };
}

// ============================================================================
// BODY SCORE (LOW confidence - prediction without video)
// ============================================================================

/**
 * Calculate BODY score prediction from sensor data
 * LOW confidence - this is speculative without video/3D analysis
 */
export function calculateBodyScore(
  facts: SensorFacts,
  baseline: PopulationBaseline
): BodyScore {
  const needsVideoFor: string[] = [];

  // Sequencing estimate (35% weight)
  // Infer from relationship between hand speed and bat speed
  // Good sequencing = efficient energy transfer = good ratio
  const ratioPercentile = calculatePercentile(
    facts.handToBatRatio,
    baseline.handToBatRatio.p10,
    baseline.handToBatRatio.p50,
    baseline.handToBatRatio.p90
  );
  const sequencingScore = ratioPercentile;
  needsVideoFor.push('Hip-shoulder separation at load');
  needsVideoFor.push('Kinetic chain timing');

  // Separation estimate (35% weight)
  // Infer from rotational acceleration if available
  let separationScore: number;
  if (facts.rotationalAccelerationMean !== undefined) {
    separationScore = Math.min(100, facts.rotationalAccelerationMean / 200);
  } else {
    // Without this data, use ratio as proxy
    separationScore = ratioPercentile * 0.8;
    needsVideoFor.push('Rotational mechanics');
  }
  needsVideoFor.push('X-factor angle');

  // Ground force estimate (30% weight)
  // Very speculative - we can't measure this from bat sensor
  // Use hand speed percentile as weak proxy (more force = more speed)
  const handSpeedPercentile = calculatePercentile(
    facts.handSpeedMean,
    baseline.handSpeed.p10,
    baseline.handSpeed.p50,
    baseline.handSpeed.p90
  );
  const groundForceScore = handSpeedPercentile * 0.7 + 15; // Scale down and add floor
  needsVideoFor.push('Weight transfer pattern');
  needsVideoFor.push('Ground reaction forces');

  const overall = Math.round(
    sequencingScore * 0.35 +
    separationScore * 0.35 +
    groundForceScore * 0.30
  );

  return {
    overall: clamp(overall, 0, 100),
    estimatedSequencing: Math.round(sequencingScore),
    estimatedSeparation: Math.round(separationScore),
    estimatedGroundForce: Math.round(groundForceScore),
    confidence: 'low',
    reasoning: `BODY score is a PREDICTION based on energy transfer efficiency. ` +
      `Without video or 3D motion capture, we cannot directly observe body mechanics. ` +
      `This score assumes that efficient energy transfer (good ratio) correlates with ` +
      `good body sequencing, which is often but not always true.`,
    needsVideoFor: Array.from(new Set(needsVideoFor)), // Deduplicate
  };
}

// ============================================================================
// BALL SCORE (from launch monitor - N/A from sensor alone)
// ============================================================================

/**
 * Calculate BALL score placeholder
 * This requires launch monitor data, not bat sensor
 */
export function calculateBallScore(
  facts?: SensorFacts,
  launchMonitorData?: {
    exitVelocity?: number;
    launchAngle?: number;
    hardHitRate?: number;
  },
  kespOpts?: {
    bat_type?: BatType;
    pitch_preset?: PitchPreset;
  },
): BallScore {
  // --- Path 1: Real launch monitor data (HIGH confidence) ---
  if (launchMonitorData && launchMonitorData.exitVelocity !== undefined) {
    const ev = launchMonitorData.exitVelocity;
    const la = launchMonitorData.launchAngle;
    const hhr = launchMonitorData.hardHitRate;

    const evScore = Math.min(100, (ev / 100) * 100);

    let laScore = 50;
    if (la !== undefined) {
      if (la >= 10 && la <= 30) {
        laScore = 80 + ((20 - Math.abs(la - 20)) / 20) * 20;
      } else if (la > 0 && la < 10) {
        laScore = 50 + la * 3;
      } else if (la > 30 && la < 45) {
        laScore = 80 - (la - 30) * 2;
      } else {
        laScore = Math.max(20, 50 - Math.abs(la));
      }
    }

    let hhrScore = 50;
    if (hhr !== undefined) {
      hhrScore = Math.min(100, hhr);
    }

    const overall = Math.round(evScore * 0.5 + laScore * 0.3 + hhrScore * 0.2);

    return {
      overall: clamp(overall, 0, 100),
      available: true,
      exitVelocity: ev,
      launchAngle: la,
      hardHitRate: hhr,
      confidence: 'high',
    };
  }

  // --- Path 2: KESP prediction from sensor data (MEDIUM confidence) ---
  if (facts) {
    const kesp = kespSensorOnly(
      {
        bat_speed_mph: facts.batSpeedMax,
        attack_angle_std_deg: facts.attackAngleStdDev,
        attack_angle_mean_deg: facts.attackAngleMean,
        hand_to_bat_ratio: facts.handToBatRatio,
      },
      {
        bat_type: kespOpts?.bat_type ?? 'bbcor',
        pitch_preset: kespOpts?.pitch_preset ?? 'bp_machine',
      },
    );

    // Score the predicted EV on the same 0-100 scale
    const evScore = Math.min(100, (kesp.predicted_ev_mph / 100) * 100);
    const overall = Math.round(evScore);

    return {
      overall: clamp(overall, 0, 100),
      available: true,
      exitVelocity: kesp.predicted_ev_mph,
      confidence: 'medium',
      reasoning: `Predicted via KESP collision model (bat ${facts.batSpeedMax} mph, ` +
        `contact quality ${kesp.contact_quality}, pitch preset ${kespOpts?.pitch_preset ?? 'bp_machine'}). ` +
        `Launch monitor data would upgrade this to HIGH confidence.`,
    };
  }

  // --- Path 3: No data at all ---
  return {
    overall: 0,
    available: false,
    confidence: 'low',
  };
}

// ============================================================================
// COMPLETE 4B ASSESSMENT
// ============================================================================

/**
 * Calculate complete 4B assessment from sensor
 */
export function calculateFourBFromSensor(
  facts: SensorFacts,
  baseline: PopulationBaseline,
  launchMonitorData?: {
    exitVelocity?: number;
    launchAngle?: number;
    hardHitRate?: number;
  }
): FourBFromSensor {
  const bat = calculateBatScore(facts, baseline);
  const brain = calculateBrainScore(facts, baseline);
  const body = calculateBodyScore(facts, baseline);
  const ball = calculateBallScore(facts, launchMonitorData);

  // Composite: weight by confidence
  // BAT (HIGH): 40%
  // BRAIN (MEDIUM): 30%
  // BODY (LOW): 15%
  // BALL: 15% (if available, otherwise redistribute)
  let composite: number;
  if (ball.available && ball.confidence === 'high') {
    composite = Math.round(
      bat.overall * 0.35 +
      brain.overall * 0.25 +
      body.overall * 0.15 +
      ball.overall * 0.25
    );
  } else if (ball.available && ball.confidence === 'medium') {
    composite = Math.round(
      bat.overall * 0.40 +
      brain.overall * 0.25 +
      body.overall * 0.15 +
      ball.overall * 0.20
    );
  } else {
    composite = Math.round(
      bat.overall * 0.50 +
      brain.overall * 0.35 +
      body.overall * 0.15
    );
  }

  const confidenceNote = generateConfidenceNote(bat, brain, body, ball);

  return {
    bat,
    brain,
    body,
    ball,
    compositeScore: composite,
    confidenceNote,
  };
}

/**
 * Generate confidence explanation
 */
function generateConfidenceNote(
  bat: BatScore,
  brain: BrainScore,
  body: BodyScore,
  ball: BallScore
): string {
  const parts: string[] = [];

  parts.push(`BAT score (${bat.overall}) is HIGH confidence - directly measured from sensor.`);
  parts.push(`BRAIN score (${brain.overall}) is MEDIUM confidence - inferred from timing and path consistency.`);
  parts.push(`BODY score (${body.overall}) is LOW confidence - predicted from energy transfer patterns. ` +
    `Video analysis would improve accuracy.`);

  if (ball.available && ball.confidence === 'high') {
    parts.push(`BALL score (${ball.overall}) is HIGH confidence - measured from launch monitor.`);
  } else if (ball.available && ball.confidence === 'medium') {
    parts.push(`BALL score (${ball.overall}) is MEDIUM confidence - predicted via KESP collision model. Launch monitor data would upgrade this to HIGH confidence.`);
  } else {
    parts.push(`BALL score requires launch monitor or sensor data.`);
  }

  return parts.join(' ');
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
