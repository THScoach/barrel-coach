/**
 * Synthetic Batted Ball Data Generator
 * 
 * DATA GOVERNANCE:
 * - Generates synthetic data based on PUBLICLY KNOWN StatCast ranges
 * - NO proprietary datasets are used
 * - Used for stress-testing scoring logic only
 * - All distributions derived from public MLB aggregate statistics
 * 
 * Public sources used for ranges:
 * - MLB Statcast leaderboards (public)
 * - Baseball Savant aggregates (public)
 * - Academic research on batted ball physics (public)
 */

import { ScoredBattedBallEvent, scoreBattedBall } from './statcast-scoring';

// ================================
// PUBLIC DISTRIBUTION PARAMETERS
// ================================

/**
 * These ranges are based on publicly available aggregate MLB data.
 * They do NOT reflect any proprietary team data.
 */
export interface DistributionParams {
  name: string;
  description: string;
  
  // Exit Velocity distribution (mph)
  ev: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
  
  // Launch Angle distribution (degrees)
  la: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
  
  // Distance distribution (feet) - optional
  distance?: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
  
  // Spray angle distribution (degrees, 0 = center)
  sprayAngle?: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

// ================================
// PUBLIC BASELINE DISTRIBUTIONS
// ================================

/**
 * MLB Average Hitter Profile (Public Data)
 * Based on league-wide public Statcast averages
 */
export const MLB_AVERAGE_DISTRIBUTION: DistributionParams = {
  name: 'MLB Average',
  description: 'League-average batted ball profile from public Statcast data',
  ev: { mean: 87.5, stdDev: 8.5, min: 50, max: 120 },
  la: { mean: 12.0, stdDev: 18.0, min: -30, max: 80 },
  distance: { mean: 220, stdDev: 80, min: 50, max: 450 },
  sprayAngle: { mean: 0, stdDev: 25, min: -45, max: 45 },
};

/**
 * High School Varsity Profile (Estimated from public data)
 */
export const HS_VARSITY_DISTRIBUTION: DistributionParams = {
  name: 'HS Varsity',
  description: 'High school varsity batted ball profile (estimated)',
  ev: { mean: 75.0, stdDev: 10.0, min: 40, max: 100 },
  la: { mean: 10.0, stdDev: 20.0, min: -25, max: 75 },
  distance: { mean: 180, stdDev: 70, min: 30, max: 380 },
  sprayAngle: { mean: 0, stdDev: 28, min: -45, max: 45 },
};

/**
 * College D1 Profile (Estimated from public data)
 */
export const COLLEGE_D1_DISTRIBUTION: DistributionParams = {
  name: 'College D1',
  description: 'College D1 batted ball profile (estimated)',
  ev: { mean: 82.0, stdDev: 9.0, min: 45, max: 110 },
  la: { mean: 11.0, stdDev: 18.0, min: -28, max: 78 },
  distance: { mean: 200, stdDev: 75, min: 40, max: 420 },
  sprayAngle: { mean: 0, stdDev: 26, min: -45, max: 45 },
};

/**
 * Elite Power Hitter Profile (Public Leaderboard Top 10%)
 */
export const ELITE_POWER_DISTRIBUTION: DistributionParams = {
  name: 'Elite Power',
  description: 'Elite power hitter profile from public leaderboard data',
  ev: { mean: 93.0, stdDev: 7.0, min: 60, max: 120 },
  la: { mean: 14.0, stdDev: 15.0, min: -20, max: 70 },
  distance: { mean: 280, stdDev: 90, min: 80, max: 480 },
  sprayAngle: { mean: -5, stdDev: 22, min: -45, max: 45 }, // Pull-heavy
};

/**
 * Contact-First Hitter Profile (Public Leaderboard K% < 15%)
 */
export const CONTACT_FIRST_DISTRIBUTION: DistributionParams = {
  name: 'Contact First',
  description: 'Contact-oriented hitter profile',
  ev: { mean: 85.0, stdDev: 7.5, min: 55, max: 110 },
  la: { mean: 8.0, stdDev: 14.0, min: -20, max: 60 },
  distance: { mean: 200, stdDev: 65, min: 50, max: 400 },
  sprayAngle: { mean: 2, stdDev: 30, min: -45, max: 45 }, // Slight opposite field
};

// ================================
// RANDOM NUMBER GENERATORS
// ================================

/**
 * Generate normally distributed random number (Box-Muller transform)
 */
function gaussianRandom(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

/**
 * Generate random number within bounds using normal distribution
 */
function boundedGaussian(
  mean: number,
  stdDev: number,
  min: number,
  max: number
): number {
  let value: number;
  let attempts = 0;
  
  do {
    value = gaussianRandom(mean, stdDev);
    attempts++;
  } while ((value < min || value > max) && attempts < 100);
  
  return Math.max(min, Math.min(max, value));
}

// ================================
// SYNTHETIC EVENT GENERATOR
// ================================

export interface SyntheticEventOptions {
  distribution: DistributionParams;
  includeDistance?: boolean;
  includeSprayAngle?: boolean;
  sessionId?: string;
  playerId?: string;
  source?: string;
  timestamp?: Date;
}

/**
 * Generate a single synthetic batted ball event
 */
export function generateSyntheticEvent(options: SyntheticEventOptions): ScoredBattedBallEvent {
  const { distribution, includeDistance = true, includeSprayAngle = true } = options;
  
  const exitVelocity = boundedGaussian(
    distribution.ev.mean,
    distribution.ev.stdDev,
    distribution.ev.min,
    distribution.ev.max
  );
  
  const launchAngle = boundedGaussian(
    distribution.la.mean,
    distribution.la.stdDev,
    distribution.la.min,
    distribution.la.max
  );
  
  let distance: number | undefined;
  if (includeDistance && distribution.distance) {
    // Distance is correlated with EV and LA
    const evFactor = (exitVelocity - distribution.ev.mean) / distribution.ev.stdDev;
    const laFactor = Math.sin((launchAngle * Math.PI) / 180); // Optimal around 30-35 degrees
    const adjustedMean = distribution.distance.mean + (evFactor * 20) + (laFactor * 30);
    
    distance = boundedGaussian(
      adjustedMean,
      distribution.distance.stdDev,
      distribution.distance.min,
      distribution.distance.max
    );
  }
  
  let sprayAngle: number | undefined;
  if (includeSprayAngle && distribution.sprayAngle) {
    sprayAngle = boundedGaussian(
      distribution.sprayAngle.mean,
      distribution.sprayAngle.stdDev,
      distribution.sprayAngle.min,
      distribution.sprayAngle.max
    );
  }
  
  const event = {
    exitVelocity: Math.round(exitVelocity * 10) / 10,
    launchAngle: Math.round(launchAngle * 10) / 10,
    distance: distance ? Math.round(distance) : undefined,
    sprayAngle: sprayAngle ? Math.round(sprayAngle * 10) / 10 : undefined,
  };
  
  return scoreBattedBall(event);
}

/**
 * Generate a batch of synthetic events
 */
export function generateSyntheticSession(
  count: number,
  options: Omit<SyntheticEventOptions, 'timestamp'>
): ScoredBattedBallEvent[] {
  const events: ScoredBattedBallEvent[] = [];
  
  for (let i = 0; i < count; i++) {
    events.push(generateSyntheticEvent(options));
  }
  
  return events;
}

// ================================
// STRESS TEST SCENARIOS
// ================================

export interface StressTestScenario {
  name: string;
  description: string;
  events: ScoredBattedBallEvent[];
  expectedMetrics: {
    avgContactScore?: { min: number; max: number };
    hardHitPct?: { min: number; max: number };
    barrelPct?: { min: number; max: number };
  };
}

/**
 * Generate edge case scenarios for testing scoring logic
 */
export function generateStressTestScenarios(): StressTestScenario[] {
  return [
    {
      name: 'All Hard Hits',
      description: 'Every ball hit 95+ mph',
      events: Array.from({ length: 50 }, () => scoreBattedBall({
        exitVelocity: 95 + Math.random() * 15,
        launchAngle: Math.random() * 60 - 10,
      })),
      expectedMetrics: {
        hardHitPct: { min: 95, max: 100 },
      },
    },
    {
      name: 'All Ground Balls',
      description: 'Every ball hit on ground (LA < 10)',
      events: Array.from({ length: 50 }, () => scoreBattedBall({
        exitVelocity: 75 + Math.random() * 30,
        launchAngle: Math.random() * 10 - 5,
      })),
      expectedMetrics: {
        avgContactScore: { min: 20, max: 50 },
      },
    },
    {
      name: 'All Pop Ups',
      description: 'Every ball hit straight up (LA > 50)',
      events: Array.from({ length: 50 }, () => scoreBattedBall({
        exitVelocity: 60 + Math.random() * 30,
        launchAngle: 55 + Math.random() * 25,
      })),
      expectedMetrics: {
        avgContactScore: { min: 0, max: 35 },
      },
    },
    {
      name: 'All Barrels',
      description: 'Perfect barrel zone hits',
      events: Array.from({ length: 50 }, () => scoreBattedBall({
        exitVelocity: 100 + Math.random() * 10,
        launchAngle: 18 + Math.random() * 8,
      })),
      expectedMetrics: {
        barrelPct: { min: 85, max: 100 },
        avgContactScore: { min: 75, max: 100 },
      },
    },
    {
      name: 'Mixed Realistic Session',
      description: 'Mix of quality similar to game conditions',
      events: generateSyntheticSession(100, { distribution: MLB_AVERAGE_DISTRIBUTION }),
      expectedMetrics: {
        avgContactScore: { min: 35, max: 60 },
        hardHitPct: { min: 25, max: 45 },
      },
    },
    {
      name: 'Youth Player Profile',
      description: 'Lower velocities typical of youth players',
      events: generateSyntheticSession(50, { 
        distribution: {
          ...HS_VARSITY_DISTRIBUTION,
          ev: { mean: 65, stdDev: 8, min: 40, max: 85 },
        },
      }),
      expectedMetrics: {
        avgContactScore: { min: 15, max: 40 },
        hardHitPct: { min: 0, max: 10 },
      },
    },
  ];
}

// ================================
// VALIDATION UTILITIES
// ================================

/**
 * Validate that a scoring config produces expected results on synthetic data
 */
export function validateScoringConfig(
  scenarios: StressTestScenario[]
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  
  for (const scenario of scenarios) {
    const { events, expectedMetrics } = scenario;
    
    // Calculate actual metrics
    const hardHitCount = events.filter(e => e.isHardHit).length;
    const barrelCount = events.filter(e => e.isBarrel).length;
    const avgContactScore = events.reduce((sum, e) => sum + e.contactScore, 0) / events.length;
    
    const hardHitPct = (hardHitCount / events.length) * 100;
    const barrelPct = (barrelCount / events.length) * 100;
    
    // Check expectations
    if (expectedMetrics.hardHitPct) {
      const { min, max } = expectedMetrics.hardHitPct;
      if (hardHitPct < min || hardHitPct > max) {
        failures.push(`${scenario.name}: hardHitPct ${hardHitPct.toFixed(1)}% not in [${min}, ${max}]`);
      }
    }
    
    if (expectedMetrics.barrelPct) {
      const { min, max } = expectedMetrics.barrelPct;
      if (barrelPct < min || barrelPct > max) {
        failures.push(`${scenario.name}: barrelPct ${barrelPct.toFixed(1)}% not in [${min}, ${max}]`);
      }
    }
    
    if (expectedMetrics.avgContactScore) {
      const { min, max } = expectedMetrics.avgContactScore;
      if (avgContactScore < min || avgContactScore > max) {
        failures.push(`${scenario.name}: avgContactScore ${avgContactScore.toFixed(1)} not in [${min}, ${max}]`);
      }
    }
  }
  
  return {
    passed: failures.length === 0,
    failures,
  };
}

// ================================
// DISTRIBUTION COMPARISON
// ================================

/**
 * Compare two sets of events to check for distribution similarity
 */
export function compareDistributions(
  eventsA: ScoredBattedBallEvent[],
  eventsB: ScoredBattedBallEvent[]
): {
  evDiff: number;
  laDiff: number;
  contactScoreDiff: number;
  similar: boolean;
} {
  const avgA = {
    ev: eventsA.reduce((s, e) => s + e.exitVelocity, 0) / eventsA.length,
    la: eventsA.reduce((s, e) => s + e.launchAngle, 0) / eventsA.length,
    score: eventsA.reduce((s, e) => s + e.contactScore, 0) / eventsA.length,
  };
  
  const avgB = {
    ev: eventsB.reduce((s, e) => s + e.exitVelocity, 0) / eventsB.length,
    la: eventsB.reduce((s, e) => s + e.launchAngle, 0) / eventsB.length,
    score: eventsB.reduce((s, e) => s + e.contactScore, 0) / eventsB.length,
  };
  
  const evDiff = Math.abs(avgA.ev - avgB.ev);
  const laDiff = Math.abs(avgA.la - avgB.la);
  const contactScoreDiff = Math.abs(avgA.score - avgB.score);
  
  // Consider similar if within reasonable tolerance
  const similar = evDiff < 5 && laDiff < 5 && contactScoreDiff < 10;
  
  return { evDiff, laDiff, contactScoreDiff, similar };
}
