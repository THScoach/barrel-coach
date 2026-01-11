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
 * Detect CSV type and launch monitor brand from headers
 */
export function detectCsvType(headers: string[]): DetectionResult {
  const h = headers.map(x => x.trim().toLowerCase());
  
  // ===================
  // LAUNCH MONITOR DETECTION
  // ===================
  
  // HitTrax - has Velo, LA, Dist, Res columns
  if (h.includes('velo') && h.includes('la') && h.includes('dist')) {
    return {
      csvType: 'launch-monitor',
      brand: 'hittrax',
      columnMap: {
        exitVelo: 'Velo',
        launchAngle: 'LA',
        distance: 'Dist',
        result: 'Res',
        hitType: 'Type',
        user: 'User'
      }
    };
  }
  
  // Trackman - has ExitSpeed, LaunchAngle
  if (h.includes('exitspeed') || h.includes('exit speed') || h.includes('exit_speed')) {
    return {
      csvType: 'launch-monitor',
      brand: 'trackman',
      columnMap: {
        exitVelo: h.find(x => x.includes('exitspeed') || x.includes('exit speed') || x.includes('exit_speed')) || 'ExitSpeed',
        launchAngle: h.find(x => x.includes('launchangle') || x.includes('launch angle') || x.includes('launch_angle')) || 'LaunchAngle',
        distance: h.find(x => x.includes('distance') || x.includes('carry')) || 'Distance'
      }
    };
  }
  
  // Rapsodo - has ExitVelo (note different from Trackman's ExitSpeed)
  if (h.includes('exitvelo') || h.includes('exit velo') || h.includes('exit_velo')) {
    return {
      csvType: 'launch-monitor',
      brand: 'rapsodo',
      columnMap: {
        exitVelo: 'ExitVelo',
        launchAngle: 'LA',
        distance: 'Dist'
      }
    };
  }
  
  // FlightScope - has BallSpeed, VLA
  if (h.includes('ballspeed') || h.includes('ball speed') || h.includes('vla')) {
    return {
      csvType: 'launch-monitor',
      brand: 'flightscope',
      columnMap: {
        exitVelo: h.find(x => x.includes('ballspeed') || x.includes('ball speed')) || 'BallSpeed',
        launchAngle: h.find(x => x.includes('vla') || x.includes('launch')) || 'VLA',
        distance: h.find(x => x.includes('carry') || x.includes('distance')) || 'Carry'
      }
    };
  }
  
  // Diamond Kinetics
  if (h.includes('exitvelocity') || h.includes('exit velocity')) {
    return {
      csvType: 'launch-monitor',
      brand: 'diamond-kinetics',
      columnMap: {
        exitVelo: 'ExitVelocity',
        launchAngle: 'LaunchAngle',
        distance: 'Distance'
      }
    };
  }
  
  // Generic launch monitor - look for velocity/speed + angle patterns
  const hasVeloColumn = h.some(x => x.includes('velo') || x.includes('speed') || x.includes('ev'));
  const hasAngleColumn = h.some(x => x.includes('angle') || x.includes('la'));
  if (hasVeloColumn && hasAngleColumn) {
    return {
      csvType: 'launch-monitor',
      brand: 'generic',
      columnMap: {
        exitVelo: headers.find(x => x.toLowerCase().includes('velo') || x.toLowerCase().includes('speed')) || '',
        launchAngle: headers.find(x => x.toLowerCase().includes('angle') || x.toLowerCase() === 'la') || '',
        distance: headers.find(x => x.toLowerCase().includes('dist') || x.toLowerCase().includes('carry')) || ''
      }
    };
  }
  
  // ===================
  // REBOOT MOTION DETECTION
  // ===================
  
  // Reboot Inverse Kinematics - unique headers: left_shoulder_plane, torso_rot, pelvis_rot, left_hip_flex
  if (
    h.includes('left_shoulder_plane') || 
    h.includes('torso_rot') || 
    h.includes('pelvis_rot') ||
    h.includes('left_hip_flex') ||
    h.includes('right_shoulder_elev') ||
    h.includes('pelvis_tilt') ||
    h.includes('left_knee') ||
    h.includes('right_knee')
  ) {
    return { csvType: 'reboot-ik' };
  }
  
  // Reboot Momentum Energy - unique headers: total_kinetic_energy, bat_kinetic_energy, torso_kinetic_energy
  if (
    h.includes('total_kinetic_energy') || 
    h.includes('bat_kinetic_energy') || 
    h.includes('torso_kinetic_energy') ||
    h.includes('larm_kinetic_energy') ||
    h.includes('rarm_kinetic_energy') ||
    h.includes('legs_kinetic_energy') ||
    h.some(x => x.endsWith('_kinetic_energy'))
  ) {
    return { csvType: 'reboot-me' };
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
