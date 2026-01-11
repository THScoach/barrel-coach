/**
 * 4B Bio Engine - Momentum-First KRS (Kinetic Report Scoring)
 * =============================================
 * Coach Rick's scoring system for catching barrels.
 * 
 * KEY DESIGN:
 * - ME (Momentum-Energy) CSV is PRIMARY + REQUIRED
 * - IK (Inverse Kinematics) CSV is OPTIONAL (support only)
 * - Bat KE is optional - uses proxy if missing
 * - Includes Kinetic Potential projections (Bat Speed + Exit Velo)
 */

// ============================================================================
// TYPES
// ============================================================================

export enum LeakType {
  CLEAN_TRANSFER = 'clean_transfer',
  EARLY_BACK_LEG_RELEASE = 'early_back_leg_release',
  LATE_LEAD_LEG_ACCEPTANCE = 'late_lead_leg_acceptance',
  VERTICAL_PUSH = 'vertical_push',
  GLIDE_WITHOUT_CAPTURE = 'glide_without_capture',
  LATE_ENGINE = 'late_engine',
  CORE_DISCONNECT = 'core_disconnect',
  NO_BAT_DELIVERY = 'no_bat_delivery',
  UNKNOWN = 'unknown',
}

export interface DataQualityFlags {
  swingCount: number;
  hasContactEvent: boolean;
  hasBatKE: boolean;
  batKECoverage: number;
  cvScoresValid: boolean;
  incompleteSwings: string[];
  warnings: string[];
  hasMEData: boolean;
  hasIKData: boolean;
}

export interface KineticProjections {
  batSpeedCurrentMph: number;
  batSpeedCeilingMph: number;
  exitVeloCurrentMph: number;
  exitVeloCeilingMph: number;
  deliveryEfficiencyPct: number;
  potentialDeliveryEfficiencyPct: number;
  hasProjections: boolean;
}

export interface SwingMetrics {
  movementId: string;
  
  // Velocities (deg/s) - from IK if available
  pelvisVelocity: number;
  torsoVelocity: number;
  
  // Separation (degrees) - from IK if available
  xFactor: number;
  xFactorStretchRate: number;
  
  // Timing (ms) - from IK if available
  pelvisPeakTime: number;
  torsoPeakTime: number;
  contactTime: number;
  pelvisTiming: number;
  
  // Kinetic Energy (Joules) - from ME (PRIMARY)
  legsKE: number;
  torsoKE: number;
  armsKE: number;
  batKE: number;
  totalKE: number;
  
  // Angles at contact (degrees) - from IK if available
  leadKneeAtContact: number;
  leadElbowAtContact: number;
  rearElbowAtContact: number;
  
  // Extension rates (deg/s) - from IK if available
  rearElbowExtRate: number;
  
  // Derived
  properSequence: boolean;
  batEfficiency: number;
  torsoToArmsTransferPct: number;
  
  // Energy timing
  legsKEPeakTime: number;
  armsKEPeakTime: number;
}

export interface FourBScores {
  // Scores (20-80 scale)
  brain: number;
  body: number;
  bat: number;
  ball: number;
  catchBarrelScore: number;
  
  // Grades
  grades: {
    brain: string;
    body: string;
    bat: string;
    ball: string;
    overall: string;
  };
  
  // Flow components
  components: {
    groundFlow: number;
    coreFlow: number;
    upperFlow: number;
  };
  
  // Raw metrics
  rawMetrics: Record<string, number>;
  
  // Leak detection
  leak: {
    type: LeakType;
    caption: string;
    trainingMeaning: string;
  };
  
  // Kinetic Potential projections (NEW)
  projections: KineticProjections;
  
  // Data quality
  dataQuality: DataQualityFlags;
  
  // Per-swing data
  swings: SwingMetrics[];
}

// Legacy interface for backward compatibility
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
  
  // Leak detection
  leak?: {
    type: LeakType;
    caption: string;
    trainingMeaning: string;
  };
  
  // Kinetic Potential projections (NEW)
  projections?: KineticProjections;
  
  // Data quality
  dataQuality?: DataQualityFlags;
  
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

// Inverse Kinematics metrics per session (OPTIONAL SUPPORT)
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

// Momentum Energy metrics per session (PRIMARY)
export interface RebootMEMetrics {
  avgTotalEnergy: number;
  avgBatEnergy: number;
  avgTorsoEnergy: number;
  avgArmsEnergy: number;
  avgLegsEnergy: number;
  avgEnergyEfficiency: number;
  swingCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const THRESHOLDS = {
  // Ground Flow (BODY) - ME-based
  legsKE: { min: 100, max: 500 },              // Joules
  
  // Core Flow (BODY) - ME-based
  torsoKE: { min: 150, max: 600 },             // Joules
  torsoToArmsTransfer: { min: 50, max: 150 },  // percentage
  
  // Upper Flow (BAT) - ME-based
  batKE: { min: 100, max: 600 },               // Joules
  armsKE: { min: 80, max: 250 },               // Joules
  batEfficiency: { min: 25, max: 65 },         // percentage
  deliveryEfficiency: { min: 30, max: 60 },    // percentage (proxy when no bat KE)
  
  // Legacy IK thresholds (used only if IK available)
  pelvisVelocity: { min: 400, max: 900 },      // deg/s
  torsoVelocity: { min: 400, max: 900 },       // deg/s
  xFactorMax: { min: 10, max: 45 },            // degrees
  xFactorStretchRate: { min: 400, max: 1200 }, // deg/s
  pelvisTiming: { min: 30, max: 200 },         // ms before contact
  leadKneeAtContact: { min: 40, max: 90 },     // degrees
  rearElbowExtRate: { min: 200, max: 600 },    // deg/s
  properSequencePct: { min: 40, max: 100 },    // percentage
  
  // Consistency (BRAIN) - INVERTED
  cvLegsKE: { min: 5, max: 40 },               // percentage
  cvTorsoKE: { min: 5, max: 40 },              // percentage
  cvArmsKE: { min: 5, max: 40 },               // percentage
  cvOutput: { min: 10, max: 150 },             // percentage (bat KE or arms KE)
  
  // Contact Consistency (BALL) - INVERTED
  cvTotalKE: { min: 5, max: 30 },              // percentage
  cvBatEfficiency: { min: 10, max: 50 },       // percentage
};

export const WEIGHTS = {
  body: 0.35,
  bat: 0.30,
  brain: 0.20,
  ball: 0.15,
};

export const MIN_SWINGS_FOR_CV = 3;

// Kinetic Potential projection constants
const K_BAT_SPEED = 4.25; // tunable constant for bat speed model
const TARGET_DELIVERY_EFFICIENCY_PCT = 55; // target if leaks closed

// Player level bat speed clamps
const BAT_SPEED_CLAMPS: Record<string, { min: number; max: number }> = {
  youth: { min: 45, max: 85 },
  hs: { min: 55, max: 95 },
  college: { min: 60, max: 105 },
  pro: { min: 65, max: 110 },
};

export const LEAK_MESSAGES: Record<LeakType, { caption: string; training: string }> = {
  [LeakType.CLEAN_TRANSFER]: {
    caption: 'Energy transferred cleanly.',
    training: 'Keep doing what you\'re doing.',
  },
  [LeakType.EARLY_BACK_LEG_RELEASE]: {
    caption: 'You left the ground too early.',
    training: 'Stay connected to the ground longer.',
  },
  [LeakType.LATE_LEAD_LEG_ACCEPTANCE]: {
    caption: 'You didn\'t catch force on the front side.',
    training: 'Learn to accept force earlier.',
  },
  [LeakType.VERTICAL_PUSH]: {
    caption: 'You pushed up instead of into the ground.',
    training: 'Redirect force into the ground.',
  },
  [LeakType.GLIDE_WITHOUT_CAPTURE]: {
    caption: 'You moved without stopping.',
    training: 'Learn when to stop and transfer.',
  },
  [LeakType.LATE_ENGINE]: {
    caption: 'Your legs produced power — it just showed up late.',
    training: 'Stay connected to the ground longer.',
  },
  [LeakType.CORE_DISCONNECT]: {
    caption: 'Your upper body fired before your lower body.',
    training: 'Let the hips lead the hands.',
  },
  [LeakType.NO_BAT_DELIVERY]: {
    caption: 'Energy isn\'t reaching the barrel.',
    training: 'Focus on connection through the core.',
  },
  [LeakType.UNKNOWN]: {
    caption: '',
    training: '',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function calculateCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return (Math.sqrt(variance) / Math.abs(mean)) * 100;
}

export function to2080Scale(value: number, min: number, max: number, invert = false): number {
  if (max === min) return 50;
  let normalized = (value - min) / (max - min);
  if (invert) normalized = 1 - normalized;
  normalized = Math.max(0, Math.min(1, normalized));
  return Math.round(20 + normalized * 60);
}

export function getGrade(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 60) return 'Plus';
  if (score >= 55) return 'Above Avg';
  if (score >= 45) return 'Average';
  if (score >= 40) return 'Below Avg';
  if (score >= 30) return 'Fringe';
  return 'Poor';
}

export function getConsistencyGrade(cv: number): string {
  if (cv < 6) return 'Elite';
  if (cv < 10) return 'Plus';
  if (cv < 15) return 'Average';
  if (cv < 20) return 'Below Avg';
  return 'Poor';
}

export function calculateVelocities(values: number[], times: number[]): number[] {
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

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

export function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// CSV PARSING TYPES
// ============================================================================

interface IKRow {
  time: string;
  org_movement_id: string;
  time_from_max_hand?: string;
  pelvis_rot: string;
  torso_rot: string;
  left_knee: string;
  right_knee: string;
  left_elbow: string;
  right_elbow: string;
  [key: string]: string | undefined;
}

interface MERow {
  time: string;
  org_movement_id: string;
  time_from_max_hand?: string;
  bat_kinetic_energy?: string;
  arms_kinetic_energy: string;
  legs_kinetic_energy: string;
  torso_kinetic_energy: string;
  total_kinetic_energy: string;
  [key: string]: string | undefined;
}

// ============================================================================
// ME FILE PROCESSING (PRIMARY - REQUIRED)
// ============================================================================

export interface MESwingMetrics {
  movementId: string;
  batKE: number;
  armsKE: number;
  legsKE: number;
  torsoKE: number;
  totalKE: number;
  batEfficiency: number;
  torsoToArmsTransferPct: number;
  legsPeakTime: number;
  armsPeakTime: number;
  hasBatKE: boolean;
}

export function processMEFile(rows: MERow[]): Map<string, MESwingMetrics> {
  // Group by movement_id
  const swingGroups = new Map<string, MERow[]>();
  
  for (const row of rows) {
    const movementId = row.org_movement_id;
    if (!movementId || movementId.toLowerCase() === 'n/a') continue;
    
    if (!swingGroups.has(movementId)) {
      swingGroups.set(movementId, []);
    }
    swingGroups.get(movementId)!.push(row);
  }
  
  const swingMetrics = new Map<string, MESwingMetrics>();
  
  for (const [movementId, frames] of swingGroups) {
    frames.sort((a, b) => parseFloat(a.time || '0') - parseFloat(b.time || '0'));
    
    if (frames.length < 5) continue;
    
    const times = frames.map(f => parseFloat(f.time || '0'));
    const hasContactMarker = frames[0].time_from_max_hand !== undefined;
    
    // Filter to swing phase
    let validIndices: number[];
    if (hasContactMarker) {
      const contactTimes = frames.map(f => parseFloat(f.time_from_max_hand || '0'));
      validIndices = contactTimes.map((ct, i) => ct <= 0.01 ? i : -1).filter(i => i >= 0);
    } else {
      validIndices = times.map((t, i) => t <= 0.5 ? i : -1).filter(i => i >= 0);
    }
    
    if (!validIndices.length) {
      validIndices = Array.from({ length: Math.min(100, frames.length) }, (_, i) => i);
    }
    
    // Extract KE values with filtering
    const batKEs: number[] = [];
    const armsKEs: number[] = [];
    const legsKEs: number[] = [];
    const torsoKEs: number[] = [];
    const totalKEs: number[] = [];
    
    for (const i of validIndices) {
      const f = frames[i];
      const batKE = parseFloat(f.bat_kinetic_energy || '0');
      const totalKE = parseFloat(f.total_kinetic_energy || '0');
      
      // Filter outliers
      if (batKE >= 0 && batKE <= totalKE && batKE < 1000) {
        batKEs.push(batKE);
      }
      
      armsKEs.push(parseFloat(f.arms_kinetic_energy || '0'));
      legsKEs.push(parseFloat(f.legs_kinetic_energy || '0'));
      torsoKEs.push(parseFloat(f.torso_kinetic_energy || '0'));
      totalKEs.push(totalKE);
    }
    
    // Use 95th percentile for peaks
    const batKE95 = batKEs.length ? percentile(batKEs, 95) : 0;
    const armsKE95 = percentile(armsKEs, 95);
    const legsKE95 = percentile(legsKEs, 95);
    const torsoKE95 = percentile(torsoKEs, 95);
    const totalKE95 = percentile(totalKEs, 95);
    
    const batEfficiency = totalKE95 > 0 ? (batKE95 / totalKE95) * 100 : 0;
    
    // Calculate torso-to-arms transfer (proxy when bat KE missing)
    const torsoToArmsTransferPct = torsoKE95 > 0 ? (armsKE95 / torsoKE95) * 100 : 0;
    
    // Find peak timing
    const legsPeakIdx = legsKEs.length 
      ? legsKEs.reduce((maxIdx, v, i) => v > legsKEs[maxIdx] ? i : maxIdx, 0) : 0;
    const armsPeakIdx = armsKEs.length 
      ? armsKEs.reduce((maxIdx, v, i) => v > armsKEs[maxIdx] ? i : maxIdx, 0) : 0;
    
    const legsPeakTime = validIndices.length ? times[validIndices[legsPeakIdx]] * 1000 : 0;
    const armsPeakTime = validIndices.length ? times[validIndices[armsPeakIdx]] * 1000 : 0;
    
    const hasBatKE = batKEs.length > 0 && Math.max(...batKEs) > 1;
    
    swingMetrics.set(movementId, {
      movementId,
      batKE: batKE95,
      armsKE: armsKE95,
      legsKE: legsKE95,
      torsoKE: torsoKE95,
      totalKE: totalKE95,
      batEfficiency,
      torsoToArmsTransferPct,
      legsPeakTime,
      armsPeakTime,
      hasBatKE,
    });
  }
  
  return swingMetrics;
}

// ============================================================================
// IK FILE PROCESSING (OPTIONAL - SUPPORT ONLY)
// ============================================================================

export interface IKSwingMetrics {
  movementId: string;
  pelvisVelocity: number;
  torsoVelocity: number;
  xFactor: number;
  xFactorStretchRate: number;
  pelvisPeakTime: number;
  torsoPeakTime: number;
  contactTime: number;
  pelvisTiming: number;
  leadKneeAtContact: number;
  leadElbowAtContact: number;
  rearElbowAtContact: number;
  rearElbowExtRate: number;
  properSequence: boolean;
}

export function processIKFile(
  rows: IKRow[],
  dominantHand: 'L' | 'R' = 'R'
): Map<string, IKSwingMetrics> {
  const swingGroups = new Map<string, IKRow[]>();
  
  for (const row of rows) {
    const movementId = row.org_movement_id;
    if (!movementId || movementId.toLowerCase() === 'n/a') continue;
    
    if (!swingGroups.has(movementId)) {
      swingGroups.set(movementId, []);
    }
    swingGroups.get(movementId)!.push(row);
  }
  
  const swingMetrics = new Map<string, IKSwingMetrics>();
  
  for (const [movementId, frames] of swingGroups) {
    frames.sort((a, b) => parseFloat(a.time || '0') - parseFloat(b.time || '0'));
    
    if (frames.length < 10) continue;
    
    const hasContactMarker = frames[0].time_from_max_hand !== undefined;
    const times = frames.map(f => parseFloat(f.time || '0'));
    
    let swingPhaseFrames: IKRow[];
    let swingPhaseTimes: number[];
    let contactIdx: number;
    
    if (hasContactMarker) {
      const contactTimes = frames.map(f => parseFloat(f.time_from_max_hand || '0'));
      contactIdx = contactTimes.reduce((minIdx, ct, i) => 
        Math.abs(ct) < Math.abs(contactTimes[minIdx]) ? i : minIdx, 0);
      
      swingPhaseFrames = frames.filter((_, i) => contactTimes[i] <= 0.01);
      swingPhaseTimes = times.filter((_, i) => contactTimes[i] <= 0.01);
    } else {
      swingPhaseFrames = frames.filter(f => parseFloat(f.time || '0') <= 0.5);
      swingPhaseTimes = swingPhaseFrames.map(f => parseFloat(f.time || '0'));
      contactIdx = swingPhaseFrames.length - 1;
    }
    
    if (swingPhaseFrames.length < 5) {
      swingPhaseFrames = frames.slice(0, Math.min(100, frames.length));
      swingPhaseTimes = times.slice(0, Math.min(100, times.length));
      contactIdx = swingPhaseFrames.length - 1;
    }
    
    // Parse rotations (radians)
    const pelvisRots = swingPhaseFrames.map(f => parseFloat(f.pelvis_rot || '0'));
    const torsoRots = swingPhaseFrames.map(f => parseFloat(f.torso_rot || '0'));
    
    // Calculate velocities in deg/s
    const pelvisVelsRad = calculateVelocities(pelvisRots, swingPhaseTimes);
    const torsoVelsRad = calculateVelocities(torsoRots, swingPhaseTimes);
    
    const pelvisVelsDeg = pelvisVelsRad.map(radToDeg);
    const torsoVelsDeg = torsoVelsRad.map(radToDeg);
    
    // Peak velocities
    const pelvisPeakVel = pelvisVelsDeg.length 
      ? Math.max(...pelvisVelsDeg.map(Math.abs)) : 0;
    const torsoPeakVel = torsoVelsDeg.length 
      ? Math.max(...torsoVelsDeg.map(Math.abs)) : 0;
    
    // X-Factor
    const xFactors = swingPhaseFrames.map((_, i) => 
      Math.abs(radToDeg(torsoRots[i]) - radToDeg(pelvisRots[i])));
    const xFactorMax = xFactors.length ? Math.max(...xFactors) : 0;
    
    // X-Factor stretch rate
    const xFactorVels = calculateVelocities(xFactors, swingPhaseTimes);
    const xFactorStretchRate = xFactorVels.length 
      ? Math.max(...xFactorVels.map(Math.abs)) : 0;
    
    // Contact time
    const contactTime = swingPhaseTimes[Math.min(contactIdx, swingPhaseTimes.length - 1)] * 1000;
    
    // Peak timing
    const pelvisPeakIdx = pelvisVelsDeg.length 
      ? pelvisVelsDeg.reduce((maxIdx, v, i) => 
          Math.abs(v) > Math.abs(pelvisVelsDeg[maxIdx]) ? i : maxIdx, 0) : 0;
    const pelvisPeakTime = swingPhaseTimes[pelvisPeakIdx] * 1000;
    
    const torsoPeakIdx = torsoVelsDeg.length 
      ? torsoVelsDeg.reduce((maxIdx, v, i) => 
          Math.abs(v) > Math.abs(torsoVelsDeg[maxIdx]) ? i : maxIdx, 0) : 0;
    const torsoPeakTime = swingPhaseTimes[torsoPeakIdx] * 1000;
    
    // Proper sequence
    const properSequence = pelvisPeakTime < torsoPeakTime;
    
    // Pelvis timing
    const pelvisTiming = contactTime - pelvisPeakTime;
    
    // Joint angles at contact
    const contactFrame = swingPhaseFrames[Math.min(contactIdx, swingPhaseFrames.length - 1)];
    
    const leadKneeCol = dominantHand === 'R' ? 'left_knee' : 'right_knee';
    const leadElbowCol = dominantHand === 'R' ? 'left_elbow' : 'right_elbow';
    const rearElbowCol = dominantHand === 'R' ? 'right_elbow' : 'left_elbow';
    
    const leadKnee = Math.abs(radToDeg(parseFloat(contactFrame[leadKneeCol] || '0')));
    const leadElbow = Math.abs(radToDeg(parseFloat(contactFrame[leadElbowCol] || '0')));
    const rearElbow = Math.abs(radToDeg(parseFloat(contactFrame[rearElbowCol] || '0')));
    
    // Rear elbow extension rate
    const rearElbowAngles = swingPhaseFrames.map(f => parseFloat(f[rearElbowCol] || '0'));
    const rearElbowVels = calculateVelocities(rearElbowAngles, swingPhaseTimes);
    const rearElbowExtRate = rearElbowVels.length 
      ? Math.max(...rearElbowVels) * (180 / Math.PI) : 0;
    
    swingMetrics.set(movementId, {
      movementId,
      pelvisVelocity: pelvisPeakVel,
      torsoVelocity: torsoPeakVel,
      xFactor: xFactorMax,
      xFactorStretchRate,
      pelvisPeakTime,
      torsoPeakTime,
      contactTime,
      pelvisTiming,
      leadKneeAtContact: leadKnee,
      leadElbowAtContact: leadElbow,
      rearElbowAtContact: rearElbow,
      rearElbowExtRate,
      properSequence,
    });
  }
  
  return swingMetrics;
}

// ============================================================================
// KINETIC POTENTIAL PROJECTION CALCULATOR
// ============================================================================

export function calculateKineticProjections(
  swings: SwingMetrics[],
  leak: { type: LeakType },
  playerLevel: string = 'hs'
): KineticProjections {
  if (!swings.length) {
    return {
      batSpeedCurrentMph: 0,
      batSpeedCeilingMph: 0,
      exitVeloCurrentMph: 0,
      exitVeloCeilingMph: 0,
      deliveryEfficiencyPct: 0,
      potentialDeliveryEfficiencyPct: TARGET_DELIVERY_EFFICIENCY_PCT,
      hasProjections: false,
    };
  }
  
  // Calculate averages
  const avgBatKE = avg(swings.map(s => s.batKE));
  const avgArmsKE = avg(swings.map(s => s.armsKE));
  const avgTotalKE = avg(swings.map(s => s.totalKE));
  const avgTorsoToArmsTransfer = avg(swings.map(s => s.torsoToArmsTransferPct));
  const hasBatKE = swings.some(s => s.batKE > 1);
  
  // Calculate delivered energy
  let deliveredEnergyJ: number;
  let deliveryEfficiencyPct: number;
  
  if (hasBatKE && avgBatKE > 0) {
    deliveredEnergyJ = avgBatKE;
    deliveryEfficiencyPct = avgTotalKE > 0 ? (avgBatKE / avgTotalKE) * 100 : 0;
  } else {
    // Proxy: arms KE * torso-to-arms transfer
    deliveredEnergyJ = avgArmsKE * (avgTorsoToArmsTransfer / 100);
    deliveryEfficiencyPct = avgTotalKE > 0 
      ? (deliveredEnergyJ / avgTotalKE) * 100 
      : clamp(avgTorsoToArmsTransfer * 0.5, 0, 60);
  }
  
  // Calculate potential delivered energy (if leaks closed)
  const potentialDeliveredEnergyJ = avgTotalKE * (TARGET_DELIVERY_EFFICIENCY_PCT / 100);
  
  // Bat speed model: BS = K * sqrt(delivered energy)
  let batSpeedCurrentMph = K_BAT_SPEED * Math.sqrt(Math.max(deliveredEnergyJ, 0));
  let batSpeedCeilingMph = K_BAT_SPEED * Math.sqrt(Math.max(potentialDeliveredEnergyJ, deliveredEnergyJ));
  
  // Leak penalty guardrails
  if (leak.type === LeakType.NO_BAT_DELIVERY || deliveryEfficiencyPct < 30) {
    // Ensure ceiling is at least +10 mph above current
    const minCeiling = batSpeedCurrentMph + 10;
    batSpeedCeilingMph = Math.max(batSpeedCeilingMph, minCeiling);
  } else if (deliveryEfficiencyPct < 45) {
    // Ensure ceiling is at least +6 mph above current
    const minCeiling = batSpeedCurrentMph + 6;
    batSpeedCeilingMph = Math.max(batSpeedCeilingMph, minCeiling);
  }
  
  // Get clamps for player level
  const clamps = BAT_SPEED_CLAMPS[playerLevel] || BAT_SPEED_CLAMPS.hs;
  
  // Clamp bat speeds
  batSpeedCurrentMph = clamp(Math.round(batSpeedCurrentMph), clamps.min, clamps.max);
  batSpeedCeilingMph = clamp(Math.round(batSpeedCeilingMph), batSpeedCurrentMph, clamps.max);
  
  // Exit Velo model: EV = 1.25 * BS + 5
  const exitVeloCurrentMph = clamp(Math.round(1.25 * batSpeedCurrentMph + 5), 55, 115);
  const exitVeloCeilingMph = clamp(Math.round(1.25 * batSpeedCeilingMph + 5), exitVeloCurrentMph, 120);
  
  return {
    batSpeedCurrentMph,
    batSpeedCeilingMph,
    exitVeloCurrentMph,
    exitVeloCeilingMph,
    deliveryEfficiencyPct: Math.round(deliveryEfficiencyPct * 10) / 10,
    potentialDeliveryEfficiencyPct: TARGET_DELIVERY_EFFICIENCY_PCT,
    hasProjections: true,
  };
}

// ============================================================================
// LEAK DETECTION (MOMENTUM-BASED)
// ============================================================================

export function detectLeakType(swings: SwingMetrics[]): {
  type: LeakType;
  caption: string;
  trainingMeaning: string;
} {
  if (!swings.length) {
    return { type: LeakType.UNKNOWN, caption: '', trainingMeaning: '' };
  }
  
  const avgBatEfficiency = avg(swings.map(s => s.batEfficiency));
  const avgTorsoToArms = avg(swings.map(s => s.torsoToArmsTransferPct));
  const hasBatKE = swings.some(s => s.batKE > 1);
  
  // Check for no bat delivery (low efficiency or no bat KE)
  if (!hasBatKE || avgBatEfficiency < 20) {
    const msg = LEAK_MESSAGES[LeakType.NO_BAT_DELIVERY];
    return { type: LeakType.NO_BAT_DELIVERY, caption: msg.caption, trainingMeaning: msg.training };
  }
  
  // If we have IK data, use timing-based detection
  const hasIKData = swings.some(s => s.pelvisVelocity > 0);
  
  if (hasIKData) {
    const avgPelvisTiming = avg(swings.filter(s => s.pelvisTiming > 0).map(s => s.pelvisTiming));
    const avgProperSeq = swings.filter(s => s.properSequence).length / swings.length;
    
    const lateEnginePct = swings.filter(s => 
      s.legsKEPeakTime > s.contactTime).length / swings.length;
    
    const earlyArmsPct = swings.filter(s => 
      s.armsKEPeakTime < s.pelvisPeakTime).length / swings.length;
    
    if (lateEnginePct > 0.5) {
      const msg = LEAK_MESSAGES[LeakType.LATE_ENGINE];
      return { type: LeakType.LATE_ENGINE, caption: msg.caption, trainingMeaning: msg.training };
    }
    
    if (avgProperSeq < 0.4) {
      const msg = LEAK_MESSAGES[LeakType.CORE_DISCONNECT];
      return { type: LeakType.CORE_DISCONNECT, caption: msg.caption, trainingMeaning: msg.training };
    }
    
    if (earlyArmsPct > 0.5) {
      const msg = LEAK_MESSAGES[LeakType.EARLY_BACK_LEG_RELEASE];
      return { type: LeakType.EARLY_BACK_LEG_RELEASE, caption: msg.caption, trainingMeaning: msg.training };
    }
    
    if (avgPelvisTiming < 30) {
      const msg = LEAK_MESSAGES[LeakType.LATE_LEAD_LEG_ACCEPTANCE];
      return { type: LeakType.LATE_LEAD_LEG_ACCEPTANCE, caption: msg.caption, trainingMeaning: msg.training };
    }
    
    if (avgPelvisTiming > 200) {
      const msg = LEAK_MESSAGES[LeakType.GLIDE_WITHOUT_CAPTURE];
      return { type: LeakType.GLIDE_WITHOUT_CAPTURE, caption: msg.caption, trainingMeaning: msg.training };
    }
  }
  
  // ME-only leak detection based on energy transfer patterns
  if (avgTorsoToArms < 60) {
    const msg = LEAK_MESSAGES[LeakType.CORE_DISCONNECT];
    return { type: LeakType.CORE_DISCONNECT, caption: msg.caption, trainingMeaning: msg.training };
  }
  
  // Check for good transfer
  if (avgBatEfficiency >= 35) {
    const msg = LEAK_MESSAGES[LeakType.CLEAN_TRANSFER];
    return { type: LeakType.CLEAN_TRANSFER, caption: msg.caption, trainingMeaning: msg.training };
  }
  
  return { type: LeakType.UNKNOWN, caption: '', trainingMeaning: '' };
}

// ============================================================================
// MAIN SCORING FUNCTION (ME-PRIMARY)
// ============================================================================

export function calculate4BScores(
  ikRows: IKRow[] | null,
  meRows: MERow[],
  dominantHand: 'L' | 'R' = 'R',
  playerLevel: string = 'hs'
): FourBScores {
  // Initialize result
  const result: FourBScores = {
    brain: 50,
    body: 50,
    bat: 50,
    ball: 50,
    catchBarrelScore: 50,
    grades: {
      brain: 'Average',
      body: 'Average',
      bat: 'Average',
      ball: 'Average',
      overall: 'Average',
    },
    components: {
      groundFlow: 50,
      coreFlow: 50,
      upperFlow: 50,
    },
    rawMetrics: {},
    leak: {
      type: LeakType.UNKNOWN,
      caption: '',
      trainingMeaning: '',
    },
    projections: {
      batSpeedCurrentMph: 0,
      batSpeedCeilingMph: 0,
      exitVeloCurrentMph: 0,
      exitVeloCeilingMph: 0,
      deliveryEfficiencyPct: 0,
      potentialDeliveryEfficiencyPct: TARGET_DELIVERY_EFFICIENCY_PCT,
      hasProjections: false,
    },
    dataQuality: {
      swingCount: 0,
      hasContactEvent: false,
      hasBatKE: false,
      batKECoverage: 0,
      cvScoresValid: false,
      incompleteSwings: [],
      warnings: [],
      hasMEData: false,
      hasIKData: false,
    },
    swings: [],
  };
  
  // ME is REQUIRED
  if (!meRows || meRows.length === 0) {
    result.dataQuality.warnings.push('ME file required for 4B scoring');
    return result;
  }
  
  // Process ME file (PRIMARY)
  const meMetrics = processMEFile(meRows);
  result.dataQuality.hasMEData = meMetrics.size > 0;
  
  if (meMetrics.size === 0) {
    result.dataQuality.warnings.push('No valid swings found in ME file');
    return result;
  }
  
  // Process IK file (OPTIONAL)
  const ikMetrics = ikRows && ikRows.length > 0 
    ? processIKFile(ikRows, dominantHand) 
    : new Map<string, IKSwingMetrics>();
  result.dataQuality.hasIKData = ikMetrics.size > 0;
  
  // Build swing data from ME (primary) with optional IK support
  const swings: SwingMetrics[] = [];
  let swingsWithBatKE = 0;
  
  for (const [movementId, meData] of meMetrics) {
    const ikData = ikMetrics.get(movementId);
    
    const swing: SwingMetrics = {
      movementId,
      // IK data (optional, defaults to 0)
      pelvisVelocity: ikData?.pelvisVelocity || 0,
      torsoVelocity: ikData?.torsoVelocity || 0,
      xFactor: ikData?.xFactor || 0,
      xFactorStretchRate: ikData?.xFactorStretchRate || 0,
      pelvisPeakTime: ikData?.pelvisPeakTime || 0,
      torsoPeakTime: ikData?.torsoPeakTime || 0,
      contactTime: ikData?.contactTime || 0,
      pelvisTiming: ikData?.pelvisTiming || 0,
      leadKneeAtContact: ikData?.leadKneeAtContact || 0,
      leadElbowAtContact: ikData?.leadElbowAtContact || 0,
      rearElbowAtContact: ikData?.rearElbowAtContact || 0,
      rearElbowExtRate: ikData?.rearElbowExtRate || 0,
      properSequence: ikData?.properSequence || false,
      // ME data (primary)
      legsKE: meData.legsKE,
      torsoKE: meData.torsoKE,
      armsKE: meData.armsKE,
      batKE: meData.batKE,
      totalKE: meData.totalKE,
      batEfficiency: meData.batEfficiency,
      torsoToArmsTransferPct: meData.torsoToArmsTransferPct,
      legsKEPeakTime: meData.legsPeakTime,
      armsKEPeakTime: meData.armsPeakTime,
    };
    
    if (meData.hasBatKE) swingsWithBatKE++;
    swings.push(swing);
  }
  
  if (!swings.length) {
    result.dataQuality.warnings.push('No valid swings found in files');
    return result;
  }
  
  // Data quality flags
  result.dataQuality.swingCount = swings.length;
  result.dataQuality.hasBatKE = swingsWithBatKE > 0;
  result.dataQuality.batKECoverage = swingsWithBatKE / swings.length;
  result.dataQuality.cvScoresValid = swings.length >= MIN_SWINGS_FOR_CV;
  
  if (!result.dataQuality.hasBatKE) {
    result.dataQuality.warnings.push('Bat KE not available - using transfer proxy');
  }
  
  if (!result.dataQuality.cvScoresValid) {
    result.dataQuality.warnings.push(
      `Need ${MIN_SWINGS_FOR_CV}+ swings for consistency scores`
    );
  }
  
  if (!result.dataQuality.hasIKData) {
    result.dataQuality.warnings.push('IK data not available - using ME-only scoring');
  }
  
  result.swings = swings;
  
  // Extract values
  const legsKEs = swings.map(s => s.legsKE);
  const torsoKEs = swings.map(s => s.torsoKE);
  const armsKEs = swings.map(s => s.armsKE);
  const batKEs = swings.map(s => s.batKE);
  const totalKEs = swings.map(s => s.totalKE);
  const batEffs = swings.map(s => s.batEfficiency);
  const torsoToArmsTransfers = swings.map(s => s.torsoToArmsTransferPct);
  
  // Calculate averages
  const avgLegsKE = avg(legsKEs);
  const avgTorsoKE = avg(torsoKEs);
  const avgArmsKE = avg(armsKEs);
  const avgBatKE = avg(batKEs);
  const avgTotalKE = avg(totalKEs);
  const avgBatEff = avg(batEffs);
  const avgTorsoToArms = avg(torsoToArmsTransfers);
  
  // Store raw metrics
  result.rawMetrics = {
    avgLegsKE: Math.round(avgLegsKE * 10) / 10,
    avgTorsoKE: Math.round(avgTorsoKE * 10) / 10,
    avgArmsKE: Math.round(avgArmsKE * 10) / 10,
    avgBatKE: Math.round(avgBatKE * 10) / 10,
    avgTotalKE: Math.round(avgTotalKE * 10) / 10,
    avgBatEfficiency: Math.round(avgBatEff * 10) / 10,
    avgTorsoToArmsTransfer: Math.round(avgTorsoToArms * 10) / 10,
    swingCount: swings.length,
  };
  
  // Add IK metrics if available
  if (result.dataQuality.hasIKData) {
    const pelvisVels = swings.map(s => s.pelvisVelocity).filter(v => v > 0);
    const torsoVels = swings.map(s => s.torsoVelocity).filter(v => v > 0);
    const xFactors = swings.map(s => s.xFactor).filter(v => v > 0);
    
    result.rawMetrics.avgPelvisVelocity = Math.round(avg(pelvisVels) * 10) / 10;
    result.rawMetrics.avgTorsoVelocity = Math.round(avg(torsoVels) * 10) / 10;
    result.rawMetrics.avgXFactor = Math.round(avg(xFactors) * 10) / 10;
  }
  
  // ========== GROUND FLOW (ME-based) ==========
  const groundFlowScore = to2080Scale(avgLegsKE, THRESHOLDS.legsKE.min, THRESHOLDS.legsKE.max);
  
  // ========== CORE FLOW (ME-based) ==========
  const coreFlowComponents = [
    to2080Scale(avgTorsoKE, THRESHOLDS.torsoKE.min, THRESHOLDS.torsoKE.max),
    to2080Scale(avgTorsoToArms, THRESHOLDS.torsoToArmsTransfer.min, THRESHOLDS.torsoToArmsTransfer.max),
  ];
  const coreFlowScore = Math.round(avg(coreFlowComponents));
  
  // ========== BODY (Ground + Core) ==========
  const bodyScore = Math.round((groundFlowScore + coreFlowScore) / 2);
  
  // ========== BAT (Upper Flow - ME-based) ==========
  let upperFlowComponents: number[];
  if (result.dataQuality.hasBatKE) {
    upperFlowComponents = [
      to2080Scale(avgBatKE, THRESHOLDS.batKE.min, THRESHOLDS.batKE.max),
      to2080Scale(avgArmsKE, THRESHOLDS.armsKE.min, THRESHOLDS.armsKE.max),
      to2080Scale(avgBatEff, THRESHOLDS.batEfficiency.min, THRESHOLDS.batEfficiency.max),
    ];
  } else {
    // Use proxy: arms KE + torso-to-arms transfer
    const deliveryEffProxy = avgArmsKE * (avgTorsoToArms / 100);
    const proxyEffPct = avgTotalKE > 0 ? (deliveryEffProxy / avgTotalKE) * 100 : avgTorsoToArms * 0.4;
    
    upperFlowComponents = [
      to2080Scale(avgArmsKE, THRESHOLDS.armsKE.min, THRESHOLDS.armsKE.max),
      to2080Scale(proxyEffPct, THRESHOLDS.deliveryEfficiency.min, THRESHOLDS.deliveryEfficiency.max),
    ];
  }
  const batScore = Math.round(avg(upperFlowComponents));
  
  // ========== BRAIN (Consistency - ME-based) ==========
  let brainScore = 50;
  if (result.dataQuality.cvScoresValid) {
    const cvLegsKE = calculateCV(legsKEs);
    const cvTorsoKE = calculateCV(torsoKEs);
    const cvArmsKE = calculateCV(armsKEs);
    const cvOutput = result.dataQuality.hasBatKE ? calculateCV(batKEs) : calculateCV(armsKEs);
    
    result.rawMetrics.cvLegsKE = Math.round(cvLegsKE * 10) / 10;
    result.rawMetrics.cvTorsoKE = Math.round(cvTorsoKE * 10) / 10;
    result.rawMetrics.cvArmsKE = Math.round(cvArmsKE * 10) / 10;
    result.rawMetrics.cvOutput = Math.round(cvOutput * 10) / 10;
    
    const brainComponents = [
      to2080Scale(cvLegsKE, THRESHOLDS.cvLegsKE.min, THRESHOLDS.cvLegsKE.max, true),
      to2080Scale(cvTorsoKE, THRESHOLDS.cvTorsoKE.min, THRESHOLDS.cvTorsoKE.max, true),
      to2080Scale(cvOutput, THRESHOLDS.cvOutput.min, THRESHOLDS.cvOutput.max, true),
    ];
    brainScore = Math.round(avg(brainComponents));
  }
  
  // ========== BALL (Output Consistency - ME-based) ==========
  let ballScore = 50;
  if (result.dataQuality.cvScoresValid) {
    const cvTotalKE = calculateCV(totalKEs);
    const cvBatEff = calculateCV(batEffs.filter(e => e > 0));
    
    result.rawMetrics.cvTotalKE = Math.round(cvTotalKE * 10) / 10;
    result.rawMetrics.cvBatEfficiency = Math.round(cvBatEff * 10) / 10;
    
    const ballComponents = [
      to2080Scale(cvTotalKE, THRESHOLDS.cvTotalKE.min, THRESHOLDS.cvTotalKE.max, true),
      to2080Scale(cvBatEff, THRESHOLDS.cvBatEfficiency.min, THRESHOLDS.cvBatEfficiency.max, true),
    ];
    ballScore = Math.round(avg(ballComponents));
  }
  
  // ========== CATCH BARREL SCORE ==========
  const catchBarrelScore = Math.round(
    bodyScore * WEIGHTS.body +
    batScore * WEIGHTS.bat +
    brainScore * WEIGHTS.brain +
    ballScore * WEIGHTS.ball
  );
  
  // ========== LEAK DETECTION ==========
  const leak = detectLeakType(swings);
  
  // ========== KINETIC PROJECTIONS ==========
  const projections = calculateKineticProjections(swings, leak, playerLevel);
  
  // ========== POPULATE RESULT ==========
  result.brain = brainScore;
  result.body = bodyScore;
  result.bat = batScore;
  result.ball = ballScore;
  result.catchBarrelScore = catchBarrelScore;
  
  result.grades = {
    brain: getGrade(brainScore),
    body: getGrade(bodyScore),
    bat: getGrade(batScore),
    ball: getGrade(ballScore),
    overall: getGrade(catchBarrelScore),
  };
  
  result.components = {
    groundFlow: groundFlowScore,
    coreFlow: coreFlowScore,
    upperFlow: batScore,
  };
  
  result.leak = leak;
  result.projections = projections;
  
  return result;
}

// ============================================================================
// LEGACY WRAPPER FUNCTIONS
// ============================================================================

function groupByLegacy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key] ?? 'unknown');
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function processRebootIK(ikData: Record<string, any>[], dominantHand: 'L' | 'R' = 'R'): RebootIKMetrics {
  const leadKneeCol = dominantHand === 'R' ? 'left_knee' : 'right_knee';
  const leadElbowCol = dominantHand === 'R' ? 'left_elbow' : 'right_elbow';
  const rearElbowCol = dominantHand === 'R' ? 'right_elbow' : 'left_elbow';
  const leadHipCol = dominantHand === 'R' ? 'left_hip_flex' : 'right_hip_flex';
  
  const toDegrees = (val: number) => Math.abs(val) > 10 ? val : val * (180 / Math.PI);
  
  const swings = groupByLegacy(ikData, 'org_movement_id' as keyof Record<string, any>);
  
  const processedSwings: any[] = [];
  
  for (const [movementId, rows] of Object.entries(swings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown' || movementId === 'null') continue;
    
    const pelvisRotValues = rows.map((r: any) => toDegrees(parseFloat(r.pelvis_rot) || 0));
    const torsoRotValues = rows.map((r: any) => toDegrees(parseFloat(r.torso_rot) || 0));
    
    const pelvisRotMax = Math.max(...pelvisRotValues.map(Math.abs), 0);
    const torsoRotMax = Math.max(...torsoRotValues.map(Math.abs), 0);
    
    const xFactors = pelvisRotValues.map((p: number, i: number) => Math.abs(p - torsoRotValues[i]));
    const xFactorMax = Math.max(...xFactors, 0);
    
    const leadKneeValues = rows.map((r: any) => toDegrees(parseFloat(r[leadKneeCol]) || 0));
    const leadElbowValues = rows.map((r: any) => toDegrees(parseFloat(r[leadElbowCol]) || 0));
    const rearElbowValues = rows.map((r: any) => toDegrees(parseFloat(r[rearElbowCol]) || 0));
    const leadHipValues = rows.map((r: any) => toDegrees(parseFloat(r[leadHipCol]) || 0));
    
    processedSwings.push({
      pelvisRotMax,
      torsoRotMax,
      xFactorMax,
      leadKneeMax: Math.max(...leadKneeValues.map(Math.abs), 0),
      leadElbowMax: Math.max(...leadElbowValues.map(Math.abs), 0),
      rearElbowMax: Math.max(...rearElbowValues.map(Math.abs), 0),
      leadHipMax: Math.max(...leadHipValues.map(Math.abs), 0),
    });
  }
  
  return {
    avgPelvisRot: avg(processedSwings.map(s => s.pelvisRotMax)),
    avgTorsoRot: avg(processedSwings.map(s => s.torsoRotMax)),
    avgXFactor: avg(processedSwings.map(s => s.xFactorMax)),
    avgLeadHipFlex: avg(processedSwings.map(s => s.leadHipMax)),
    avgLeadKneeFlex: avg(processedSwings.map(s => s.leadKneeMax)),
    avgLeadShoulderElev: 0,
    avgRearShoulderElev: 0,
    avgLeadElbow: avg(processedSwings.map(s => s.leadElbowMax)),
    avgRearElbow: avg(processedSwings.map(s => s.rearElbowMax)),
    swingCount: processedSwings.length,
  };
}

export function processRebootME(meData: Record<string, any>[]): RebootMEMetrics {
  const swings = groupByLegacy(meData, 'org_movement_id' as keyof Record<string, any>);
  
  const processedSwings: any[] = [];
  
  for (const [movementId, rows] of Object.entries(swings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown' || movementId === 'null') continue;
    
    const totalKE = rows.map((r: any) => parseFloat(r.total_kinetic_energy) || 0);
    const batKE = rows.map((r: any) => parseFloat(r.bat_kinetic_energy) || 0);
    const totalMax = Math.max(...totalKE, 1);
    const batMax = Math.max(...batKE, 0);
    
    processedSwings.push({
      totalKEMax: totalMax,
      batKEMax: batMax,
      torsoKEMax: Math.max(...rows.map((r: any) => parseFloat(r.torso_kinetic_energy) || 0), 0),
      armsKEMax: Math.max(...rows.map((r: any) => (parseFloat(r.larm_kinetic_energy) || 0) + (parseFloat(r.rarm_kinetic_energy) || 0) || parseFloat(r.arms_kinetic_energy) || 0), 0),
      legsKEMax: Math.max(...rows.map((r: any) => parseFloat(r.legs_kinetic_energy) || 0), 0),
      energyEfficiency: totalMax > 0 ? (batMax / totalMax) * 100 : 0,
    });
  }
  
  return {
    avgTotalEnergy: avg(processedSwings.map(s => s.totalKEMax)),
    avgBatEnergy: avg(processedSwings.map(s => s.batKEMax)),
    avgTorsoEnergy: avg(processedSwings.map(s => s.torsoKEMax)),
    avgArmsEnergy: avg(processedSwings.map(s => s.armsKEMax)),
    avgLegsEnergy: avg(processedSwings.map(s => s.legsKEMax)),
    avgEnergyEfficiency: avg(processedSwings.map(s => s.energyEfficiency)),
    swingCount: processedSwings.length,
  };
}

/**
 * Calculate Reboot scores using the Momentum-First 4B Bio Engine
 * ME is PRIMARY + REQUIRED, IK is OPTIONAL
 */
export function calculateRebootScores(
  ikData: Record<string, any>[] | null,
  meData: Record<string, any>[],
  dominantHand: 'L' | 'R' = 'R',
  playerLevel: string = 'hs'
): RebootScores {
  // Use the momentum-first scoring function
  const scores = calculate4BScores(ikData as any, meData as any, dominantHand, playerLevel);
  
  // Determine weakest link
  const scoreMap = {
    brain: scores.brain,
    body: scores.body,
    bat: scores.bat,
    ball: scores.ball,
  };
  const weakestLink = (Object.entries(scoreMap).reduce((min, [k, v]) => 
    v < min[1] ? [k, v] : min, ['brain', 100])[0]) as 'brain' | 'body' | 'bat' | 'ball';
  
  // Get IK metrics for legacy compatibility
  const pelvisVel = scores.rawMetrics.avgPelvisVelocity || 0;
  const torsoVel = scores.rawMetrics.avgTorsoVelocity || 0;
  const xFactor = scores.rawMetrics.avgXFactor || 0;
  
  // Convert to legacy format
  return {
    brainScore: scores.brain,
    bodyScore: scores.body,
    batScore: scores.bat,
    ballScore: scores.ball,
    catchBarrelScore: scores.catchBarrelScore,
    
    grades: scores.grades,
    
    // Legacy aliases
    compositeScore: scores.catchBarrelScore,
    grade: scores.grades.overall,
    
    // Flow component scores
    groundFlowScore: scores.components.groundFlow,
    coreFlowScore: scores.components.coreFlow,
    upperFlowScore: scores.components.upperFlow,
    
    // Raw biomechanical metrics (ME-based)
    pelvisVelocity: pelvisVel,
    torsoVelocity: torsoVel,
    xFactor: xFactor,
    xFactorStretchRate: 0,
    batKE: scores.rawMetrics.avgBatKE || 0,
    armsKE: scores.rawMetrics.avgArmsKE || 0,
    legsKE: scores.rawMetrics.avgLegsKE || 0,
    transferEfficiency: scores.rawMetrics.avgBatEfficiency || 0,
    properSequencePct: 0,
    
    // Consistency metrics (CV)
    consistencyCV: scores.rawMetrics.cvOutput || 0,
    consistencyGrade: getConsistencyGrade(scores.rawMetrics.cvOutput || 15),
    cvPelvis: 0,
    cvTorso: 0,
    cvXFactor: 0,
    cvOutput: scores.rawMetrics.cvOutput || 0,
    cvLeadElbow: 0,
    cvRearElbow: 0,
    
    weakestLink,
    
    // New fields
    leak: scores.leak,
    projections: scores.projections,
    dataQuality: scores.dataQuality,
    
    swingCount: scores.dataQuality.swingCount,
    
    // Raw metrics for display
    rawMetrics: {
      avgPelvisVelocity: pelvisVel,
      avgTorsoVelocity: torsoVel,
      avgXFactor: xFactor,
      avgBatKE: scores.rawMetrics.avgBatKE || 0,
      avgBatEfficiency: scores.rawMetrics.avgBatEfficiency || 0,
      cvPelvis: 0,
      cvTorso: 0,
      cvXFactor: 0,
      cvOutput: scores.rawMetrics.cvOutput || 0,
      properSequencePct: 0,
    },
  };
}

/**
 * Detect file type from CSV headers
 */
export function detectRebootFileType(headers: string[]): 'reboot-ik' | 'reboot-me' | null {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // ME file markers (PRIMARY)
  const meMarkers = ['total_kinetic_energy', 'legs_kinetic_energy', 'torso_kinetic_energy', 'arms_kinetic_energy'];
  const isME = meMarkers.some(marker => lowerHeaders.includes(marker));
  
  // IK file markers (OPTIONAL)
  const ikMarkers = ['pelvis_rot', 'torso_rot', 'left_shoulder_plane', 'left_knee', 'right_knee'];
  const isIK = ikMarkers.some(marker => lowerHeaders.includes(marker));
  
  if (isME) return 'reboot-me';
  if (isIK) return 'reboot-ik';
  return null;
}
