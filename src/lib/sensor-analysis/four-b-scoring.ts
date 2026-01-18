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
} from './types';
import { calculatePercentile } from './extract-facts';

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
    confidence: 'HIGH',
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
  baseline: PopulationBaseline
): BrainScore {
  // Timing consistency (40% weight)
  // Lower CV = higher score
  const timingCV = facts.timingCV;
  const timingScore = Math.max(0, Math.min(100, 100 - (timingCV * 1000)));

  // Path consistency (30% weight)
  // Lower attack angle StdDev = higher score
  const pathStdDev = facts.attackAngleStdDev;
  const pathScore = Math.max(0, Math.min(100, 100 - (pathStdDev * 5)));

  // Zone adaptability (30% weight)
  // Moderate attack direction range is ideal (5-12 degrees)
  const directionRange = facts.attackDirectionStdDev;
  let adaptabilityScore: number;
  if (directionRange < 3) {
    // Too rigid
    adaptabilityScore = 60;
  } else if (directionRange <= 12) {
    // Ideal range - adaptable
    adaptabilityScore = 80 + (directionRange - 3) * 2;
  } else {
    // Too scattered - might be inconsistent
    adaptabilityScore = Math.max(40, 100 - (directionRange - 12) * 3);
  }

  const overall = Math.round(
    timingScore * 0.4 +
    pathScore * 0.3 +
    adaptabilityScore * 0.3
  );

  return {
    overall: clamp(overall, 0, 100),
    timingConsistency: Math.round(timingScore),
    pathConsistency: Math.round(pathScore),
    zoneAdaptability: Math.round(adaptabilityScore),
    confidence: 'MEDIUM',
    reasoning: `BRAIN score inferred from timing CV (${(timingCV * 100).toFixed(1)}%), ` +
      `attack angle variance (${pathStdDev.toFixed(1)}°), and direction range ` +
      `(${directionRange.toFixed(1)}°). Timing and path consistency are measurable, ` +
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
    confidence: 'LOW',
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
  launchMonitorData?: {
    exitVelocity?: number;
    launchAngle?: number;
    hardHitRate?: number;
  }
): BallScore {
  if (!launchMonitorData || launchMonitorData.exitVelocity === undefined) {
    return {
      overall: 0,
      available: false,
      confidence: 'LOW',
    };
  }

  // If we have launch monitor data, calculate score
  const ev = launchMonitorData.exitVelocity;
  const la = launchMonitorData.launchAngle;
  const hhr = launchMonitorData.hardHitRate;

  // Exit velocity score (50% weight for youth, scales up)
  // Youth 12U: 50+ is good, 70+ is elite
  // High school: 80+ is good, 95+ is elite
  // For now, use a general scale
  const evScore = Math.min(100, (ev / 100) * 100);

  // Launch angle score (30% weight)
  // Optimal is 10-30 degrees
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

  // Hard hit rate score (20% weight)
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
    confidence: 'HIGH',
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
  const ball = calculateBallScore(launchMonitorData);

  // Composite: weight by confidence
  // BAT (HIGH): 40%
  // BRAIN (MEDIUM): 30%
  // BODY (LOW): 15%
  // BALL: 15% (if available, otherwise redistribute)
  let composite: number;
  if (ball.available) {
    composite = Math.round(
      bat.overall * 0.40 +
      brain.overall * 0.30 +
      body.overall * 0.15 +
      ball.overall * 0.15
    );
  } else {
    // Redistribute ball weight to bat
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

  if (ball.available) {
    parts.push(`BALL score (${ball.overall}) is HIGH confidence - measured from launch monitor.`);
  } else {
    parts.push(`BALL score requires launch monitor data (HitTrax, Rapsodo, etc.).`);
  }

  return parts.join(' ');
}

// ============================================================================
// Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
