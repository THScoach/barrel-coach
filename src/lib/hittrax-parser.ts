// HitTrax CSV Parser and Quality Hit Game Scoring

export interface HitTraxRow {
  swingNumber: number;
  atBat: number;
  date: string;
  timeStamp: string;
  pitchSpeed: number;
  strikeZone: number;
  pitchType: string;
  exitVelo: number;
  launchAngle: number;
  distance: number;
  result: string;
  hitType: string;
  horizAngle: number;
  points: number;
  user: string;
  batting: string;
  level: string;
}

export interface HitTraxSessionStats {
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
 * Parse HitTrax CSV text into structured rows
 * Handles leading spaces in column names (common in HitTrax exports)
 */
export function parseHitTraxCSV(csvText: string): HitTraxRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  // Parse headers and trim whitespace
  const headers = lines[0].split(',').map(h => h.trim());
  
  const rows: HitTraxRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    const rowData: Record<string, string> = {};
    
    headers.forEach((header, idx) => {
      rowData[header] = values[idx] || '';
    });
    
    rows.push({
      swingNumber: parseInt(rowData['#']) || i,
      atBat: parseInt(rowData['AB']) || 0,
      date: rowData['Date'] || '',
      timeStamp: rowData['Time Stamp'] || '',
      pitchSpeed: parseFloat(rowData['Pitch']) || 0,
      strikeZone: parseInt(rowData['Strike Zone']) || 0,
      pitchType: rowData['P. Type'] || '',
      exitVelo: parseFloat(rowData['Velo']) || 0,
      launchAngle: parseFloat(rowData['LA']) || 0,
      distance: parseFloat(rowData['Dist']) || 0,
      result: rowData['Res'] || '',
      hitType: rowData['Type'] || '',
      horizAngle: parseFloat(rowData['Horiz. Angle']) || 0,
      points: parseInt(rowData['Pts']) || 0,
      user: rowData['User'] || '',
      batting: rowData['Batting'] || '',
      level: rowData['Level'] || ''
    });
  }
  
  return rows;
}

/**
 * Check if a swing is a miss (swing and miss)
 */
export function isMiss(row: HitTraxRow): boolean {
  return row.exitVelo === 0 && !row.result;
}

/**
 * Check if a swing is a foul ball
 */
export function isFoul(row: HitTraxRow): boolean {
  return row.result.toLowerCase() === 'foul';
}

/**
 * Calculate Quality Hit Game points for a single swing
 */
export function calculateSwingPoints(row: HitTraxRow): number {
  // Miss = -5 points
  if (isMiss(row)) {
    return -5;
  }
  
  // Foul = 0 points
  if (isFoul(row)) {
    return 0;
  }
  
  let points = 0;
  const velo = row.exitVelo;
  const la = row.launchAngle;
  const result = row.result.toUpperCase();
  
  // Exit velocity scoring
  if (velo >= 100) points += 20;
  else if (velo >= 95) points += 15;
  else if (velo >= 90) points += 10;
  else if (velo >= 85) points += 5;
  else points += 2;
  
  // Launch angle scoring
  if (la >= 10 && la <= 25) points += 10;  // Optimal
  else if (la >= 8 && la <= 30) points += 5;  // Acceptable
  else if (la < 0) points -= 5;  // Negative LA ground ball
  
  // Result bonus
  if (result.includes('HR')) points += 25;
  else if (result.includes('3B')) points += 20;
  else if (result.includes('2B')) points += 15;
  else if (result.includes('1B')) points += 10;
  else if (row.hitType === 'LD') points += 5;
  
  return points;
}

/**
 * Convert points per swing to 20-80 scale Ball Score
 */
export function calculateBallScore(pointsPerSwing: number): number {
  if (pointsPerSwing >= 35) return 80;  // Plus-Plus
  if (pointsPerSwing >= 30) return 70;  // Plus
  if (pointsPerSwing >= 25) return 60;  // Above Average
  if (pointsPerSwing >= 20) return 55;  // Above Average
  if (pointsPerSwing >= 15) return 50;  // Average
  if (pointsPerSwing >= 10) return 45;  // Below Average
  if (pointsPerSwing >= 5) return 40;   // Fringe
  return 30;  // Poor
}

/**
 * Get grade label for a 20-80 score
 */
export function getBallScoreGrade(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 60) return 'Plus';
  if (score >= 55) return 'Above Average';
  if (score >= 50) return 'Average';
  if (score >= 45) return 'Below Average';
  if (score >= 40) return 'Fringe';
  return 'Poor';
}

/**
 * Process multiple HitTrax rows and calculate all session statistics
 */
export function calculateSessionStats(rows: HitTraxRow[]): HitTraxSessionStats {
  const totalSwings = rows.length;
  
  // Categorize swings
  const misses = rows.filter(isMiss).length;
  const fouls = rows.filter(isFoul).length;
  const ballsInPlay = rows.filter(r => !isMiss(r) && !isFoul(r));
  const ballsInPlayCount = ballsInPlay.length;
  
  // Contact rate
  const contactRate = totalSwings > 0 
    ? ((totalSwings - misses) / totalSwings) * 100 
    : 0;
  
  // Exit velocity stats (only for balls in play)
  const velos = ballsInPlay.map(r => r.exitVelo).filter(v => v > 0);
  const avgExitVelo = velos.length > 0 
    ? velos.reduce((a, b) => a + b, 0) / velos.length 
    : 0;
  const maxExitVelo = velos.length > 0 ? Math.max(...velos) : 0;
  const minExitVelo = velos.length > 0 ? Math.min(...velos) : 0;
  const velo90Plus = velos.filter(v => v >= 90).length;
  const velo95Plus = velos.filter(v => v >= 95).length;
  const velo100Plus = velos.filter(v => v >= 100).length;
  
  // Launch angle stats
  const launchAngles = ballsInPlay.map(r => r.launchAngle);
  const avgLaunchAngle = launchAngles.length > 0 
    ? launchAngles.reduce((a, b) => a + b, 0) / launchAngles.length 
    : 0;
  const optimalLaCount = launchAngles.filter(la => la >= 10 && la <= 25).length;
  const groundBallCount = launchAngles.filter(la => la < 10).length;
  const flyBallCount = launchAngles.filter(la => la > 25).length;
  
  // Distance stats
  const distances = ballsInPlay.map(r => r.distance).filter(d => d > 0);
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;
  const avgDistance = distances.length > 0 
    ? distances.reduce((a, b) => a + b, 0) / distances.length 
    : 0;
  
  // Quality metrics
  const qualityHits = ballsInPlay.filter(r => {
    const la = r.launchAngle;
    return la >= 10 && la <= 25;
  }).length;
  
  const barrelHits = ballsInPlay.filter(r => {
    const velo = r.exitVelo;
    const la = r.launchAngle;
    return velo >= 95 && la >= 10 && la <= 25;
  }).length;
  
  const qualityHitPct = ballsInPlayCount > 0 
    ? (qualityHits / ballsInPlayCount) * 100 
    : 0;
  const barrelPct = ballsInPlayCount > 0 
    ? (barrelHits / ballsInPlayCount) * 100 
    : 0;
  
  // Quality Hit Game scoring
  const totalPoints = rows.reduce((sum, row) => sum + calculateSwingPoints(row), 0);
  const pointsPerSwing = totalSwings > 0 ? totalPoints / totalSwings : 0;
  const ballScore = calculateBallScore(pointsPerSwing);
  
  // Results breakdown
  const resultsBreakdown: Record<string, number> = {};
  rows.forEach(row => {
    const result = row.result || 'Miss';
    resultsBreakdown[result] = (resultsBreakdown[result] || 0) + 1;
  });
  
  // Hit types breakdown
  const hitTypesBreakdown: Record<string, number> = {};
  ballsInPlay.forEach(row => {
    const hitType = row.hitType || 'Unknown';
    hitTypesBreakdown[hitType] = (hitTypesBreakdown[hitType] || 0) + 1;
  });
  
  return {
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
