// Universal Launch Monitor Parser and Ball Score Calculator

import { ColumnMap, LaunchMonitorBrand } from './csv-detector';

function normStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().toLowerCase();
}

function normStrUpper(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().toUpperCase();
}

export interface LaunchMonitorSwing {
  exitVelo: number;
  launchAngle: number;
  distance: number;
  result: string;
  hitType: string;
  user: string;
}

export interface LaunchMonitorSessionStats {
  source: LaunchMonitorBrand;
  totalSwings: number;
  misses: number;
  fouls: number;
  ballsInPlay: number;
  contactRate: number;
  
  avgExitVelo: number;
  maxExitVelo: number;
  minExitVelo: number;
  velo90Plus: number;
  velo95Plus: number;
  velo100Plus: number;
  
  avgLaunchAngle: number;
  optimalLaCount: number;
  groundBallCount: number;
  flyBallCount: number;
  
  maxDistance: number;
  avgDistance: number;
  
  qualityHits: number;
  barrelHits: number;
  qualityHitPct: number;
  barrelPct: number;
  
  totalPoints: number;
  pointsPerSwing: number;
  ballScore: number;
  
  resultsBreakdown: Record<string, number>;
  hitTypesBreakdown: Record<string, number>;
}

/**
 * Parse launch monitor data using the detected column map
 */
export function parseLaunchMonitorData(rows: Record<string, any>[], columnMap: ColumnMap): LaunchMonitorSwing[] {
  const swings: LaunchMonitorSwing[] = [];

  if (import.meta.env.DEV) {
    console.log('[LaunchMonitor] Column mapping:', {
      exitVelo: columnMap.exitVelo,
      launchAngle: columnMap.launchAngle,
      distance: columnMap.distance,
      result: columnMap.result ?? '(none)',
      hitType: columnMap.hitType ?? '(none)',
    });
  }

  const getValue = (row: Record<string, any>, colName: string): any => {
    // Try exact match first
    if (row[colName] !== undefined) return row[colName];

    // Try case-insensitive match
    const keys = Object.keys(row);
    const match = keys.find(k => k.trim().toLowerCase() === colName.toLowerCase());
    if (match) return row[match];

    // Try partial match
    const partial = keys.find(k => k.toLowerCase().includes(colName.toLowerCase()));
    if (partial) return row[partial];

    return null;
  };

  for (const row of rows) {
    const rawResult = columnMap.result ? getValue(row, columnMap.result) : '';
    const rawHitType = columnMap.hitType ? getValue(row, columnMap.hitType) : '';
    const rawUser = columnMap.user ? getValue(row, columnMap.user) : '';

    if (import.meta.env.DEV && swings.length < 3) {
      console.log('[LaunchMonitor] Debug row result types:', {
        resultType: typeof rawResult,
        result: rawResult,
      });
    }

    swings.push({
      exitVelo: parseFloat(getValue(row, columnMap.exitVelo)) || 0,
      launchAngle: parseFloat(getValue(row, columnMap.launchAngle)) || 0,
      distance: parseFloat(getValue(row, columnMap.distance)) || 0,
      // IMPORTANT: ALWAYS coerce to string; never assume result/hitType are strings
      result: rawResult === null || rawResult === undefined ? '' : String(rawResult),
      hitType: rawHitType === null || rawHitType === undefined ? '' : String(rawHitType),
      user: rawUser === null || rawUser === undefined ? '' : String(rawUser),
    });
  }

  return swings;
}

/**
 * Calculate swing points for Quality Hit Game
 */
function calculateSwingPoints(swing: LaunchMonitorSwing): number {
  const { exitVelo, launchAngle } = swing;
  const resultLower = normStr(swing.result);
  const resultUpper = normStrUpper(swing.result);
  const hitTypeLower = normStr(swing.hitType);

  // Miss = -5 points
  if (exitVelo === 0) {
    return -5;
  }

  // Foul = 0 points (only if result exists)
  if (resultLower === 'foul') {
    return 0;
  }

  let points = 0;

  // Exit velocity scoring
  if (exitVelo >= 100) points += 20;
  else if (exitVelo >= 95) points += 15;
  else if (exitVelo >= 90) points += 10;
  else if (exitVelo >= 85) points += 5;
  else points += 2;

  // Launch angle scoring
  if (launchAngle >= 10 && launchAngle <= 25) points += 10; // Optimal
  else if (launchAngle >= 8 && launchAngle <= 30) points += 5; // Acceptable
  else if (launchAngle < 0) points -= 5; // Negative LA ground ball

  // Result bonus
  if (resultUpper.includes('HR')) points += 25;
  else if (resultUpper.includes('3B')) points += 20;
  else if (resultUpper.includes('2B')) points += 15;
  else if (resultUpper.includes('1B')) points += 10;
  else if (hitTypeLower === 'ld') points += 5;

  return points;
}

/**
 * Convert points per swing to 20-80 scale Ball Score
 */
function calculateBallScoreFromPoints(pointsPerSwing: number): number {
  if (pointsPerSwing >= 35) return 80; // Plus-Plus
  if (pointsPerSwing >= 30) return 70; // Plus
  if (pointsPerSwing >= 25) return 60; // Above Average
  if (pointsPerSwing >= 20) return 55; // Above Average
  if (pointsPerSwing >= 15) return 50; // Average
  if (pointsPerSwing >= 10) return 45; // Below Average
  if (pointsPerSwing >= 5) return 40; // Fringe
  return 30; // Poor
}

/**
 * Calculate full session statistics from launch monitor swings
 */
export function calculateLaunchMonitorStats(swings: LaunchMonitorSwing[], brand: LaunchMonitorBrand): LaunchMonitorSessionStats {
  const totalSwings = swings.length;

  // Categorize swings
  const misses = swings.filter(s => s.exitVelo === 0).length;

  // Only treat result as a filter if we actually have result values
  const hasResult = swings.some(s => normStr(s.result) !== '');

  const fouls = hasResult
    ? swings.filter(s => normStr(s.result) === 'foul').length
    : 0;

  const ballsInPlay = hasResult
    ? swings.filter(s => s.exitVelo > 0 && normStr(s.result) !== 'foul')
    : swings.filter(s => s.exitVelo > 0);

  const ballsInPlayCount = ballsInPlay.length;

  // Contact rate
  const contactRate = totalSwings > 0
    ? ((totalSwings - misses) / totalSwings) * 100
    : 0;
  
  // Exit velocity stats (only for balls in play)
  const velos = ballsInPlay.map(s => s.exitVelo).filter(v => v > 0);
  const avgExitVelo = velos.length > 0 
    ? velos.reduce((a, b) => a + b, 0) / velos.length 
    : 0;
  const maxExitVelo = velos.length > 0 ? Math.max(...velos) : 0;
  const minExitVelo = velos.length > 0 ? Math.min(...velos) : 0;
  const velo90Plus = velos.filter(v => v >= 90).length;
  const velo95Plus = velos.filter(v => v >= 95).length;
  const velo100Plus = velos.filter(v => v >= 100).length;
  
  // Launch angle stats
  const launchAngles = ballsInPlay.map(s => s.launchAngle);
  const avgLaunchAngle = launchAngles.length > 0 
    ? launchAngles.reduce((a, b) => a + b, 0) / launchAngles.length 
    : 0;
  const optimalLaCount = launchAngles.filter(la => la >= 10 && la <= 25).length;
  const groundBallCount = launchAngles.filter(la => la < 10).length;
  const flyBallCount = launchAngles.filter(la => la > 25).length;
  
  // Distance stats
  const distances = ballsInPlay.map(s => s.distance).filter(d => d > 0);
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;
  const avgDistance = distances.length > 0 
    ? distances.reduce((a, b) => a + b, 0) / distances.length 
    : 0;
  
  // Quality metrics
  const qualityHits = ballsInPlay.filter(s => {
    return s.launchAngle >= 10 && s.launchAngle <= 25;
  }).length;
  
  const barrelHits = ballsInPlay.filter(s => {
    return s.exitVelo >= 95 && s.launchAngle >= 10 && s.launchAngle <= 25;
  }).length;
  
  const qualityHitPct = ballsInPlayCount > 0 
    ? (qualityHits / ballsInPlayCount) * 100 
    : 0;
  const barrelPct = ballsInPlayCount > 0 
    ? (barrelHits / ballsInPlayCount) * 100 
    : 0;
  
  // Quality Hit Game scoring
  const totalPoints = swings.reduce((sum, swing) => sum + calculateSwingPoints(swing), 0);
  const pointsPerSwing = totalSwings > 0 ? totalPoints / totalSwings : 0;
  const ballScore = calculateBallScoreFromPoints(pointsPerSwing);
  
  // Results breakdown
  const resultsBreakdown: Record<string, number> = {};
  swings.forEach(swing => {
    const result = swing.result || (swing.exitVelo === 0 ? 'Miss' : 'Unknown');
    resultsBreakdown[result] = (resultsBreakdown[result] || 0) + 1;
  });
  
  // Hit types breakdown
  const hitTypesBreakdown: Record<string, number> = {};
  ballsInPlay.forEach(swing => {
    const hitType = swing.hitType || 'Unknown';
    hitTypesBreakdown[hitType] = (hitTypesBreakdown[hitType] || 0) + 1;
  });
  
  return {
    source: brand,
    totalSwings,
    misses,
    fouls,
    ballsInPlay: ballsInPlayCount,
    contactRate: Math.round(contactRate * 10) / 10,
    
    avgExitVelo: Math.round(avgExitVelo * 10) / 10,
    maxExitVelo: Math.round(maxExitVelo * 10) / 10,
    minExitVelo: Math.round(minExitVelo * 10) / 10,
    velo90Plus,
    velo95Plus,
    velo100Plus,
    
    avgLaunchAngle: Math.round(avgLaunchAngle * 10) / 10,
    optimalLaCount,
    groundBallCount,
    flyBallCount,
    
    maxDistance: Math.round(maxDistance),
    avgDistance: Math.round(avgDistance),
    
    qualityHits,
    barrelHits,
    qualityHitPct: Math.round(qualityHitPct * 10) / 10,
    barrelPct: Math.round(barrelPct * 10) / 10,
    
    totalPoints,
    pointsPerSwing: Math.round(pointsPerSwing * 10) / 10,
    ballScore,
    
    resultsBreakdown,
    hitTypesBreakdown
  };
}

/**
 * Get grade label for a 20-80 score
 */
export function getScoreGrade(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 60) return 'Plus';
  if (score >= 55) return 'Above Average';
  if (score >= 50) return 'Average';
  if (score >= 45) return 'Below Average';
  if (score >= 40) return 'Fringe';
  return 'Poor';
}
