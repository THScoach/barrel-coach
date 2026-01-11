// CSV Type and Launch Monitor Brand Detection

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
}

/**
 * Normalize a header string for matching
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\s_\-\.]+/g, ' ')
    .replace(/[^\w\s#]/g, '');
}

/**
 * Check if headers contain any of the given aliases
 */
function hasAnyAlias(normalizedHeaders: string[], aliases: string[]): boolean {
  return aliases.some(alias => {
    const normalized = normalizeHeader(alias);
    return normalizedHeaders.some(h => 
      h === normalized || h.includes(normalized) || normalized.includes(h)
    );
  });
}

/**
 * Find a matching header from aliases
 */
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

// Exit Velocity aliases for all brands
const EV_ALIASES = [
  'velo', 'exit velocity', 'exitvelocity', 'ev', 'ev (mph)', 'exit velo', 
  'exitvelo', 'exit_velocity', 'exit_velo', 'ball speed', 'ballspeed', 
  'ball_speed', 'exit speed', 'exitspeed', 'exit_speed'
];

// Launch Angle aliases for all brands
const LA_ALIASES = [
  'la', 'launch angle', 'launchangle', 'angle', 'launch_angle',
  'vert angle', 'vertical angle', 'vert_angle', 'vla'
];

// Distance aliases
const DIST_ALIASES = [
  'dist', 'distance', 'carry', 'total distance', 'totaldistance',
  'total_distance', 'projected distance', 'proj dist', 'proj_dist'
];

/**
 * Detect CSV type and launch monitor brand from headers
 * HARDENED: Uses flexible header matching with aliases
 */
export function detectCsvType(headers: string[]): DetectionResult {
  const h = headers.map(x => normalizeHeader(x));
  
  // ===================
  // REBOOT MOTION DETECTION (check first - very specific headers)
  // ===================
  
  // Reboot Inverse Kinematics
  const rebootIkAliases = ['left_shoulder_plane', 'torso_rot', 'pelvis_rot', 'left_hip_flex', 
    'right_shoulder_elev', 'pelvis_tilt', 'left_knee', 'right_knee'];
  if (hasAnyAlias(h, rebootIkAliases)) {
    return { csvType: 'reboot-ik' };
  }
  
  // Reboot Momentum Energy
  const rebootMeAliases = ['total_kinetic_energy', 'bat_kinetic_energy', 'torso_kinetic_energy',
    'larm_kinetic_energy', 'rarm_kinetic_energy', 'legs_kinetic_energy'];
  if (hasAnyAlias(h, rebootMeAliases) || h.some(x => x.endsWith('kinetic energy'))) {
    return { csvType: 'reboot-me' };
  }
  
  // ===================
  // LAUNCH MONITOR DETECTION
  // ===================
  
  // HitTrax specific - has 'Res' column for result
  const hittraxSpecific = ['res', 'pts', 'horiz angle'];
  if (hasAnyAlias(h, hittraxSpecific) && hasAnyAlias(h, EV_ALIASES)) {
    return {
      csvType: 'launch-monitor',
      brand: 'hittrax',
      columnMap: {
        exitVelo: findMatchingHeader(headers, EV_ALIASES) || 'Velo',
        launchAngle: findMatchingHeader(headers, LA_ALIASES) || 'LA',
        distance: findMatchingHeader(headers, DIST_ALIASES) || 'Dist',
        result: findMatchingHeader(headers, ['res', 'result', 'outcome']) || 'Res',
        hitType: findMatchingHeader(headers, ['type', 'hit type', 'hittype', 'bb type']) || 'Type',
        user: findMatchingHeader(headers, ['user', 'player', 'name', 'hitter']) || 'User'
      }
    };
  }
  
  // Trackman - has ExitSpeed specifically
  if (hasAnyAlias(h, ['exit speed', 'exitspeed', 'exit_speed'])) {
    return {
      csvType: 'launch-monitor',
      brand: 'trackman',
      columnMap: {
        exitVelo: findMatchingHeader(headers, ['exit speed', 'exitspeed', 'exit_speed']) || 'ExitSpeed',
        launchAngle: findMatchingHeader(headers, LA_ALIASES) || 'LaunchAngle',
        distance: findMatchingHeader(headers, DIST_ALIASES) || 'Distance'
      }
    };
  }
  
  // FlightScope - has BallSpeed and VLA specifically
  if (hasAnyAlias(h, ['ball speed', 'ballspeed', 'ball_speed'])) {
    return {
      csvType: 'launch-monitor',
      brand: 'flightscope',
      columnMap: {
        exitVelo: findMatchingHeader(headers, ['ball speed', 'ballspeed', 'ball_speed']) || 'BallSpeed',
        launchAngle: findMatchingHeader(headers, ['vla', ...LA_ALIASES]) || 'VLA',
        distance: findMatchingHeader(headers, ['carry', ...DIST_ALIASES]) || 'Carry'
      }
    };
  }
  
  // Diamond Kinetics - has ExitVelocity (two words camelcase)
  if (h.some(x => x === 'exitvelocity' || x === 'exit velocity')) {
    return {
      csvType: 'launch-monitor',
      brand: 'diamond-kinetics',
      columnMap: {
        exitVelo: findMatchingHeader(headers, ['exitvelocity', 'exit velocity']) || 'ExitVelocity',
        launchAngle: findMatchingHeader(headers, LA_ALIASES) || 'LaunchAngle',
        distance: findMatchingHeader(headers, DIST_ALIASES) || 'Distance'
      }
    };
  }
  
  // Rapsodo - has ExitVelo
  if (hasAnyAlias(h, ['exit velo', 'exitvelo', 'exit_velo'])) {
    return {
      csvType: 'launch-monitor',
      brand: 'rapsodo',
      columnMap: {
        exitVelo: findMatchingHeader(headers, ['exit velo', 'exitvelo', 'exit_velo']) || 'ExitVelo',
        launchAngle: findMatchingHeader(headers, LA_ALIASES) || 'LA',
        distance: findMatchingHeader(headers, DIST_ALIASES) || 'Dist'
      }
    };
  }
  
  // Generic launch monitor - look for any velocity + angle patterns
  if (hasAnyAlias(h, EV_ALIASES) && hasAnyAlias(h, LA_ALIASES)) {
    return {
      csvType: 'launch-monitor',
      brand: 'generic',
      columnMap: {
        exitVelo: findMatchingHeader(headers, EV_ALIASES) || '',
        launchAngle: findMatchingHeader(headers, LA_ALIASES) || '',
        distance: findMatchingHeader(headers, DIST_ALIASES) || ''
      }
    };
  }
  
  return { csvType: 'unknown' };
}

/**
 * Parse CSV text into headers and rows
 */
export function parseCSV(csvText: string): { headers: string[]; rows: Record<string, any>[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, any> = {};
    
    headers.forEach((header, idx) => {
      const val = values[idx] || '';
      const num = parseFloat(val);
      row[header] = isNaN(num) || val === '' ? val : num;
    });
    
    rows.push(row);
  }
  
  return { headers, rows };
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
