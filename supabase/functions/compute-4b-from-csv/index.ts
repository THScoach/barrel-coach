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
type ContactFrameType = 'explicit' | 'bat_ke_peak' | 'bat_momentum_peak' | 'torso_peak' | 'frame_ratio';

interface ContactFrameResult {
  frame: number;
  type: ContactFrameType;
  confidence: 'high' | 'medium' | 'low';
}

interface Swing4BResult {
  b1_score: number;
  b2_score: number;
  b3_score: number;
  b4_score: number;
  four_b_bat: number;
  four_b_ball: number;
  four_b_hit: number;
  v_bat_actual_mph: number;
  v_bat_expected_mph: number;
  mechanical_loss_mph: number;
  mechanical_loss_pct: number;
  primary_bucket_issue: 'B1' | 'B2' | 'B3' | 'B4';
  bucket_loss_breakdown: Record<string, number>;
  contact_frame_type: ContactFrameType;
  bat_speed_confidence: 'high' | 'medium' | 'low';
}

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
 */
function findPeakFrame(values: number[]): number {
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
 * Get peak absolute value from an array
 */
function getPeakAbs(values: number[]): number {
  let maxVal = 0;
  for (const val of values) {
    const absVal = Math.abs(val || 0);
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

/**
 * Compute Bucket 1: Rotational Foundation (Pelvis & Torso)
 */
function computeB1(ikData: IKData): number {
  const contactI = ikData.contact_frame;
  const strideI = ikData.stride_frame;
  const swingWindow = Math.max(1, contactI - strideI);
  
  // Target frames using stride→contact window
  const pelvisTarget = getTargetFrame(contactI, strideI, KRS_PHASE.pelvis);
  const torsoTarget = getTargetFrame(contactI, strideI, KRS_PHASE.torso);
  
  // Pelvis metrics with real scaling caps
  const pelvisPeakFrame = findPeakFrame(ikData.pelvisrot);
  const pelvisPeakAbs = getPeakAbs(ikData.pelvisrot);
  const magPelvis = clamp01(pelvisPeakAbs / MAG_CAPS.pelvis);
  const pelvisTimingErr = timingError(pelvisPeakFrame, pelvisTarget, swingWindow);
  
  // Torso metrics with real scaling caps
  const torsoPeakFrame = findPeakFrame(ikData.torsorot);
  const torsoPeakAbs = getPeakAbs(ikData.torsorot);
  const magTorso = clamp01(torsoPeakAbs / MAG_CAPS.torso);
  const torsoTimingErr = timingError(torsoPeakFrame, torsoTarget, swingWindow);
  
  // Pelvis lateral shift
  const sidePeakAbs = ikData.pelvisside.length > 0 ? getPeakAbs(ikData.pelvisside) : 0;
  const magSide = clamp01(sidePeakAbs / MAG_CAPS.side);
  
  // Bucket 1 score (weighted magnitude minus timing penalties)
  const b1Raw = (0.5 * magPelvis + 0.3 * magTorso + 0.2 * magSide) - 
    0.3 * (pelvisTimingErr + torsoTimingErr);
  
  return clamp01(b1Raw) * 100;
}

/**
 * Compute Bucket 2: Proximal Load Transfer (Ball-Side Hip)
 */
function computeB2(ikData: IKData, handedness: 'L' | 'R' = 'R'): number {
  const contactI = ikData.contact_frame;
  const strideI = ikData.stride_frame;
  const swingWindow = Math.max(1, contactI - strideI);
  
  // Target frame for hip
  const hipTarget = getTargetFrame(contactI, strideI, KRS_PHASE.hip);
  
  // Select ball-side hip data
  const hipFlex = handedness === 'R' ? ikData.righthipflex : (ikData.lefthipflex || []);
  const hipAdd = handedness === 'R' ? ikData.righthipadd : (ikData.lefthipadd || []);
  const hipRot = handedness === 'R' ? ikData.righthiprot : (ikData.lefthiprot || []);
  
  if (!hipFlex.length || !hipAdd.length || !hipRot.length) {
    return 50; // Default if data missing
  }
  
  // Hip flexion with real scaling caps
  const hipFlexPeak = findPeakFrame(hipFlex);
  const magHipFlex = clamp01(getPeakAbs(hipFlex) / MAG_CAPS.hipFlex);
  const hipFlexTimingErr = timingError(hipFlexPeak, hipTarget, swingWindow);
  
  // Hip adduction with real scaling caps
  const magHipAdd = clamp01(getPeakAbs(hipAdd) / MAG_CAPS.hipAdd);
  
  // Hip rotation with real scaling caps
  const magHipRot = clamp01(getPeakAbs(hipRot) / MAG_CAPS.hipRot);
  
  // Bucket 2 score
  const b2Raw = (0.4 * magHipFlex + 0.35 * magHipAdd + 0.25 * magHipRot) - 
    0.25 * hipFlexTimingErr;
  
  return clamp01(b2Raw) * 100;
}

/**
 * Compute Bucket 3: Distal Ground Connection (Ball-Side Knee & Ankle)
 */
function computeB3(ikData: IKData, handedness: 'L' | 'R' = 'R'): number {
  const contactI = ikData.contact_frame;
  const strideI = ikData.stride_frame;
  const swingWindow = Math.max(1, contactI - strideI);
  
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
  
  // Knee metrics with real scaling caps
  const kneePeak = findPeakFrame(knee);
  const magKnee = clamp01(getPeakAbs(knee) / MAG_CAPS.knee);
  const kneeTimingErr = timingError(kneePeak, kneeTarget, swingWindow);
  
  // Ankle inversion with real scaling caps
  const magAnkleInv = clamp01(getPeakAbs(ankleInv) / MAG_CAPS.ankleInv);
  
  // Ankle flexion with real scaling caps
  const anklePeak = findPeakFrame(ankleFlex);
  const magAnkleFlex = clamp01(getPeakAbs(ankleFlex) / MAG_CAPS.ankleFlex);
  const ankleTimingErr = timingError(anklePeak, ankleTarget, swingWindow);
  
  // Bucket 3 score
  const b3Raw = (0.4 * magKnee + 0.35 * magAnkleInv + 0.25 * magAnkleFlex) - 
    0.2 * (kneeTimingErr + ankleTimingErr);
  
  return clamp01(b3Raw) * 100;
}

/**
 * Compute Bucket 4: Temporal Synchronization
 */
function computeB4(meData: MEData): number {
  // Get angular momentum peaks for each segment
  const segmentPeaks: number[] = [];
  
  if (meData.pelvis_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.pelvis_angular_momentum_mag));
  }
  if (meData.torso_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.torso_angular_momentum_mag));
  }
  if (meData.arms_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.arms_angular_momentum_mag));
  }
  if (meData.bat_angular_momentum_mag?.length) {
    segmentPeaks.push(findPeakFrame(meData.bat_angular_momentum_mag));
  }
  
  if (segmentPeaks.length < 2) {
    return 50; // Default if insufficient data
  }
  
  // Normalize peaks to [0, 1] range
  const totalFrames = meData.bat_linear_momentum_x.length;
  const normalizedPeaks = segmentPeaks.map(p => p / Math.max(1, totalFrames));
  
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
 * Extract actual bat speed in mph from ME data - unit robust
 * Handles both velocity (m/s) and momentum (kg·m/s) exports
 */
function extractBatSpeed(meData: MEData, batMassKg: number = DEFAULT_BAT_MASS_KG): number {
  const contactI = Math.max(0, Math.min(meData.bat_linear_momentum_x.length - 1, meData.contact_frame));
  
  const x = Number(meData.bat_linear_momentum_x[contactI] ?? 0);
  const y = Number(meData.bat_linear_momentum_y[contactI] ?? 0);
  const z = Number(meData.bat_linear_momentum_z[contactI] ?? 0);
  
  const mag = Math.sqrt(x * x + y * y + z * z);
  
  const MPS_TO_MPH = 2.236936;
  
  // If magnitude looks like velocity (m/s range for bat: typically 20-40 m/s = 45-90 mph)
  // We expect bat speeds between 20-50 m/s for most players
  if (mag > 0 && mag < 80) {
    return mag * MPS_TO_MPH;
  }
  
  // Otherwise treat as momentum (kg·m/s), divide by bat mass
  const vMps = mag / Math.max(1e-6, batMassKg);
  return vMps * MPS_TO_MPH;
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
  mechanicalLoss: number
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
function mapIKData(csvData: Record<string, number[]>): IKData {
  const frameCount = csvData['rel_frame']?.length || csvData['frame']?.length || 100;
  return {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: csvData['contact_frame']?.[0] ?? Math.floor(frameCount * 0.8),
    stride_frame: csvData['stride_frame']?.[0] ?? Math.floor(frameCount * 0.2),
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
}

/**
 * Detect contact frame using multiple proxy methods with confidence levels
 * Priority: explicit > bat_ke_peak > bat_momentum_peak > torso_peak > frame_ratio
 */
function detectContactFrame(
  csvData: Record<string, number[]>,
  ikData?: IKData
): ContactFrameResult {
  const frameCount = csvData['rel_frame']?.length || csvData['frame']?.length || 100;
  
  // Method 1: Explicit contact_frame column (highest confidence)
  const explicitContact = csvData['contact_frame']?.[0];
  if (explicitContact != null && !isNaN(explicitContact) && explicitContact > 0) {
    return { frame: Math.round(explicitContact), type: 'explicit', confidence: 'high' };
  }
  
  // Method 2: Peak of bat kinetic energy (high confidence)
  const batKE = csvData['bat_kinetic_energy'] || csvData['bat_ke'] || [];
  if (batKE.length > 0) {
    const peakFrame = findPeakFrame(batKE);
    // Sanity check: peak should be in the latter half of the swing
    if (peakFrame > frameCount * 0.4) {
      return { frame: peakFrame, type: 'bat_ke_peak', confidence: 'high' };
    }
  }
  
  // Method 3: Peak of bat linear momentum magnitude (medium-high confidence)
  const batMomX = csvData['bat_linear_momentum_x'] || csvData['bat_mom_x'] || [];
  const batMomY = csvData['bat_linear_momentum_y'] || csvData['bat_mom_y'] || [];
  const batMomZ = csvData['bat_linear_momentum_z'] || csvData['bat_mom_z'] || [];
  if (batMomX.length > 0 && batMomY.length > 0 && batMomZ.length > 0) {
    // Calculate momentum magnitude at each frame
    const momMag: number[] = [];
    for (let i = 0; i < batMomX.length; i++) {
      const x = batMomX[i] || 0;
      const y = batMomY[i] || 0;
      const z = batMomZ[i] || 0;
      momMag.push(Math.sqrt(x*x + y*y + z*z));
    }
    const peakFrame = findPeakFrame(momMag);
    if (peakFrame > frameCount * 0.4) {
      return { frame: peakFrame, type: 'bat_momentum_peak', confidence: 'medium' };
    }
  }
  
  // Method 4: Peak of torso rotation from IK data (medium confidence)
  if (ikData?.torsorot?.length) {
    const peakFrame = findPeakFrame(ikData.torsorot);
    // Torso typically peaks slightly before contact, so add ~5% offset
    const adjustedFrame = Math.min(Math.round(peakFrame * 1.05), frameCount - 1);
    if (adjustedFrame > frameCount * 0.4) {
      return { frame: adjustedFrame, type: 'torso_peak', confidence: 'medium' };
    }
  }
  
  // Method 5: Fixed ratio fallback (low confidence)
  return { frame: Math.floor(frameCount * 0.8), type: 'frame_ratio', confidence: 'low' };
}

/**
 * Map ME CSV data to structured MEData with intelligent contact frame detection
 */
function mapMEData(csvData: Record<string, number[]>, ikData?: IKData): MEData {
  const contactResult = detectContactFrame(csvData, ikData);
  
  return {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: contactResult.frame,
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

    // Map to structured data with intelligent contact frame detection
    const ikData = mapIKData(ikParsed);
    const contactFrameResult = detectContactFrame(meParsed, ikData);
    const meData = mapMEData(meParsed, ikData);
    
    // Log contact frame detection method for debugging
    console.log(`Contact frame detected: ${contactFrameResult.frame} via ${contactFrameResult.type} (${contactFrameResult.confidence} confidence)`);

    // Compute 4B bucket scores
    const b1 = computeB1(ikData);
    const b2 = computeB2(ikData, effectiveHandedness as 'L' | 'R');
    const b3 = computeB3(ikData, effectiveHandedness as 'L' | 'R');
    const b4 = computeB4(meData);

    const buckets: BucketScores = { b1, b2, b3, b4 };

    // Aggregate 4B scores
    const fourBBat = BUCKET_WEIGHTS.w1 * b1 + BUCKET_WEIGHTS.w2 * b2 + 
                     BUCKET_WEIGHTS.w3 * b3 + BUCKET_WEIGHTS.w4 * b4;
    const fourBBall = fourBBat; // Same logic for now
    const fourBHit = 0.5 * fourBBat + 0.5 * fourBBall;

    // Extract bat speed with correct bat mass
    const vBatActual = extractBatSpeed(meData, batMassKg);

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
          batSpeedConfidence: contactFrameResult.confidence,
          contactFrame: contactFrameResult.frame,
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
