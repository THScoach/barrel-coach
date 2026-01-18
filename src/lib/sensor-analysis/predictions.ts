// ============================================================================
// KWON-STYLE PREDICTIONS
// Predictions with explicit confidence levels
// "We don't add, we unlock"
// ============================================================================

import type {
  SensorFacts,
  ReleasePrediction,
  TimingPrediction,
  UpstreamPrediction,
  KineticPotential,
  PopulationBaseline,
  ConfidenceLevel,
} from './types';
import { POPULATION_BASELINES } from './types';
import { calculatePercentile } from './extract-facts';

// ============================================================================
// RELEASE PREDICTION (HIGH confidence)
// ============================================================================

/**
 * Predict release quality from hand-to-bat ratio
 * HIGH confidence - this is a direct calculation from measured values
 */
export function predictRelease(
  facts: SensorFacts,
  baseline: PopulationBaseline
): ReleasePrediction {
  const ratio = facts.handToBatRatio;

  // Determine quality tier
  let quality: ReleasePrediction['quality'];
  if (ratio >= 1.30) {
    quality = 'excellent';
  } else if (ratio >= 1.25) {
    quality = 'good';
  } else if (ratio >= 1.20) {
    quality = 'average';
  } else {
    quality = 'needs_work';
  }

  // Calculate percentile vs population
  const percentile = calculatePercentile(
    ratio,
    baseline.handToBatRatio.p10,
    baseline.handToBatRatio.p50,
    baseline.handToBatRatio.p90
  );

  // Calculate potential unlock
  // If they're below 1.28 (high-level average), estimate what they'd gain at 1.28
  const targetRatio = 1.28;
  let potentialUnlock = 0;
  if (ratio < targetRatio) {
    // At same hand speed, what bat speed would they hit at target ratio?
    const currentBatSpeed = facts.batSpeedMean;
    const currentHandSpeed = facts.handSpeedMean;
    const potentialBatSpeed = currentHandSpeed * targetRatio;
    potentialUnlock = Math.max(0, potentialBatSpeed - currentBatSpeed);
  }

  return {
    handToBatRatio: ratio,
    quality,
    percentile: Math.round(percentile),
    potentialUnlock: round(potentialUnlock, 1),
    confidence: 'HIGH',
    reasoning: `Hand-to-bat ratio of ${ratio.toFixed(2)} directly measured from sensor. ` +
      `${percentile.toFixed(0)}th percentile for ${baseline.ageGroup}. ` +
      (potentialUnlock > 0
        ? `Could unlock +${potentialUnlock.toFixed(1)} mph with improved release.`
        : 'Release is already optimized.'),
  };
}

// ============================================================================
// TIMING PREDICTION (MEDIUM confidence)
// ============================================================================

/**
 * Predict timing consistency from variance patterns
 * MEDIUM confidence - inferred from measured variance
 */
export function predictTiming(
  facts: SensorFacts,
  baseline: PopulationBaseline
): TimingPrediction {
  const cv = facts.timingCV;
  const meanTiming = facts.timeToContactMean;

  // Consistency score: lower CV = higher consistency
  // CV of 0.02 = 100, CV of 0.15 = 0
  const consistencyScore = Math.max(0, Math.min(100, 100 - (cv - 0.02) * 700));

  // Tempo category
  let tempoCategory: TimingPrediction['tempoCategory'];
  if (meanTiming < 350) {
    tempoCategory = 'quick';
  } else if (meanTiming < 450) {
    tempoCategory = 'moderate';
  } else {
    tempoCategory = 'deliberate';
  }

  // Adjustability: based on attack direction variance
  // Higher variance might indicate adaptability OR inconsistency
  let adjustability: TimingPrediction['adjustability'];
  const directionVariance = facts.attackDirectionStdDev;
  if (directionVariance < 5) {
    adjustability = 'rigid'; // Very tight pattern - may struggle adjusting
  } else if (directionVariance < 12) {
    adjustability = 'adaptable'; // Good range
  } else {
    adjustability = 'fluid'; // Very wide range - could be wild or intentional
  }

  // Predicted timing window
  const predictedTimingWindow = Math.round(facts.timeToContactStdDev * 2);

  // Potential unlock from timing
  // If CV is high, better timing could unlock bat speed
  let potentialUnlock = 0;
  if (cv > 0.08) {
    // Inconsistent timing wastes energy - estimate 2-4 mph potential
    potentialUnlock = Math.min(4, (cv - 0.05) * 50);
  }

  return {
    consistencyScore: Math.round(consistencyScore),
    tempoCategory,
    adjustability,
    predictedTimingWindow,
    potentialUnlock: round(potentialUnlock, 1),
    confidence: 'MEDIUM',
    reasoning: `Timing CV of ${(cv * 100).toFixed(1)}% indicates ${cv < 0.06 ? 'consistent' : 'variable'} ` +
      `timing. ${tempoCategory.charAt(0).toUpperCase() + tempoCategory.slice(1)} tempo at ` +
      `${meanTiming.toFixed(0)}ms average. ` +
      (potentialUnlock > 0
        ? `Tighter timing could unlock +${potentialUnlock.toFixed(1)} mph.`
        : 'Timing is already consistent.'),
  };
}

// ============================================================================
// UPSTREAM PREDICTION (LOW confidence)
// ============================================================================

/**
 * Predict upstream energy utilization
 * LOW confidence - speculation without video, but educated guesses
 */
export function predictUpstream(
  facts: SensorFacts,
  baseline: PopulationBaseline
): UpstreamPrediction {
  // This is our most speculative prediction
  // We can infer some things from the relationship between metrics

  const likelyBreaks: string[] = [];
  const needsVideoFor: string[] = [];

  // Estimate hip contribution (very speculative)
  // Higher bat speed relative to hand speed might indicate good hip drive
  let estimatedHipContribution = 50; // Start at neutral
  const ratioPercentile = calculatePercentile(
    facts.handToBatRatio,
    baseline.handToBatRatio.p10,
    baseline.handToBatRatio.p50,
    baseline.handToBatRatio.p90
  );
  estimatedHipContribution = Math.min(100, Math.max(20, ratioPercentile));

  // Estimate torso contribution
  let estimatedTorsoContribution = 50;
  if (facts.rotationalAccelerationMean) {
    // Higher rotational acceleration suggests good torso rotation
    estimatedTorsoContribution = Math.min(100, facts.rotationalAccelerationMean / 200);
  } else {
    // Without this data, we can only guess
    needsVideoFor.push('Torso rotation speed and timing');
  }

  // Look for likely kinetic chain breaks
  if (facts.handToBatRatio < 1.20) {
    likelyBreaks.push('Early wrist release');
    needsVideoFor.push('Wrist/bat connection through zone');
  }

  if (facts.timingCV > 0.10) {
    likelyBreaks.push('Inconsistent load timing');
    needsVideoFor.push('Load-to-launch sequence');
  }

  if (facts.attackAngleStdDev > 8) {
    likelyBreaks.push('Variable bat path');
    needsVideoFor.push('Hip-shoulder separation at toe touch');
  }

  // We always need video for full body assessment
  needsVideoFor.push('Ground force utilization');
  needsVideoFor.push('Full kinetic chain sequencing');

  // Calculate potential unlock (speculative)
  // If we see signs of leaks, estimate what could be unlocked
  let potentialUnlock = 0;
  if (likelyBreaks.length > 0) {
    potentialUnlock = likelyBreaks.length * 1.5; // 1.5 mph per likely leak
  }

  return {
    estimatedHipContribution: Math.round(estimatedHipContribution),
    estimatedTorsoContribution: Math.round(estimatedTorsoContribution),
    likelyKineticChainBreaks: likelyBreaks,
    potentialUnlock: round(potentialUnlock, 1),
    confidence: 'LOW',
    reasoning: `Without video, upstream energy assessment is speculative. ` +
      `Hand-to-bat ratio suggests ${estimatedHipContribution > 60 ? 'good' : 'moderate'} ` +
      `lower-body contribution. ` +
      (likelyBreaks.length > 0
        ? `Possible breaks: ${likelyBreaks.join(', ')}.`
        : 'No clear leak indicators from sensor data alone.'),
    needsVideoFor,
  };
}

// ============================================================================
// KINETIC POTENTIAL
// ============================================================================

/**
 * Calculate total kinetic potential from all predictions
 */
export function calculateKineticPotential(
  facts: SensorFacts,
  releasePrediction: ReleasePrediction,
  timingPrediction: TimingPrediction,
  upstreamPrediction: UpstreamPrediction
): KineticPotential {
  const currentBatSpeed = facts.batSpeedMax;

  // Sum up all potential unlocks
  const releaseUnlock = releasePrediction.potentialUnlock;
  const timingUnlock = timingPrediction.potentialUnlock;
  const upstreamUnlock = upstreamPrediction.potentialUnlock;
  const totalUnlock = releaseUnlock + timingUnlock + upstreamUnlock;

  const projectedPotential = currentBatSpeed + totalUnlock;

  // Determine overall confidence (weighted by contribution)
  let overallConfidence: ConfidenceLevel = 'MEDIUM';
  if (upstreamUnlock > releaseUnlock + timingUnlock) {
    // If most potential comes from speculative sources
    overallConfidence = 'LOW';
  } else if (releaseUnlock > timingUnlock + upstreamUnlock) {
    // If most potential is high-confidence
    overallConfidence = 'HIGH';
  }

  // What would help validate
  const validationNeeds: string[] = [];
  if (upstreamPrediction.potentialUnlock > 0) {
    validationNeeds.push(...upstreamPrediction.needsVideoFor);
  }
  if (timingPrediction.potentialUnlock > 1) {
    validationNeeds.push('Pitch-type timing breakdown');
  }

  return {
    currentBatSpeed: round(currentBatSpeed, 1),
    projectedPotential: round(projectedPotential, 1),
    totalUnlock: round(totalUnlock, 1),

    releaseUnlock: {
      value: releaseUnlock,
      confidence: 'HIGH',
      reasoning: releasePrediction.reasoning,
    },
    timingUnlock: {
      value: timingUnlock,
      confidence: 'MEDIUM',
      reasoning: timingPrediction.reasoning,
    },
    upstreamUnlock: {
      value: upstreamUnlock,
      confidence: 'LOW',
      reasoning: upstreamPrediction.reasoning,
    },

    overallConfidence,
    validationNeeds,
  };
}

// ============================================================================
// Helper
// ============================================================================

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
