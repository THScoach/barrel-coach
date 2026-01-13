import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KRS Target Vector - expected timing of segment peaks relative to contact frame
// These are PHASE OFFSETS (negative = before contact)
const KRS_PHASE = {
  pelvis: -0.20,  // Pelvis peaks 20% before contact
  torso: -0.10,   // Torso peaks 10% before contact
  hip: -0.08,     // Ball-side hip peaks 8% before contact
  knee: -0.05,    // Ball-side knee peaks 5% before contact
  ankle: -0.02,   // Ball-side ankle peaks closest to contact
};

// Default bucket weights
const BUCKET_WEIGHTS = {
  w1: 0.25, // Rotational foundation
  w2: 0.25, // Proximal hip load
  w3: 0.25, // Distal ground
  w4: 0.25, // Temporal sync
};

// Default athlete model (used when no calibrated model exists)
const DEFAULT_MODEL = {
  beta_0: 50,   // Baseline bat speed (mph)
  beta_1: 0.3,  // B1 coefficient
  beta_2: 0.3,  // B2 coefficient
  beta_3: 0.25, // B3 coefficient
  beta_4: 0.15, // B4 coefficient
};

// Default bat mass in kg (~31 oz bat)
const DEFAULT_BAT_MASS_KG = 0.88;

// Magnitude caps for normalization (degrees)
const MAG_CAPS = {
  pelvis: 60,
  torso: 80,
  side: 30,
  hipFlex: 50,
  hipAdd: 40,
  hipRot: 45,
  knee: 70,
  ankleInv: 30,
  ankleFlex: 40,
};

interface IKData {
  rel_frame: number[];
  contact_frame: number;
  stride_frame: number;
  pelvisrot: number[];
  torsorot: number[];
  pelvisside: number[];
  // Ball-side hip (use right for RHH)
  righthipflex: number[];
  righthipadd: number[];
  righthiprot: number[];
  // Ball-side knee/ankle
  rightknee: number[];
  rightankleinv: number[];
  rightankleflex: number[];
  // Left side equivalents for LHH
  lefthipflex?: number[];
  lefthipadd?: number[];
  lefthiprot?: number[];
  leftknee?: number[];
  leftankleinv?: number[];
  leftankleflex?: number[];
  // Optional hand velocity columns
  hand_vel_x?: number[];
  hand_vel_y?: number[];
  hand_vel_z?: number[];
}

interface MEData {
  rel_frame: number[];
  contact_frame: number;
  bat_linear_momentum_x: number[];
  bat_linear_momentum_y: number[];
  bat_linear_momentum_z: number[];
  bat_kinetic_energy: number[];
  total_kinetic_energy: number[];
  // Angular momentum for sync calculation
  pelvis_angular_momentum_mag?: number[];
  torso_angular_momentum_mag?: number[];
  arms_angular_momentum_mag?: number[];
  bat_angular_momentum_mag?: number[];
}

interface BucketScores {
  b1: number;
  b2: number;
  b3: number;
  b4: number;
}

// Contact frame detection methods (ordered by confidence)
type ContactFrameType =
  | 'explicit'
  | 'event_contact'
  | 'hand_decel_proxy'
  | 'bat_ke_peak'
  | 'bat_momentum_peak'
  | 'torso_peak'
  | 'frame_ratio';

interface ContactFrameResult {
  frame: number;
  type: ContactFrameType;
  confidence: 'high' | 'medium' | 'low';
}

interface BatSpeedResult {
  mph: number;
  confidence: 'high' | 'medium' | 'low';
  method: string;
}

// ========================
// UTILITY HELPERS
// ========================

/**
 * Clamp a value between 0 and 1
 */
function clamp01(val: number): number {
  return Math.max(0, Math.min(1, isNaN(val) ? 0 : val));
}

/**
 * Slice an array with safe bounds
 */
function sliceWindow(values: number[], start: number, end: number): number[] {
  if (!values?.length) return [];
  const s = Math.max(0, Math.min(values.length - 1, start));
  const e = Math.max(0, Math.min(values.length - 1, end));
  if (e <= s) return values.slice(s, s + 1);
  return values.slice(s, e + 1);
}

/**
 * Find peak frame within a specific window
 */
function findPeakFrameInWindow(values: number[], start: number, end: number): number {
  if (!values?.length) return 0;
  const s = Math.max(0, Math.min(values.length - 1, start));
  const e = Math.max(0, Math.min(values.length - 1, end));
  let maxIdx = s;
  let maxVal = Math.abs(values[s] || 0);
  for (let i = s + 1; i <= e; i++) {
    const v = Math.abs(values[i] || 0);
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Get peak absolute value within a specific window
 */
function getPeakAbsInWindow(values: number[], start: number, end: number): number {
  if (!values?.length) return 0;
  const s = Math.max(0, Math.min(values.length - 1, start));
  const e = Math.max(0, Math.min(values.length - 1, end));
  let maxVal = 0;
  for (let i = s; i <= e; i++) {
    const v = Math.abs(values[i] || 0);
    if (v > maxVal) maxVal = v;
  }
  return maxVal;
}

/**
 * Find the frame index where a metric reaches its maximum absolute value (full array)
 */
function findPeakFrame(values: number[]): number {
  if (!values?.length) return 0;
  let maxIdx = 0;
  let maxVal = Math.abs(values[0] || 0);
  for (let i = 1; i < values.length; i++) {
    const absVal = Math.abs(values[i] || 0);
    if (absVal > maxVal) {
      maxVal = absVal;
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Get peak absolute value from an array (full array)
 */
function getPeakAbs(values: number[]): number {
  if (!values?.length) return 0;
  let maxVal = 0;
  for (const val of values) {
    const absVal = Math.abs(val || 0);
    if (absVal > maxVal) maxVal = absVal;
  }
  return maxVal;
}

/**
 * Auto-detect radians -> degrees for IK angles
 * If peak is small (<8), it's likely radians (typical torso/pelvis peaks < ~3.5 rad)
 */
function maybeRadiansToDegrees(values: number[]): { values: number[]; converted: boolean } {
  if (!values?.length) return { values: [], converted: false };
  const maxAbs = getPeakAbs(values);
  // If peak is small, it's likely radians
  if (maxAbs > 0 && maxAbs < 8) {
    const DEG = 57.29577951308232; // 180/PI
    return { values: values.map(v => (v || 0) * DEG), converted: true };
  }
  return { values, converted: false };
}

/**
 * Calculate timing error using stride→contact window
 */
function timingError(peakFrame: number, targetFrame: number, swingWindow: number): number {
  if (swingWindow <= 0) return 0;
  return Math.abs(peakFrame - targetFrame) / swingWindow;
}

/**
 * Get target frame for a given phase offset
 */
function getTargetFrame(contactFrame: number, strideFrame: number, phase: number): number {
  const swingWindow = Math.max(1, contactFrame - strideFrame);
  return Math.max(0, Math.round(contactFrame + phase * swingWindow));
}

// ========================
// CSV PARSING
// ========================

/**
 * Parse CSV string into structured data - handles quoted values and blanks safely
 */
function parseCSV(csvContent: string): Record<string, number[]> {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return {};

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const result: Record<string, number[]> = {};
  headers.forEach(h => { result[h] = []; });

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted values and trim whitespace
    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    headers.forEach((header, idx) => {
      const raw = values[idx] ?? '';
      const val = parseFloat(raw);
      result[header].push(Number.isFinite(val) ? val : 0);
    });
  }
  return result;
}

// ========================
// CONTACT FRAME DETECTION
// ========================

/**
 * Compute a proxy "contact" based on hand-speed peak then decel threshold
 */
function findHandDecelContactProxy(
  ik: IKData,
  strideI: number,
  decelPct: number = 0.88,
  maxLookaheadFrames: number = 40
): number | null {
  const handVX = ik.hand_vel_x;
  const handVY = ik.hand_vel_y;
  const handVZ = ik.hand_vel_z;

  if (!handVX?.length || !handVY?.length || !handVZ?.length) return null;

  const n = Math.min(handVX.length, handVY.length, handVZ.length);
  const speed: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = handVX[i] || 0;
    const y = handVY[i] || 0;
    const z = handVZ[i] || 0;
    speed.push(Math.sqrt(x * x + y * y + z * z));
  }

  // Find peak after stride
  const peakI = findPeakFrameInWindow(speed, strideI, n - 1);
  const peakVal = speed[peakI] || 0;
  if (peakVal <= 0) return null;

  const threshold = peakVal * decelPct;
  const end = Math.min(n - 1, peakI + maxLookaheadFrames);

  for (let i = peakI + 1; i <= end; i++) {
    if ((speed[i] || 0) <= threshold) return i;
  }

  // If it never decels in window, use peak itself
  return peakI;
}

/**
 * Detect contact frame using multiple methods with confidence levels
 * Priority: explicit > hand_decel_proxy > bat_ke_peak > bat_momentum_peak > torso_peak > frame_ratio
 */
function detectContactFrame(
  meCsv: Record<string, number[]>,
  ikData?: IKData
): ContactFrameResult {
  const frameCount = meCsv['rel_frame']?.length || meCsv['frame']?.length || 100;

  // 1) Explicit contact frame (if sane)
  const explicit = meCsv['contact_frame']?.[0];
  if (explicit != null && Number.isFinite(explicit) && explicit > 0 && explicit < frameCount) {
    return { frame: Math.round(explicit), type: 'explicit', confidence: 'high' };
  }

  // 2) Hand decel proxy (best "behavioral contact")
  if (ikData) {
    const strideI = ikData.stride_frame ?? Math.floor((ikData.rel_frame?.length || frameCount) * 0.2);
    const proxy = findHandDecelContactProxy(ikData, strideI, 0.88, 40);
    if (proxy != null) {
      return { frame: proxy, type: 'hand_decel_proxy', confidence: 'high' };
    }
  }

  // 3) Bat kinetic energy peak
  const batKE = meCsv['bat_kinetic_energy'] || meCsv['bat_ke'] || [];
  if (batKE.length > 0) {
    const peak = findPeakFrame(batKE);
    if (peak > frameCount * 0.4) {
      return { frame: peak, type: 'bat_ke_peak', confidence: 'medium' };
    }
  }

  // 4) Bat momentum magnitude peak
  const x = meCsv['bat_linear_momentum_x'] || meCsv['bat_mom_x'] || [];
  const y = meCsv['bat_linear_momentum_y'] || meCsv['bat_mom_y'] || [];
  const z = meCsv['bat_linear_momentum_z'] || meCsv['bat_mom_z'] || [];
  if (x.length && y.length && z.length) {
    const n = Math.min(x.length, y.length, z.length);
    const mag: number[] = [];
    for (let i = 0; i < n; i++) {
      mag.push(Math.sqrt((x[i] || 0) ** 2 + (y[i] || 0) ** 2 + (z[i] || 0) ** 2));
    }
    const peak = findPeakFrame(mag);
    if (peak > frameCount * 0.4) {
      return { frame: peak, type: 'bat_momentum_peak', confidence: 'medium' };
    }
  }

  // 5) Torso peak (slightly before contact, so adjust)
  if (ikData?.torsorot?.length) {
    const peak = findPeakFrame(ikData.torsorot);
    const adjusted = Math.min(Math.round(peak * 1.05), frameCount - 1);
    if (adjusted > frameCount * 0.4) {
      return { frame: adjusted, type: 'torso_peak', confidence: 'low' };
    }
  }

  // 6) Fallback ratio
  return { frame: Math.floor(frameCount * 0.8), type: 'frame_ratio', confidence: 'low' };
}

// ========================
// DATA MAPPING
// ========================

/**
 * Map IK CSV data to structured IKData with unit fixes
 */
function mapIKData(csvData: Record<string, number[]>): IKData {
  const frameCount = csvData['rel_frame']?.length || csvData['frame']?.length || 100;

  // Pull raw series
  const pelvisRaw = csvData['pelvisrot'] || csvData['pelvis_rotation'] || [];
  const torsoRaw = csvData['torsorot'] || csvData['torso_rotation'] || [];
  const sideRaw = csvData['pelvisside'] || csvData['pelvis_lateral'] || [];

  // Convert radians->degrees if needed
  const pelvisFix = maybeRadiansToDegrees(pelvisRaw);
  const torsoFix = maybeRadiansToDegrees(torsoRaw);

  // Also check hip/knee/ankle rotations
  const rightHipFlexRaw = csvData['righthipflex'] || csvData['right_hip_flex'] || [];
  const rightHipAddRaw = csvData['righthipadd'] || csvData['right_hip_add'] || [];
  const rightHipRotRaw = csvData['righthiprot'] || csvData['right_hip_rot'] || [];
  const rightKneeRaw = csvData['rightknee'] || csvData['right_knee'] || [];
  const rightAnkleInvRaw = csvData['rightankleinv'] || csvData['right_ankle_inv'] || [];
  const rightAnkleFlexRaw = csvData['rightankleflex'] || csvData['right_ankle_flex'] || [];

  const rightHipFlexFix = maybeRadiansToDegrees(rightHipFlexRaw);
  const rightHipAddFix = maybeRadiansToDegrees(rightHipAddRaw);
  const rightHipRotFix = maybeRadiansToDegrees(rightHipRotRaw);
  const rightKneeFix = maybeRadiansToDegrees(rightKneeRaw);
  const rightAnkleInvFix = maybeRadiansToDegrees(rightAnkleInvRaw);
  const rightAnkleFlexFix = maybeRadiansToDegrees(rightAnkleFlexRaw);

  // Left side (optional)
  const leftHipFlexRaw = csvData['lefthipflex'] || csvData['left_hip_flex'];
  const leftHipAddRaw = csvData['lefthipadd'] || csvData['left_hip_add'];
  const leftHipRotRaw = csvData['lefthiprot'] || csvData['left_hip_rot'];
  const leftKneeRaw = csvData['leftknee'] || csvData['left_knee'];
  const leftAnkleInvRaw = csvData['leftankleinv'] || csvData['left_ankle_inv'];
  const leftAnkleFlexRaw = csvData['leftankleflex'] || csvData['left_ankle_flex'];

  // Map hand velocity columns if present
  const handVX = csvData['hand_vel_x'] || csvData['hand_vx'] || csvData['dom_hand_vel_x'] || [];
  const handVY = csvData['hand_vel_y'] || csvData['hand_vy'] || csvData['dom_hand_vel_y'] || [];
  const handVZ = csvData['hand_vel_z'] || csvData['hand_vz'] || csvData['dom_hand_vel_z'] || [];

  return {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: csvData['contact_frame']?.[0] ?? Math.floor(frameCount * 0.8),
    stride_frame: csvData['stride_frame']?.[0] ?? Math.floor(frameCount * 0.2),

    pelvisrot: pelvisFix.values,
    torsorot: torsoFix.values,
    pelvisside: sideRaw,

    righthipflex: rightHipFlexFix.values,
    righthipadd: rightHipAddFix.values,
    righthiprot: rightHipRotFix.values,
    rightknee: rightKneeFix.values,
    rightankleinv: rightAnkleInvFix.values,
    rightankleflex: rightAnkleFlexFix.values,

    lefthipflex: leftHipFlexRaw ? maybeRadiansToDegrees(leftHipFlexRaw).values : undefined,
    lefthipadd: leftHipAddRaw ? maybeRadiansToDegrees(leftHipAddRaw).values : undefined,
    lefthiprot: leftHipRotRaw ? maybeRadiansToDegrees(leftHipRotRaw).values : undefined,
    leftknee: leftKneeRaw ? maybeRadiansToDegrees(leftKneeRaw).values : undefined,
    leftankleinv: leftAnkleInvRaw ? maybeRadiansToDegrees(leftAnkleInvRaw).values : undefined,
    leftankleflex: leftAnkleFlexRaw ? maybeRadiansToDegrees(leftAnkleFlexRaw).values : undefined,

    // Hand velocity for contact proxy
    hand_vel_x: handVX.length > 0 ? handVX : undefined,
    hand_vel_y: handVY.length > 0 ? handVY : undefined,
    hand_vel_z: handVZ.length > 0 ? handVZ : undefined,
  };
}

/**
 * Map ME CSV data to structured MEData with contact frame detection
 */
function mapMEData(
  csvData: Record<string, number[]>,
  ikData?: IKData
): { me: MEData; contact: ContactFrameResult } {
  const contact = detectContactFrame(csvData, ikData);

  const me: MEData = {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: contact.frame,

    bat_linear_momentum_x: csvData['bat_linear_momentum_x'] || csvData['bat_mom_x'] || [],
    bat_linear_momentum_y: csvData['bat_linear_momentum_y'] || csvData['bat_mom_y'] || [],
    bat_linear_momentum_z: csvData['bat_linear_momentum_z'] || csvData['bat_mom_z'] || [],

    bat_kinetic_energy: csvData['bat_kinetic_energy'] || csvData['bat_ke'] || [],
    total_kinetic_energy: csvData['total_kinetic_energy'] || csvData['total_ke'] || [],

    pelvis_angular_momentum_mag: csvData['pelvis_angular_momentum_mag'] || csvData['pelvis_ang_mom'],
    torso_angular_momentum_mag: csvData['torso_angular_momentum_mag'] || csvData['torso_ang_mom'],
    arms_angular_momentum_mag: csvData['arms_angular_momentum_mag'] || csvData['arms_ang_mom'],
    bat_angular_momentum_mag: csvData['bat_angular_momentum_mag'] || csvData['bat_ang_mom'],
  };

  return { me, contact };
}

// ========================
// BAT SPEED EXTRACTION
// ========================

/**
 * Extract bat speed with priority order and confidence levels
 * A) bat KE -> v = sqrt(2KE/m) (high confidence)
 * B) bat momentum -> v = p/m (medium confidence)
 * C) Fallback (low confidence)
 */
function extractBatSpeed(
  meData: MEData,
  batMassKg: number = DEFAULT_BAT_MASS_KG
): BatSpeedResult {
  const i = Math.max(0, Math.min(meData.bat_linear_momentum_x.length - 1, meData.contact_frame));
  const MPS_TO_MPH = 2.236936;

  // A) If bat KE exists & is non-zero -> compute speed from KE (best if units are trustworthy)
  const ke = meData.bat_kinetic_energy?.[i] ?? 0;
  if (ke > 0.01 && Number.isFinite(ke)) {
    // v = sqrt(2KE/m)
    const vMps = Math.sqrt((2 * ke) / Math.max(1e-6, batMassKg));
    const mph = vMps * MPS_TO_MPH;
    // Sanity cap: 0-120 mph
    return { mph: Math.max(0, Math.min(120, mph)), confidence: 'high', method: 'bat_ke' };
  }

  // B) Use bat momentum magnitude -> v = p/m
  const x = Number(meData.bat_linear_momentum_x[i] ?? 0);
  const y = Number(meData.bat_linear_momentum_y[i] ?? 0);
  const z = Number(meData.bat_linear_momentum_z[i] ?? 0);
  const p = Math.sqrt(x * x + y * y + z * z);

  if (p > 0 && Number.isFinite(p)) {
    // If p is tiny (< ~6), it's probably already velocity data (m/s) or junk
    // Youth often shows low values; MLB momentum is usually larger.
    if (p < 6) {
      const mph = p * MPS_TO_MPH;
      return { mph: Math.max(0, Math.min(120, mph)), confidence: 'low', method: 'velocity_guess' };
    }

    const vMps = p / Math.max(1e-6, batMassKg);
    const mph = vMps * MPS_TO_MPH;
    return { mph: Math.max(0, Math.min(120, mph)), confidence: 'medium', method: 'momentum_over_mass' };
  }

  // C) Fallback
  return { mph: 0, confidence: 'low', method: 'missing' };
}

// ========================
// BUCKET SCORE CALCULATIONS
// ========================

/**
 * Compute Bucket 1: Rotational Foundation (Pelvis & Torso)
 * Uses stride→contact window for peak finding
 */
function computeB1(ikData: IKData): number {
  const start = Math.max(0, ikData.stride_frame);
  const end = Math.max(start + 1, ikData.contact_frame);
  const swingWindow = Math.max(1, end - start);
  
  // Target frames using stride→contact window
  const pelvisTarget = getTargetFrame(end, start, KRS_PHASE.pelvis);
  const torsoTarget = getTargetFrame(end, start, KRS_PHASE.torso);
  
  // Pelvis metrics - windowed search
  const pelvisPeakFrame = findPeakFrameInWindow(ikData.pelvisrot, start, end);
  const pelvisPeakAbs = getPeakAbsInWindow(ikData.pelvisrot, start, end);
  const magPelvis = clamp01(pelvisPeakAbs / MAG_CAPS.pelvis);
  const pelvisTimingErr = timingError(pelvisPeakFrame, pelvisTarget, swingWindow);
  
  // Torso metrics - windowed search
  const torsoPeakFrame = findPeakFrameInWindow(ikData.torsorot, start, end);
  const torsoPeakAbs = getPeakAbsInWindow(ikData.torsorot, start, end);
  const magTorso = clamp01(torsoPeakAbs / MAG_CAPS.torso);
  const torsoTimingErr = timingError(torsoPeakFrame, torsoTarget, swingWindow);
  
  // Pelvis lateral shift - windowed search
  const sidePeakAbs = ikData.pelvisside.length > 0 
    ? getPeakAbsInWindow(ikData.pelvisside, start, end) 
    : 0;
  const magSide = clamp01(sidePeakAbs / MAG_CAPS.side);
  
  // Bucket 1 score (weighted magnitude minus timing penalties)
  const b1Raw = (0.5 * magPelvis + 0.3 * magTorso + 0.2 * magSide) - 
    0.3 * (pelvisTimingErr + torsoTimingErr);
  
  return clamp01(b1Raw) * 100;
}

/**
 * Compute Bucket 2: Proximal Load Transfer (Ball-Side Hip)
 * Uses stride→contact window for peak finding
 */
function computeB2(ikData: IKData, handedness: 'L' | 'R' = 'R'): number {
  const start = Math.max(0, ikData.stride_frame);
  const end = Math.max(start + 1, ikData.contact_frame);
  const swingWindow = Math.max(1, end - start);
  
  // Target frame for hip
  const hipTarget = getTargetFrame(end, start, KRS_PHASE.hip);
  
  // Select ball-side hip data
  const hipFlex = handedness === 'R' ? ikData.righthipflex : (ikData.lefthipflex || []);
  const hipAdd = handedness === 'R' ? ikData.righthipadd : (ikData.lefthipadd || []);
  const hipRot = handedness === 'R' ? ikData.righthiprot : (ikData.lefthiprot || []);
  
  if (!hipFlex.length || !hipAdd.length || !hipRot.length) {
    return 50; // Default if data missing
  }
  
  // Hip flexion - windowed search
  const hipFlexPeak = findPeakFrameInWindow(hipFlex, start, end);
  const magHipFlex = clamp01(getPeakAbsInWindow(hipFlex, start, end) / MAG_CAPS.hipFlex);
  const hipFlexTimingErr = timingError(hipFlexPeak, hipTarget, swingWindow);
  
  // Hip adduction - windowed search
  const magHipAdd = clamp01(getPeakAbsInWindow(hipAdd, start, end) / MAG_CAPS.hipAdd);
  
  // Hip rotation - windowed search
  const magHipRot = clamp01(getPeakAbsInWindow(hipRot, start, end) / MAG_CAPS.hipRot);
  
  // Bucket 2 score
  const b2Raw = (0.4 * magHipFlex + 0.35 * magHipAdd + 0.25 * magHipRot) - 
    0.25 * hipFlexTimingErr;
  
  return clamp01(b2Raw) * 100;
}

/**
 * Compute Bucket 3: Distal Ground Connection (Ball-Side Knee & Ankle)
 * Uses stride→contact window for peak finding
 */
function computeB3(ikData: IKData, handedness: 'L' | 'R' = 'R'): number {
  const start = Math.max(0, ikData.stride_frame);
  const end = Math.max(start + 1, ikData.contact_frame);
  const swingWindow = Math.max(1, end - start);
  
  // Target frames
  const kneeTarget = getTargetFrame(end, start, KRS_PHASE.knee);
  const ankleTarget = getTargetFrame(end, start, KRS_PHASE.ankle);
  
  // Select ball-side knee/ankle data
  const knee = handedness === 'R' ? ikData.rightknee : (ikData.leftknee || []);
  const ankleInv = handedness === 'R' ? ikData.rightankleinv : (ikData.leftankleinv || []);
  const ankleFlex = handedness === 'R' ? ikData.rightankleflex : (ikData.leftankleflex || []);
  
  if (!knee.length || !ankleInv.length || !ankleFlex.length) {
    return 50; // Default if data missing
  }
  
  // Knee metrics - windowed search
  const kneePeak = findPeakFrameInWindow(knee, start, end);
  const magKnee = clamp01(getPeakAbsInWindow(knee, start, end) / MAG_CAPS.knee);
  const kneeTimingErr = timingError(kneePeak, kneeTarget, swingWindow);
  
  // Ankle inversion - windowed search
  const magAnkleInv = clamp01(getPeakAbsInWindow(ankleInv, start, end) / MAG_CAPS.ankleInv);
  
  // Ankle flexion - windowed search
  const anklePeak = findPeakFrameInWindow(ankleFlex, start, end);
  const magAnkleFlex = clamp01(getPeakAbsInWindow(ankleFlex, start, end) / MAG_CAPS.ankleFlex);
  const ankleTimingErr = timingError(anklePeak, ankleTarget, swingWindow);
  
  // Bucket 3 score
  const b3Raw = (0.4 * magKnee + 0.35 * magAnkleInv + 0.25 * magAnkleFlex) - 
    0.2 * (kneeTimingErr + ankleTimingErr);
  
  return clamp01(b3Raw) * 100;
}

/**
 * Compute Bucket 4: Temporal Synchronization
 * Uses stride→contact window for peak finding
 */
function computeB4(meData: MEData, strideFrame: number, contactFrame: number): number {
  const start = Math.max(0, strideFrame);
  const end = Math.max(start + 1, contactFrame);
  const swingWindow = Math.max(1, end - start);
  
  // Get angular momentum peaks for each segment within swing window
  const segmentPeaks: number[] = [];
  
  if (meData.pelvis_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrameInWindow(meData.pelvis_angular_momentum_mag, start, end));
  }
  if (meData.torso_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrameInWindow(meData.torso_angular_momentum_mag, start, end));
  }
  if (meData.arms_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrameInWindow(meData.arms_angular_momentum_mag, start, end));
  }
  if (meData.bat_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrameInWindow(meData.bat_angular_momentum_mag, start, end));
  }
  
  if (segmentPeaks.length < 2) {
    return 50; // Default if insufficient data
  }
  
  // Normalize peaks to swing window
  const normalizedPeaks = segmentPeaks.map(p => (p - start) / swingWindow);
  
  // Calculate phase scatter (std dev of peak timings)
  const mean = normalizedPeaks.reduce((a, b) => a + b, 0) / normalizedPeaks.length;
  const variance = normalizedPeaks.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / normalizedPeaks.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower scatter = higher synchronization score
  const maxExpectedScatter = 0.3;
  const b4Raw = 1 - (stdDev / maxExpectedScatter);
  
  return clamp01(b4Raw) * 100;
}

/**
 * Compute expected bat speed from KRS using athlete model
 */
function computeExpectedBatSpeed(
  buckets: BucketScores,
  model: typeof DEFAULT_MODEL
): number {
  return model.beta_0 + 
    model.beta_1 * buckets.b1 + 
    model.beta_2 * buckets.b2 + 
    model.beta_3 * buckets.b3 + 
    model.beta_4 * buckets.b4;
}

/**
 * Attribute mechanical loss to individual buckets
 */
function attributeBucketLoss(
  buckets: BucketScores,
  model: typeof DEFAULT_MODEL,
  mechanicalLoss: number | null
): { breakdown: Record<string, number>; primary: 'B1' | 'B2' | 'B3' | 'B4' } {
  // Calculate expected contribution from each bucket at 100% efficiency
  const idealB1 = 100 * model.beta_1;
  const idealB2 = 100 * model.beta_2;
  const idealB3 = 100 * model.beta_3;
  const idealB4 = 100 * model.beta_4;
  
  // Calculate actual contribution
  const actualB1 = buckets.b1 * model.beta_1;
  const actualB2 = buckets.b2 * model.beta_2;
  const actualB3 = buckets.b3 * model.beta_3;
  const actualB4 = buckets.b4 * model.beta_4;
  
  // Loss per bucket
  const breakdown = {
    B1: Math.max(0, idealB1 - actualB1),
    B2: Math.max(0, idealB2 - actualB2),
    B3: Math.max(0, idealB3 - actualB3),
    B4: Math.max(0, idealB4 - actualB4),
  };
  
  // Find primary issue
  const primary = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])[0][0] as 'B1' | 'B2' | 'B3' | 'B4';
  
  return { breakdown, primary };
}

/**
 * Get 20-80 scale grade
 */
function getGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 45) return "Average";
  if (score >= 40) return "Below Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

/**
 * Map bucket to weakest link label
 */
function bucketToWeakestLink(bucket: 'B1' | 'B2' | 'B3' | 'B4'): string {
  const map = {
    'B1': 'body', // Rotational foundation
    'B2': 'body', // Proximal hip
    'B3': 'body', // Distal ground
    'B4': 'brain', // Temporal sync
  };
  return map[bucket];
}

/**
 * Get primary issue description for coaching feedback
 */
function getPrimaryIssueDetails(bucket: 'B1' | 'B2' | 'B3' | 'B4'): { title: string; description: string; category: string } {
  const details = {
    'B1': {
      title: 'Rotational Foundation',
      description: 'Late pelvis/torso rotation timing. Focus on initiating rotation earlier in the swing.',
      category: 'body'
    },
    'B2': {
      title: 'Hip Load Transfer',
      description: 'Inefficient ball-side hip load. Work on driving the back hip through earlier.',
      category: 'body'
    },
    'B3': {
      title: 'Ground Connection',
      description: 'Limited ankle/knee mobility affecting power transfer. Increase ankle flexibility in stride.',
      category: 'body'
    },
    'B4': {
      title: 'Temporal Synchronization',
      description: 'Segment timing is scattered. Practice slow-motion drills to sync upper/lower half.',
      category: 'brain'
    },
  };
  return details[bucket];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, ikCsvContent, meCsvContent, handedness = 'R', swingNumber = 1 } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ikCsvContent || !meCsvContent) {
      return new Response(
        JSON.stringify({ error: 'Both ikCsvContent and meCsvContent are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch session and player info
    const { data: session, error: sessionError } = await supabase
      .from('reboot_sessions')
      .select('*, players(id, handedness, bat_mass_kg)')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const playerId = session.player_id;
    const playerHandedness = session.players?.handedness === 'left' ? 'L' : 'R';
    const effectiveHandedness = handedness || playerHandedness;
    
    // Use player's bat mass if set, otherwise default
    const batMassKg = session.players?.bat_mass_kg || DEFAULT_BAT_MASS_KG;

    // Parse CSV files
    const ikParsed = parseCSV(ikCsvContent);
    const meParsed = parseCSV(meCsvContent);

    // Map to structured data with unit fixes and contact detection
    const ikData = mapIKData(ikParsed);
    const { me: meData, contact: contactFrameResult } = mapMEData(meParsed, ikData);
    
    // Update IK data with detected contact frame for bucket calculations
    ikData.contact_frame = contactFrameResult.frame;
    
    // Log contact frame detection method for debugging
    console.log(`Contact frame detected: ${contactFrameResult.frame} via ${contactFrameResult.type} (${contactFrameResult.confidence})`);

    // Compute 4B bucket scores (now using windowed peak finding)
    const b1 = computeB1(ikData);
    const b2 = computeB2(ikData, effectiveHandedness as 'L' | 'R');
    const b3 = computeB3(ikData, effectiveHandedness as 'L' | 'R');
    const b4 = computeB4(meData, ikData.stride_frame, ikData.contact_frame);

    const buckets: BucketScores = { b1, b2, b3, b4 };

    // Aggregate 4B scores
    const fourBBat = BUCKET_WEIGHTS.w1 * b1 + BUCKET_WEIGHTS.w2 * b2 + 
                     BUCKET_WEIGHTS.w3 * b3 + BUCKET_WEIGHTS.w4 * b4;
    const fourBBall = fourBBat; // Same logic for now
    const fourBHit = 0.5 * fourBBat + 0.5 * fourBBall;

    // Extract bat speed with confidence
    const batSpeed = extractBatSpeed(meData, batMassKg);
    const vBatActual = batSpeed.mph;
    
    console.log(`Bat speed: ${vBatActual.toFixed(1)} mph via ${batSpeed.method} (${batSpeed.confidence})`);

    // Load or use default athlete model
    let model = DEFAULT_MODEL;
    if (playerId) {
      const { data: athleteModel } = await supabase
        .from('athlete_krs_models')
        .select('*')
        .eq('player_id', playerId)
        .single();
      
      if (athleteModel) {
        model = {
          beta_0: athleteModel.beta_0,
          beta_1: athleteModel.beta_1,
          beta_2: athleteModel.beta_2,
          beta_3: athleteModel.beta_3,
          beta_4: athleteModel.beta_4,
        };
      }
    }

    // Compute expected speed and loss
    const vBatExpected = computeExpectedBatSpeed(buckets, model);
    const mechanicalLoss = vBatExpected - vBatActual;
    const mechanicalLossPct = vBatExpected > 0 ? (mechanicalLoss / vBatExpected) * 100 : 0;

    // Attribute loss to buckets
    const { breakdown, primary } = attributeBucketLoss(buckets, model, mechanicalLoss);
    const issueDetails = getPrimaryIssueDetails(primary);

    // Calculate legacy compatibility scores (20-80 scale)
    const compositeScore = fourBHit;
    const grade = getGrade(compositeScore);
    const weakestLink = bucketToWeakestLink(primary);

    // Legacy score mapping
    const brainScore = Math.round(b4 * 0.8 + 20); // B4 maps to brain
    const bodyScore = Math.round((b1 + b2 + b3) / 3 * 0.8 + 20); // Average of B1-B3
    const batScore = Math.round(b1 * 0.8 + 20); // B1 closest to bat mechanics
    const ballScore = Math.round(b4 * 0.8 + 20); // B4 represents consistency

    // Store result in database
    const swingScore = {
      session_id: sessionId,
      player_id: playerId,
      swing_number: swingNumber,
      b1_score: b1,
      b2_score: b2,
      b3_score: b3,
      b4_score: b4,
      four_b_bat: fourBBat,
      four_b_ball: fourBBall,
      four_b_hit: fourBHit,
      v_bat_actual_mph: vBatActual,
      v_bat_expected_mph: vBatExpected,
      mechanical_loss_mph: mechanicalLoss,
      mechanical_loss_pct: mechanicalLossPct,
      primary_bucket_issue: primary,
      bucket_loss_breakdown: breakdown,
      // Enhanced diagnostic fields
      primary_issue_title: issueDetails.title,
      primary_issue_description: issueDetails.description,
      primary_issue_category: issueDetails.category,
      // Legacy fields
      brain_score: brainScore,
      body_score: bodyScore,
      bat_score: batScore,
      ball_score: ballScore,
      composite_score: compositeScore,
      grade: grade,
      weakest_link: weakestLink,
    };

    const { data: insertedScore, error: insertError } = await supabase
      .from('swing_4b_scores')
      .insert(swingScore)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting swing score:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save swing score', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update player's latest scores
    if (playerId) {
      await supabase
        .from('players')
        .update({
          latest_brain_score: brainScore,
          latest_body_score: bodyScore,
          latest_bat_score: batScore,
          latest_ball_score: ballScore,
          latest_composite_score: compositeScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', playerId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        swing: insertedScore,
        summary: {
          fourBHit,
          grade,
          vBatActual,
          vBatExpected,
          mechanicalLoss,
          mechanicalLossPct,
          primaryIssue: primary,
          primaryIssueDetails: issueDetails,
          bucketBreakdown: breakdown,
          // Contact frame detection info
          contactFrameType: contactFrameResult.type,
          contactFrame: contactFrameResult.frame,
          // Bat speed info with confidence
          batSpeedConfidence: batSpeed.confidence,
          batSpeedMethod: batSpeed.method,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in compute-4b-from-csv:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
