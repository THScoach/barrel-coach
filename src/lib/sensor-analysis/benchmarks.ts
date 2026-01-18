// ============================================================================
// BENCHMARKS & POPULATION DATA
// Age/level-based performance benchmarks for percentile calculations
// ============================================================================

import type { PopulationBaseline, PercentileRange } from './types';
import { POPULATION_BASELINES } from './types';

/**
 * Extended benchmarks with more granular age groups
 */
export const EXTENDED_BENCHMARKS: Record<string, PopulationBaseline> = {
  // Youth levels
  '10u': {
    ageGroup: '10u',
    batSpeed: { p10: 30, p50: 38, p90: 46 },
    handSpeed: { p10: 12, p50: 15, p90: 18 },
    handToBatRatio: { p10: 1.12, p50: 1.18, p90: 1.25 },
    timingCV: { p10: 0.08, p50: 0.14, p90: 0.22 },
  },
  '11u': {
    ageGroup: '11u',
    batSpeed: { p10: 33, p50: 42, p90: 50 },
    handSpeed: { p10: 13, p50: 16, p90: 20 },
    handToBatRatio: { p10: 1.13, p50: 1.20, p90: 1.27 },
    timingCV: { p10: 0.07, p50: 0.12, p90: 0.20 },
  },
  '12u': {
    ageGroup: '12u',
    batSpeed: { p10: 38, p50: 48, p90: 58 },
    handSpeed: { p10: 15, p50: 19, p90: 23 },
    handToBatRatio: { p10: 1.15, p50: 1.22, p90: 1.30 },
    timingCV: { p10: 0.06, p50: 0.11, p90: 0.18 },
  },
  '13u': {
    ageGroup: '13u',
    batSpeed: { p10: 45, p50: 55, p90: 65 },
    handSpeed: { p10: 17, p50: 21, p90: 26 },
    handToBatRatio: { p10: 1.16, p50: 1.23, p90: 1.31 },
    timingCV: { p10: 0.05, p50: 0.10, p90: 0.16 },
  },
  '14u': {
    ageGroup: '14u',
    batSpeed: { p10: 50, p50: 60, p90: 70 },
    handSpeed: { p10: 19, p50: 23, p90: 28 },
    handToBatRatio: { p10: 1.17, p50: 1.24, p90: 1.32 },
    timingCV: { p10: 0.045, p50: 0.09, p90: 0.15 },
  },
  // High school levels
  '15u': {
    ageGroup: '15u',
    batSpeed: { p10: 53, p50: 63, p90: 73 },
    handSpeed: { p10: 20, p50: 24, p90: 29 },
    handToBatRatio: { p10: 1.18, p50: 1.25, p90: 1.32 },
    timingCV: { p10: 0.04, p50: 0.085, p90: 0.14 },
  },
  '16u': {
    ageGroup: '16u',
    batSpeed: { p10: 56, p50: 66, p90: 76 },
    handSpeed: { p10: 21, p50: 25, p90: 30 },
    handToBatRatio: { p10: 1.18, p50: 1.26, p90: 1.33 },
    timingCV: { p10: 0.038, p50: 0.08, p90: 0.13 },
  },
  '17u': {
    ageGroup: '17u',
    batSpeed: { p10: 58, p50: 68, p90: 78 },
    handSpeed: { p10: 22, p50: 26, p90: 31 },
    handToBatRatio: { p10: 1.19, p50: 1.26, p90: 1.33 },
    timingCV: { p10: 0.035, p50: 0.075, p90: 0.12 },
  },
  '18u': {
    ageGroup: '18u',
    batSpeed: { p10: 60, p50: 70, p90: 80 },
    handSpeed: { p10: 23, p50: 27, p90: 32 },
    handToBatRatio: { p10: 1.20, p50: 1.27, p90: 1.34 },
    timingCV: { p10: 0.032, p50: 0.07, p90: 0.11 },
  },
  // Include base population baselines
  ...POPULATION_BASELINES,
};

/**
 * Get benchmark for a specific age/level
 */
export function getBenchmark(level: string): PopulationBaseline {
  const normalized = level.toLowerCase().replace(/[\s-]/g, '_');
  return EXTENDED_BENCHMARKS[normalized] || POPULATION_BASELINES.high_school;
}

/**
 * Calculate percentile for a value within a range
 */
export function calculatePercentile(value: number, range: PercentileRange): number {
  const { p10, p50, p90 } = range;
  
  if (value <= p10) {
    return Math.max(1, Math.round((value / p10) * 10));
  } else if (value <= p50) {
    return 10 + Math.round(((value - p10) / (p50 - p10)) * 40);
  } else if (value <= p90) {
    return 50 + Math.round(((value - p50) / (p90 - p50)) * 40);
  } else {
    // Above 90th percentile - cap at 99
    return Math.min(99, 90 + Math.round(((value - p90) / (p90 - p50)) * 9));
  }
}

/**
 * Get percentile score for bat speed
 */
export function getBatSpeedPercentile(batSpeed: number, level: string): number {
  const benchmark = getBenchmark(level);
  return calculatePercentile(batSpeed, benchmark.batSpeed);
}

/**
 * Get percentile score for hand speed
 */
export function getHandSpeedPercentile(handSpeed: number, level: string): number {
  const benchmark = getBenchmark(level);
  return calculatePercentile(handSpeed, benchmark.handSpeed);
}

/**
 * Get percentile score for hand-to-bat ratio
 */
export function getRatioPercentile(ratio: number, level: string): number {
  const benchmark = getBenchmark(level);
  return calculatePercentile(ratio, benchmark.handToBatRatio);
}

/**
 * Get percentile score for timing consistency (lower is better)
 */
export function getTimingConsistencyPercentile(timingCV: number, level: string): number {
  const benchmark = getBenchmark(level);
  // Invert the percentile since lower CV is better
  const rawPercentile = calculatePercentile(timingCV, benchmark.timingCV);
  return 100 - rawPercentile;
}

/**
 * Get expected bat speed for a player's regression model
 */
export function getExpectedBatSpeed(
  batScore: number,
  brainScore: number,
  bodyScore: number,
  ballScore: number,
  coefficients: { beta_0: number; beta_1: number; beta_2: number; beta_3: number; beta_4: number }
): number {
  const { beta_0, beta_1, beta_2, beta_3, beta_4 } = coefficients;
  return beta_0 + beta_1 * batScore + beta_2 * brainScore + beta_3 * bodyScore + beta_4 * ballScore;
}

/**
 * Calculate mechanical loss (MPH left on the table)
 */
export function calculateMechanicalLoss(
  actualBatSpeed: number,
  expectedBatSpeed: number
): number {
  return Math.max(0, expectedBatSpeed - actualBatSpeed);
}

/**
 * Get all percentile scores for a player
 */
export function getAllPercentiles(
  batSpeed: number,
  handSpeed: number,
  handToBatRatio: number,
  timingCV: number,
  level: string
): {
  batSpeedPercentile: number;
  handSpeedPercentile: number;
  ratioPercentile: number;
  timingPercentile: number;
  compositePercentile: number;
} {
  const batSpeedPercentile = getBatSpeedPercentile(batSpeed, level);
  const handSpeedPercentile = getHandSpeedPercentile(handSpeed, level);
  const ratioPercentile = getRatioPercentile(handToBatRatio, level);
  const timingPercentile = getTimingConsistencyPercentile(timingCV, level);
  
  const compositePercentile = Math.round(
    (batSpeedPercentile * 0.4 + handSpeedPercentile * 0.2 + ratioPercentile * 0.25 + timingPercentile * 0.15)
  );

  return {
    batSpeedPercentile,
    handSpeedPercentile,
    ratioPercentile,
    timingPercentile,
    compositePercentile,
  };
}
