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
}

interface MEData {
  rel_frame: number[];
  contact_frame: number;
  stride_frame: number;
  bat_linear_momentum_x: number[];
  bat_linear_momentum_y: number[];
  bat_linear_momentum_z: number[];
  bat_kinetic_energy: number[];
  total_kinetic_energy: number[];
  // Bat speed column if available
  bat_speed?: number[];
  // Hand speed for fallback
  hand_speed?: number[];
  dom_hand_speed?: number[];
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
type ContactFrameType = 'explicit' | 'bat_ke_peak' | 'bat_momentum_peak' | 'hand_speed_peak' | 'torso_peak' | 'frame_ratio';
type BatSpeedSource = 'explicit_column' | 'kinetic_energy' | 'hand_speed_proxy' | 'fallback' | 'none';

interface ContactFrameResult {
  frame: number;
  type: ContactFrameType;
  confidence: 'high' | 'medium' | 'low';
}

interface BatSpeedResult {
  speed: number | null;
  source: BatSpeedSource;
  confidence: 'high' | 'medium' | 'low';
}

interface SwingWindow {
  strideFrame: number;
  contactFrame: number;
}

interface Swing4BResult {
  b1_score: number;
  b2_score: number;
  b3_score: number;
  b4_score: number;
  four_b_bat: number;
  four_b_ball: number;
  four_b_hit: number;
  v_bat_actual_mph: number | null;
  v_bat_expected_mph: number;
  mechanical_loss_mph: number | null;
  mechanical_loss_pct: number | null;
  primary_bucket_issue: 'B1' | 'B2' | 'B3' | 'B4';
  bucket_loss_breakdown: Record<string, number>;
  contact_frame_type: ContactFrameType;
  bat_speed_confidence: 'high' | 'medium' | 'low';
  bat_speed_source: BatSpeedSource;
}

// ========================
// FIX A: Radians to Degrees Conversion
// ========================

/**
 * Detect if rotation data is in radians (max magnitude < 10) and convert to degrees
 */
function maybeConvertRadiansToDegrees(values: number[]): number[] {
  if (!values || values.length === 0) return values;
  
  // Find max absolute value
  let maxAbs = 0;
  for (const v of values) {
    const abs = Math.abs(v ?? 0);
    if (abs > maxAbs) maxAbs = abs;
  }
  
  // If max is < 10, likely radians (typical rotations are 0-2π ≈ 0-6.28 radians)
  // Degrees would typically be 20-90+ degrees
  if (maxAbs > 0 && maxAbs < 10) {
    const RAD_TO_DEG = 180 / Math.PI;
    return values.map(v => (v ?? 0) * RAD_TO_DEG);
  }
  
  return values;
}

/**
 * Apply radians-to-degrees conversion to all rotation arrays in IK data
 */
function normalizeIKRotations(ikData: IKData): IKData {
  return {
    ...ikData,
    pelvisrot: maybeConvertRadiansToDegrees(ikData.pelvisrot),
    torsorot: maybeConvertRadiansToDegrees(ikData.torsorot),
    pelvisside: maybeConvertRadiansToDegrees(ikData.pelvisside),
    righthipflex: maybeConvertRadiansToDegrees(ikData.righthipflex),
    righthipadd: maybeConvertRadiansToDegrees(ikData.righthipadd),
    righthiprot: maybeConvertRadiansToDegrees(ikData.righthiprot),
    rightknee: maybeConvertRadiansToDegrees(ikData.rightknee),
    rightankleinv: maybeConvertRadiansToDegrees(ikData.rightankleinv),
    rightankleflex: maybeConvertRadiansToDegrees(ikData.rightankleflex),
    lefthipflex: ikData.lefthipflex ? maybeConvertRadiansToDegrees(ikData.lefthipflex) : undefined,
    lefthipadd: ikData.lefthipadd ? maybeConvertRadiansToDegrees(ikData.lefthipadd) : undefined,
    lefthiprot: ikData.lefthiprot ? maybeConvertRadiansToDegrees(ikData.lefthiprot) : undefined,
    leftknee: ikData.leftknee ? maybeConvertRadiansToDegrees(ikData.leftknee) : undefined,
    leftankleinv: ikData.leftankleinv ? maybeConvertRadiansToDegrees(ikData.leftankleinv) : undefined,
    leftankleflex: ikData.leftankleflex ? maybeConvertRadiansToDegrees(ikData.leftankleflex) : undefined,
  };
}

// ========================
// FIX B: Swing Window Peak Search
// ========================

/**
 * Clamp a value between 0 and 1
 */
function clamp01(val: number): number {
  return Math.max(0, Math.min(1, isNaN(val) ? 0 : val));
}

/**
 * Parse CSV string into structured data
 */
function parseCSV(csvContent: string): Record<string, number[]> {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return {};
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const result: Record<string, number[]> = {};
  
  headers.forEach(h => { result[h] = []; });
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    headers.forEach((header, idx) => {
      const val = parseFloat(values[idx]);
      result[header].push(isNaN(val) ? 0 : val);
    });
  }
  
  return result;
}

/**
 * Find the frame index where a metric reaches its maximum absolute value
 * FIX B: Now accepts optional start and end frame parameters to limit search to swing window
 */
function findPeakFrame(values: number[], startFrame?: number, endFrame?: number): number {
  if (!values || values.length === 0) return 0;
  
  const start = startFrame ?? 0;
  const end = endFrame ?? values.length - 1;
  
  let maxIdx = start;
  let maxVal = Math.abs(values[start] || 0);
  
  for (let i = start + 1; i <= Math.min(end, values.length - 1); i++) {
    const absVal = Math.abs(values[i] || 0);
    if (absVal > maxVal) {
      maxVal = absVal;
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Get peak absolute value from an array within optional window
 */
function getPeakAbs(values: number[], startFrame?: number, endFrame?: number): number {
  if (!values || values.length === 0) return 0;
  
  const start = startFrame ?? 0;
  const end = endFrame ?? values.length - 1;
  
  let maxVal = 0;
  for (let i = start; i <= Math.min(end, values.length - 1); i++) {
    const absVal = Math.abs(values[i] || 0);
    if (absVal > maxVal) maxVal = absVal;
  }
  return maxVal;
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
// FIX C: Multi-Swing Alignment
// ========================

/**
 * Find swing window by aligning max_dom_hand_velo with closest preceding max_stride
 * This ensures we analyze a single swing and don't mix frames from different swings
 */
function findAlignedSwingWindow(csvData: Record<string, number[]>): SwingWindow {
  const frameCount = csvData['rel_frame']?.length || csvData['frame']?.length || 100;
  
  // Try to find explicit event markers
  const maxDomHandVelo = csvData['max_dom_hand_velo'] || csvData['max_hand_velo'] || [];
  const maxStrideEvents = csvData['max_stride'] || csvData['stride_event'] || [];
  
  // Find the frame with max dom hand velocity (our anchor)
  let handVeloAnchor: number | null = null;
  
  // Option 1: Look for explicit max_dom_hand_velo column with non-zero value
  for (let i = 0; i < maxDomHandVelo.length; i++) {
    if (maxDomHandVelo[i] && maxDomHandVelo[i] > 0) {
      handVeloAnchor = i;
      break;
    }
  }
  
  // Option 2: Find peak in dom_hand_speed or hand_speed
  if (handVeloAnchor === null) {
    const domHandSpeed = csvData['dom_hand_speed'] || csvData['hand_speed'] || [];
    if (domHandSpeed.length > 0) {
      handVeloAnchor = findPeakFrame(domHandSpeed);
    }
  }
  
  // Option 3: Use bat momentum peak as anchor
  if (handVeloAnchor === null) {
    const batMomMag = buildBatMomentumMag(csvData);
    if (batMomMag && batMomMag.length > 0) {
      handVeloAnchor = findPeakFrame(batMomMag);
    }
  }
  
  // Find the closest max_stride BEFORE the hand velo anchor
  let strideFrame: number | null = null;
  
  // Option 1: Look for explicit stride event
  for (let i = 0; i < maxStrideEvents.length; i++) {
    if (maxStrideEvents[i] && maxStrideEvents[i] > 0) {
      // Is this stride before our anchor?
      if (handVeloAnchor === null || i < handVeloAnchor) {
        strideFrame = i;
      }
    }
  }
  
  // Option 2: Look for stride_frame column
  if (strideFrame === null) {
    const explicitStride = csvData['stride_frame']?.[0];
    if (explicitStride != null && !isNaN(explicitStride) && explicitStride > 0) {
      strideFrame = Math.round(explicitStride);
    }
  }
  
  // Fallback: Use 20% of frame count as stride estimate
  if (strideFrame === null) {
    strideFrame = Math.floor(frameCount * 0.2);
  }
  
  // Determine contact frame (slightly after hand velo peak)
  let contactFrame: number;
  if (handVeloAnchor !== null) {
    // Contact is typically 5-10 frames after peak hand velocity
    contactFrame = Math.min(frameCount - 1, handVeloAnchor + 5);
  } else {
    // Fallback to explicit or 80% estimate
    const explicitContact = csvData['contact_frame']?.[0];
    if (explicitContact != null && !isNaN(explicitContact) && explicitContact > 0) {
      contactFrame = Math.round(explicitContact);
    } else {
      contactFrame = Math.floor(frameCount * 0.8);
    }
  }
  
  // Ensure stride is before contact
  if (strideFrame >= contactFrame) {
    strideFrame = Math.max(0, contactFrame - Math.floor(frameCount * 0.3));
  }
  
  return {
    strideFrame: Math.max(0, Math.min(strideFrame, frameCount - 1)),
    contactFrame: Math.max(0, Math.min(contactFrame, frameCount - 1)),
  };
}

// ========================
// FIX D: Bat Speed Priority with Confidence
// ========================

/**
 * Build bat momentum magnitude signal from components.
 */
function buildBatMomentumMag(csvData: Record<string, number[]>): number[] | null {
  const x = csvData["bat_linear_momentum_x"] || csvData["bat_mom_x"] || [];
  const y = csvData["bat_linear_momentum_y"] || csvData["bat_mom_y"] || [];
  const z = csvData["bat_linear_momentum_z"] || csvData["bat_mom_z"] || [];
  if (!x.length || !y.length || !z.length) return null;

  const n = Math.min(x.length, y.length, z.length);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const xi = x[i] ?? 0;
    const yi = y[i] ?? 0;
    const zi = z[i] ?? 0;
    out[i] = Math.sqrt(xi * xi + yi * yi + zi * zi);
  }
  return out;
}

/**
 * Extract bat speed with priority order and confidence levels
 * FIX D: Priority order with proper confidence
 * 1. Explicit bat_speed column (high)
 * 2. Calculate from bat_kinetic_energy (high)
 * 3. Hand speed deceleration proxy (medium)
 * 4. Fallback (low, returns null)
 */
function extractBatSpeedWithConfidence(
  meData: MEData, 
  swingWindow: SwingWindow,
  batMassKg: number = DEFAULT_BAT_MASS_KG
): BatSpeedResult {
  const contactI = swingWindow.contactFrame;
  const MPS_TO_MPH = 2.236936;
  
  // Priority 1: Explicit bat_speed column
  if (meData.bat_speed && meData.bat_speed.length > contactI) {
    const speed = meData.bat_speed[contactI];
    if (speed != null && !isNaN(speed) && speed > 0) {
      // Assume stored in mph or convert from m/s if < 50
      const speedMph = speed < 50 ? speed * MPS_TO_MPH : speed;
      if (speedMph > 30 && speedMph < 120) {
        return { speed: speedMph, source: 'explicit_column', confidence: 'high' };
      }
    }
  }
  
  // Priority 2: Calculate from bat kinetic energy
  // v = sqrt(2 * KE / mass)
  if (meData.bat_kinetic_energy && meData.bat_kinetic_energy.length > 0) {
    // Find peak KE within swing window
    const peakKEFrame = findPeakFrame(
      meData.bat_kinetic_energy, 
      swingWindow.strideFrame, 
      swingWindow.contactFrame + 5
    );
    const peakKE = Math.abs(meData.bat_kinetic_energy[peakKEFrame] ?? 0);
    
    if (peakKE > 0 && batMassKg > 0) {
      // KE in Joules, mass in kg -> v in m/s
      const vMps = Math.sqrt((2 * peakKE) / batMassKg);
      const vMph = vMps * MPS_TO_MPH;
      
      // Sanity check: bat speeds typically 40-100 mph
      if (vMph > 30 && vMph < 120) {
        return { speed: vMph, source: 'kinetic_energy', confidence: 'high' };
      }
    }
  }
  
  // Priority 3: Hand speed deceleration proxy
  // Find peak hand speed, then frame where it drops to 85-90%
  const handSpeed = meData.dom_hand_speed || meData.hand_speed || [];
  if (handSpeed.length > 0) {
    const peakFrame = findPeakFrame(
      handSpeed, 
      swingWindow.strideFrame, 
      swingWindow.contactFrame + 10
    );
    const peakSpeed = Math.abs(handSpeed[peakFrame] ?? 0);
    
    if (peakSpeed > 0) {
      // Find frame where speed drops to 85-90% of peak (deceleration = contact)
      const dropThreshold = peakSpeed * 0.87; // Use 87% as middle ground
      let contactSpeedFrame = peakFrame;
      
      for (let i = peakFrame + 1; i < Math.min(handSpeed.length, peakFrame + 15); i++) {
        if (Math.abs(handSpeed[i]) <= dropThreshold) {
          contactSpeedFrame = i;
          break;
        }
      }
      
      // Hand speed at contact, convert to bat speed (bat tip ~1.3-1.5x hand speed)
      const handSpeedAtContact = Math.abs(handSpeed[contactSpeedFrame] ?? peakSpeed);
      const BAT_TO_HAND_RATIO = 1.4;
      const vMps = handSpeedAtContact * BAT_TO_HAND_RATIO;
      const vMph = vMps * MPS_TO_MPH;
      
      if (vMph > 20 && vMph < 120) {
        return { speed: vMph, source: 'hand_speed_proxy', confidence: 'medium' };
      }
    }
  }
  
  // Priority 4: Fallback - can't reliably determine bat speed
  return { speed: null, source: 'none', confidence: 'low' };
}

/**
 * Clamp frame index to valid range
 */
function clampFrame(i: number, n: number): number {
  return Math.max(0, Math.min(n - 1, i));
}

/**
 * Get absolute value at peak index
 */
function peakValueAbs(values: number[], peakI: number): number {
  return Math.abs(values[peakI] ?? 0);
}

/**
 * After the peak, find the first frame where the signal drops to <= dropFrac * peak.
 * This approximates "release/contact-ish" better than using the peak itself.
 */
function findPeakToDropFrame(
  values: number[],
  dropFrac = 0.90,
  minAfterPeakFrames = 3,
  startFrame?: number,
  endFrame?: number
): number | null {
  if (!values?.length || values.length < 10) return null;

  const peakI = findPeakFrame(values, startFrame, endFrame);
  const peakV = peakValueAbs(values, peakI);
  if (!isFinite(peakV) || peakV <= 0) return null;

  const threshold = peakV * dropFrac;
  const searchEnd = endFrame ? Math.min(endFrame + 10, values.length) : values.length;

  for (let i = peakI + minAfterPeakFrames; i < searchEnd; i++) {
    const v = Math.abs(values[i] ?? 0);
    if (v <= threshold) return i;
  }

  // If it never drops, return null so caller can try another method.
  return null;
}

/**
 * Detect contact frame using deceleration proxy (peak→drop) methods with confidence levels
 * Priority: explicit > bat_ke_peak > bat_momentum_peak > hand_speed > torso_peak > frame_ratio
 */
function detectContactFrame(
  csvData: Record<string, number[]>,
  swingWindow: SwingWindow,
  ikData?: IKData
): ContactFrameResult {
  const frameCount =
    csvData["rel_frame"]?.length || csvData["frame"]?.length || 100;

  // --- 1) Explicit contact_frame column (highest confidence) ---
  const explicitContact = csvData["contact_frame"]?.[0];
  if (explicitContact != null && !isNaN(explicitContact) && explicitContact > 0) {
    const f = clampFrame(Math.round(explicitContact), frameCount);
    // Verify it's within reasonable range of our swing window
    if (f >= swingWindow.strideFrame && f <= frameCount - 1) {
      return { frame: f, type: "explicit", confidence: "high" };
    }
  }

  // Tunables
  const DROP_FRAC_KE = 0.90;
  const DROP_FRAC_MOM = 0.90;
  const DROP_FRAC_HAND = 0.87;
  const DROP_FRAC_TORSO = 0.92;
  const MIN_AFTER_PEAK = 3;

  // --- 2) Bat kinetic energy: peak → drop (high confidence) ---
  const batKE = csvData["bat_kinetic_energy"] || csvData["bat_ke"] || [];
  if (batKE.length > 0) {
    const dropI = findPeakToDropFrame(batKE, DROP_FRAC_KE, MIN_AFTER_PEAK, swingWindow.strideFrame, swingWindow.contactFrame + 10);
    if (dropI != null && dropI >= swingWindow.strideFrame) {
      return { frame: clampFrame(dropI, frameCount), type: "bat_ke_peak", confidence: "high" };
    }
  }

  // --- 3) Bat momentum magnitude: peak → drop (medium confidence) ---
  const momMag = buildBatMomentumMag(csvData);
  if (momMag?.length) {
    const dropI = findPeakToDropFrame(momMag, DROP_FRAC_MOM, MIN_AFTER_PEAK, swingWindow.strideFrame, swingWindow.contactFrame + 10);
    if (dropI != null && dropI >= swingWindow.strideFrame) {
      return { frame: clampFrame(dropI, frameCount), type: "bat_momentum_peak", confidence: "medium" };
    }
  }

  // --- 4) Hand speed: peak → drop (medium confidence) ---
  const handSpeed = csvData["dom_hand_speed"] || csvData["hand_speed"] || [];
  if (handSpeed.length > 0) {
    const dropI = findPeakToDropFrame(handSpeed, DROP_FRAC_HAND, MIN_AFTER_PEAK, swingWindow.strideFrame, swingWindow.contactFrame + 10);
    if (dropI != null && dropI >= swingWindow.strideFrame) {
      return { frame: clampFrame(dropI, frameCount), type: "hand_speed_peak", confidence: "medium" };
    }
  }

  // --- 5) Torso rotation: peak → drop (low confidence) ---
  if (ikData?.torsorot?.length) {
    const dropI = findPeakToDropFrame(ikData.torsorot, DROP_FRAC_TORSO, MIN_AFTER_PEAK, swingWindow.strideFrame, swingWindow.contactFrame + 10);
    if (dropI != null && dropI >= swingWindow.strideFrame) {
      return { frame: clampFrame(dropI, frameCount), type: "torso_peak", confidence: "low" };
    }
  }

  // --- 6) Fixed ratio fallback (low confidence) ---
  return {
    frame: clampFrame(swingWindow.contactFrame, frameCount),
    type: "frame_ratio",
    confidence: "low",
  };
}

/**
 * Compute Bucket 1: Rotational Foundation (Pelvis & Torso)
 */
function computeB1(ikData: IKData, swingWindow: SwingWindow): number {
  const contactI = swingWindow.contactFrame;
  const strideI = swingWindow.strideFrame;
  const swingWindowSize = Math.max(1, contactI - strideI);
  
  // Target frames using stride→contact window
  const pelvisTarget = getTargetFrame(contactI, strideI, KRS_PHASE.pelvis);
  const torsoTarget = getTargetFrame(contactI, strideI, KRS_PHASE.torso);
  
  // FIX B: Only search within swing window
  const pelvisPeakFrame = findPeakFrame(ikData.pelvisrot, strideI, contactI);
  const pelvisPeakAbs = getPeakAbs(ikData.pelvisrot, strideI, contactI);
  const magPelvis = clamp01(pelvisPeakAbs / MAG_CAPS.pelvis);
  const pelvisTimingErr = timingError(pelvisPeakFrame, pelvisTarget, swingWindowSize);
  
  const torsoPeakFrame = findPeakFrame(ikData.torsorot, strideI, contactI);
  const torsoPeakAbs = getPeakAbs(ikData.torsorot, strideI, contactI);
  const magTorso = clamp01(torsoPeakAbs / MAG_CAPS.torso);
  const torsoTimingErr = timingError(torsoPeakFrame, torsoTarget, swingWindowSize);
  
  // Pelvis lateral shift
  const sidePeakAbs = ikData.pelvisside.length > 0 ? getPeakAbs(ikData.pelvisside, strideI, contactI) : 0;
  const magSide = clamp01(sidePeakAbs / MAG_CAPS.side);
  
  // Bucket 1 score (weighted magnitude minus timing penalties)
  const b1Raw = (0.5 * magPelvis + 0.3 * magTorso + 0.2 * magSide) - 
    0.3 * (pelvisTimingErr + torsoTimingErr);
  
  return clamp01(b1Raw) * 100;
}

/**
 * Compute Bucket 2: Proximal Load Transfer (Ball-Side Hip)
 */
function computeB2(ikData: IKData, swingWindow: SwingWindow, handedness: 'L' | 'R' = 'R'): number {
  const contactI = swingWindow.contactFrame;
  const strideI = swingWindow.strideFrame;
  const swingWindowSize = Math.max(1, contactI - strideI);
  
  // Target frame for hip
  const hipTarget = getTargetFrame(contactI, strideI, KRS_PHASE.hip);
  
  // Select ball-side hip data
  const hipFlex = handedness === 'R' ? ikData.righthipflex : (ikData.lefthipflex || []);
  const hipAdd = handedness === 'R' ? ikData.righthipadd : (ikData.lefthipadd || []);
  const hipRot = handedness === 'R' ? ikData.righthiprot : (ikData.lefthiprot || []);
  
  if (!hipFlex.length || !hipAdd.length || !hipRot.length) {
    return 50; // Default if data missing
  }
  
  // FIX B: Search within swing window
  const hipFlexPeak = findPeakFrame(hipFlex, strideI, contactI);
  const magHipFlex = clamp01(getPeakAbs(hipFlex, strideI, contactI) / MAG_CAPS.hipFlex);
  const hipFlexTimingErr = timingError(hipFlexPeak, hipTarget, swingWindowSize);
  
  const magHipAdd = clamp01(getPeakAbs(hipAdd, strideI, contactI) / MAG_CAPS.hipAdd);
  const magHipRot = clamp01(getPeakAbs(hipRot, strideI, contactI) / MAG_CAPS.hipRot);
  
  // Bucket 2 score
  const b2Raw = (0.4 * magHipFlex + 0.35 * magHipAdd + 0.25 * magHipRot) - 
    0.25 * hipFlexTimingErr;
  
  return clamp01(b2Raw) * 100;
}

/**
 * Compute Bucket 3: Distal Ground Connection (Ball-Side Knee & Ankle)
 */
function computeB3(ikData: IKData, swingWindow: SwingWindow, handedness: 'L' | 'R' = 'R'): number {
  const contactI = swingWindow.contactFrame;
  const strideI = swingWindow.strideFrame;
  const swingWindowSize = Math.max(1, contactI - strideI);
  
  // Target frames
  const kneeTarget = getTargetFrame(contactI, strideI, KRS_PHASE.knee);
  const ankleTarget = getTargetFrame(contactI, strideI, KRS_PHASE.ankle);
  
  // Select ball-side knee/ankle data
  const knee = handedness === 'R' ? ikData.rightknee : (ikData.leftknee || []);
  const ankleInv = handedness === 'R' ? ikData.rightankleinv : (ikData.leftankleinv || []);
  const ankleFlex = handedness === 'R' ? ikData.rightankleflex : (ikData.leftankleflex || []);
  
  if (!knee.length || !ankleInv.length || !ankleFlex.length) {
    return 50; // Default if data missing
  }
  
  // FIX B: Search within swing window
  const kneePeak = findPeakFrame(knee, strideI, contactI);
  const magKnee = clamp01(getPeakAbs(knee, strideI, contactI) / MAG_CAPS.knee);
  const kneeTimingErr = timingError(kneePeak, kneeTarget, swingWindowSize);
  
  const magAnkleInv = clamp01(getPeakAbs(ankleInv, strideI, contactI) / MAG_CAPS.ankleInv);
  
  const anklePeak = findPeakFrame(ankleFlex, strideI, contactI);
  const magAnkleFlex = clamp01(getPeakAbs(ankleFlex, strideI, contactI) / MAG_CAPS.ankleFlex);
  const ankleTimingErr = timingError(anklePeak, ankleTarget, swingWindowSize);
  
  // Bucket 3 score
  const b3Raw = (0.4 * magKnee + 0.35 * magAnkleInv + 0.25 * magAnkleFlex) - 
    0.2 * (kneeTimingErr + ankleTimingErr);
  
  return clamp01(b3Raw) * 100;
}

/**
 * Compute Bucket 4: Temporal Synchronization
 */
function computeB4(meData: MEData, swingWindow: SwingWindow): number {
  const strideI = swingWindow.strideFrame;
  const contactI = swingWindow.contactFrame;
  
  // Get angular momentum peaks for each segment within swing window
  const segmentPeaks: number[] = [];
  
  if (meData.pelvis_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.pelvis_angular_momentum_mag, strideI, contactI));
  }
  if (meData.torso_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.torso_angular_momentum_mag, strideI, contactI));
  }
  if (meData.arms_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.arms_angular_momentum_mag, strideI, contactI));
  }
  if (meData.bat_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.bat_angular_momentum_mag, strideI, contactI));
  }
  
  if (segmentPeaks.length < 2) {
    return 50; // Default if insufficient data
  }
  
  // Normalize peaks to swing window
  const swingWindowSize = Math.max(1, contactI - strideI);
  const normalizedPeaks = segmentPeaks.map(p => (p - strideI) / swingWindowSize);
  
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
 * Map IK CSV data to structured IKData
 */
function mapIKData(csvData: Record<string, number[]>, swingWindow: SwingWindow): IKData {
  const rawData: IKData = {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: swingWindow.contactFrame,
    stride_frame: swingWindow.strideFrame,
    pelvisrot: csvData['pelvisrot'] || csvData['pelvis_rotation'] || [],
    torsorot: csvData['torsorot'] || csvData['torso_rotation'] || [],
    pelvisside: csvData['pelvisside'] || csvData['pelvis_lateral'] || [],
    righthipflex: csvData['righthipflex'] || csvData['right_hip_flex'] || [],
    righthipadd: csvData['righthipadd'] || csvData['right_hip_add'] || [],
    righthiprot: csvData['righthiprot'] || csvData['right_hip_rot'] || [],
    rightknee: csvData['rightknee'] || csvData['right_knee'] || [],
    rightankleinv: csvData['rightankleinv'] || csvData['right_ankle_inv'] || [],
    rightankleflex: csvData['rightankleflex'] || csvData['right_ankle_flex'] || [],
    lefthipflex: csvData['lefthipflex'] || csvData['left_hip_flex'],
    lefthipadd: csvData['lefthipadd'] || csvData['left_hip_add'],
    lefthiprot: csvData['lefthiprot'] || csvData['left_hip_rot'],
    leftknee: csvData['leftknee'] || csvData['left_knee'],
    leftankleinv: csvData['leftankleinv'] || csvData['left_ankle_inv'],
    leftankleflex: csvData['leftankleflex'] || csvData['left_ankle_flex'],
  };
  
  // FIX A: Apply radians-to-degrees conversion
  return normalizeIKRotations(rawData);
}

/**
 * Map ME CSV data to structured MEData with intelligent contact frame detection
 */
function mapMEData(csvData: Record<string, number[]>, swingWindow: SwingWindow, ikData?: IKData): MEData {
  const contactResult = detectContactFrame(csvData, swingWindow, ikData);
  
  return {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: contactResult.frame,
    stride_frame: swingWindow.strideFrame,
    bat_linear_momentum_x: csvData['bat_linear_momentum_x'] || csvData['bat_mom_x'] || [],
    bat_linear_momentum_y: csvData['bat_linear_momentum_y'] || csvData['bat_mom_y'] || [],
    bat_linear_momentum_z: csvData['bat_linear_momentum_z'] || csvData['bat_mom_z'] || [],
    bat_kinetic_energy: csvData['bat_kinetic_energy'] || csvData['bat_ke'] || [],
    total_kinetic_energy: csvData['total_kinetic_energy'] || csvData['total_ke'] || [],
    bat_speed: csvData['bat_speed'] || csvData['bat_velo'],
    hand_speed: csvData['hand_speed'],
    dom_hand_speed: csvData['dom_hand_speed'] || csvData['dominant_hand_speed'],
    pelvis_angular_momentum_mag: csvData['pelvis_angular_momentum_mag'] || csvData['pelvis_ang_mom'],
    torso_angular_momentum_mag: csvData['torso_angular_momentum_mag'] || csvData['torso_ang_mom'],
    arms_angular_momentum_mag: csvData['arms_angular_momentum_mag'] || csvData['arms_ang_mom'],
    bat_angular_momentum_mag: csvData['bat_angular_momentum_mag'] || csvData['bat_ang_mom'],
  };
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

    // FIX C: Find aligned swing window using multi-swing alignment
    const swingWindow = findAlignedSwingWindow({...ikParsed, ...meParsed});
    console.log(`Swing window: stride=${swingWindow.strideFrame}, contact=${swingWindow.contactFrame}`);

    // Map to structured data with intelligent contact frame detection
    const ikData = mapIKData(ikParsed, swingWindow);
    const contactFrameResult = detectContactFrame(meParsed, swingWindow, ikData);
    
    // Update swing window with detected contact
    const refinedSwingWindow: SwingWindow = {
      strideFrame: swingWindow.strideFrame,
      contactFrame: contactFrameResult.frame,
    };
    
    const meData = mapMEData(meParsed, refinedSwingWindow, ikData);
    
    // Log contact frame detection method for debugging
    console.log(`Contact frame detected: ${contactFrameResult.frame} via ${contactFrameResult.type} (${contactFrameResult.confidence} confidence)`);

    // Compute 4B bucket scores using swing window
    const b1 = computeB1(ikData, refinedSwingWindow);
    const b2 = computeB2(ikData, refinedSwingWindow, effectiveHandedness as 'L' | 'R');
    const b3 = computeB3(ikData, refinedSwingWindow, effectiveHandedness as 'L' | 'R');
    const b4 = computeB4(meData, refinedSwingWindow);

    const buckets: BucketScores = { b1, b2, b3, b4 };

    // Aggregate 4B scores
    const fourBBat = BUCKET_WEIGHTS.w1 * b1 + BUCKET_WEIGHTS.w2 * b2 + 
                     BUCKET_WEIGHTS.w3 * b3 + BUCKET_WEIGHTS.w4 * b4;
    const fourBBall = fourBBat; // Same logic for now
    const fourBHit = 0.5 * fourBBat + 0.5 * fourBBall;

    // FIX D: Extract bat speed with priority and confidence
    const batSpeedResult = extractBatSpeedWithConfidence(meData, refinedSwingWindow, batMassKg);
    const vBatActual = batSpeedResult.speed;
    
    console.log(`Bat speed: ${vBatActual?.toFixed(1) ?? 'N/A'} mph via ${batSpeedResult.source} (${batSpeedResult.confidence} confidence)`);

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
    const mechanicalLoss = vBatActual != null ? vBatExpected - vBatActual : null;
    const mechanicalLossPct = vBatActual != null && vBatExpected > 0 
      ? (mechanicalLoss! / vBatExpected) * 100 
      : null;

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
          batSpeedConfidence: batSpeedResult.confidence,
          batSpeedSource: batSpeedResult.source,
          // Swing window info
          swingWindow: refinedSwingWindow,
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
