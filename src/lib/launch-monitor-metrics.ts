/**
 * ESPN-Style Launch Monitor Metrics Calculator
 * 
 * Provides level-adjusted thresholds for Barrel Rate, Hard-Hit Rate,
 * LA Distribution, and Score Drivers.
 */

// ================================
// LEVEL-BASED THRESHOLDS
// ================================

export type PlayerLevel = 'youth' | 'middle_school' | 'high_school' | 'college' | 'pro';

export interface LevelThresholds {
  barrelEvMin: number;
  barrelLaMin: number;
  barrelLaMax: number;
  hardHitEvMin: number;
  label: string;
}

export const LEVEL_THRESHOLDS: Record<PlayerLevel, LevelThresholds> = {
  youth: {
    barrelEvMin: 65,
    barrelLaMin: 10,
    barrelLaMax: 30,
    hardHitEvMin: 60,
    label: 'Youth (12U)'
  },
  middle_school: {
    barrelEvMin: 70,
    barrelLaMin: 10,
    barrelLaMax: 30,
    hardHitEvMin: 65,
    label: 'Middle School'
  },
  high_school: {
    barrelEvMin: 80,
    barrelLaMin: 10,
    barrelLaMax: 30,
    hardHitEvMin: 75,
    label: 'High School'
  },
  college: {
    barrelEvMin: 90,
    barrelLaMin: 8,
    barrelLaMax: 32,
    hardHitEvMin: 85,
    label: 'College'
  },
  pro: {
    barrelEvMin: 95,
    barrelLaMin: 8,
    barrelLaMax: 32,
    hardHitEvMin: 95,
    label: 'Professional'
  }
};

export function getLevelThresholds(level?: string): LevelThresholds {
  if (!level) return LEVEL_THRESHOLDS.high_school;
  const normalized = level.toLowerCase().replace(/[\s_-]/g, '_');
  return LEVEL_THRESHOLDS[normalized as PlayerLevel] || LEVEL_THRESHOLDS.high_school;
}

// ================================
// LA DISTRIBUTION BUCKETS
// ================================

export interface LaDistribution {
  groundBall: number;  // LA < 5
  lineDrive: number;   // LA 5-20
  flyBall: number;     // LA 20-35
  popUp: number;       // LA > 35
  groundBallPct: number;
  lineDrivePct: number;
  flyBallPct: number;
  popUpPct: number;
}

export function calculateLaDistribution(launchAngles: number[]): LaDistribution {
  const total = launchAngles.length;
  if (total === 0) {
    return {
      groundBall: 0, lineDrive: 0, flyBall: 0, popUp: 0,
      groundBallPct: 0, lineDrivePct: 0, flyBallPct: 0, popUpPct: 0
    };
  }

  const groundBall = launchAngles.filter(la => la < 5).length;
  const lineDrive = launchAngles.filter(la => la >= 5 && la < 20).length;
  const flyBall = launchAngles.filter(la => la >= 20 && la <= 35).length;
  const popUp = launchAngles.filter(la => la > 35).length;

  return {
    groundBall,
    lineDrive,
    flyBall,
    popUp,
    groundBallPct: Math.round((groundBall / total) * 1000) / 10,
    lineDrivePct: Math.round((lineDrive / total) * 1000) / 10,
    flyBallPct: Math.round((flyBall / total) * 1000) / 10,
    popUpPct: Math.round((popUp / total) * 1000) / 10
  };
}

// ================================
// SCORE DRIVERS (BALL SCORE EXPLANATION)
// ================================

export interface ScoreDriver {
  label: string;
  impact: number;      // Points contributed (+/-)
  context: string;     // Brief explanation
  isPositive: boolean;
}

export interface ScoreComponents {
  drivers: ScoreDriver[];
  totalExplained: number;
  rawScore: number;
  finalScore: number;
}

/**
 * Calculate score drivers that explain WHY the Ball Score is what it is
 */
export function calculateScoreDrivers(
  avgEv: number,
  contactRate: number,
  barrelPct: number,
  avgLa: number,
  optimalLaPct: number,
  hardHitPct: number,
  level: PlayerLevel = 'high_school'
): ScoreComponents {
  const drivers: ScoreDriver[] = [];
  const thresholds = LEVEL_THRESHOLDS[level];

  // Contact Rate Driver (0-20 points)
  const contactImpact = Math.round(contactRate * 0.2);
  drivers.push({
    label: 'Contact Rate',
    impact: contactImpact - 10, // Relative to average (50%)
    context: `${contactRate.toFixed(0)}% contact`,
    isPositive: contactRate >= 70
  });

  // Avg Exit Velo Driver (0-25 points)
  const evBenchmark = thresholds.hardHitEvMin;
  const evDelta = avgEv - evBenchmark;
  const evImpact = Math.round(evDelta * 0.5);
  drivers.push({
    label: 'Exit Velocity',
    impact: evImpact,
    context: `${avgEv.toFixed(1)} mph avg`,
    isPositive: avgEv >= evBenchmark
  });

  // Barrel Rate Driver (0-15 points)
  const barrelBenchmark = 8; // League average ~8%
  const barrelDelta = barrelPct - barrelBenchmark;
  const barrelImpact = Math.round(barrelDelta * 1.5);
  drivers.push({
    label: 'Barrel Rate',
    impact: barrelImpact,
    context: `${barrelPct.toFixed(1)}% barrels`,
    isPositive: barrelPct >= barrelBenchmark
  });

  // Hard Hit Rate Driver (0-10 points)
  const hardHitBenchmark = 35; // ~35% league average
  const hardHitDelta = hardHitPct - hardHitBenchmark;
  const hardHitImpact = Math.round(hardHitDelta * 0.3);
  drivers.push({
    label: 'Hard Hit Rate',
    impact: hardHitImpact,
    context: `${hardHitPct.toFixed(1)}% hard hit`,
    isPositive: hardHitPct >= hardHitBenchmark
  });

  // Launch Angle Spread Driver (-5 to +10 points)
  const optimalLaBenchmark = 40; // ~40% optimal LA
  const laDelta = optimalLaPct - optimalLaBenchmark;
  const laImpact = Math.round(laDelta * 0.2);
  drivers.push({
    label: 'LA Quality',
    impact: laImpact,
    context: `${avgLa.toFixed(1)}° avg`,
    isPositive: avgLa >= 10 && avgLa <= 25
  });

  // Sort by absolute impact
  drivers.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const totalExplained = drivers.reduce((sum, d) => sum + d.impact, 0);
  const baseScore = 50;
  const rawScore = baseScore + totalExplained;
  const finalScore = Math.max(20, Math.min(80, rawScore));

  return {
    drivers,
    totalExplained,
    rawScore,
    finalScore
  };
}

// ================================
// ENHANCED SESSION STATS
// ================================

export interface EnhancedLaunchMonitorStats {
  // Existing fields
  totalSwings: number;
  ballsInPlay: number;
  contactRate: number;
  avgExitVelo: number;
  maxExitVelo: number;
  avgLaunchAngle: number;
  avgDistance: number;
  maxDistance: number;
  ballScore: number;

  // NEW: Level-adjusted metrics
  level: PlayerLevel;
  thresholds: LevelThresholds;

  // NEW: Barrel Rate (level-adjusted)
  barrelCount: number;
  barrelRate: number;

  // NEW: Hard-Hit Rate (level-adjusted)
  hardHitCount: number;
  hardHitRate: number;

  // NEW: LA Distribution
  laDistribution: LaDistribution;

  // NEW: Score explanation
  scoreComponents: ScoreComponents;

  // NEW: Sweet Spot stats
  sweetSpotCount: number;
  sweetSpotPct: number;
}

export interface Swing {
  exitVelo: number;
  launchAngle: number;
  distance?: number;
}

/**
 * Calculate enhanced ESPN-style stats with level-adjusted thresholds
 */
export function calculateEnhancedStats(
  swings: Swing[],
  level?: string
): EnhancedLaunchMonitorStats {
  const thresholds = getLevelThresholds(level);
  const playerLevel = (level?.toLowerCase().replace(/[\s_-]/g, '_') || 'high_school') as PlayerLevel;

  // Filter to balls in play (EV > 0)
  const ballsInPlay = swings.filter(s => s.exitVelo > 0);
  const bipCount = ballsInPlay.length;
  const totalSwings = swings.length;

  // Contact rate
  const contactRate = totalSwings > 0 ? (bipCount / totalSwings) * 100 : 0;

  // Exit velocity stats
  const evs = ballsInPlay.map(s => s.exitVelo);
  const avgExitVelo = evs.length > 0 ? evs.reduce((a, b) => a + b, 0) / evs.length : 0;
  const maxExitVelo = evs.length > 0 ? Math.max(...evs) : 0;

  // Launch angle stats
  const las = ballsInPlay.map(s => s.launchAngle);
  const avgLaunchAngle = las.length > 0 ? las.reduce((a, b) => a + b, 0) / las.length : 0;

  // Distance stats
  const distances = ballsInPlay.map(s => s.distance || 0).filter(d => d > 0);
  const avgDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;

  // Barrel Rate (level-adjusted)
  const barrelCount = ballsInPlay.filter(s => 
    s.exitVelo >= thresholds.barrelEvMin &&
    s.launchAngle >= thresholds.barrelLaMin &&
    s.launchAngle <= thresholds.barrelLaMax
  ).length;
  const barrelRate = bipCount > 0 ? (barrelCount / bipCount) * 100 : 0;

  // Hard-Hit Rate (level-adjusted)
  const hardHitCount = ballsInPlay.filter(s => s.exitVelo >= thresholds.hardHitEvMin).length;
  const hardHitRate = bipCount > 0 ? (hardHitCount / bipCount) * 100 : 0;

  // Sweet Spot (LA 8-32)
  const sweetSpotCount = ballsInPlay.filter(s => s.launchAngle >= 8 && s.launchAngle <= 32).length;
  const sweetSpotPct = bipCount > 0 ? (sweetSpotCount / bipCount) * 100 : 0;

  // LA Distribution
  const laDistribution = calculateLaDistribution(las);

  // Optimal LA percentage
  const optimalLaCount = las.filter(la => la >= 10 && la <= 25).length;
  const optimalLaPct = bipCount > 0 ? (optimalLaCount / bipCount) * 100 : 0;

  // Score components
  const scoreComponents = calculateScoreDrivers(
    avgExitVelo,
    contactRate,
    barrelRate,
    avgLaunchAngle,
    optimalLaPct,
    hardHitRate,
    playerLevel
  );

  return {
    totalSwings,
    ballsInPlay: bipCount,
    contactRate: Math.round(contactRate * 10) / 10,
    avgExitVelo: Math.round(avgExitVelo * 10) / 10,
    maxExitVelo: Math.round(maxExitVelo * 10) / 10,
    avgLaunchAngle: Math.round(avgLaunchAngle * 10) / 10,
    avgDistance: Math.round(avgDistance),
    maxDistance: Math.round(maxDistance),
    ballScore: scoreComponents.finalScore,
    level: playerLevel,
    thresholds,
    barrelCount,
    barrelRate: Math.round(barrelRate * 10) / 10,
    hardHitCount,
    hardHitRate: Math.round(hardHitRate * 10) / 10,
    laDistribution,
    scoreComponents,
    sweetSpotCount,
    sweetSpotPct: Math.round(sweetSpotPct * 10) / 10
  };
}

// ================================
// PEER COMPARISON
// ================================

export interface PeerComparison {
  avgEvDelta: number;      // + or - vs peers
  barrelRateDelta: number;
  hardHitDelta: number;
  hasData: boolean;
}

// Peer benchmarks by level (will be replaced with real data later)
const PEER_BENCHMARKS: Record<PlayerLevel, { avgEv: number; barrelRate: number; hardHitRate: number }> = {
  youth: { avgEv: 55, barrelRate: 5, hardHitRate: 15 },
  middle_school: { avgEv: 62, barrelRate: 6, hardHitRate: 20 },
  high_school: { avgEv: 75, barrelRate: 8, hardHitRate: 30 },
  college: { avgEv: 86, barrelRate: 10, hardHitRate: 38 },
  pro: { avgEv: 89, barrelRate: 12, hardHitRate: 42 }
};

export function calculatePeerComparison(
  stats: EnhancedLaunchMonitorStats
): PeerComparison {
  const benchmarks = PEER_BENCHMARKS[stats.level] || PEER_BENCHMARKS.high_school;

  return {
    avgEvDelta: Math.round((stats.avgExitVelo - benchmarks.avgEv) * 10) / 10,
    barrelRateDelta: Math.round((stats.barrelRate - benchmarks.barrelRate) * 10) / 10,
    hardHitDelta: Math.round((stats.hardHitRate - benchmarks.hardHitRate) * 10) / 10,
    hasData: stats.ballsInPlay >= 5 // Need at least 5 swings for meaningful comparison
  };
}

// ================================
// DISPLAY HELPERS
// ================================

export function getGradeLabel(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 60) return 'Plus';
  if (score >= 55) return 'Above Average';
  if (score >= 50) return 'Average';
  if (score >= 45) return 'Below Average';
  if (score >= 40) return 'Fringe';
  return 'Poor';
}

export function getGradeColor(score: number): string {
  if (score >= 60) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getDeltaColor(delta: number): string {
  if (delta > 0) return 'text-green-500';
  if (delta < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

export function formatDelta(delta: number, unit: string = ''): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}${unit}`;
}
