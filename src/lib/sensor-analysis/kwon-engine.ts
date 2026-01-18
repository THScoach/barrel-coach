// ============================================================================
// KWON-STYLE SENSOR ANALYSIS ENGINE
// "We don't add, we unlock. Measure to understand, not enforce."
// ============================================================================

import type {
  SensorFacts,
  ReleasePrediction,
  TimingPrediction,
  UpstreamPrediction,
  KineticPotential,
  PossibleLeak,
  FourBScores,
  KineticFingerprint,
  KwonAnalysis,
  MotorProfile,
  DataQuality,
  AnalysisOptions,
  DrillRecommendation,
} from './types';
import type { CanonicalSwing } from '../integrations/diamond-kinetics/types';

// ============================================================================
// SENSOR FACTS - MEASURED (100% Confidence)
// ============================================================================

/**
 * Extract measured facts from sensor data
 */
export function extractSensorFacts(swings: CanonicalSwing[]): SensorFacts {
  const validSwings = swings.filter((s) => s.is_valid && s.bat_speed_mph !== null);

  if (validSwings.length === 0) {
    throw new Error('No valid swings to analyze');
  }

  const batSpeeds = validSwings.map((s) => s.bat_speed_mph!);
  const handSpeeds = validSwings.map((s) => s.hand_speed_mph).filter(Boolean) as number[];
  const timings = validSwings.map((s) => s.trigger_to_impact_ms).filter(Boolean) as number[];
  const attackAngles = validSwings.map((s) => s.attack_angle_deg).filter(Boolean) as number[];
  const attackDirs = validSwings.map((s) => s.attack_direction_deg).filter(Boolean) as number[];
  const ratios = validSwings.map((s) => s.hand_to_bat_ratio).filter(Boolean) as number[];

  const batSpeedMean = mean(batSpeeds);
  const batSpeedStdDev = stdDev(batSpeeds);

  const handSpeedMean = handSpeeds.length > 0 ? mean(handSpeeds) : 0;
  const handSpeedStdDev = handSpeeds.length > 0 ? stdDev(handSpeeds) : 0;

  const timeToContactMean = timings.length > 0 ? mean(timings) : 0;
  const timeToContactStdDev = timings.length > 0 ? stdDev(timings) : 0;
  const timingCV = timeToContactMean > 0 ? timeToContactStdDev / timeToContactMean : 0;

  return {
    swingCount: validSwings.length,
    batSpeedMax: Math.max(...batSpeeds),
    batSpeedMean: round(batSpeedMean, 1),
    batSpeedStdDev: round(batSpeedStdDev, 2),
    handSpeedMax: handSpeeds.length > 0 ? Math.max(...handSpeeds) : 0,
    handSpeedMean: round(handSpeedMean, 1),
    handSpeedStdDev: round(handSpeedStdDev, 2),
    timeToContactMean: round(timeToContactMean, 0),
    timeToContactStdDev: round(timeToContactStdDev, 1),
    timingCV: round(timingCV, 3),
    attackAngleMean: attackAngles.length > 0 ? round(mean(attackAngles), 1) : 0,
    attackAngleStdDev: attackAngles.length > 0 ? round(stdDev(attackAngles), 1) : 0,
    attackDirectionMean: attackDirs.length > 0 ? round(mean(attackDirs), 1) : 0,
    attackDirectionStdDev: attackDirs.length > 0 ? round(stdDev(attackDirs), 1) : 0,
    handToBatRatio: ratios.length > 0 ? round(mean(ratios), 3) : 0,
  };
}

// ============================================================================
// RELEASE PREDICTION - HIGH Confidence
// ============================================================================

/**
 * Predict release quality from hand-to-bat ratio
 */
export function predictRelease(facts: SensorFacts): ReleasePrediction {
  const ratio = facts.handToBatRatio;

  // Elite range: 0.70-0.80 (bat speed ~1.25-1.43x hand speed)
  let quality: ReleasePrediction['quality'];
  let percentile: number;
  let potentialUnlock: number;

  if (ratio >= 0.75 && ratio <= 0.82) {
    quality = 'elite';
    percentile = 90;
    potentialUnlock = 0;
  } else if (ratio >= 0.70 && ratio < 0.75) {
    quality = 'good';
    percentile = 70;
    potentialUnlock = (0.75 - ratio) * 15; // ~2-3 mph
  } else if (ratio >= 0.65 && ratio < 0.70) {
    quality = 'developing';
    percentile = 50;
    potentialUnlock = (0.75 - ratio) * 15; // ~3-5 mph
  } else if (ratio < 0.65) {
    quality = 'poor';
    percentile = 25;
    potentialUnlock = (0.75 - ratio) * 12;
  } else {
    // ratio > 0.82 - over-releasing (hands too fast relative to bat)
    quality = 'developing';
    percentile = 40;
    potentialUnlock = (ratio - 0.80) * 10;
  }

  const reasoning =
    quality === 'elite'
      ? 'Excellent barrel whip - hands decelerate at ideal time'
      : quality === 'good'
        ? 'Good release pattern with minor timing optimization available'
        : quality === 'developing'
          ? 'Release timing can be improved for more barrel speed'
          : 'Significant release efficiency gains available';

  return {
    handToBatRatio: ratio,
    quality,
    percentile,
    potentialUnlock: round(potentialUnlock, 1),
    confidence: 'high',
    reasoning,
  };
}

// ============================================================================
// TIMING PREDICTION - MEDIUM Confidence
// ============================================================================

/**
 * Predict timing adjustability from swing timing data
 */
export function predictTiming(facts: SensorFacts): TimingPrediction {
  const cv = facts.timingCV;
  const avgTime = facts.timeToContactMean;

  // Consistency score (lower CV = more consistent)
  const consistencyScore = Math.max(0, 100 - cv * 500);

  // Tempo category
  let tempoCategory: TimingPrediction['tempoCategory'];
  if (avgTime < 150) {
    tempoCategory = 'quick';
  } else if (avgTime < 200) {
    tempoCategory = 'moderate';
  } else {
    tempoCategory = 'deliberate';
  }

  // Adjustability (higher CV can mean more adjustable, but needs context)
  let adjustability: TimingPrediction['adjustability'];
  if (cv < 0.05) {
    adjustability = 'low'; // Very consistent but may be rigid
  } else if (cv < 0.10) {
    adjustability = 'medium';
  } else {
    adjustability = 'high'; // High variance - could be adjustable or inconsistent
  }

  // Timing window
  const predictedTimingWindow = round(avgTime * cv * 2, 0);

  // Potential unlock from timing consistency
  const potentialUnlock = cv > 0.08 ? round((cv - 0.05) * 30, 1) : 0;

  const reasoning =
    consistencyScore >= 90
      ? 'Elite timing consistency - repeatable swing'
      : consistencyScore >= 70
        ? 'Good timing consistency with room for refinement'
        : 'Timing variance suggests opportunity for gains through consistency work';

  return {
    consistencyScore: round(consistencyScore, 0),
    tempoCategory,
    adjustability,
    predictedTimingWindow,
    potentialUnlock,
    confidence: 'medium',
    reasoning,
  };
}

// ============================================================================
// UPSTREAM PREDICTION - LOW Confidence (needs video)
// ============================================================================

/**
 * Predict upstream body mechanics from sensor data (low confidence)
 */
export function predictUpstream(facts: SensorFacts, release: ReleasePrediction): UpstreamPrediction {
  // These are educated guesses - need video to confirm
  const needsVideoFor: string[] = [];

  // Estimate hip contribution from release quality
  let estimatedHipContribution: number;
  let estimatedTorsoContribution: number;
  const likelyBreaks: string[] = [];

  if (release.quality === 'elite') {
    estimatedHipContribution = 35;
    estimatedTorsoContribution = 30;
  } else if (release.quality === 'good') {
    estimatedHipContribution = 30;
    estimatedTorsoContribution = 28;
    needsVideoFor.push('hip-shoulder separation');
  } else {
    estimatedHipContribution = 25;
    estimatedTorsoContribution = 25;
    likelyBreaks.push('early torso rotation');
    needsVideoFor.push('hip-shoulder separation', 'ground force generation');
  }

  // Check for pattern clues
  if (facts.attackAngleStdDev > 8) {
    likelyBreaks.push('inconsistent posture');
    needsVideoFor.push('spine angle at contact');
  }

  if (facts.attackDirectionStdDev > 10) {
    likelyBreaks.push('variable hip direction');
    needsVideoFor.push('hip rotation direction');
  }

  // Potential unlock from body mechanics
  const potentialUnlock = round(
    Math.max(0, (35 - estimatedHipContribution) * 0.15 + (30 - estimatedTorsoContribution) * 0.12),
    1
  );

  return {
    estimatedHipContribution,
    estimatedTorsoContribution,
    likelyKineticChainBreaks: likelyBreaks,
    potentialUnlock,
    confidence: 'low',
    reasoning:
      'Upstream estimates based on sensor patterns - video analysis needed for confirmation',
    needsVideoFor,
  };
}

// ============================================================================
// KINETIC POTENTIAL - Aggregated Hidden Bat Speed
// ============================================================================

/**
 * Calculate total kinetic potential (hidden bat speed)
 */
export function calculateKineticPotential(
  facts: SensorFacts,
  release: ReleasePrediction,
  timing: TimingPrediction,
  upstream: UpstreamPrediction
): KineticPotential {
  const totalUnlock = round(
    release.potentialUnlock + timing.potentialUnlock + upstream.potentialUnlock,
    1
  );

  const validationNeeds: string[] = [];
  if (timing.potentialUnlock > 0) {
    validationNeeds.push('Multi-session timing analysis');
  }
  if (upstream.potentialUnlock > 0) {
    validationNeeds.push(...upstream.needsVideoFor);
  }

  // Determine overall confidence
  let overallConfidence: KineticPotential['overallConfidence'];
  if (release.potentialUnlock >= totalUnlock * 0.7) {
    overallConfidence = 'high'; // Mostly from high-confidence release prediction
  } else if (upstream.potentialUnlock >= totalUnlock * 0.5) {
    overallConfidence = 'low'; // Mostly from low-confidence upstream prediction
  } else {
    overallConfidence = 'medium';
  }

  return {
    currentBatSpeed: facts.batSpeedMax,
    projectedPotential: round(facts.batSpeedMax + totalUnlock, 1),
    totalUnlock,
    releaseUnlock: { value: release.potentialUnlock, confidence: 'high' },
    timingUnlock: { value: timing.potentialUnlock, confidence: 'medium' },
    upstreamUnlock: { value: upstream.potentialUnlock, confidence: 'low' },
    overallConfidence,
    validationNeeds,
  };
}

// ============================================================================
// LEAK DETECTION
// ============================================================================

/**
 * Identify possible leaks with probability levels
 */
export function identifyPossibleLeaks(
  facts: SensorFacts,
  release: ReleasePrediction,
  timing: TimingPrediction,
  upstream: UpstreamPrediction
): PossibleLeak[] {
  const leaks: PossibleLeak[] = [];

  // BAT leaks (from sensor data)
  if (release.quality === 'poor' || release.quality === 'developing') {
    leaks.push({
      leakType: 'early_release',
      category: 'bat',
      description: 'Barrel releases before optimal whip point',
      probability: release.quality === 'poor' ? 'likely' : 'possible',
      evidence: `Hand-to-bat ratio: ${facts.handToBatRatio}`,
      potentialGain: release.potentialUnlock,
      howToConfirm: 'Side view video at contact - check hand deceleration',
    });
  }

  // BRAIN leaks (timing patterns)
  if (timing.consistencyScore < 70) {
    leaks.push({
      leakType: 'timing_variance',
      category: 'brain',
      description: 'Inconsistent swing timing across swings',
      probability: timing.consistencyScore < 50 ? 'likely' : 'possible',
      evidence: `Timing CV: ${(facts.timingCV * 100).toFixed(1)}%`,
      potentialGain: timing.potentialUnlock,
      howToConfirm: 'Track timing consistency across multiple sessions',
    });
  }

  // BODY leaks (inferred from patterns)
  if (facts.attackAngleStdDev > 8) {
    leaks.push({
      leakType: 'posture_inconsistency',
      category: 'body',
      description: 'Attack angle variance suggests posture changes',
      probability: 'possible',
      evidence: `Attack angle std dev: ${facts.attackAngleStdDev}°`,
      potentialGain: round(facts.attackAngleStdDev * 0.2, 1),
      howToConfirm: 'Video analysis of spine angle at contact',
    });
  }

  // Add upstream-identified leaks
  upstream.likelyKineticChainBreaks.forEach((breakType) => {
    leaks.push({
      leakType: breakType.replace(/\s+/g, '_').toLowerCase(),
      category: 'body',
      description: breakType,
      probability: 'speculative',
      evidence: 'Inferred from sensor patterns',
      potentialGain: round(upstream.potentialUnlock / upstream.likelyKineticChainBreaks.length, 1),
      howToConfirm: upstream.needsVideoFor.join(', '),
    });
  });

  return leaks;
}

// ============================================================================
// 4B SCORES FROM SENSOR
// ============================================================================

/**
 * Calculate 4B scores from sensor data
 */
export function calculateFourBFromSensor(
  facts: SensorFacts,
  release: ReleasePrediction,
  timing: TimingPrediction,
  ageGroup?: string
): FourBScores {
  // Age-adjusted thresholds (simplified)
  const ageMultiplier = getAgeMultiplier(ageGroup);

  // BAT score (high confidence from sensor)
  const batSpeedScore = scoreMetric(facts.batSpeedMax, 55 * ageMultiplier, 75 * ageMultiplier);
  const handSpeedScore = scoreMetric(facts.handSpeedMax, 40 * ageMultiplier, 55 * ageMultiplier);
  const releaseScore = release.percentile;

  const batOverall = round((batSpeedScore * 0.5 + handSpeedScore * 0.25 + releaseScore * 0.25), 0);

  // BRAIN score (medium-high confidence)
  const timingConsistency = timing.consistencyScore;
  const pathConsistency = scoreMetric(100 - facts.attackAngleStdDev * 5, 0, 100);
  const zoneAdaptability = timing.adjustability === 'high' ? 70 : timing.adjustability === 'medium' ? 50 : 30;

  const brainOverall = round((timingConsistency * 0.5 + pathConsistency * 0.3 + zoneAdaptability * 0.2), 0);

  // BODY score (low confidence - needs video)
  const estimatedSequencing = release.quality === 'elite' ? 75 : release.quality === 'good' ? 60 : 45;
  const estimatedSeparation = release.quality === 'elite' ? 70 : release.quality === 'good' ? 55 : 40;
  const estimatedGroundForce = 50; // Can't measure from bat sensor

  const bodyOverall = round((estimatedSequencing * 0.4 + estimatedSeparation * 0.35 + estimatedGroundForce * 0.25), 0);

  // BALL score (not available from sensor alone)
  const ball = {
    overall: 0,
    available: false,
    confidence: 'low' as const,
    needsVideoFor: ['Exit velocity measurement', 'Launch angle data'],
  };

  // Composite (excluding ball if not available)
  const compositeScore = round((batOverall * 0.35 + brainOverall * 0.35 + bodyOverall * 0.30), 0);

  return {
    bat: {
      overall: batOverall,
      batSpeedScore,
      handSpeedScore,
      releaseScore,
      confidence: 'high',
    },
    brain: {
      overall: brainOverall,
      timingConsistency,
      pathConsistency,
      zoneAdaptability,
      confidence: 'high',
      reasoning: 'Based on measured timing and path consistency',
    },
    body: {
      overall: bodyOverall,
      estimatedSequencing,
      estimatedSeparation,
      estimatedGroundForce,
      confidence: 'low',
      reasoning: 'Estimated from sensor patterns - video recommended',
      needsVideoFor: ['Hip-shoulder separation', 'Ground force timing'],
    },
    ball,
    compositeScore,
    confidenceNote: 'BAT and BRAIN scores are measured. BODY is estimated. BALL requires launch monitor data.',
  };
}

// ============================================================================
// MOTOR PROFILE CLASSIFICATION
// ============================================================================

/**
 * Classify motor profile from sensor data
 */
export function classifyMotorProfile(facts: SensorFacts, release: ReleasePrediction): MotorProfile {
  const ratio = facts.handToBatRatio;
  const timingCV = facts.timingCV;
  const avgTime = facts.timeToContactMean;

  // Spinner: Quick tempo, high hand speed relative to bat, tight path
  if (ratio > 0.78 && avgTime < 160 && facts.attackAngleStdDev < 5) {
    return 'Spinner';
  }

  // Slingshotter: Moderate tempo, excellent release, uses lag
  if (ratio >= 0.72 && ratio <= 0.78 && release.quality === 'elite') {
    return 'Slingshotter';
  }

  // Whipper: Good release, high attack angle variance (adjustable)
  if (ratio >= 0.68 && ratio <= 0.75 && facts.attackAngleStdDev > 6) {
    return 'Whipper';
  }

  // Titan: Deliberate tempo, high power, lower ratio
  if (avgTime > 190 && ratio < 0.72 && facts.batSpeedMax > 70) {
    return 'Titan';
  }

  return 'Unknown';
}

// ============================================================================
// KINETIC FINGERPRINT
// ============================================================================

/**
 * Calculate kinetic fingerprint for visualization
 */
export function calculateFingerprint(
  facts: SensorFacts,
  timing: TimingPrediction
): KineticFingerprint {
  const tightness = Math.max(0, 100 - (facts.attackAngleStdDev + facts.attackDirectionStdDev) * 3);

  let zoneBias: KineticFingerprint['patternMetrics']['zoneBias'];
  if (facts.attackAngleMean < -5) {
    zoneBias = 'low';
  } else if (facts.attackAngleMean > 15) {
    zoneBias = 'high';
  } else {
    zoneBias = 'middle';
  }

  return {
    intentMap: {
      horizontalMean: facts.attackDirectionMean,
      horizontalStdDev: facts.attackDirectionStdDev,
      verticalMean: facts.attackAngleMean,
      verticalStdDev: facts.attackAngleStdDev,
      depthIndex: timing.potentialUnlock,
      depthConsistency: 100 - facts.timingCV * 100,
    },
    timingSignature: {
      triggerToImpactMs: facts.timeToContactMean,
      timingVariance: facts.timingCV,
      tempoCategory: timing.tempoCategory,
    },
    patternMetrics: {
      tightness: round(tightness, 0),
      pullBias: facts.attackDirectionMean,
      zoneBias,
      comfortZone: {
        horizontal: [
          round(facts.attackDirectionMean - facts.attackDirectionStdDev, 1),
          round(facts.attackDirectionMean + facts.attackDirectionStdDev, 1),
        ],
        vertical: [
          round(facts.attackAngleMean - facts.attackAngleStdDev, 1),
          round(facts.attackAngleMean + facts.attackAngleStdDev, 1),
        ],
      },
    },
  };
}

// ============================================================================
// DRILL RECOMMENDATIONS
// ============================================================================

/**
 * Get drill recommendations based on leaks
 */
export function getDrillsForLeaks(leaks: PossibleLeak[]): DrillRecommendation[] {
  const drills: DrillRecommendation[] = [];

  const drillMap: Record<string, Omit<DrillRecommendation, 'targetLeak' | 'priority'>> = {
    early_release: {
      drillId: 'connection-bat-path',
      name: 'Connection Bat Path',
      category: 'bat',
      description: 'Focus on maintaining connection through the zone',
    },
    timing_variance: {
      drillId: 'tempo-rhythm',
      name: 'Tempo & Rhythm',
      category: 'brain',
      description: 'Develop consistent load-to-launch timing',
    },
    posture_inconsistency: {
      drillId: 'posture-holds',
      name: 'Posture Holds',
      category: 'body',
      description: 'Build awareness of spine angle through contact',
    },
    early_torso_rotation: {
      drillId: 'separation-sequence',
      name: 'Separation Sequence',
      category: 'body',
      description: 'Train hip-to-shoulder separation timing',
    },
  };

  leaks.forEach((leak, index) => {
    const drill = drillMap[leak.leakType];
    if (drill) {
      drills.push({
        ...drill,
        targetLeak: leak.leakType,
        priority: index + 1,
      });
    }
  });

  return drills;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Perform complete Kwon-style analysis on swing data
 */
export function performKwonAnalysis(
  sessionId: string,
  playerId: string,
  swings: CanonicalSwing[],
  options: AnalysisOptions = {}
): KwonAnalysis {
  // Extract facts
  const facts = extractSensorFacts(swings);

  // Determine data quality
  let dataQuality: DataQuality;
  if (facts.swingCount >= 20 && facts.handSpeedMax > 0 && facts.timeToContactMean > 0) {
    dataQuality = 'excellent';
  } else if (facts.swingCount >= 10) {
    dataQuality = 'good';
  } else {
    dataQuality = 'limited';
  }

  // Run predictions
  const release = predictRelease(facts);
  const timing = predictTiming(facts);
  const upstream = predictUpstream(facts, release);

  // Calculate kinetic potential
  const kineticPotential = calculateKineticPotential(facts, release, timing, upstream);

  // Identify leaks
  const possibleLeaks = identifyPossibleLeaks(facts, release, timing, upstream);

  // Classify motor profile
  const motorProfile = classifyMotorProfile(facts, release);

  // Calculate 4B scores
  const fourBScores = calculateFourBFromSensor(facts, release, timing, options.ageGroup);

  // Calculate fingerprint
  const fingerprint = calculateFingerprint(facts, timing);

  // Determine focus areas
  const priorityFocus = possibleLeaks.length > 0 ? possibleLeaks[0].leakType : 'consistency';
  const secondaryFocus = possibleLeaks.length > 1 ? possibleLeaks[1].leakType : 'timing';

  return {
    sessionId,
    playerId,
    analysisDate: new Date().toISOString(),
    swingsAnalyzed: facts.swingCount,
    dataQuality,
    motorProfile,
    sensorFacts: facts,
    releasePrediction: release,
    timingPrediction: timing,
    upstreamPrediction: upstream,
    kineticPotential,
    possibleLeaks,
    fourBScores,
    priorityFocus,
    secondaryFocus,
    fingerprint,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const avg = mean(arr);
  const squareDiffs = arr.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function scoreMetric(value: number, min: number, max: number): number {
  if (value <= min) return 20;
  if (value >= max) return 80;
  return 20 + ((value - min) / (max - min)) * 60;
}

function getAgeMultiplier(ageGroup?: string): number {
  const multipliers: Record<string, number> = {
    '10U': 0.65,
    '11U': 0.70,
    '12U': 0.75,
    '13U': 0.80,
    '14U': 0.85,
    '15U': 0.90,
    '16U': 0.95,
    '17U': 0.98,
    '18U': 1.0,
    College: 1.05,
    Pro: 1.10,
    Adult: 1.0,
  };
  return multipliers[ageGroup || 'Adult'] || 1.0;
}
