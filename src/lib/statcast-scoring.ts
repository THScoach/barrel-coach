/**
 * StatCast-Aligned Exit Velocity / Contact Quality Scoring Module
 * 
 * Uses official StatCast definitions for:
 * - Hard Hit: EV ≥ 95 mph
 * - Sweet Spot: LA between 8° and 32°
 * - Barrel: Complex EV + LA zone
 * - Batted Ball Type: GB/LD/FB/PU
 * 
 * Contact Quality Score: 0-100 scale
 * "How hard and how clean you hit the ball."
 */

// ================================
// STATCAST DEFINITIONS (LOCKED)
// ================================

/**
 * Hard Hit: Exit Velocity ≥ 95 mph
 */
export function isHardHit(exitVelocity: number): boolean {
  return exitVelocity >= 95;
}

/**
 * Sweet Spot: Launch Angle between 8° and 32°
 */
export function isSweetSpot(launchAngle: number): boolean {
  return launchAngle >= 8 && launchAngle <= 32;
}

/**
 * Barrel Definition (StatCast):
 * - EV ≥ 98 mph
 * - LA zone expands with EV:
 *   - At 98 mph: LA 26°-30°
 *   - For each additional mph, zone expands by ~2° on each side
 *   - Capped at EV ≥ 116 → LA 8°-50°
 */
export function isBarrel(exitVelocity: number, launchAngle: number): boolean {
  if (exitVelocity < 98) return false;
  
  // Calculate barrel zone based on exit velocity
  // Base zone at 98 mph: 26-30°
  // Zone expands ~2° each direction per mph above 98
  const evAbove98 = Math.min(exitVelocity - 98, 18); // Cap at 116 mph
  
  // Low LA starts at 26° and decreases to 8° at 116+ mph
  const lowLA = Math.max(8, 26 - evAbove98);
  
  // High LA starts at 30° and increases to 50° at 116+ mph
  const highLA = Math.min(50, 30 + evAbove98 * (20 / 18));
  
  return launchAngle >= lowLA && launchAngle <= highLA;
}

/**
 * Batted Ball Type Classification:
 * - GB (Ground Ball): LA < 10°
 * - LD (Line Drive): LA 10°-25°
 * - FB (Fly Ball): LA 25°-50°
 * - PU (Pop Up): LA > 50°
 */
export type BattedBallType = 'GB' | 'LD' | 'FB' | 'PU' | 'UNK';

export function getBattedBallType(launchAngle: number): BattedBallType {
  if (launchAngle < 10) return 'GB';
  if (launchAngle >= 10 && launchAngle < 25) return 'LD';
  if (launchAngle >= 25 && launchAngle < 50) return 'FB';
  if (launchAngle >= 50) return 'PU';
  return 'UNK';
}

// ================================
// CONTACT QUALITY SCORE (0–100)
// ================================

export interface ContactScoreBreakdown {
  baseScore: number;      // 0-70 from EV normalization
  laAngleBonus: number;   // -15 to +15 based on LA
  hardHitBonus: number;   // +10 if hard hit
  sweetSpotBonus: number; // +10 if sweet spot
  barrelBonus: number;    // +15 if barrel (capped)
  rawScore: number;       // Before clamping
  finalScore: number;     // 0-100 clamped
}

/**
 * Calculate Contact Quality Score (0-100)
 * 
 * Base Score:
 * - Normalize EV from 60 → 115 mph into 0–70 points
 * - Penalize LA outside sweet spot
 * - Reward LA centered near 18–22°
 * 
 * Bonuses:
 * - Hard Hit: +10
 * - Sweet Spot: +10
 * - Barrel: +15 (max cap applies)
 */
export function calculateContactScore(
  exitVelocity: number,
  launchAngle: number
): ContactScoreBreakdown {
  // Skip invalid data
  if (exitVelocity <= 0) {
    return {
      baseScore: 0,
      laAngleBonus: 0,
      hardHitBonus: 0,
      sweetSpotBonus: 0,
      barrelBonus: 0,
      rawScore: 0,
      finalScore: 0
    };
  }

  // Base Score: Normalize EV from 60-115 mph to 0-70 points
  const evMin = 60;
  const evMax = 115;
  const evNormalized = Math.max(0, Math.min(1, (exitVelocity - evMin) / (evMax - evMin)));
  const baseScore = evNormalized * 70;

  // LA Angle Bonus/Penalty
  // Optimal center: 18-22°
  // Sweet spot: 8-32°
  // Outside sweet spot: penalty
  let laAngleBonus = 0;
  if (launchAngle >= 18 && launchAngle <= 22) {
    // Perfect LA range: +15
    laAngleBonus = 15;
  } else if (launchAngle >= 12 && launchAngle <= 28) {
    // Very good LA: +10
    laAngleBonus = 10;
  } else if (launchAngle >= 8 && launchAngle <= 32) {
    // Sweet spot but not optimal: +5
    laAngleBonus = 5;
  } else if (launchAngle >= 0 && launchAngle < 8) {
    // Too flat: -5
    laAngleBonus = -5;
  } else if (launchAngle > 32 && launchAngle <= 50) {
    // Too high but still FB: -5
    laAngleBonus = -5;
  } else if (launchAngle > 50) {
    // Pop up: -15
    laAngleBonus = -15;
  } else if (launchAngle < 0) {
    // Negative LA: -10
    laAngleBonus = -10;
  }

  // Bonus calculations
  const hardHit = isHardHit(exitVelocity);
  const sweetSpot = isSweetSpot(launchAngle);
  const barrel = isBarrel(exitVelocity, launchAngle);

  const hardHitBonus = hardHit ? 10 : 0;
  const sweetSpotBonus = sweetSpot ? 10 : 0;
  // Barrel bonus replaces sweet spot bonus if both apply (avoid double-dipping)
  const barrelBonus = barrel ? 15 : 0;
  
  // If barrel, don't also add sweet spot (barrel is better)
  const effectiveSweetSpotBonus = barrel ? 0 : sweetSpotBonus;

  // Calculate raw and final scores
  const rawScore = baseScore + laAngleBonus + hardHitBonus + effectiveSweetSpotBonus + barrelBonus;
  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    baseScore: Math.round(baseScore * 10) / 10,
    laAngleBonus,
    hardHitBonus,
    sweetSpotBonus: effectiveSweetSpotBonus,
    barrelBonus,
    rawScore: Math.round(rawScore * 10) / 10,
    finalScore
  };
}

/**
 * Quick contact score calculation (just returns final score)
 */
export function getContactScore(exitVelocity: number, launchAngle: number): number {
  return calculateContactScore(exitVelocity, launchAngle).finalScore;
}

// ================================
// BATTED BALL EVENT INTERFACE
// ================================

export interface BattedBallEvent {
  exitVelocity: number;
  launchAngle: number;
  distance?: number;
  sprayAngle?: number;
  hangTime?: number;
  result?: string;
  hitType?: string;
}

export interface ScoredBattedBallEvent extends BattedBallEvent {
  isHardHit: boolean;
  isSweetSpot: boolean;
  isBarrel: boolean;
  bbType: BattedBallType;
  contactScore: number;
  scoreBreakdown: ContactScoreBreakdown;
}

/**
 * Score a single batted ball event
 */
export function scoreBattedBall(event: BattedBallEvent): ScoredBattedBallEvent {
  const scoreBreakdown = calculateContactScore(event.exitVelocity, event.launchAngle);
  
  return {
    ...event,
    isHardHit: isHardHit(event.exitVelocity),
    isSweetSpot: isSweetSpot(event.launchAngle),
    isBarrel: isBarrel(event.exitVelocity, event.launchAngle),
    bbType: getBattedBallType(event.launchAngle),
    contactScore: scoreBreakdown.finalScore,
    scoreBreakdown
  };
}

// ================================
// SESSION AGGREGATION
// ================================

export interface ContactQualitySessionStats {
  totalEvents: number;
  
  // Exit Velocity
  avgEV: number;
  maxEV: number;
  minEV: number;
  
  // Launch Angle
  avgLA: number;
  
  // Quality Percentages
  hardHitPct: number;
  sweetSpotPct: number;
  barrelPct: number;
  
  // Batted Ball Type Distribution
  gbPct: number;
  ldPct: number;
  fbPct: number;
  puPct: number;
  
  // Contact Score
  avgContactScore: number;
  maxContactScore: number;
  minContactScore: number;
  
  // Distance (optional)
  avgDistance?: number;
  maxDistance?: number;
}

/**
 * Calculate session-level statistics from scored events
 */
export function calculateSessionStats(events: ScoredBattedBallEvent[]): ContactQualitySessionStats {
  if (events.length === 0) {
    return {
      totalEvents: 0,
      avgEV: 0,
      maxEV: 0,
      minEV: 0,
      avgLA: 0,
      hardHitPct: 0,
      sweetSpotPct: 0,
      barrelPct: 0,
      gbPct: 0,
      ldPct: 0,
      fbPct: 0,
      puPct: 0,
      avgContactScore: 0,
      maxContactScore: 0,
      minContactScore: 0
    };
  }

  const total = events.length;
  
  // EV stats
  const evs = events.map(e => e.exitVelocity).filter(v => v > 0);
  const avgEV = evs.length > 0 ? evs.reduce((a, b) => a + b, 0) / evs.length : 0;
  const maxEV = evs.length > 0 ? Math.max(...evs) : 0;
  const minEV = evs.length > 0 ? Math.min(...evs) : 0;
  
  // LA stats
  const las = events.map(e => e.launchAngle);
  const avgLA = las.reduce((a, b) => a + b, 0) / total;
  
  // Quality metrics
  const hardHitCount = events.filter(e => e.isHardHit).length;
  const sweetSpotCount = events.filter(e => e.isSweetSpot).length;
  const barrelCount = events.filter(e => e.isBarrel).length;
  
  // BB Type distribution
  const gbCount = events.filter(e => e.bbType === 'GB').length;
  const ldCount = events.filter(e => e.bbType === 'LD').length;
  const fbCount = events.filter(e => e.bbType === 'FB').length;
  const puCount = events.filter(e => e.bbType === 'PU').length;
  
  // Contact scores
  const scores = events.map(e => e.contactScore);
  const avgContactScore = scores.reduce((a, b) => a + b, 0) / total;
  const maxContactScore = Math.max(...scores);
  const minContactScore = Math.min(...scores);
  
  // Distance (if available)
  const distances = events.map(e => e.distance).filter((d): d is number => d !== undefined && d > 0);
  const avgDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : undefined;
  const maxDistance = distances.length > 0 ? Math.max(...distances) : undefined;

  return {
    totalEvents: total,
    avgEV: Math.round(avgEV * 10) / 10,
    maxEV: Math.round(maxEV * 10) / 10,
    minEV: Math.round(minEV * 10) / 10,
    avgLA: Math.round(avgLA * 10) / 10,
    hardHitPct: Math.round((hardHitCount / total) * 1000) / 10,
    sweetSpotPct: Math.round((sweetSpotCount / total) * 1000) / 10,
    barrelPct: Math.round((barrelCount / total) * 1000) / 10,
    gbPct: Math.round((gbCount / total) * 1000) / 10,
    ldPct: Math.round((ldCount / total) * 1000) / 10,
    fbPct: Math.round((fbCount / total) * 1000) / 10,
    puPct: Math.round((puCount / total) * 1000) / 10,
    avgContactScore: Math.round(avgContactScore * 10) / 10,
    maxContactScore,
    minContactScore,
    avgDistance: avgDistance ? Math.round(avgDistance) : undefined,
    maxDistance: maxDistance ? Math.round(maxDistance) : undefined
  };
}

// ================================
// TREND ANALYSIS
// ================================

export interface TrendData {
  periodDays: number;
  avgEV: number;
  avgContactScore: number;
  hardHitPct: number;
  barrelPct: number;
  sweetSpotPct: number;
  totalEvents: number;
}

export interface TrendComparison {
  current: TrendData;
  previous: TrendData;
  evChange: number;
  contactScoreChange: number;
  hardHitChange: number;
  barrelChange: number;
  trendDirection: 'improving' | 'declining' | 'stable';
}

/**
 * Determine trend direction based on key metrics
 */
export function getTrendDirection(
  currentAvgScore: number, 
  previousAvgScore: number,
  threshold: number = 3
): 'improving' | 'declining' | 'stable' {
  const change = currentAvgScore - previousAvgScore;
  if (change > threshold) return 'improving';
  if (change < -threshold) return 'declining';
  return 'stable';
}

// ================================
// SCORE LABELS & DISPLAY
// ================================

export function getContactScoreGrade(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Average';
  if (score >= 30) return 'Poor';
  return 'Very Poor';
}

export function getContactScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-emerald-600';
  if (score >= 50) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * One-sentence explanation for players
 */
export function explainContactScore(score: number): string {
  if (score >= 90) return "You're crushing it — elite-level contact quality.";
  if (score >= 80) return "Excellent contact — consistently hitting the ball hard and clean.";
  if (score >= 70) return "Very good contact — your swing is producing quality output.";
  if (score >= 60) return "Good contact — solid work, room to grow.";
  if (score >= 50) return "Average contact — keep working on barrel accuracy.";
  if (score >= 40) return "Below average — focus on EV and launch angle.";
  return "Needs work — let's build better contact quality.";
}
