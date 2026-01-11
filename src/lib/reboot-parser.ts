// Reboot Motion CSV Parser and 4B Bio Engine (KRS - Kinetic Report Scoring)
// Coach Rick's complete scoring system for Catching Barrels

export interface RebootScores {
  brainScore: number;
  bodyScore: number;
  batScore: number;
  ballScore: number;
  catchBarrelScore: number;
  
  grades: {
    brain: string;
    body: string;
    bat: string;
    ball: string;
    overall: string;
  };
  
  // Legacy alias for compositeScore
  compositeScore: number;
  grade: string;
  
  // Flow component scores
  groundFlowScore: number;
  coreFlowScore: number;
  upperFlowScore: number;
  
  // Raw biomechanical metrics
  pelvisVelocity: number;
  torsoVelocity: number;
  xFactor: number;
  xFactorStretchRate: number;
  batKE: number;
  armsKE: number;
  legsKE: number;
  transferEfficiency: number;
  properSequencePct: number;
  
  // Consistency metrics (CV)
  consistencyCV: number;
  consistencyGrade: string;
  cvPelvis: number;
  cvTorso: number;
  cvXFactor: number;
  cvOutput: number;
  cvLeadElbow: number;
  cvRearElbow: number;
  
  weakestLink: 'brain' | 'body' | 'bat' | 'ball';
  
  // Detailed metrics
  ikMetrics?: RebootIKMetrics;
  meMetrics?: RebootMEMetrics;
  swingCount?: number;
  
  // Raw metrics for display
  rawMetrics: {
    avgPelvisVelocity: number;
    avgTorsoVelocity: number;
    avgXFactor: number;
    avgBatKE: number;
    avgBatEfficiency: number;
    cvPelvis: number;
    cvTorso: number;
    cvXFactor: number;
    cvOutput: number;
    properSequencePct: number;
  };
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
  avgLeadElbow: number;
  avgRearElbow: number;
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

// Per-swing metrics for detailed analysis
interface SwingMetrics {
  pelvisVelocity: number;
  torsoVelocity: number;
  xFactor: number;
  xFactorStretchRate: number;
  legsKE: number;
  batKE: number;
  armsKE: number;
  totalKE: number;
  leadKneeAtContact: number;
  rearElbowExtRate: number;
  leadElbowAtContact: number;
  rearElbowAtContact: number;
  pelvisPeakTime: number;
  torsoPeakTime: number;
  contactTime: number;
  properSequence: boolean;
}

// ============================================================================
// THRESHOLDS - Coach Rick's KRS Thresholds
// ============================================================================

const THRESHOLDS = {
  // Ground Flow (BODY)
  pelvisVelocity: { min: 400, max: 900 },      // deg/s
  legsKE: { min: 100, max: 500 },              // Joules
  pelvisTiming: { min: 30, max: 200 },         // ms before contact
  leadKneeAtContact: { min: 40, max: 90 },     // degrees
  
  // Core Flow (BODY)
  torsoVelocity: { min: 400, max: 900 },       // deg/s
  xFactorMax: { min: 10, max: 45 },            // degrees
  xFactorStretchRate: { min: 400, max: 1200 }, // deg/s
  properSequencePct: { min: 40, max: 100 },    // percentage
  
  // Upper Flow (BAT)
  batKE: { min: 100, max: 600 },               // Joules
  armsKE: { min: 80, max: 250 },               // Joules
  rearElbowExtRate: { min: 200, max: 600 },    // deg/s
  batEfficiency: { min: 25, max: 65 },         // percentage
  
  // Consistency (BRAIN) - INVERTED (lower CV = higher score)
  cvPelvis: { min: 5, max: 40 },               // percentage
  cvTorso: { min: 5, max: 40 },                // percentage
  cvXFactor: { min: 10, max: 80 },             // percentage
  cvOutput: { min: 10, max: 150 },             // percentage
  
  // Contact Consistency (BALL) - INVERTED
  cvLeadElbow: { min: 5, max: 30 },            // percentage
  cvRearElbow: { min: 5, max: 30 },            // percentage
};

// ============================================================================
// COMPOSITE FORMULA WEIGHTS
// ============================================================================

const WEIGHTS = {
  body: 0.35,
  bat: 0.30,
  brain: 0.20,
  ball: 0.15,
};

// ============================================================================
// GRADE LABELS (20-80 Scout Scale)
// ============================================================================

const GRADE_LABELS = {
  70: 'PLUS-PLUS',
  60: 'PLUS',
  55: 'ABOVE AVG',
  45: 'AVERAGE',
  40: 'BELOW AVG',
  30: 'FRINGE',
  20: 'POOR',
};

/**
 * Get grade label for a 20-80 score
 */
export function getGrade(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 60) return 'Plus';
  if (score >= 55) return 'Above Avg';
  if (score >= 45) return 'Average';
  if (score >= 40) return 'Below Avg';
  if (score >= 30) return 'Fringe';
  return 'Poor';
}

/**
 * Get consistency grade based on CV
 */
export function getConsistencyGrade(cv: number): string {
  if (cv < 6) return 'Elite';
  if (cv < 10) return 'Plus';
  if (cv < 15) return 'Average';
  if (cv < 20) return 'Below Avg';
  return 'Poor';
}

/**
 * Convert raw metric to 20-80 scale
 */
function to2080Scale(value: number, min: number, max: number, invert = false): number {
  let normalized = (value - min) / (max - min);
  if (invert) normalized = 1 - normalized;
  normalized = Math.max(0, Math.min(1, normalized)); // Clamp 0-1
  return Math.round(20 + normalized * 60); // Map to 20-80
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
 * Calculate coefficient of variation (CV) as percentage
 * Lower CV = more consistent
 */
function coefficientOfVariation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  if (m === 0) return 0;
  return (std(arr) / Math.abs(m)) * 100;
}

/**
 * Calculate velocities from position/angle data
 */
function calculateVelocities(values: number[], times: number[]): number[] {
  const velocities: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const dt = times[i] - times[i - 1];
    if (dt > 0) {
      velocities.push((values[i] - values[i - 1]) / dt);
    } else {
      velocities.push(0);
    }
  }
  return velocities;
}

/**
 * Calculate angular velocity from angle data (fixed dt)
 */
function calculateAngularVelocity(angles: number[], dt: number = 0.008333): number[] {
  const velocities: number[] = [];
  for (let i = 1; i < angles.length; i++) {
    velocities.push((angles[i] - angles[i - 1]) / dt);
  }
  return velocities;
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
export function processRebootIK(ikData: Record<string, any>[], dominantHand: 'L' | 'R' = 'R'): RebootIKMetrics {
  // Try to group by org_movement_id first, then movement_id
  let swings = groupBy(ikData, 'org_movement_id' as keyof Record<string, any>);
  
  // If org_movement_id grouping failed, try movement_id
  const validSwings = Object.entries(swings).filter(([id]) => 
    id !== 'n/a' && id !== 'undefined' && id !== 'unknown' && id !== 'null'
  );
  
  if (validSwings.length === 0) {
    swings = groupBy(ikData, 'movement_id' as keyof Record<string, any>);
  }
  
  const leadKneeCol = dominantHand === 'R' ? 'left_knee' : 'right_knee';
  const rearKneeCol = dominantHand === 'R' ? 'right_knee' : 'left_knee';
  const leadElbowCol = dominantHand === 'R' ? 'left_elbow' : 'right_elbow';
  const rearElbowCol = dominantHand === 'R' ? 'right_elbow' : 'left_elbow';
  const leadHipCol = dominantHand === 'R' ? 'left_hip_flex' : 'right_hip_flex';
  
  const processedSwings: {
    pelvisRotMax: number;
    torsoRotMax: number;
    xFactorMax: number;
    leadHipFlexMax: number;
    leadKneeFlexMax: number;
    leadShoulderElevMax: number;
    rearShoulderElevMax: number;
    leadElbowMax: number;
    rearElbowMax: number;
  }[] = [];
  
  for (const [movementId, rows] of Object.entries(swings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown' || movementId === 'null') continue;
    
    // Convert radians to degrees if needed (Reboot uses radians)
    const toDegrees = (val: number) => Math.abs(val) > 10 ? val : val * (180 / Math.PI);
    
    const pelvisRotValues = rows.map(r => toDegrees(parseFloat(r.pelvis_rot) || 0));
    const torsoRotValues = rows.map(r => toDegrees(parseFloat(r.torso_rot) || 0));
    
    // Calculate X-Factor (torso - pelvis separation)
    const xFactorValues = rows.map(r => 
      Math.abs(toDegrees(parseFloat(r.torso_rot) || 0) - toDegrees(parseFloat(r.pelvis_rot) || 0))
    );
    
    const leadHipFlexValues = rows.map(r => Math.abs(toDegrees(parseFloat(r[leadHipCol]) || 0)));
    const leadKneeFlexValues = rows.map(r => Math.abs(toDegrees(parseFloat(r[leadKneeCol]) || 0)));
    const leadShoulderElevValues = rows.map(r => Math.abs(toDegrees(parseFloat(r.left_shoulder_elev) || 0)));
    const rearShoulderElevValues = rows.map(r => Math.abs(toDegrees(parseFloat(r.right_shoulder_elev) || 0)));
    const leadElbowValues = rows.map(r => Math.abs(toDegrees(parseFloat(r[leadElbowCol]) || 0)));
    const rearElbowValues = rows.map(r => Math.abs(toDegrees(parseFloat(r[rearElbowCol]) || 0)));
    
    processedSwings.push({
      pelvisRotMax: Math.max(...pelvisRotValues.map(Math.abs), 0),
      torsoRotMax: Math.max(...torsoRotValues.map(Math.abs), 0),
      xFactorMax: Math.max(...xFactorValues, 0),
      leadHipFlexMax: Math.max(...leadHipFlexValues, 0),
      leadKneeFlexMax: Math.max(...leadKneeFlexValues, 0),
      leadShoulderElevMax: Math.max(...leadShoulderElevValues, 0),
      rearShoulderElevMax: Math.max(...rearShoulderElevValues, 0),
      leadElbowMax: Math.max(...leadElbowValues, 0),
      rearElbowMax: Math.max(...rearElbowValues, 0),
    });
  }
  
  // If no swing groupings found, process all data as one swing
  if (processedSwings.length === 0 && ikData.length > 0) {
    const toDegrees = (val: number) => Math.abs(val) > 10 ? val : val * (180 / Math.PI);
    
    const pelvisRotValues = ikData.map(r => toDegrees(parseFloat(r.pelvis_rot) || 0));
    const torsoRotValues = ikData.map(r => toDegrees(parseFloat(r.torso_rot) || 0));
    const xFactorValues = ikData.map(r => 
      Math.abs(toDegrees(parseFloat(r.torso_rot) || 0) - toDegrees(parseFloat(r.pelvis_rot) || 0))
    );
    
    processedSwings.push({
      pelvisRotMax: Math.max(...pelvisRotValues.map(Math.abs), 0),
      torsoRotMax: Math.max(...torsoRotValues.map(Math.abs), 0),
      xFactorMax: Math.max(...xFactorValues, 0),
      leadHipFlexMax: Math.max(...ikData.map(r => Math.abs(toDegrees(parseFloat(r[leadHipCol]) || 0))), 0),
      leadKneeFlexMax: Math.max(...ikData.map(r => Math.abs(toDegrees(parseFloat(r[leadKneeCol]) || 0))), 0),
      leadShoulderElevMax: Math.max(...ikData.map(r => Math.abs(toDegrees(parseFloat(r.left_shoulder_elev) || 0))), 0),
      rearShoulderElevMax: Math.max(...ikData.map(r => Math.abs(toDegrees(parseFloat(r.right_shoulder_elev) || 0))), 0),
      leadElbowMax: Math.max(...ikData.map(r => Math.abs(toDegrees(parseFloat(r[leadElbowCol]) || 0))), 0),
      rearElbowMax: Math.max(...ikData.map(r => Math.abs(toDegrees(parseFloat(r[rearElbowCol]) || 0))), 0),
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
    avgLeadElbow: mean(processedSwings.map(s => s.leadElbowMax)),
    avgRearElbow: mean(processedSwings.map(s => s.rearElbowMax)),
    swingCount: processedSwings.length,
  };
}

/**
 * Process Reboot ME data and extract key metrics per swing
 */
export function processRebootME(meData: Record<string, any>[]): RebootMEMetrics {
  // Try to group by org_movement_id first, then movement_id
  let swings = groupBy(meData, 'org_movement_id' as keyof Record<string, any>);
  
  const validSwings = Object.entries(swings).filter(([id]) => 
    id !== 'n/a' && id !== 'undefined' && id !== 'unknown' && id !== 'null'
  );
  
  if (validSwings.length === 0) {
    swings = groupBy(meData, 'movement_id' as keyof Record<string, any>);
  }
  
  const processedSwings: {
    totalKEMax: number;
    batKEMax: number;
    torsoKEMax: number;
    armsKEMax: number;
    legsKEMax: number;
    energyEfficiency: number;
  }[] = [];
  
  for (const [movementId, rows] of Object.entries(swings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown' || movementId === 'null') continue;
    
    // Find max kinetic energies
    const totalKE = rows.map(r => parseFloat(r.total_kinetic_energy) || 0);
    const batKE = rows.map(r => parseFloat(r.bat_kinetic_energy) || 0);
    const torsoKE = rows.map(r => parseFloat(r.torso_kinetic_energy) || 0);
    const larmsKE = rows.map(r => parseFloat(r.larm_kinetic_energy) || 0);
    const rarmsKE = rows.map(r => parseFloat(r.rarm_kinetic_energy) || 0);
    const armsKE = rows.map(r => (parseFloat(r.larm_kinetic_energy) || 0) + (parseFloat(r.rarm_kinetic_energy) || 0));
    const legsKE = rows.map(r => parseFloat(r.legs_kinetic_energy) || 0);
    
    const totalMax = Math.max(...totalKE, 1); // Avoid division by zero
    const batMax = Math.max(...batKE, 0);
    const armsMax = Math.max(...armsKE, 0);
    
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
      armsKEMax: Math.max(...meData.map(r => (parseFloat(r.larm_kinetic_energy) || 0) + (parseFloat(r.rarm_kinetic_energy) || 0)), 0),
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
 * Extract per-swing metrics for detailed analysis
 */
function extractSwingMetrics(
  ikData: Record<string, any>[],
  meData: Record<string, any>[],
  dominantHand: 'L' | 'R' = 'R'
): SwingMetrics[] {
  const leadElbowCol = dominantHand === 'R' ? 'left_elbow' : 'right_elbow';
  const rearElbowCol = dominantHand === 'R' ? 'right_elbow' : 'left_elbow';
  const leadKneeCol = dominantHand === 'R' ? 'left_knee' : 'right_knee';
  
  const toDegrees = (val: number) => Math.abs(val) > 10 ? val : val * (180 / Math.PI);
  
  // Group IK and ME data by movement ID
  let ikSwings = groupBy(ikData, 'org_movement_id' as keyof Record<string, any>);
  let meSwings = groupBy(meData, 'org_movement_id' as keyof Record<string, any>);
  
  // Fallback to movement_id if org_movement_id didn't work
  const validIKSwings = Object.entries(ikSwings).filter(([id]) => 
    id !== 'n/a' && id !== 'undefined' && id !== 'unknown' && id !== 'null'
  );
  if (validIKSwings.length === 0) {
    ikSwings = groupBy(ikData, 'movement_id' as keyof Record<string, any>);
  }
  
  const validMESwings = Object.entries(meSwings).filter(([id]) => 
    id !== 'n/a' && id !== 'undefined' && id !== 'unknown' && id !== 'null'
  );
  if (validMESwings.length === 0) {
    meSwings = groupBy(meData, 'movement_id' as keyof Record<string, any>);
  }
  
  const swingMetrics: SwingMetrics[] = [];
  
  for (const [movementId, ikRows] of Object.entries(ikSwings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown' || movementId === 'null') continue;
    
    const meRows = meSwings[movementId] || [];
    
    // Parse time and rotations
    const timeValues = ikRows.map(r => parseFloat(r.time) || 0);
    const pelvisRotations = ikRows.map(r => toDegrees(parseFloat(r.pelvis_rot) || 0));
    const torsoRotations = ikRows.map(r => toDegrees(parseFloat(r.torso_rot) || 0));
    
    // Calculate velocities
    const pelvisVelocities = timeValues.length > 1 
      ? calculateVelocities(pelvisRotations, timeValues)
      : calculateAngularVelocity(pelvisRotations);
    const torsoVelocities = timeValues.length > 1
      ? calculateVelocities(torsoRotations, timeValues)
      : calculateAngularVelocity(torsoRotations);
    
    // Peak velocities (convert to deg/s * 1000 for better scale)
    const pelvisPeakVel = pelvisVelocities.length ? Math.max(...pelvisVelocities.map(Math.abs)) * 1000 : 0;
    const torsoPeakVel = torsoVelocities.length ? Math.max(...torsoVelocities.map(Math.abs)) * 1000 : 0;
    
    // X-Factor
    const xFactors = ikRows.map(r => 
      Math.abs(toDegrees(parseFloat(r.torso_rot) || 0) - toDegrees(parseFloat(r.pelvis_rot) || 0))
    );
    const xFactorMax = Math.max(...xFactors, 0);
    
    // X-Factor stretch rate
    const xFactorVelocities = timeValues.length > 1
      ? calculateVelocities(xFactors, timeValues)
      : calculateAngularVelocity(xFactors);
    const xFactorStretchRate = xFactorVelocities.length ? Math.max(...xFactorVelocities.map(Math.abs)) * 1000 : 0;
    
    // Contact frame estimation (last frame or use event column if available)
    const contactIdx = ikRows.length - 1;
    const contactTime = timeValues[contactIdx] * 1000; // Convert to ms
    
    // Lead knee at contact
    const leadKneeAtContact = Math.abs(toDegrees(parseFloat(ikRows[contactIdx]?.[leadKneeCol]) || 0));
    
    // Lead/rear elbow at contact
    const leadElbowAtContact = Math.abs(toDegrees(parseFloat(ikRows[contactIdx]?.[leadElbowCol]) || 0));
    const rearElbowAtContact = Math.abs(toDegrees(parseFloat(ikRows[contactIdx]?.[rearElbowCol]) || 0));
    
    // Pelvis peak time
    const pelvisPeakIdx = pelvisVelocities.indexOf(Math.max(...pelvisVelocities.map(Math.abs)));
    const pelvisPeakTime = (timeValues[pelvisPeakIdx] || 0) * 1000;
    
    // Torso peak time
    const torsoPeakIdx = torsoVelocities.indexOf(Math.max(...torsoVelocities.map(Math.abs)));
    const torsoPeakTime = (timeValues[torsoPeakIdx] || 0) * 1000;
    
    // Proper sequence (pelvis fires before torso)
    const properSequence = pelvisPeakTime < torsoPeakTime;
    
    // Rear elbow extension rate
    const rearElbowAngles = ikRows.map(r => toDegrees(parseFloat(r[rearElbowCol]) || 0));
    const rearElbowVelocities = timeValues.length > 1
      ? calculateVelocities(rearElbowAngles, timeValues)
      : calculateAngularVelocity(rearElbowAngles);
    const rearElbowExtRate = rearElbowVelocities.length ? Math.max(...rearElbowVelocities) * 1000 : 0;
    
    // ME data for this swing
    const batKEs = meRows.map(r => parseFloat(r.bat_kinetic_energy) || 0);
    const armsKEs = meRows.map(r => (parseFloat(r.larm_kinetic_energy) || 0) + (parseFloat(r.rarm_kinetic_energy) || 0));
    const legsKEs = meRows.map(r => parseFloat(r.legs_kinetic_energy) || 0);
    const totalKEs = meRows.map(r => parseFloat(r.total_kinetic_energy) || 0);
    
    swingMetrics.push({
      pelvisVelocity: pelvisPeakVel,
      torsoVelocity: torsoPeakVel,
      xFactor: xFactorMax,
      xFactorStretchRate,
      legsKE: Math.max(...legsKEs, 0),
      batKE: Math.max(...batKEs, 0),
      armsKE: Math.max(...armsKEs, 0),
      totalKE: Math.max(...totalKEs, 1),
      leadKneeAtContact,
      rearElbowExtRate,
      leadElbowAtContact,
      rearElbowAtContact,
      pelvisPeakTime,
      torsoPeakTime,
      contactTime,
      properSequence,
    });
  }
  
  return swingMetrics;
}

/**
 * Calculate Reboot Motion 4B scores using Coach Rick's KRS logic
 */
export function calculateRebootScores(
  ikData: Record<string, any>[],
  meData: Record<string, any>[],
  dominantHand: 'L' | 'R' = 'R'
): RebootScores {
  // Process extracted metrics
  const ikMetrics = ikData.length > 0 ? processRebootIK(ikData, dominantHand) : undefined;
  const meMetrics = meData.length > 0 ? processRebootME(meData) : undefined;
  
  // Extract per-swing metrics for CV calculations
  const swingMetrics = extractSwingMetrics(ikData, meData, dominantHand);
  
  // If we have swing data, use it for CV calculations
  let pelvisVelocities: number[] = [];
  let torsoVelocities: number[] = [];
  let xFactors: number[] = [];
  let batKEs: number[] = [];
  let leadElbows: number[] = [];
  let rearElbows: number[] = [];
  let properSequences = 0;
  
  if (swingMetrics.length > 0) {
    pelvisVelocities = swingMetrics.map(s => s.pelvisVelocity);
    torsoVelocities = swingMetrics.map(s => s.torsoVelocity);
    xFactors = swingMetrics.map(s => s.xFactor);
    batKEs = swingMetrics.map(s => s.batKE);
    leadElbows = swingMetrics.map(s => s.leadElbowAtContact);
    rearElbows = swingMetrics.map(s => s.rearElbowAtContact);
    properSequences = swingMetrics.filter(s => s.properSequence).length;
  } else {
    // Fallback: extract from raw data
    const toDegrees = (val: number) => Math.abs(val) > 10 ? val : val * (180 / Math.PI);
    
    for (const row of ikData) {
      const pelvis = toDegrees(parseFloat(row.pelvis_rot) || 0);
      const torso = toDegrees(parseFloat(row.torso_rot) || 0);
      if (pelvis !== 0) pelvisVelocities.push(pelvis);
      if (torso !== 0) torsoVelocities.push(torso);
      const xf = Math.abs(torso - pelvis);
      if (xf !== 0) xFactors.push(xf);
    }
    
    for (const row of meData) {
      const batKE = parseFloat(row.bat_kinetic_energy) || 0;
      if (batKE !== 0) batKEs.push(batKE);
    }
  }
  
  // ========== CALCULATE AVERAGES ==========
  const avgPelvisVel = mean(pelvisVelocities);
  const avgTorsoVel = mean(torsoVelocities);
  const avgXFactor = mean(xFactors);
  const avgLegsKE = meMetrics?.avgLegsEnergy || 0;
  const avgBatKE = meMetrics?.avgBatEnergy || 0;
  const avgArmsKE = meMetrics?.avgArmsEnergy || 0;
  const avgBatEfficiency = meMetrics?.avgEnergyEfficiency || 0;
  const avgLeadKnee = ikMetrics?.avgLeadKneeFlex || 0;
  const avgRearElbowExtRate = swingMetrics.length > 0 ? mean(swingMetrics.map(s => s.rearElbowExtRate)) : 0;
  const avgXFactorStretchRate = swingMetrics.length > 0 ? mean(swingMetrics.map(s => s.xFactorStretchRate)) : 0;
  const properSequencePct = swingMetrics.length > 0 ? (properSequences / swingMetrics.length) * 100 : 50;
  
  // ========== CVs (Consistency) ==========
  const cvPelvis = coefficientOfVariation(pelvisVelocities);
  const cvTorso = coefficientOfVariation(torsoVelocities);
  const cvXFactor = coefficientOfVariation(xFactors);
  const cvOutput = coefficientOfVariation(batKEs);
  const cvLeadElbow = coefficientOfVariation(leadElbows);
  const cvRearElbow = coefficientOfVariation(rearElbows);
  const avgCV = (cvPelvis + cvTorso) / 2;
  
  // ========== GROUND FLOW (BODY component 1) ==========
  const groundFlowComponents = [
    to2080Scale(avgPelvisVel, THRESHOLDS.pelvisVelocity.min, THRESHOLDS.pelvisVelocity.max),
    to2080Scale(avgLegsKE, THRESHOLDS.legsKE.min, THRESHOLDS.legsKE.max),
    to2080Scale(avgLeadKnee, THRESHOLDS.leadKneeAtContact.min, THRESHOLDS.leadKneeAtContact.max),
  ];
  const groundFlowScore = Math.round(mean(groundFlowComponents));
  
  // ========== CORE FLOW (BODY component 2) ==========
  const coreFlowComponents = [
    to2080Scale(avgTorsoVel, THRESHOLDS.torsoVelocity.min, THRESHOLDS.torsoVelocity.max),
    to2080Scale(avgXFactor, THRESHOLDS.xFactorMax.min, THRESHOLDS.xFactorMax.max),
    to2080Scale(avgXFactorStretchRate, THRESHOLDS.xFactorStretchRate.min, THRESHOLDS.xFactorStretchRate.max),
    to2080Scale(properSequencePct, THRESHOLDS.properSequencePct.min, THRESHOLDS.properSequencePct.max),
  ];
  const coreFlowScore = Math.round(mean(coreFlowComponents));
  
  // ========== BODY SCORE ==========
  const bodyScore = Math.round((groundFlowScore + coreFlowScore) / 2);
  
  // ========== UPPER FLOW (BAT) ==========
  const upperFlowComponents = [
    to2080Scale(avgBatKE, THRESHOLDS.batKE.min, THRESHOLDS.batKE.max),
    to2080Scale(avgArmsKE, THRESHOLDS.armsKE.min, THRESHOLDS.armsKE.max),
    to2080Scale(avgRearElbowExtRate, THRESHOLDS.rearElbowExtRate.min, THRESHOLDS.rearElbowExtRate.max),
    to2080Scale(avgBatEfficiency, THRESHOLDS.batEfficiency.min, THRESHOLDS.batEfficiency.max),
  ];
  const batScore = Math.round(mean(upperFlowComponents));
  const upperFlowScore = batScore;
  
  // ========== BRAIN (Consistency - INVERTED) ==========
  const brainComponents = [
    to2080Scale(cvPelvis, THRESHOLDS.cvPelvis.min, THRESHOLDS.cvPelvis.max, true),
    to2080Scale(cvTorso, THRESHOLDS.cvTorso.min, THRESHOLDS.cvTorso.max, true),
    to2080Scale(cvXFactor, THRESHOLDS.cvXFactor.min, THRESHOLDS.cvXFactor.max, true),
    to2080Scale(cvOutput, THRESHOLDS.cvOutput.min, THRESHOLDS.cvOutput.max, true),
  ];
  const brainScore = Math.round(mean(brainComponents));
  
  // ========== BALL (Contact Consistency - INVERTED) ==========
  const ballComponents = [
    to2080Scale(cvLeadElbow, THRESHOLDS.cvLeadElbow.min, THRESHOLDS.cvLeadElbow.max, true),
    to2080Scale(cvRearElbow, THRESHOLDS.cvRearElbow.min, THRESHOLDS.cvRearElbow.max, true),
  ];
  const ballScore = Math.round(mean(ballComponents));
  
  // ========== CATCH BARREL SCORE (Composite) ==========
  const catchBarrelScore = Math.round(
    (bodyScore * WEIGHTS.body) +
    (batScore * WEIGHTS.bat) +
    (brainScore * WEIGHTS.brain) +
    (ballScore * WEIGHTS.ball)
  );
  
  // ========== WEAKEST LINK ==========
  const scores = { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore };
  const weakestLink = (Object.entries(scores).reduce((a, b) => (a[1] < b[1] ? a : b))[0]) as 'brain' | 'body' | 'bat' | 'ball';
  
  // Calculate swing count
  const swingCount = Math.max(
    swingMetrics.length,
    ikMetrics?.swingCount || 0, 
    meMetrics?.swingCount || 0
  );
  
  return {
    brainScore,
    bodyScore,
    batScore,
    ballScore,
    catchBarrelScore,
    
    grades: {
      brain: getGrade(brainScore),
      body: getGrade(bodyScore),
      bat: getGrade(batScore),
      ball: getGrade(ballScore),
      overall: getGrade(catchBarrelScore),
    },
    
    // Legacy aliases
    compositeScore: catchBarrelScore,
    grade: getGrade(catchBarrelScore),
    
    groundFlowScore,
    coreFlowScore,
    upperFlowScore,
    
    pelvisVelocity: Math.round(avgPelvisVel),
    torsoVelocity: Math.round(avgTorsoVel),
    xFactor: Math.round(avgXFactor * 10) / 10,
    xFactorStretchRate: Math.round(avgXFactorStretchRate),
    batKE: Math.round(avgBatKE),
    armsKE: Math.round(avgArmsKE),
    legsKE: Math.round(avgLegsKE),
    transferEfficiency: Math.round(avgBatEfficiency * 10) / 10,
    properSequencePct: Math.round(properSequencePct),
    
    consistencyCV: Math.round(avgCV * 10) / 10,
    consistencyGrade: getConsistencyGrade(avgCV),
    cvPelvis: Math.round(cvPelvis * 10) / 10,
    cvTorso: Math.round(cvTorso * 10) / 10,
    cvXFactor: Math.round(cvXFactor * 10) / 10,
    cvOutput: Math.round(cvOutput * 10) / 10,
    cvLeadElbow: Math.round(cvLeadElbow * 10) / 10,
    cvRearElbow: Math.round(cvRearElbow * 10) / 10,
    
    weakestLink,
    
    ikMetrics,
    meMetrics,
    swingCount: swingCount > 0 ? swingCount : undefined,
    
    rawMetrics: {
      avgPelvisVelocity: avgPelvisVel,
      avgTorsoVelocity: avgTorsoVel,
      avgXFactor,
      avgBatKE,
      avgBatEfficiency,
      cvPelvis,
      cvTorso,
      cvXFactor,
      cvOutput,
      properSequencePct,
    },
  };
}
