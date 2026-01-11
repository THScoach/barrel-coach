/**
 * 4B Bio Engine - Corrected Version
 * =============================================
 * Coach Rick's KRS (Kinetic Report Scoring) System
 * 
 * FIXES APPLIED:
 * 1. Removed erroneous * 1000 from velocity calculations
 * 2. Uses time_from_max_hand for contact detection
 * 3. Filters to swing phase only (time_from_max_hand <= 0)
 * 4. Handles missing Bat KE gracefully
 * 5. Skips CV-based scores when swing count < 3
 * 6. Adds data quality flags
 * 7. Detects leak types for visualization
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
}

export interface SwingMetrics {
  movementId: string;
  
  // Velocities (deg/s)
  pelvisVelocity: number;
  torsoVelocity: number;
  
  // Separation (degrees)
  xFactor: number;
  xFactorStretchRate: number;
  
  // Timing (ms)
  pelvisPeakTime: number;
  torsoPeakTime: number;
  contactTime: number;
  pelvisTiming: number;
  
  // Kinetic Energy (Joules)
  legsKE: number;
  torsoKE: number;
  armsKE: number;
  batKE: number;
  totalKE: number;
  
  // Angles at contact (degrees)
  leadKneeAtContact: number;
  leadElbowAtContact: number;
  rearElbowAtContact: number;
  
  // Extension rates (deg/s)
  rearElbowExtRate: number;
  
  // Derived
  properSequence: boolean;
  batEfficiency: number;
  
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

// ============================================================================
// CONSTANTS
// ============================================================================

export const THRESHOLDS = {
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
  
  // Consistency (BRAIN) - INVERTED
  cvPelvis: { min: 5, max: 40 },               // percentage
  cvTorso: { min: 5, max: 40 },                // percentage
  cvXFactor: { min: 10, max: 80 },             // percentage
  cvOutput: { min: 10, max: 150 },             // percentage
  
  // Contact Consistency (BALL) - INVERTED
  cvLeadElbow: { min: 5, max: 30 },            // percentage
  cvRearElbow: { min: 5, max: 30 },            // percentage
};

export const WEIGHTS = {
  body: 0.35,
  bat: 0.30,
  brain: 0.20,
  ball: 0.15,
};

export const MIN_SWINGS_FOR_CV = 3;

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

/**
 * Calculate velocities from position values
 * NOTE: No * 1000 multiplier - time is already in seconds
 */
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
  bat_kinetic_energy: string;
  arms_kinetic_energy: string;
  legs_kinetic_energy: string;
  torso_kinetic_energy: string;
  total_kinetic_energy: string;
  [key: string]: string | undefined;
}

// ============================================================================
// IK FILE PROCESSING
// ============================================================================

export function processIKFile(
  rows: IKRow[],
  dominantHand: 'L' | 'R' = 'R'
): Map<string, Partial<SwingMetrics>> {
  // Group by movement_id
  const swingGroups = new Map<string, IKRow[]>();
  
  for (const row of rows) {
    const movementId = row.org_movement_id;
    if (!movementId || movementId.toLowerCase() === 'n/a') continue;
    
    if (!swingGroups.has(movementId)) {
      swingGroups.set(movementId, []);
    }
    swingGroups.get(movementId)!.push(row);
  }
  
  const swingMetrics = new Map<string, Partial<SwingMetrics>>();
  
  for (const [movementId, frames] of swingGroups) {
    // Sort by time
    frames.sort((a, b) => parseFloat(a.time || '0') - parseFloat(b.time || '0'));
    
    if (frames.length < 10) continue;
    
    // Check for contact marker
    const hasContactMarker = frames[0].time_from_max_hand !== undefined;
    
    const times = frames.map(f => parseFloat(f.time || '0'));
    
    // Filter to swing phase
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
      // Fallback: first 0.5 seconds
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
    
    // Calculate velocities in deg/s (NO * 1000!)
    const pelvisVelsRad = calculateVelocities(pelvisRots, swingPhaseTimes);
    const torsoVelsRad = calculateVelocities(torsoRots, swingPhaseTimes);
    
    const pelvisVelsDeg = pelvisVelsRad.map(radToDeg);
    const torsoVelsDeg = torsoVelsRad.map(radToDeg);
    
    // Peak velocities
    const pelvisPeakVel = pelvisVelsDeg.length 
      ? Math.max(...pelvisVelsDeg.map(Math.abs)) : 0;
    const torsoPeakVel = torsoVelsDeg.length 
      ? Math.max(...torsoVelsDeg.map(Math.abs)) : 0;
    
    // X-Factor (swing phase only)
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
// ME FILE PROCESSING
// ============================================================================

export function processMEFile(rows: MERow[]): Map<string, {
  batKE: number;
  armsKE: number;
  legsKE: number;
  torsoKE: number;
  totalKE: number;
  batEfficiency: number;
  legsPeakTime: number;
  armsPeakTime: number;
  hasBatKE: boolean;
}> {
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
  
  const swingMetrics = new Map();
  
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
    
    // Use 95th percentile
    const batKE95 = batKEs.length ? percentile(batKEs, 95) : 0;
    const armsKE95 = percentile(armsKEs, 95);
    const legsKE95 = percentile(legsKEs, 95);
    const torsoKE95 = percentile(torsoKEs, 95);
    const totalKE95 = percentile(totalKEs, 95);
    
    const batEfficiency = totalKE95 > 0 ? (batKE95 / totalKE95) * 100 : 0;
    
    // Find peak timing
    const legsPeakIdx = legsKEs.length 
      ? legsKEs.reduce((maxIdx, v, i) => v > legsKEs[maxIdx] ? i : maxIdx, 0) : 0;
    const armsPeakIdx = armsKEs.length 
      ? armsKEs.reduce((maxIdx, v, i) => v > armsKEs[maxIdx] ? i : maxIdx, 0) : 0;
    
    const legsPeakTime = validIndices.length ? times[validIndices[legsPeakIdx]] * 1000 : 0;
    const armsPeakTime = validIndices.length ? times[validIndices[armsPeakIdx]] * 1000 : 0;
    
    const hasBatKE = batKEs.length > 0 && Math.max(...batKEs) > 1;
    
    swingMetrics.set(movementId, {
      batKE: batKE95,
      armsKE: armsKE95,
      legsKE: legsKE95,
      torsoKE: torsoKE95,
      totalKE: totalKE95,
      batEfficiency,
      legsPeakTime,
      armsPeakTime,
      hasBatKE,
    });
  }
  
  return swingMetrics;
}

// ============================================================================
// LEAK DETECTION
// ============================================================================

export function detectLeakType(swings: SwingMetrics[]): {
  type: LeakType;
  caption: string;
  trainingMeaning: string;
} {
  if (!swings.length) {
    return { type: LeakType.UNKNOWN, caption: '', trainingMeaning: '' };
  }
  
  const avgPelvisTiming = avg(swings.map(s => s.pelvisTiming));
  const avgProperSeq = swings.filter(s => s.properSequence).length / swings.length;
  
  const lateEnginePct = swings.filter(s => 
    s.legsKEPeakTime > s.contactTime).length / swings.length;
  
  const earlyArmsPct = swings.filter(s => 
    s.armsKEPeakTime < s.pelvisPeakTime).length / swings.length;
  
  // Determine primary leak
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
  
  if (avgProperSeq > 0.8 && avgPelvisTiming >= 50 && avgPelvisTiming <= 150) {
    const msg = LEAK_MESSAGES[LeakType.CLEAN_TRANSFER];
    return { type: LeakType.CLEAN_TRANSFER, caption: msg.caption, trainingMeaning: msg.training };
  }
  
  return { type: LeakType.UNKNOWN, caption: '', trainingMeaning: '' };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

export function calculate4BScores(
  ikRows: IKRow[],
  meRows: MERow[],
  dominantHand: 'L' | 'R' = 'R'
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
    dataQuality: {
      swingCount: 0,
      hasContactEvent: false,
      hasBatKE: false,
      batKECoverage: 0,
      cvScoresValid: false,
      incompleteSwings: [],
      warnings: [],
    },
    swings: [],
  };
  
  // Process files
  const ikMetrics = processIKFile(ikRows as IKRow[], dominantHand);
  const meMetrics = processMEFile(meRows as MERow[]);
  
  // Merge swing data
  const swings: SwingMetrics[] = [];
  let swingsWithBatKE = 0;
  
  for (const [movementId, ikData] of ikMetrics) {
    const meData = meMetrics.get(movementId) || {
      batKE: 0, armsKE: 0, legsKE: 0, torsoKE: 0, totalKE: 0,
      batEfficiency: 0, legsPeakTime: 0, armsPeakTime: 0, hasBatKE: false,
    };
    
    const swing: SwingMetrics = {
      movementId,
      pelvisVelocity: ikData.pelvisVelocity || 0,
      torsoVelocity: ikData.torsoVelocity || 0,
      xFactor: ikData.xFactor || 0,
      xFactorStretchRate: ikData.xFactorStretchRate || 0,
      pelvisPeakTime: ikData.pelvisPeakTime || 0,
      torsoPeakTime: ikData.torsoPeakTime || 0,
      contactTime: ikData.contactTime || 0,
      pelvisTiming: ikData.pelvisTiming || 0,
      legsKE: meData.legsKE,
      torsoKE: meData.torsoKE,
      armsKE: meData.armsKE,
      batKE: meData.batKE,
      totalKE: meData.totalKE,
      leadKneeAtContact: ikData.leadKneeAtContact || 0,
      leadElbowAtContact: ikData.leadElbowAtContact || 0,
      rearElbowAtContact: ikData.rearElbowAtContact || 0,
      rearElbowExtRate: ikData.rearElbowExtRate || 0,
      properSequence: ikData.properSequence || false,
      batEfficiency: meData.batEfficiency,
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
    result.dataQuality.warnings.push('Bat KE data missing - BAT score uses partial components');
  }
  
  if (!result.dataQuality.cvScoresValid) {
    result.dataQuality.warnings.push(
      `Need ${MIN_SWINGS_FOR_CV}+ swings for consistency scores - BRAIN/BALL scores set to average`
    );
  }
  
  result.swings = swings;
  
  // Extract values
  const pelvisVels = swings.map(s => s.pelvisVelocity);
  const torsoVels = swings.map(s => s.torsoVelocity);
  const xFactors = swings.map(s => s.xFactor);
  const xFactorRates = swings.map(s => s.xFactorStretchRate);
  const legsKEs = swings.map(s => s.legsKE);
  const armsKEs = swings.map(s => s.armsKE);
  const batKEs = swings.map(s => s.batKE);
  const batEffs = swings.map(s => s.batEfficiency);
  const leadKnees = swings.map(s => s.leadKneeAtContact);
  const rearElbowRates = swings.map(s => s.rearElbowExtRate);
  const leadElbows = swings.map(s => s.leadElbowAtContact);
  const rearElbows = swings.map(s => s.rearElbowAtContact);
  const pelvisTimings = swings.map(s => s.pelvisTiming);
  const properSeqCount = swings.filter(s => s.properSequence).length;
  
  // Calculate averages
  const avgPelvisVel = avg(pelvisVels);
  const avgTorsoVel = avg(torsoVels);
  const avgXFactor = avg(xFactors);
  const avgXFactorRate = avg(xFactorRates);
  const avgLegsKE = avg(legsKEs);
  const avgArmsKE = avg(armsKEs);
  const avgBatKE = avg(batKEs);
  const avgBatEff = avg(batEffs);
  const avgLeadKnee = avg(leadKnees);
  const avgRearElbowRate = avg(rearElbowRates);
  const avgPelvisTiming = avg(pelvisTimings);
  const properSeqPct = (properSeqCount / swings.length) * 100;
  
  // Store raw metrics
  result.rawMetrics = {
    avgPelvisVelocity: Math.round(avgPelvisVel * 10) / 10,
    avgTorsoVelocity: Math.round(avgTorsoVel * 10) / 10,
    avgXFactor: Math.round(avgXFactor * 10) / 10,
    avgXFactorRate: Math.round(avgXFactorRate * 10) / 10,
    avgLegsKE: Math.round(avgLegsKE * 10) / 10,
    avgArmsKE: Math.round(avgArmsKE * 10) / 10,
    avgBatKE: Math.round(avgBatKE * 10) / 10,
    avgBatEfficiency: Math.round(avgBatEff * 10) / 10,
    avgLeadKnee: Math.round(avgLeadKnee * 10) / 10,
    avgPelvisTiming: Math.round(avgPelvisTiming * 10) / 10,
    properSequencePct: Math.round(properSeqPct * 10) / 10,
    swingCount: swings.length,
  };
  
  // ========== GROUND FLOW ==========
  const groundFlowComponents = [
    to2080Scale(avgPelvisVel, THRESHOLDS.pelvisVelocity.min, THRESHOLDS.pelvisVelocity.max),
    to2080Scale(avgLegsKE, THRESHOLDS.legsKE.min, THRESHOLDS.legsKE.max),
    to2080Scale(avgPelvisTiming, THRESHOLDS.pelvisTiming.min, THRESHOLDS.pelvisTiming.max),
    to2080Scale(avgLeadKnee, THRESHOLDS.leadKneeAtContact.min, THRESHOLDS.leadKneeAtContact.max),
  ];
  const groundFlow = Math.round(avg(groundFlowComponents));
  
  // ========== CORE FLOW ==========
  const coreFlowComponents = [
    to2080Scale(avgTorsoVel, THRESHOLDS.torsoVelocity.min, THRESHOLDS.torsoVelocity.max),
    to2080Scale(avgXFactor, THRESHOLDS.xFactorMax.min, THRESHOLDS.xFactorMax.max),
    to2080Scale(avgXFactorRate, THRESHOLDS.xFactorStretchRate.min, THRESHOLDS.xFactorStretchRate.max),
    to2080Scale(properSeqPct, THRESHOLDS.properSequencePct.min, THRESHOLDS.properSequencePct.max),
  ];
  const coreFlow = Math.round(avg(coreFlowComponents));
  
  // ========== BODY ==========
  const bodyScore = Math.round((groundFlow + coreFlow) / 2);
  
  // ========== BAT (Upper Flow) ==========
  let upperFlowComponents: number[];
  if (result.dataQuality.hasBatKE) {
    upperFlowComponents = [
      to2080Scale(avgBatKE, THRESHOLDS.batKE.min, THRESHOLDS.batKE.max),
      to2080Scale(avgArmsKE, THRESHOLDS.armsKE.min, THRESHOLDS.armsKE.max),
      to2080Scale(avgRearElbowRate, THRESHOLDS.rearElbowExtRate.min, THRESHOLDS.rearElbowExtRate.max),
      to2080Scale(avgBatEff, THRESHOLDS.batEfficiency.min, THRESHOLDS.batEfficiency.max),
    ];
  } else {
    upperFlowComponents = [
      to2080Scale(avgArmsKE, THRESHOLDS.armsKE.min, THRESHOLDS.armsKE.max),
      to2080Scale(avgRearElbowRate, THRESHOLDS.rearElbowExtRate.min, THRESHOLDS.rearElbowExtRate.max),
    ];
  }
  const batScore = Math.round(avg(upperFlowComponents));
  
  // ========== BRAIN (Consistency) ==========
  let brainScore = 50;
  if (result.dataQuality.cvScoresValid) {
    const cvPelvis = calculateCV(pelvisVels);
    const cvTorso = calculateCV(torsoVels);
    const cvXFactor = calculateCV(xFactors);
    const cvOutput = result.dataQuality.hasBatKE ? calculateCV(batKEs) : calculateCV(armsKEs);
    
    result.rawMetrics.cvPelvis = Math.round(cvPelvis * 10) / 10;
    result.rawMetrics.cvTorso = Math.round(cvTorso * 10) / 10;
    result.rawMetrics.cvXFactor = Math.round(cvXFactor * 10) / 10;
    result.rawMetrics.cvOutput = Math.round(cvOutput * 10) / 10;
    
    const brainComponents = [
      to2080Scale(cvPelvis, THRESHOLDS.cvPelvis.min, THRESHOLDS.cvPelvis.max, true),
      to2080Scale(cvTorso, THRESHOLDS.cvTorso.min, THRESHOLDS.cvTorso.max, true),
      to2080Scale(cvXFactor, THRESHOLDS.cvXFactor.min, THRESHOLDS.cvXFactor.max, true),
      to2080Scale(cvOutput, THRESHOLDS.cvOutput.min, THRESHOLDS.cvOutput.max, true),
    ];
    brainScore = Math.round(avg(brainComponents));
  }
  
  // ========== BALL (Contact Consistency) ==========
  let ballScore = 50;
  if (result.dataQuality.cvScoresValid) {
    const cvLeadElbow = calculateCV(leadElbows);
    const cvRearElbow = calculateCV(rearElbows);
    
    result.rawMetrics.cvLeadElbow = Math.round(cvLeadElbow * 10) / 10;
    result.rawMetrics.cvRearElbow = Math.round(cvRearElbow * 10) / 10;
    
    const ballComponents = [
      to2080Scale(cvLeadElbow, THRESHOLDS.cvLeadElbow.min, THRESHOLDS.cvLeadElbow.max, true),
      to2080Scale(cvRearElbow, THRESHOLDS.cvRearElbow.min, THRESHOLDS.cvRearElbow.max, true),
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
    groundFlow,
    coreFlow,
    upperFlow: batScore,
  };
  
  result.leak = leak;
  
  return result;
}

// ============================================================================
// LEGACY WRAPPER FUNCTIONS
// ============================================================================

/**
 * Legacy processRebootIK function for backward compatibility
 */
export function processRebootIK(ikData: Record<string, any>[], dominantHand: 'L' | 'R' = 'R'): RebootIKMetrics {
  const leadKneeCol = dominantHand === 'R' ? 'left_knee' : 'right_knee';
  const leadElbowCol = dominantHand === 'R' ? 'left_elbow' : 'right_elbow';
  const rearElbowCol = dominantHand === 'R' ? 'right_elbow' : 'left_elbow';
  const leadHipCol = dominantHand === 'R' ? 'left_hip_flex' : 'right_hip_flex';
  
  const toDegrees = (val: number) => Math.abs(val) > 10 ? val : val * (180 / Math.PI);
  
  // Group by movement_id
  const swings = groupBy(ikData, 'org_movement_id' as keyof Record<string, any>);
  
  const processedSwings: any[] = [];
  
  for (const [movementId, rows] of Object.entries(swings)) {
    if (movementId === 'n/a' || movementId === 'undefined' || movementId === 'unknown' || movementId === 'null') continue;
    
    const pelvisRotValues = rows.map((r: any) => toDegrees(parseFloat(r.pelvis_rot) || 0));
    const torsoRotValues = rows.map((r: any) => toDegrees(parseFloat(r.torso_rot) || 0));
    const xFactorValues = rows.map((r: any) => 
      Math.abs(toDegrees(parseFloat(r.torso_rot) || 0) - toDegrees(parseFloat(r.pelvis_rot) || 0))
    );
    
    processedSwings.push({
      pelvisRotMax: Math.max(...pelvisRotValues.map(Math.abs), 0),
      torsoRotMax: Math.max(...torsoRotValues.map(Math.abs), 0),
      xFactorMax: Math.max(...xFactorValues, 0),
      leadHipFlexMax: Math.max(...rows.map((r: any) => Math.abs(toDegrees(parseFloat(r[leadHipCol]) || 0))), 0),
      leadKneeFlexMax: Math.max(...rows.map((r: any) => Math.abs(toDegrees(parseFloat(r[leadKneeCol]) || 0))), 0),
      leadShoulderElevMax: Math.max(...rows.map((r: any) => Math.abs(toDegrees(parseFloat(r.left_shoulder_elev) || 0))), 0),
      rearShoulderElevMax: Math.max(...rows.map((r: any) => Math.abs(toDegrees(parseFloat(r.right_shoulder_elev) || 0))), 0),
      leadElbowMax: Math.max(...rows.map((r: any) => Math.abs(toDegrees(parseFloat(r[leadElbowCol]) || 0))), 0),
      rearElbowMax: Math.max(...rows.map((r: any) => Math.abs(toDegrees(parseFloat(r[rearElbowCol]) || 0))), 0),
    });
  }
  
  return {
    avgPelvisRot: avg(processedSwings.map(s => s.pelvisRotMax)),
    avgTorsoRot: avg(processedSwings.map(s => s.torsoRotMax)),
    avgXFactor: avg(processedSwings.map(s => s.xFactorMax)),
    avgLeadHipFlex: avg(processedSwings.map(s => s.leadHipFlexMax)),
    avgLeadKneeFlex: avg(processedSwings.map(s => s.leadKneeFlexMax)),
    avgLeadShoulderElev: avg(processedSwings.map(s => s.leadShoulderElevMax)),
    avgRearShoulderElev: avg(processedSwings.map(s => s.rearShoulderElevMax)),
    avgLeadElbow: avg(processedSwings.map(s => s.leadElbowMax)),
    avgRearElbow: avg(processedSwings.map(s => s.rearElbowMax)),
    swingCount: processedSwings.length,
  };
}

/**
 * Legacy processRebootME function for backward compatibility
 */
export function processRebootME(meData: Record<string, any>[]): RebootMEMetrics {
  const swings = groupBy(meData, 'org_movement_id' as keyof Record<string, any>);
  
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
      armsKEMax: Math.max(...rows.map((r: any) => (parseFloat(r.larm_kinetic_energy) || 0) + (parseFloat(r.rarm_kinetic_energy) || 0)), 0),
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
 * Calculate Reboot scores using the new corrected 4B Bio Engine
 * This is the main function called by the upload modal
 */
export function calculateRebootScores(
  ikData: Record<string, any>[],
  meData: Record<string, any>[],
  dominantHand: 'L' | 'R' = 'R'
): RebootScores {
  // Use the new corrected scoring function
  const scores = calculate4BScores(ikData as any, meData as any, dominantHand);
  
  // Determine weakest link
  const scoreMap = {
    brain: scores.brain,
    body: scores.body,
    bat: scores.bat,
    ball: scores.ball,
  };
  const weakestLink = (Object.entries(scoreMap).reduce((min, [k, v]) => 
    v < min[1] ? [k, v] : min, ['brain', 100])[0]) as 'brain' | 'body' | 'bat' | 'ball';
  
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
    
    // Raw biomechanical metrics
    pelvisVelocity: scores.rawMetrics.avgPelvisVelocity || 0,
    torsoVelocity: scores.rawMetrics.avgTorsoVelocity || 0,
    xFactor: scores.rawMetrics.avgXFactor || 0,
    xFactorStretchRate: scores.rawMetrics.avgXFactorRate || 0,
    batKE: scores.rawMetrics.avgBatKE || 0,
    armsKE: scores.rawMetrics.avgArmsKE || 0,
    legsKE: scores.rawMetrics.avgLegsKE || 0,
    transferEfficiency: scores.rawMetrics.avgBatEfficiency || 0,
    properSequencePct: scores.rawMetrics.properSequencePct || 0,
    
    // Consistency metrics (CV)
    consistencyCV: scores.rawMetrics.cvPelvis || 0,
    consistencyGrade: getConsistencyGrade(scores.rawMetrics.cvPelvis || 15),
    cvPelvis: scores.rawMetrics.cvPelvis || 0,
    cvTorso: scores.rawMetrics.cvTorso || 0,
    cvXFactor: scores.rawMetrics.cvXFactor || 0,
    cvOutput: scores.rawMetrics.cvOutput || 0,
    cvLeadElbow: scores.rawMetrics.cvLeadElbow || 0,
    cvRearElbow: scores.rawMetrics.cvRearElbow || 0,
    
    weakestLink,
    
    // New fields
    leak: scores.leak,
    dataQuality: scores.dataQuality,
    
    swingCount: scores.dataQuality.swingCount,
    
    // Raw metrics for display
    rawMetrics: {
      avgPelvisVelocity: scores.rawMetrics.avgPelvisVelocity || 0,
      avgTorsoVelocity: scores.rawMetrics.avgTorsoVelocity || 0,
      avgXFactor: scores.rawMetrics.avgXFactor || 0,
      avgBatKE: scores.rawMetrics.avgBatKE || 0,
      avgBatEfficiency: scores.rawMetrics.avgBatEfficiency || 0,
      cvPelvis: scores.rawMetrics.cvPelvis || 0,
      cvTorso: scores.rawMetrics.cvTorso || 0,
      cvXFactor: scores.rawMetrics.cvXFactor || 0,
      cvOutput: scores.rawMetrics.cvOutput || 0,
      properSequencePct: scores.rawMetrics.properSequencePct || 0,
    },
  };
}

/**
 * Detect file type from CSV headers
 */
export function detectRebootFileType(headers: string[]): 'reboot-ik' | 'reboot-me' | null {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // IK file markers
  const ikMarkers = ['pelvis_rot', 'torso_rot', 'left_shoulder_plane', 'left_knee', 'right_knee'];
  const isIK = ikMarkers.some(marker => lowerHeaders.includes(marker));
  
  // ME file markers
  const meMarkers = ['total_kinetic_energy', 'bat_kinetic_energy', 'legs_kinetic_energy', 'torso_kinetic_energy'];
  const isME = meMarkers.some(marker => lowerHeaders.includes(marker));
  
  if (isIK) return 'reboot-ik';
  if (isME) return 'reboot-me';
  return null;
}
