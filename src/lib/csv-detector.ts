// CSV Type and Launch Monitor Brand Detection
// HARDENED: Content-based detection with filename hints

export type CsvType = 'launch-monitor' | 'reboot-ik' | 'reboot-me' | 'unknown';
export type LaunchMonitorBrand = 'hittrax' | 'trackman' | 'rapsodo' | 'flightscope' | 'diamond-kinetics' | 'generic';

export interface ColumnMap {
  exitVelo: string;
  launchAngle: string;
  distance: string;
  result?: string;
  hitType?: string;
  user?: string;
}

export interface DetectionResult {
  csvType: CsvType;
  brand?: LaunchMonitorBrand;
  columnMap?: ColumnMap;
  confidence: 'high' | 'medium' | 'low';
  debugInfo?: {
    matchedHeaders: string[];
    filename?: string;
    firstHeaders?: string[];
  };
}

// ============================================
// HEADER NORMALIZATION
// ============================================

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_\-\.]+/g, ' ')
    .replace(/[^\w\s#]/g, '');
}

function hasAnyAlias(normalizedHeaders: string[], aliases: string[]): boolean {
  return aliases.some(alias => {
    const normalized = normalizeHeader(alias);
    return normalizedHeaders.some(h => 
      h === normalized || h.includes(normalized) || normalized.includes(h)
    );
  });
}

function countMatchingAliases(normalizedHeaders: string[], aliases: string[]): number {
  let count = 0;
  for (const alias of aliases) {
    const normalized = normalizeHeader(alias);
    if (normalizedHeaders.some(h => h === normalized || h.includes(normalized))) {
      count++;
    }
  }
  return count;
}

function findMatchingHeader(headers: string[], aliases: string[]): string | undefined {
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const alias of aliases) {
      const aliasNorm = normalizeHeader(alias);
      if (normalized === aliasNorm || normalized.includes(aliasNorm)) {
        return header;
      }
    }
  }
  return undefined;
}

// ============================================
// REBOOT MOTION HEADER PATTERNS (STRICT)
// ============================================

// Reboot IK MUST have these biomechanics headers
const REBOOT_IK_HEADERS = [
  // Core rotation headers
  'pelvis_rot', 'pelvis rot', 'pelvisrot', 'pelvis rotation',
  'torso_rot', 'torso rot', 'torsorot', 'torso rotation',
  'thorax_rot', 'thorax rot', 'thoraxrot',
  
  // Time headers (reboot specific)
  'time_from_max_hand', 'time from max hand',
  'org_movement_id', 'org movement id', 'movement_id', 'movement id',
  
  // Angular/positional data
  'pelvis_tilt', 'pelvis tilt', 'pelvistilt',
  'pelvis_lateral', 'pelvis lateral',
  'torso_tilt', 'torso tilt', 'torsotilt',
  'torso_lateral', 'torso lateral',
  
  // Joint angles
  'left_shoulder_elev', 'left_shoulder elev', 'left shoulder elev',
  'right_shoulder_elev', 'right_shoulder elev', 'right shoulder elev',
  'left_shoulder_plane', 'left shoulder plane',
  'right_shoulder_plane', 'right shoulder plane',
  'left_elbow', 'left elbow', 'leftelbow',
  'right_elbow', 'right elbow', 'rightelbow',
  'left_hip_flex', 'left hip flex', 'left_hip_flexion',
  'right_hip_flex', 'right hip flex', 'right_hip_flexion',
  'left_knee', 'left knee', 'leftknee',
  'right_knee', 'right knee', 'rightknee',
  
  // Lead/trail terminology
  'lead_arm', 'lead arm', 'leadarm',
  'trail_arm', 'trail arm', 'trailarm',
  'lead_hip', 'lead hip', 'leadhip',
  'trail_hip', 'trail hip', 'trailhip',
  
  // Angular velocity columns (IK derived)
  'pelvis_angular_velocity', 'pelvis angular velocity',
  'torso_angular_velocity', 'torso angular velocity',
  'thorax_angular_velocity', 'thorax angular velocity'
];

// Reboot ME MUST have these energy/momentum headers
const REBOOT_ME_HEADERS = [
  // Kinetic energy columns
  'bat_kinetic_energy', 'bat kinetic energy', 'batkinetic energy',
  'torso_kinetic_energy', 'torso kinetic energy', 'torsokinetic energy',
  'arms_kinetic_energy', 'arms kinetic energy', 'armskinetic energy',
  'larm_kinetic_energy', 'larm kinetic energy',
  'rarm_kinetic_energy', 'rarm kinetic energy',
  'legs_kinetic_energy', 'legs kinetic energy', 'legskinetic energy',
  'total_kinetic_energy', 'total kinetic energy', 'totalkinetic energy',
  
  // Momentum columns
  'angular_momentum', 'angular momentum', 'angularmomentum',
  'bat_momentum', 'bat momentum',
  'torso_momentum', 'torso momentum',
  'pelvis_momentum', 'pelvis momentum',
  
  // Power columns
  'power', 'segment_power', 'segment power',
  'bat_power', 'bat power',
  'legs_power', 'legs power',
  
  // Work/energy transfer
  'work', 'energy_work', 'energy work',
  'energy_transfer', 'energy transfer',
  
  // Movement ID (also in IK)
  'org_movement_id', 'org movement id', 'movement_id', 'movement id',
  'time_from_max_hand', 'time from max hand'
];

// ============================================
// LAUNCH MONITOR HEADER PATTERNS
// ============================================

const EV_ALIASES = [
  'velo', 'exit velocity', 'exitvelocity', 'ev', 'ev (mph)', 'exit velo', 
  'exitvelo', 'exit_velocity', 'exit_velo', 'ball speed', 'ballspeed', 
  'ball_speed', 'exit speed', 'exitspeed', 'exit_speed'
];

const LA_ALIASES = [
  'la', 'launch angle', 'launchangle', 'angle', 'launch_angle',
  'vert angle', 'vertical angle', 'vert_angle', 'vla'
];

const DIST_ALIASES = [
  'dist', 'distance', 'carry', 'total distance', 'totaldistance',
  'total_distance', 'projected distance', 'proj dist', 'proj_dist'
];

// Launch monitor specific headers (NOT in biomechanics data)
const LM_SPECIFIC_HEADERS = [
  'res', 'result', 'outcome', 'play_result',
  'pts', 'points',
  'horiz angle', 'horiz. angle', 'spray angle', 'spray_angle',
  'pitch', 'pitch speed', 'pitch_speed',
  'strike zone', 'strikezone',
  'user', 'player', 'hitter', 'batter',
  'batting', 'bat side'
];

// ============================================
// FILENAME HINT PATTERNS
// ============================================

interface FilenameBias {
  pattern: RegExp;
  type: CsvType;
  strength: number; // 0-1
}

const FILENAME_BIASES: FilenameBias[] = [
  { pattern: /inverse[_\-\s]?kinematic/i, type: 'reboot-ik', strength: 0.9 },
  { pattern: /momentum[_\-\s]?energy/i, type: 'reboot-me', strength: 0.9 },
  { pattern: /reboot.*ik/i, type: 'reboot-ik', strength: 0.8 },
  { pattern: /reboot.*me/i, type: 'reboot-me', strength: 0.8 },
  { pattern: /rebootmotion/i, type: 'reboot-ik', strength: 0.5 }, // needs header confirmation
  { pattern: /hittrax/i, type: 'launch-monitor', strength: 0.7 },
  { pattern: /trackman/i, type: 'launch-monitor', strength: 0.7 },
  { pattern: /rapsodo/i, type: 'launch-monitor', strength: 0.7 },
  { pattern: /flightscope/i, type: 'launch-monitor', strength: 0.7 },
];

function getFilenameBias(filename: string): { type: CsvType; strength: number } | null {
  for (const bias of FILENAME_BIASES) {
    if (bias.pattern.test(filename)) {
      return { type: bias.type, strength: bias.strength };
    }
  }
  return null;
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Detect CSV type and launch monitor brand from headers
 * HARDENED: Uses header content analysis with filename hints
 */
export function detectCsvType(headers: string[], filename?: string): DetectionResult {
  const normalizedHeaders = headers.map(normalizeHeader);
  const matchedHeaders: string[] = [];
  
  // Get filename bias if available
  const filenameBias = filename ? getFilenameBias(filename) : null;
  
  // Count matches for each type
  const ikMatches = countMatchingAliases(normalizedHeaders, REBOOT_IK_HEADERS);
  const meMatches = countMatchingAliases(normalizedHeaders, REBOOT_ME_HEADERS);
  const evMatches = countMatchingAliases(normalizedHeaders, EV_ALIASES);
  const laMatches = countMatchingAliases(normalizedHeaders, LA_ALIASES);
  const lmSpecificMatches = countMatchingAliases(normalizedHeaders, LM_SPECIFIC_HEADERS);
  
  console.log(`CSV Detection - File: ${filename || 'unknown'}`);
  console.log(`  IK matches: ${ikMatches}, ME matches: ${meMatches}`);
  console.log(`  EV matches: ${evMatches}, LA matches: ${laMatches}, LM specific: ${lmSpecificMatches}`);
  console.log(`  Headers (first 10): ${headers.slice(0, 10).join(', ')}`);
  
  // ==========================================
  // REBOOT IK DETECTION (CHECK FIRST)
  // ==========================================
  // Strong IK indicators: pelvis_rot, torso_rot, org_movement_id, left/right elbow/knee
  const hasIKCore = normalizedHeaders.some(h => 
    h.includes('pelvis rot') || h.includes('pelvis_rot') ||
    h.includes('torso rot') || h.includes('torso_rot') ||
    h.includes('thorax rot') || h.includes('thorax_rot')
  );
  
  const hasMovementId = normalizedHeaders.some(h => 
    h.includes('org movement id') || h.includes('movement id') || h.includes('movement_id')
  );
  
  const hasJointAngles = normalizedHeaders.some(h =>
    h.includes('left elbow') || h.includes('right elbow') ||
    h.includes('left knee') || h.includes('right knee') ||
    h.includes('left_elbow') || h.includes('right_elbow') ||
    h.includes('left_knee') || h.includes('right_knee')
  );
  
  // Check for kinetic energy columns (ME specific)
  const hasKineticEnergy = normalizedHeaders.some(h =>
    h.includes('kinetic energy') || h.includes('kinetic_energy')
  );
  
  // If has IK core headers AND doesn't have kinetic energy => IK file
  if ((hasIKCore || hasJointAngles) && !hasKineticEnergy) {
    // This is likely IK
    const confidence = (ikMatches >= 5 || (hasIKCore && hasMovementId)) ? 'high' : 
                       (ikMatches >= 3) ? 'medium' : 'low';
    
    console.log(`  => Detected as REBOOT-IK (confidence: ${confidence})`);
    
    return {
      csvType: 'reboot-ik',
      confidence,
      debugInfo: {
        matchedHeaders: REBOOT_IK_HEADERS.filter(h => 
          normalizedHeaders.some(nh => nh.includes(normalizeHeader(h)))
        ).slice(0, 10),
        filename,
        firstHeaders: headers.slice(0, 10)
      }
    };
  }
  
  // ==========================================
  // REBOOT ME DETECTION
  // ==========================================
  if (hasKineticEnergy || meMatches >= 3) {
    const confidence = (meMatches >= 5 || hasKineticEnergy) ? 'high' : 
                       (meMatches >= 3) ? 'medium' : 'low';
    
    console.log(`  => Detected as REBOOT-ME (confidence: ${confidence})`);
    
    return {
      csvType: 'reboot-me',
      confidence,
      debugInfo: {
        matchedHeaders: REBOOT_ME_HEADERS.filter(h => 
          normalizedHeaders.some(nh => nh.includes(normalizeHeader(h)))
        ).slice(0, 10),
        filename,
        firstHeaders: headers.slice(0, 10)
      }
    };
  }
  
  // Filename bias for reboot (if header detection was inconclusive)
  if (filenameBias && (filenameBias.type === 'reboot-ik' || filenameBias.type === 'reboot-me')) {
    if (filenameBias.strength >= 0.8 && (ikMatches >= 2 || meMatches >= 2)) {
      console.log(`  => Detected as ${filenameBias.type} via filename bias`);
      
      return {
        csvType: filenameBias.type,
        confidence: 'medium',
        debugInfo: {
          matchedHeaders: [],
          filename,
          firstHeaders: headers.slice(0, 10)
        }
      };
    }
  }
  
  // ==========================================
  // LAUNCH MONITOR DETECTION
  // ==========================================
  // Must have EV AND LA columns to be a launch monitor
  const hasEV = evMatches >= 1;
  const hasLA = laMatches >= 1;
  
  if (hasEV && hasLA) {
    // Determine brand
    let brand: LaunchMonitorBrand = 'generic';
    
    // HitTrax specific - has 'Res' column for result
    if (hasAnyAlias(normalizedHeaders, ['res', 'pts', 'horiz angle'])) {
      brand = 'hittrax';
    }
    // Trackman - has ExitSpeed specifically
    else if (hasAnyAlias(normalizedHeaders, ['exit speed', 'exitspeed', 'exit_speed'])) {
      brand = 'trackman';
    }
    // FlightScope - has BallSpeed specifically
    else if (hasAnyAlias(normalizedHeaders, ['ball speed', 'ballspeed', 'ball_speed'])) {
      brand = 'flightscope';
    }
    // Rapsodo - has ExitVelo
    else if (hasAnyAlias(normalizedHeaders, ['exit velo', 'exitvelo', 'exit_velo'])) {
      brand = 'rapsodo';
    }
    // Diamond Kinetics
    else if (normalizedHeaders.some(h => h === 'exitvelocity' || h === 'exit velocity')) {
      brand = 'diamond-kinetics';
    }
    
    const confidence = (lmSpecificMatches >= 2) ? 'high' : 'medium';
    
    console.log(`  => Detected as LAUNCH-MONITOR (${brand}, confidence: ${confidence})`);
    
    return {
      csvType: 'launch-monitor',
      brand,
      confidence,
      columnMap: {
        exitVelo: findMatchingHeader(headers, EV_ALIASES) || 'Velo',
        launchAngle: findMatchingHeader(headers, LA_ALIASES) || 'LA',
        distance: findMatchingHeader(headers, DIST_ALIASES) || 'Dist',
        result: findMatchingHeader(headers, ['res', 'result', 'outcome']) || 'Res',
        hitType: findMatchingHeader(headers, ['type', 'hit type', 'hittype', 'bb type']) || 'Type',
        user: findMatchingHeader(headers, ['user', 'player', 'name', 'hitter']) || 'User'
      },
      debugInfo: {
        matchedHeaders: [],
        filename,
        firstHeaders: headers.slice(0, 10)
      }
    };
  }
  
  // ==========================================
  // UNKNOWN - provide debug info
  // ==========================================
  console.log(`  => UNKNOWN format`);
  
  return { 
    csvType: 'unknown',
    confidence: 'low',
    debugInfo: {
      matchedHeaders: [],
      filename,
      firstHeaders: headers.slice(0, 10)
    }
  };
}

/**
 * Parse CSV text into headers and rows
 */
export function parseCSV(csvText: string): { headers: string[]; rows: Record<string, any>[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVLine(line);
      const row: Record<string, any> = {};
      
      headers.forEach((header, idx) => {
        const val = (values[idx] || '').trim();
        const num = parseFloat(val);
        row[header] = isNaN(num) || val === '' ? val : num;
      });
      
      rows.push(row);
    } catch (e) {
      // Skip malformed rows
      console.warn(`Skipping malformed row ${i}`);
    }
  }
  
  return { headers, rows };
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
        i++;
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
 * Get display name for launch monitor brand
 */
export function getBrandDisplayName(brand: LaunchMonitorBrand): string {
  const names: Record<LaunchMonitorBrand, string> = {
    'hittrax': 'HitTrax',
    'trackman': 'Trackman',
    'rapsodo': 'Rapsodo',
    'flightscope': 'FlightScope',
    'diamond-kinetics': 'Diamond Kinetics',
    'generic': 'Launch Monitor'
  };
  return names[brand] || brand;
}

/**
 * Get display name for CSV type
 */
export function getCsvTypeDisplayName(csvType: CsvType): string {
  const names: Record<CsvType, string> = {
    'launch-monitor': 'Launch Monitor',
    'reboot-ik': 'Reboot Motion — Inverse Kinematics',
    'reboot-me': 'Reboot Motion — Momentum/Energy',
    'unknown': 'Unknown Format'
  };
  return names[csvType] || csvType;
}
