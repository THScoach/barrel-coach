// HitTrax CSV Parser and Quality Hit Game Scoring
// HARDENED for flexible column mapping and robust error handling

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
  
  // Parsing metadata
  validRowCount: number;
  skippedRowCount: number;
  parsingWarnings: string[];
}

// ============================================
// FLEXIBLE HEADER MAPPING (ALIASES)
// ============================================

const HEADER_ALIASES: Record<string, string[]> = {
  // Exit Velocity aliases
  exitVelo: [
    'velo', 'exit velocity', 'exitvelocity', 'ev', 'ev (mph)', 
    'exit velo', 'exitvelo', 'exit_velocity', 'exit_velo',
    'ball speed', 'ballspeed', 'ball_speed', 'exit speed', 'exitspeed'
  ],
  
  // Launch Angle aliases  
  launchAngle: [
    'la', 'launch angle', 'launchangle', 'angle', 'launch_angle',
    'vert angle', 'vertical angle', 'vert_angle', 'vla'
  ],
  
  // Distance aliases
  distance: [
    'dist', 'distance', 'carry', 'total distance', 'totaldistance',
    'total_distance', 'projected distance', 'proj dist', 'proj_dist'
  ],
  
  // Result aliases
  result: [
    'res', 'result', 'outcome', 'play result', 'playresult', 'play_result'
  ],
  
  // Hit Type aliases
  hitType: [
    'type', 'hit type', 'hittype', 'hit_type', 'bb type', 'bbtype', 'bb_type'
  ],
  
  // Horizontal Angle aliases
  horizAngle: [
    'horiz. angle', 'horiz angle', 'horizangle', 'horizontal angle', 
    'spray angle', 'sprayangle', 'spray_angle', 'horiz_angle', 'direction'
  ],
  
  // Pitch Speed aliases
  pitchSpeed: [
    'pitch', 'pitch speed', 'pitchspeed', 'pitch_speed', 'velo in', 'pitch velo'
  ],
  
  // Points aliases
  points: [
    'pts', 'points', 'score', 'pt'
  ],
  
  // Swing Number aliases
  swingNumber: [
    '#', 'swing', 'swing #', 'swing_number', 'swingnumber', 'num', 'number'
  ],
  
  // At Bat aliases
  atBat: [
    'ab', 'at bat', 'atbat', 'at_bat'
  ],
  
  // Date aliases
  date: [
    'date', 'session date', 'sessiondate', 'session_date'
  ],
  
  // Timestamp aliases
  timeStamp: [
    'time stamp', 'timestamp', 'time_stamp', 'time'
  ],
  
  // Strike Zone aliases
  strikeZone: [
    'strike zone', 'strikezone', 'strike_zone', 'zone'
  ],
  
  // Pitch Type aliases
  pitchType: [
    'p. type', 'ptype', 'p_type', 'pitch type', 'pitchtype', 'pitch_type'
  ],
  
  // User aliases
  user: [
    'user', 'player', 'name', 'hitter', 'batter'
  ],
  
  // Batting aliases
  batting: [
    'batting', 'bat side', 'batside', 'bat_side', 'side'
  ],
  
  // Level aliases
  level: [
    'level', 'difficulty', 'setting'
  ]
};

/**
 * Normalize a header string for matching
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_\-\.]+/g, ' ')  // Normalize separators
    .replace(/[^\w\s#]/g, '');     // Remove special chars except # and spaces
}

/**
 * Find the best matching column name from headers using aliases
 */
function findColumn(headers: string[], field: string): string | null {
  const aliases = HEADER_ALIASES[field] || [];
  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: normalizeHeader(h)
  }));
  
  // First try exact matches
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const match = normalizedHeaders.find(h => h.normalized === normalizedAlias);
    if (match) return match.original;
  }
  
  // Then try partial matches (contains)
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const match = normalizedHeaders.find(h => 
      h.normalized.includes(normalizedAlias) || normalizedAlias.includes(h.normalized)
    );
    if (match) return match.original;
  }
  
  return null;
}

/**
 * Build a column map from the CSV headers
 */
function buildColumnMap(headers: string[]): Record<string, string | null> {
  const columnMap: Record<string, string | null> = {};
  
  for (const field of Object.keys(HEADER_ALIASES)) {
    columnMap[field] = findColumn(headers, field);
  }
  
  return columnMap;
}

/**
 * Safely parse a numeric value with fallback
 */
function safeParseFloat(value: string | undefined | null, fallback: number = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  
  // Remove common units/suffixes
  const cleaned = value
    .toString()
    .replace(/[^\d.\-]/g, '')  // Keep only digits, decimal, minus
    .trim();
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

/**
 * Safely parse an integer value with fallback
 */
function safeParseInt(value: string | undefined | null, fallback: number = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  
  const cleaned = value.toString().replace(/[^\d\-]/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? fallback : num;
}

/**
 * Check if a row has minimum required data (at least EV or LA)
 */
function hasMinimumData(rowData: Record<string, string>, columnMap: Record<string, string | null>): boolean {
  const evCol = columnMap.exitVelo;
  const laCol = columnMap.launchAngle;
  
  const hasEV = evCol && rowData[evCol] !== undefined && rowData[evCol] !== '';
  const hasLA = laCol && rowData[laCol] !== undefined && rowData[laCol] !== '';
  
  return hasEV || hasLA;
}

/**
 * Parse HitTrax CSV text into structured rows
 * HARDENED: Flexible header mapping, skips bad rows, never fails completely
 */
export function parseHitTraxCSV(csvText: string): HitTraxRow[] {
  const warnings: string[] = [];
  
  try {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      console.warn('HitTrax CSV: No data rows found');
      return [];
    }
    
    // Parse headers and trim whitespace
    const headers = lines[0].split(',').map(h => h.trim());
    const columnMap = buildColumnMap(headers);
    
    // Log detected columns for debugging
    console.log('HitTrax CSV: Detected columns:', columnMap);
    
    // Check for critical columns (EV and LA)
    if (!columnMap.exitVelo && !columnMap.launchAngle) {
      console.warn('HitTrax CSV: Could not find Exit Velocity or Launch Angle columns');
      console.warn('Available headers:', headers);
    }
    
    const rows: HitTraxRow[] = [];
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        skippedCount++;
        continue;
      }
      
      try {
        // Handle quoted CSV values properly
        const values = parseCSVLine(line);
        const rowData: Record<string, string> = {};
        
        headers.forEach((header, idx) => {
          rowData[header] = (values[idx] || '').trim();
        });
        
        // Skip rows without minimum required data
        if (!hasMinimumData(rowData, columnMap)) {
          skippedCount++;
          continue;
        }
        
        const getValue = (field: string): string => {
          const col = columnMap[field];
          return col ? rowData[col] || '' : '';
        };
        
        rows.push({
          swingNumber: safeParseInt(getValue('swingNumber')) || i,
          atBat: safeParseInt(getValue('atBat')),
          date: getValue('date'),
          timeStamp: getValue('timeStamp'),
          pitchSpeed: safeParseFloat(getValue('pitchSpeed')),
          strikeZone: safeParseInt(getValue('strikeZone')),
          pitchType: getValue('pitchType'),
          exitVelo: safeParseFloat(getValue('exitVelo')),
          launchAngle: safeParseFloat(getValue('launchAngle')),
          distance: safeParseFloat(getValue('distance')),
          result: getValue('result'),
          hitType: getValue('hitType'),
          horizAngle: safeParseFloat(getValue('horizAngle')),
          points: safeParseInt(getValue('points')),
          user: getValue('user'),
          batting: getValue('batting'),
          level: getValue('level')
        });
      } catch (rowError) {
        console.warn(`HitTrax CSV: Error parsing row ${i}:`, rowError);
        skippedCount++;
      }
    }
    
    if (skippedCount > 0) {
      console.log(`HitTrax CSV: Skipped ${skippedCount} invalid/empty rows`);
    }
    
    return rows;
  } catch (error) {
    console.error('HitTrax CSV: Critical parsing error:', error);
    return [];
  }
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Check if a swing is a miss (swing and miss)
 */
export function isMiss(row: HitTraxRow): boolean {
  // Miss if EV is 0 and no result OR result indicates miss
  const resultLower = (row.result || '').toLowerCase();
  return (
    row.exitVelo === 0 && 
    (!row.result || resultLower.includes('miss') || resultLower.includes('whiff'))
  );
}

/**
 * Check if a swing is a foul ball
 */
export function isFoul(row: HitTraxRow): boolean {
  const resultLower = (row.result || '').toLowerCase();
  return resultLower === 'foul' || resultLower.includes('foul');
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
  const result = (row.result || '').toUpperCase();
  
  // Exit velocity scoring
  if (velo >= 100) points += 20;
  else if (velo >= 95) points += 15;
  else if (velo >= 90) points += 10;
  else if (velo >= 85) points += 5;
  else if (velo > 0) points += 2;
  
  // Launch angle scoring
  if (la >= 10 && la <= 25) points += 10;  // Optimal
  else if (la >= 8 && la <= 30) points += 5;  // Acceptable
  else if (la < 0) points -= 5;  // Negative LA ground ball
  
  // Result bonus
  if (result.includes('HR') || result.includes('HOME')) points += 25;
  else if (result.includes('3B') || result.includes('TRIPLE')) points += 20;
  else if (result.includes('2B') || result.includes('DOUBLE')) points += 15;
  else if (result.includes('1B') || result.includes('SINGLE')) points += 10;
  else if (row.hitType === 'LD' || (row.hitType || '').toLowerCase().includes('line')) points += 5;
  
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
 * HARDENED: Never fails, returns valid stats even with partial data
 */
export function calculateSessionStats(rows: HitTraxRow[]): HitTraxSessionStats {
  // Handle empty input
  if (!rows || rows.length === 0) {
    return createEmptyStats();
  }
  
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
  
  // Exit velocity stats (only for balls in play with valid velo)
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
  const validLAs = launchAngles.filter(la => la !== 0 || launchAngles.every(l => l === 0));
  const avgLaunchAngle = validLAs.length > 0 
    ? validLAs.reduce((a, b) => a + b, 0) / validLAs.length 
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
    const result = row.result || (isMiss(row) ? 'Miss' : 'Unknown');
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
    hitTypesBreakdown,
    
    // Parsing metadata
    validRowCount: rows.length,
    skippedRowCount: 0,
    parsingWarnings: []
  };
}

/**
 * Create empty stats object for error cases
 */
function createEmptyStats(): HitTraxSessionStats {
  return {
    totalSwings: 0,
    misses: 0,
    fouls: 0,
    ballsInPlay: 0,
    contactRate: 0,
    avgExitVelo: 0,
    maxExitVelo: 0,
    minExitVelo: 0,
    velo90Plus: 0,
    velo95Plus: 0,
    velo100Plus: 0,
    avgLaunchAngle: 0,
    optimalLaCount: 0,
    groundBallCount: 0,
    flyBallCount: 0,
    maxDistance: 0,
    avgDistance: 0,
    qualityHits: 0,
    barrelHits: 0,
    qualityHitPct: 0,
    barrelPct: 0,
    totalPoints: 0,
    pointsPerSwing: 0,
    ballScore: 30,
    resultsBreakdown: {},
    hitTypesBreakdown: {},
    validRowCount: 0,
    skippedRowCount: 0,
    parsingWarnings: ['No valid data found']
  };
}

/**
 * Validate if CSV text appears to be HitTrax data
 */
export function validateHitTraxCSV(csvText: string): { valid: boolean; reason?: string; detectedColumns?: Record<string, string | null> } {
  try {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return { valid: false, reason: 'No data rows found' };
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const columnMap = buildColumnMap(headers);
    
    // Need at least EV or LA to be valid
    if (!columnMap.exitVelo && !columnMap.launchAngle) {
      return { 
        valid: false, 
        reason: 'Could not detect Exit Velocity or Launch Angle columns',
        detectedColumns: columnMap
      };
    }
    
    return { valid: true, detectedColumns: columnMap };
  } catch (error) {
    return { valid: false, reason: `Parse error: ${error}` };
  }
}
