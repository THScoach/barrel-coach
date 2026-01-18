// ============================================================================
// KWON-STYLE ANALYSIS - MAIN ORCHESTRATION
// "We don't add, we unlock. Measure to understand, not enforce."
// ============================================================================

import type {
  DKSwingData,
  KwonAnalysis,
  PopulationBaseline,
  MotorProfile,
  SensorFacts,
} from './types';
import { POPULATION_BASELINES } from './types';
import { extractSensorFacts, extractSensorFactsFromRaw, assessDataQuality } from './extract-facts';
import { predictRelease, predictTiming, predictUpstream, calculateKineticPotential } from './predictions';
import { identifyPossibleLeaks } from './leaks';
import { calculateFourBFromSensor } from './four-b-scoring';
import type { CanonicalSwing } from '@/lib/integrations/diamond-kinetics/types';

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export interface AnalysisOptions {
  ageGroup?: string;
  level?: 'youth' | 'high_school' | 'college' | 'pro';
  launchMonitorData?: {
    exitVelocity?: number;
    launchAngle?: number;
    hardHitRate?: number;
  };
}

/**
 * Perform complete Kwon-style analysis on normalized CanonicalSwing data
 */
export function performKwonAnalysis(
  sessionId: string,
  playerId: string,
  swings: CanonicalSwing[] | DKSwingData[],
  options: AnalysisOptions = {}
): KwonAnalysis {
  // Determine baseline population for comparison
  const baselineKey = determineBaselineKey(options.ageGroup, options.level);
  const baseline = POPULATION_BASELINES[baselineKey] || POPULATION_BASELINES['high_school'];

  // Extract measured facts - detect input type
  const sensorFacts = isCanonicalSwingArray(swings)
    ? extractSensorFacts(swings)
    : extractSensorFactsFromRaw(swings);

  // Generate predictions
  const releasePrediction = predictRelease(sensorFacts, baseline);
  const timingPrediction = predictTiming(sensorFacts, baseline);
  const upstreamPrediction = predictUpstream(sensorFacts, baseline);

  // Calculate kinetic potential
  const kineticPotential = calculateKineticPotential(
    sensorFacts,
    releasePrediction,
    timingPrediction,
    upstreamPrediction
  );

  // Identify possible leaks
  const possibleLeaks = identifyPossibleLeaks(sensorFacts, releasePrediction, timingPrediction, upstreamPrediction);

  // Calculate 4B scores
  const fourBScores = calculateFourBFromSensor(
    sensorFacts,
    baseline,
    options.launchMonitorData
  );

  // Classify motor profile
  const motorProfile = classifyMotorProfile(sensorFacts, timingPrediction);

  // Determine priority focus
  const { priorityFocus, secondaryFocus } = determineFocusAreas(
    releasePrediction,
    timingPrediction,
    possibleLeaks
  );

  // Assess data quality
  const dataQuality = assessDataQuality(swings.length);

  return {
    sessionId,
    playerId,
    analysisDate: new Date().toISOString(),

    sensorFacts,
    releasePrediction,
    timingPrediction,
    upstreamPrediction,
    kineticPotential,
    possibleLeaks,
    fourBScores,
    motorProfile,

    priorityFocus,
    secondaryFocus,

    swingsAnalyzed: swings.length,
    dataQuality,
  };
}

/**
 * Type guard to check if array contains CanonicalSwing objects
 */
function isCanonicalSwingArray(swings: unknown[]): swings is CanonicalSwing[] {
  if (swings.length === 0) return false;
  const first = swings[0] as Record<string, unknown>;
  return 'session_id' in first && 'is_valid' in first;
}

// ============================================================================
// MOTOR PROFILE CLASSIFICATION
// ============================================================================

/**
 * Classify motor profile from swing patterns
 */
function classifyMotorProfile(
  facts: SensorFacts,
  timing: { tempoCategory: string; adjustability: string }
): MotorProfile {
  const { timingCV, attackAngleStdDev, handToBatRatio } = facts;
  const { tempoCategory } = timing;

  // Spinner: Quick tempo, tight pattern, rotational focus
  if (tempoCategory === 'quick' && timingCV < 0.05 && attackAngleStdDev < 5) {
    return 'Spinner';
  }

  // Slingshotter: Deliberate, uses stretch-shortening cycle
  if (tempoCategory === 'deliberate' && handToBatRatio >= 1.28) {
    return 'Slingshotter';
  }

  // Whipper: Pull-heavy, explosive release
  if (facts.attackDirectionMean < -8 && handToBatRatio >= 1.25) {
    return 'Whipper';
  }

  // Titan: Very consistent, all-around elite metrics
  if (timingCV < 0.04 && handToBatRatio >= 1.30 && attackAngleStdDev < 4) {
    return 'Titan';
  }

  // Unknown: Doesn't fit a clear pattern (yet)
  return 'Unknown';
}

// ============================================================================
// FOCUS AREA DETERMINATION
// ============================================================================

function determineFocusAreas(
  releasePrediction: { quality: string; potentialUnlock: number },
  timingPrediction: { consistencyScore: number; potentialUnlock: number },
  leaks: { leakType: string; potentialGain: number; probability: string }[]
): { priorityFocus: string; secondaryFocus: string } {
  // Priority is based on biggest potential gain with highest confidence

  const focusOptions: { focus: string; gain: number; confidence: number }[] = [];

  // Release (HIGH confidence)
  if (releasePrediction.potentialUnlock > 0) {
    focusOptions.push({
      focus: `Release: ${releasePrediction.quality === 'needs_work' ? 'Work on barrel lag and whip' : 'Fine-tune release timing'}`,
      gain: releasePrediction.potentialUnlock,
      confidence: 3, // HIGH
    });
  }

  // Timing (MEDIUM confidence)
  if (timingPrediction.consistencyScore < 70) {
    focusOptions.push({
      focus: 'Timing: Tighten tempo and load sequence',
      gain: timingPrediction.potentialUnlock,
      confidence: 2, // MEDIUM
    });
  }

  // Top leak (varies)
  const primaryLeak = leaks.find(l => l.probability === 'likely');
  if (primaryLeak) {
    focusOptions.push({
      focus: `Leak: ${primaryLeak.leakType.replace('_', ' ')}`,
      gain: primaryLeak.potentialGain,
      confidence: primaryLeak.probability === 'likely' ? 2.5 : 1.5,
    });
  }

  // Sort by gain * confidence (weighted priority)
  focusOptions.sort((a, b) => (b.gain * b.confidence) - (a.gain * a.confidence));

  const priorityFocus = focusOptions[0]?.focus || 'Maintain current approach';
  const secondaryFocus = focusOptions[1]?.focus || 'General consistency work';

  return { priorityFocus, secondaryFocus };
}

// ============================================================================
// BASELINE DETERMINATION
// ============================================================================

function determineBaselineKey(
  ageGroup?: string,
  level?: 'youth' | 'high_school' | 'college' | 'pro'
): string {
  if (level === 'pro') return 'pro';
  if (level === 'college') return 'college';
  if (level === 'high_school') return 'high_school';

  // Try to determine from age group
  if (ageGroup) {
    const lower = ageGroup.toLowerCase();
    if (lower.includes('12u') || lower.includes('11u') || lower.includes('10u')) {
      return 'youth_12u';
    }
    if (lower.includes('14u') || lower.includes('13u')) {
      return 'youth_14u';
    }
    if (lower.includes('16u') || lower.includes('15u') || lower.includes('18u') || lower.includes('high')) {
      return 'high_school';
    }
    if (lower.includes('college') || lower.includes('uni')) {
      return 'college';
    }
    if (lower.includes('pro') || lower.includes('mlb')) {
      return 'pro';
    }
  }

  // Default to high school
  return 'high_school';
}

// ============================================================================
// ANALYSIS COMPARISON
// ============================================================================

export interface AnalysisComparison {
  batSpeedChange: number;
  handToBatRatioChange: number;
  consistencyChange: number;
  potentialChange: number;
  improved: boolean;
  summary: string;
}

/**
 * Compare two analyses to track progress
 */
export function compareAnalyses(
  older: KwonAnalysis,
  newer: KwonAnalysis
): AnalysisComparison {
  const batSpeedChange = newer.sensorFacts.batSpeedMax - older.sensorFacts.batSpeedMax;
  const ratioChange = newer.sensorFacts.handToBatRatio - older.sensorFacts.handToBatRatio;
  const consistencyChange = (
    (older.sensorFacts.timingCV - newer.sensorFacts.timingCV) * 100 // Lower is better
  );
  const potentialChange = older.kineticPotential.totalUnlock - newer.kineticPotential.totalUnlock;

  // If potential decreased, they're realizing their potential
  const realizingPotential = potentialChange > 0.5;
  const mechanicsImproved = ratioChange > 0.02;
  const speedIncreased = batSpeedChange > 1;
  const moreConsistent = consistencyChange > 0.5;

  const improved = realizingPotential || mechanicsImproved || speedIncreased || moreConsistent;

  // Generate summary
  const summaryParts: string[] = [];
  if (speedIncreased) {
    summaryParts.push(`+${batSpeedChange.toFixed(1)} mph bat speed`);
  }
  if (mechanicsImproved) {
    summaryParts.push(`+${(ratioChange * 100).toFixed(1)}% release efficiency`);
  }
  if (moreConsistent) {
    summaryParts.push(`Timing tightened ${consistencyChange.toFixed(1)}%`);
  }
  if (realizingPotential) {
    summaryParts.push(`Unlocked ${potentialChange.toFixed(1)} mph of hidden potential`);
  }

  const summary = summaryParts.length > 0
    ? summaryParts.join('. ') + '.'
    : 'No significant changes detected.';

  return {
    batSpeedChange: round(batSpeedChange, 1),
    handToBatRatioChange: round(ratioChange, 3),
    consistencyChange: round(consistencyChange, 1),
    potentialChange: round(potentialChange, 1),
    improved,
    summary,
  };
}

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
