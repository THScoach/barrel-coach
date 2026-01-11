// Reboot Motion CSV Parser and 4B Score Calculator (Brain/Body/Bat)

export interface RebootScores {
  brainScore: number;
  bodyScore: number;
  batScore: number;
  compositeScore: number;
  grade: string;
  
  groundFlowScore: number;
  coreFlowScore: number;
  upperFlowScore: number;
  
  pelvisVelocity: number;
  torsoVelocity: number;
  xFactor: number;
  batKE: number;
  transferEfficiency: number;
  consistencyCV: number;
  consistencyGrade: string;
  
  weakestLink: 'brain' | 'body' | 'bat';
  
  // IK Metrics
  ikMetrics?: RebootIKMetrics;
  // ME Metrics
  meMetrics?: RebootMEMetrics;
  // Swing count
  swingCount?: number;
}

// Inverse Kinematics metrics per session
export interface RebootIKMetrics {
  avgPelvisRot: number;
  avgTorsoRot: number;
  avgXFactor: number;
  avgLeadHipFlex: number;
  avgLeadKneeFlex: number;
  avgLeadShoulderElev: number;
  avgRearShoulderElev: number;
  swingCount: number;
}

// Momentum Energy metrics per session
export interface RebootMEMetrics {
  avgTotalEnergy: number;
  avgBatEnergy: number;
  avgTorsoEnergy: number;
  avgArmsEnergy: number;
  avgLegsEnergy: number;
  avgEnergyEfficiency: number;
  swingCount: number;
}

// Thresholds for 20-80 scale conversion
const THRESHOLDS = {
  pelvis_velocity: { min: 400, max: 900 },
  torso_velocity: { min: 400, max: 900 },
  x_factor: { min: 10, max: 45 },
  stretch_rate: { min: 400, max: 1200 },
  bat_ke: { min: 100, max: 600 },
  legs_ke: { min: 100, max: 500 },
  bat_efficiency: { min: 25, max: 65 },
  consistency_cv: { min: 5, max: 40 },
};

/**
 * Convert a raw value to the 20-80 scouting scale
 */
function to2080Scale(value: number, min: number, max: number, invert = false): number {
  let normalized = (value - min) / (max - min);
  if (invert) normalized = 1 - normalized;
  normalized = Math.max(0, Math.min(1, normalized));
  return Math.round(20 + normalized * 60);
}

/**
 * Get grade label for a 20-80 score
 */
export function getGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 45) return "Average";
  if (score >= 40) return "Below Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

/**
 * Get consistency grade based on CV
 */
export function getConsistencyGrade(cv: number): string {
  if (cv < 6) return "Elite";
  if (cv < 10) return "Plus";
  if (cv < 15) return "Average";
  if (cv < 20) return "Below Avg";
  return "Poor";
}

/**
 * Calculate angular velocity from angle data
 */
function calculateAngularVelocity(angles: number[], dt: number = 0.008333): number[] {
  const velocities: number[] = [];
  for (let i = 1; i < angles.length; i++) {
    velocities.push((angles[i] - angles[i - 1]) / dt);
  }
  return velocities;
}

/**
 * Calculate mean of array
 */
function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Calculate standard deviation
 */
function std(arr: number[]): number {
  if (!arr.length) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length);
}

/**
 * Calculate coefficient of variation
 */
function coefficientOfVariation(arr: number[]): number {
  const m = mean(arr);
  return m === 0 ? 0 : (std(arr) / Math.abs(m)) * 100;
}

/**
 * Find column value with flexible matching
 */
function findColumn(row: Record<string, any>, patterns: string[]): number | null {
  for (const key of Object.keys(row)) {
    const lowerKey = key.toLowerCase();
    if (patterns.some(p => lowerKey.includes(p))) {
      const val = parseFloat(row[key]);
      return isNaN(val) ? null : val;
    }
  }
  return null;
}

/**
 * Group array by key
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key] ?? 'unknown');
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Process Reboot IK data and extract key metrics per swing
 */
export function processRebootIK(ikData: Record<string, any>[]): RebootIKMetrics {
  // Group rows by movement_id (each swing has a unique movement_id)
  const swings = groupBy(ikData, 'movement_id' as keyof Record<string, any>);
  
  const processedSwings: {
    pelvisRotMax: number;
    torsoRotMax: number;
    xFactorMax: number;
    leadHipFlexMax: number;
    leadKneeFlexMax: number;
    leadShoulderElevMax: number;
    rearShoulderElevMax: number;
  }[] = [];
  
  for (const [movementId, rows] of Object.entries(swings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown') continue;
    
    // Find max values across the swing
    const pelvisRotValues = rows.map(r => Math.abs(parseFloat(r.pelvis_rot) || 0));
    const torsoRotValues = rows.map(r => Math.abs(parseFloat(r.torso_rot) || 0));
    
    // Calculate X-Factor (torso - pelvis separation)
    const xFactorValues = rows.map(r => 
      Math.abs((parseFloat(r.torso_rot) || 0) - (parseFloat(r.pelvis_rot) || 0))
    );
    
    const leadHipFlexValues = rows.map(r => Math.abs(parseFloat(r.left_hip_flex) || 0));
    const leadKneeFlexValues = rows.map(r => Math.abs(parseFloat(r.left_knee) || 0));
    const leadShoulderElevValues = rows.map(r => Math.abs(parseFloat(r.left_shoulder_elev) || 0));
    const rearShoulderElevValues = rows.map(r => Math.abs(parseFloat(r.right_shoulder_elev) || 0));
    
    processedSwings.push({
      pelvisRotMax: Math.max(...pelvisRotValues, 0),
      torsoRotMax: Math.max(...torsoRotValues, 0),
      xFactorMax: Math.max(...xFactorValues, 0),
      leadHipFlexMax: Math.max(...leadHipFlexValues, 0),
      leadKneeFlexMax: Math.max(...leadKneeFlexValues, 0),
      leadShoulderElevMax: Math.max(...leadShoulderElevValues, 0),
      rearShoulderElevMax: Math.max(...rearShoulderElevValues, 0),
    });
  }
  
  // If no swing groupings found, process all data as one swing
  if (processedSwings.length === 0 && ikData.length > 0) {
    const pelvisRotValues = ikData.map(r => Math.abs(parseFloat(r.pelvis_rot) || 0));
    const torsoRotValues = ikData.map(r => Math.abs(parseFloat(r.torso_rot) || 0));
    const xFactorValues = ikData.map(r => 
      Math.abs((parseFloat(r.torso_rot) || 0) - (parseFloat(r.pelvis_rot) || 0))
    );
    
    processedSwings.push({
      pelvisRotMax: Math.max(...pelvisRotValues, 0),
      torsoRotMax: Math.max(...torsoRotValues, 0),
      xFactorMax: Math.max(...xFactorValues, 0),
      leadHipFlexMax: Math.max(...ikData.map(r => Math.abs(parseFloat(r.left_hip_flex) || 0)), 0),
      leadKneeFlexMax: Math.max(...ikData.map(r => Math.abs(parseFloat(r.left_knee) || 0)), 0),
      leadShoulderElevMax: Math.max(...ikData.map(r => Math.abs(parseFloat(r.left_shoulder_elev) || 0)), 0),
      rearShoulderElevMax: Math.max(...ikData.map(r => Math.abs(parseFloat(r.right_shoulder_elev) || 0)), 0),
    });
  }
  
  return {
    avgPelvisRot: mean(processedSwings.map(s => s.pelvisRotMax)),
    avgTorsoRot: mean(processedSwings.map(s => s.torsoRotMax)),
    avgXFactor: mean(processedSwings.map(s => s.xFactorMax)),
    avgLeadHipFlex: mean(processedSwings.map(s => s.leadHipFlexMax)),
    avgLeadKneeFlex: mean(processedSwings.map(s => s.leadKneeFlexMax)),
    avgLeadShoulderElev: mean(processedSwings.map(s => s.leadShoulderElevMax)),
    avgRearShoulderElev: mean(processedSwings.map(s => s.rearShoulderElevMax)),
    swingCount: processedSwings.length,
  };
}

/**
 * Process Reboot ME data and extract key metrics per swing
 */
export function processRebootME(meData: Record<string, any>[]): RebootMEMetrics {
  // Group rows by movement_id
  const swings = groupBy(meData, 'movement_id' as keyof Record<string, any>);
  
  const processedSwings: {
    totalKEMax: number;
    batKEMax: number;
    torsoKEMax: number;
    armsKEMax: number;
    legsKEMax: number;
    energyEfficiency: number;
  }[] = [];
  
  for (const [movementId, rows] of Object.entries(swings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown') continue;
    
    // Find max kinetic energies
    const totalKE = rows.map(r => parseFloat(r.total_kinetic_energy) || 0);
    const batKE = rows.map(r => parseFloat(r.bat_kinetic_energy) || 0);
    const torsoKE = rows.map(r => parseFloat(r.torso_kinetic_energy) || 0);
    const larmsKE = rows.map(r => parseFloat(r.larm_kinetic_energy) || 0);
    const rarmsKE = rows.map(r => parseFloat(r.rarm_kinetic_energy) || 0);
    const legsKE = rows.map(r => parseFloat(r.legs_kinetic_energy) || 0);
    
    const totalMax = Math.max(...totalKE, 1); // Avoid division by zero
    const batMax = Math.max(...batKE, 0);
    const armsMax = Math.max(...larmsKE, 0) + Math.max(...rarmsKE, 0);
    
    processedSwings.push({
      totalKEMax: totalMax,
      batKEMax: batMax,
      torsoKEMax: Math.max(...torsoKE, 0),
      armsKEMax: armsMax,
      legsKEMax: Math.max(...legsKE, 0),
      energyEfficiency: totalMax > 0 ? (batMax / totalMax) * 100 : 0,
    });
  }
  
  // If no swing groupings found, process all data as one swing
  if (processedSwings.length === 0 && meData.length > 0) {
    const totalKE = meData.map(r => parseFloat(r.total_kinetic_energy) || 0);
    const batKE = meData.map(r => parseFloat(r.bat_kinetic_energy) || 0);
    const totalMax = Math.max(...totalKE, 1);
    const batMax = Math.max(...batKE, 0);
    
    processedSwings.push({
      totalKEMax: totalMax,
      batKEMax: batMax,
      torsoKEMax: Math.max(...meData.map(r => parseFloat(r.torso_kinetic_energy) || 0), 0),
      armsKEMax: Math.max(...meData.map(r => parseFloat(r.larm_kinetic_energy) || 0), 0) +
                 Math.max(...meData.map(r => parseFloat(r.rarm_kinetic_energy) || 0), 0),
      legsKEMax: Math.max(...meData.map(r => parseFloat(r.legs_kinetic_energy) || 0), 0),
      energyEfficiency: totalMax > 0 ? (batMax / totalMax) * 100 : 0,
    });
  }
  
  return {
    avgTotalEnergy: mean(processedSwings.map(s => s.totalKEMax)),
    avgBatEnergy: mean(processedSwings.map(s => s.batKEMax)),
    avgTorsoEnergy: mean(processedSwings.map(s => s.torsoKEMax)),
    avgArmsEnergy: mean(processedSwings.map(s => s.armsKEMax)),
    avgLegsEnergy: mean(processedSwings.map(s => s.legsKEMax)),
    avgEnergyEfficiency: mean(processedSwings.map(s => s.energyEfficiency)),
    swingCount: processedSwings.length,
  };
}

/**
 * Calculate Reboot Motion 4B scores from IK and ME data
 */
export function calculateRebootScores(
  ikData: Record<string, any>[],
  meData: Record<string, any>[]
): RebootScores {
  // Process extracted metrics
  const ikMetrics = ikData.length > 0 ? processRebootIK(ikData) : undefined;
  const meMetrics = meData.length > 0 ? processRebootME(meData) : undefined;
  
  // Extract rotation data from IK
  const pelvisRotations: number[] = [];
  const torsoRotations: number[] = [];
  
  for (const row of ikData) {
    const pelvis = findColumn(row, ['pelvis_rot', 'pelvis_rotation', 'hip_rot']);
    const torso = findColumn(row, ['torso_rot', 'torso_rotation', 'trunk_rot']);
    
    if (pelvis !== null) pelvisRotations.push(pelvis * (180 / Math.PI));
    if (torso !== null) torsoRotations.push(torso * (180 / Math.PI));
  }
  
  // Calculate velocities
  const pelvisVelocities = calculateAngularVelocity(pelvisRotations);
  const torsoVelocities = calculateAngularVelocity(torsoRotations);
  
  const pelvisPeakVel = pelvisVelocities.length ? Math.max(...pelvisVelocities.map(Math.abs)) : 0;
  const torsoPeakVel = torsoVelocities.length ? Math.max(...torsoVelocities.map(Math.abs)) : 0;
  
  // X-Factor
  const xFactors: number[] = [];
  for (let i = 0; i < Math.min(pelvisRotations.length, torsoRotations.length); i++) {
    xFactors.push(Math.abs(pelvisRotations[i] - torsoRotations[i]));
  }
  const xFactorMax = xFactors.length ? Math.max(...xFactors) : (ikMetrics?.avgXFactor || 0);
  
  // Stretch rate
  const xFactorVelocities = calculateAngularVelocity(xFactors);
  const stretchRate = xFactorVelocities.length ? Math.max(...xFactorVelocities.map(Math.abs)) : 0;
  
  // Extract energy data from ME
  let batKEMax = meMetrics?.avgBatEnergy || 0;
  let legsKEMax = meMetrics?.avgLegsEnergy || 0;
  let totalKEMax = meMetrics?.avgTotalEnergy || 1;
  
  for (const row of meData) {
    const batKE = findColumn(row, ['bat_kinetic', 'bat_ke', 'bat_kinetic_energy']);
    const legsKE = findColumn(row, ['legs_kinetic', 'legs_ke', 'legs_kinetic_energy', 'lower_ke']);
    const totalKE = findColumn(row, ['total_kinetic', 'total_ke', 'total_kinetic_energy']);
    
    if (batKE !== null && batKE > batKEMax) batKEMax = batKE;
    if (legsKE !== null && legsKE > legsKEMax) legsKEMax = legsKE;
    if (totalKE !== null && totalKE > totalKEMax) totalKEMax = totalKE;
  }
  
  const transferEfficiency = meMetrics?.avgEnergyEfficiency || ((batKEMax / totalKEMax) * 100);
  
  // Calculate sub-scores
  const pelvisScore = to2080Scale(pelvisPeakVel, THRESHOLDS.pelvis_velocity.min, THRESHOLDS.pelvis_velocity.max);
  const legsScore = to2080Scale(legsKEMax, THRESHOLDS.legs_ke.min, THRESHOLDS.legs_ke.max);
  const groundFlowScore = Math.round((pelvisScore + legsScore) / 2);
  
  const torsoScore = to2080Scale(torsoPeakVel, THRESHOLDS.torso_velocity.min, THRESHOLDS.torso_velocity.max);
  const xFactorScore = to2080Scale(xFactorMax, THRESHOLDS.x_factor.min, THRESHOLDS.x_factor.max);
  const stretchScore = to2080Scale(stretchRate, THRESHOLDS.stretch_rate.min, THRESHOLDS.stretch_rate.max);
  const coreFlowScore = Math.round((torsoScore + xFactorScore + stretchScore) / 3);
  
  const batKEScore = to2080Scale(batKEMax, THRESHOLDS.bat_ke.min, THRESHOLDS.bat_ke.max);
  const efficiencyScore = to2080Scale(transferEfficiency, THRESHOLDS.bat_efficiency.min, THRESHOLDS.bat_efficiency.max);
  const upperFlowScore = Math.round((batKEScore + efficiencyScore) / 2);
  
  // Consistency (Brain)
  const pelvisCV = coefficientOfVariation(pelvisVelocities);
  const torsoCV = coefficientOfVariation(torsoVelocities);
  const avgCV = (pelvisCV + torsoCV) / 2;
  const consistencyScore = to2080Scale(avgCV, THRESHOLDS.consistency_cv.min, THRESHOLDS.consistency_cv.max, true);
  
  // 4B Scores
  const brainScore = consistencyScore;
  const bodyScore = Math.round((groundFlowScore * 0.4 + coreFlowScore * 0.6));
  const batScore = upperFlowScore;
  
  const compositeScore = Math.round(
    brainScore * 0.20 +
    bodyScore * 0.45 +
    batScore * 0.35
  );
  
  // Weakest link
  const scores = { brain: brainScore, body: bodyScore, bat: batScore };
  const weakestLink = (Object.entries(scores).reduce((a, b) => (a[1] < b[1] ? a : b))[0]) as 'brain' | 'body' | 'bat';
  
  // Calculate swing count
  const swingCount = Math.max(ikMetrics?.swingCount || 0, meMetrics?.swingCount || 0);
  
  return {
    brainScore,
    bodyScore,
    batScore,
    compositeScore,
    grade: getGrade(compositeScore),
    groundFlowScore,
    coreFlowScore,
    upperFlowScore,
    pelvisVelocity: Math.round(pelvisPeakVel),
    torsoVelocity: Math.round(torsoPeakVel),
    xFactor: Math.round(xFactorMax * 10) / 10,
    batKE: Math.round(batKEMax),
    transferEfficiency: Math.round(transferEfficiency * 10) / 10,
    consistencyCV: Math.round(avgCV * 10) / 10,
    consistencyGrade: getConsistencyGrade(avgCV),
    weakestLink,
    ikMetrics,
    meMetrics,
    swingCount: swingCount > 0 ? swingCount : undefined,
  };
}
