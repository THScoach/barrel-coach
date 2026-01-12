import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KRS Target Vector - expected timing of segment peaks relative to contact frame
const KRS_TARGET = {
  max_pelvis_time: -0.20, // Pelvis peaks 20% before contact
  max_torso_time: -0.10,  // Torso peaks 10% before contact
  max_hip_time: -0.08,    // Ball-side hip peaks 8% before contact
  max_knee_time: -0.05,   // Ball-side knee peaks 5% before contact
  max_ankle_time: -0.02,  // Ball-side ankle peaks closest to contact
  max_bat_speed_time: 0.00, // Bat speed peaks at contact
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
 * Compute Bucket 1: Rotational Foundation (Pelvis & Torso)
 */
function computeB1(ikData: IKData): number {
  const totalFrames = ikData.pelvisrot.length;
  const swingDuration = ikData.contact_frame - ikData.stride_frame;
  
  // Pelvis metrics
  const pelvisPeakFrame = findPeakFrame(ikData.pelvisrot);
  const pelvisMag = Math.abs(ikData.pelvisrot[pelvisPeakFrame]) / 
    Math.max(...ikData.pelvisrot.map(Math.abs));
  const pelvisTimingError = Math.abs(pelvisPeakFrame - 
    (KRS_TARGET.max_pelvis_time * ikData.contact_frame + ikData.contact_frame)) / totalFrames;
  
  // Torso metrics
  const torsoPeakFrame = findPeakFrame(ikData.torsorot);
  const torsoMag = Math.abs(ikData.torsorot[torsoPeakFrame]) / 
    Math.max(...ikData.torsorot.map(Math.abs));
  const torsoTimingError = Math.abs(torsoPeakFrame - 
    (KRS_TARGET.max_torso_time * ikData.contact_frame + ikData.contact_frame)) / totalFrames;
  
  // Pelvis lateral shift
  const pelvisSideMag = ikData.pelvisside.length > 0 ? 
    Math.abs(ikData.pelvisside[findPeakFrame(ikData.pelvisside)]) / 
    Math.max(...ikData.pelvisside.map(Math.abs)) : 0.5;
  
  // Bucket 1 score
  const b1Raw = (0.5 * pelvisMag + 0.3 * torsoMag + 0.2 * pelvisSideMag) - 
    0.3 * (pelvisTimingError + torsoTimingError);
  
  return Math.max(0, Math.min(1, b1Raw)) * 100;
}

/**
 * Compute Bucket 2: Proximal Load Transfer (Ball-Side Hip)
 */
function computeB2(ikData: IKData, handedness: 'L' | 'R' = 'R'): number {
  const totalFrames = ikData.pelvisrot.length;
  
  // Select ball-side hip data
  const hipFlex = handedness === 'R' ? ikData.righthipflex : (ikData.lefthipflex || []);
  const hipAdd = handedness === 'R' ? ikData.righthipadd : (ikData.lefthipadd || []);
  const hipRot = handedness === 'R' ? ikData.righthiprot : (ikData.lefthiprot || []);
  
  if (!hipFlex.length || !hipAdd.length || !hipRot.length) {
    return 50; // Default if data missing
  }
  
  // Hip flexion metrics
  const hipFlexPeak = findPeakFrame(hipFlex);
  const hipFlexMag = Math.abs(hipFlex[hipFlexPeak]) / Math.max(...hipFlex.map(Math.abs));
  const hipFlexTimingError = Math.abs(hipFlexPeak - 
    (KRS_TARGET.max_hip_time * ikData.contact_frame + ikData.contact_frame)) / totalFrames;
  
  // Hip adduction metrics
  const hipAddPeak = findPeakFrame(hipAdd);
  const hipAddMag = Math.abs(hipAdd[hipAddPeak]) / Math.max(...hipAdd.map(Math.abs));
  
  // Hip rotation metrics
  const hipRotPeak = findPeakFrame(hipRot);
  const hipRotMag = Math.abs(hipRot[hipRotPeak]) / Math.max(...hipRot.map(Math.abs));
  
  // Bucket 2 score
  const b2Raw = (0.4 * hipFlexMag + 0.35 * hipAddMag + 0.25 * hipRotMag) - 
    0.25 * hipFlexTimingError;
  
  return Math.max(0, Math.min(1, b2Raw)) * 100;
}

/**
 * Compute Bucket 3: Distal Ground Connection (Ball-Side Knee & Ankle)
 */
function computeB3(ikData: IKData, handedness: 'L' | 'R' = 'R'): number {
  const totalFrames = ikData.pelvisrot.length;
  
  // Select ball-side knee/ankle data
  const knee = handedness === 'R' ? ikData.rightknee : (ikData.leftknee || []);
  const ankleInv = handedness === 'R' ? ikData.rightankleinv : (ikData.leftankleinv || []);
  const ankleFlex = handedness === 'R' ? ikData.rightankleflex : (ikData.leftankleflex || []);
  
  if (!knee.length || !ankleInv.length || !ankleFlex.length) {
    return 50; // Default if data missing
  }
  
  // Knee metrics
  const kneePeak = findPeakFrame(knee);
  const kneeMag = Math.abs(knee[kneePeak]) / Math.max(...knee.map(Math.abs));
  const kneeTimingError = Math.abs(kneePeak - 
    (KRS_TARGET.max_knee_time * ikData.contact_frame + ikData.contact_frame)) / totalFrames;
  
  // Ankle inversion metrics
  const ankleInvMag = Math.abs(ankleInv[findPeakFrame(ankleInv)]) / 
    Math.max(...ankleInv.map(Math.abs));
  
  // Ankle flexion metrics
  const ankleFlexMag = Math.abs(ankleFlex[findPeakFrame(ankleFlex)]) / 
    Math.max(...ankleFlex.map(Math.abs));
  
  // Bucket 3 score
  const b3Raw = (0.4 * kneeMag + 0.35 * ankleInvMag + 0.25 * ankleFlexMag) - 
    0.2 * kneeTimingError;
  
  return Math.max(0, Math.min(1, b3Raw)) * 100;
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
  const normalizedPeaks = segmentPeaks.map(p => p / totalFrames);
  
  // Calculate phase scatter (std dev of peak timings)
  const mean = normalizedPeaks.reduce((a, b) => a + b, 0) / normalizedPeaks.length;
  const variance = normalizedPeaks.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / normalizedPeaks.length;
  const stdDev = Math.sqrt(variance);
  
  // Lower scatter = higher synchronization score
  const maxExpectedScatter = 0.3; // Maximum expected phase scatter
  const b4Raw = 1 - (stdDev / maxExpectedScatter);
  
  return Math.max(0, Math.min(1, b4Raw)) * 100;
}

/**
 * Extract actual bat speed in mph from ME data
 */
function extractBatSpeed(meData: MEData): number {
  const contactFrame = meData.contact_frame;
  
  // Get momentum at contact
  const momX = meData.bat_linear_momentum_x[contactFrame] || 0;
  const momY = meData.bat_linear_momentum_y[contactFrame] || 0;
  const momZ = meData.bat_linear_momentum_z[contactFrame] || 0;
  
  const momentumMag = Math.sqrt(momX * momX + momY * momY + momZ * momZ);
  
  // Standard baseball bat mass in kg
  const batMass = 0.879; // ~31 oz bat in kg
  
  // Velocity in m/s
  const velocityMs = momentumMag / batMass;
  
  // Convert to mph (1 m/s = 2.237 mph)
  return velocityMs * 2.237;
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
  return {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: csvData['contact_frame']?.[0] || Math.floor((csvData['rel_frame']?.length || 100) * 0.8),
    stride_frame: csvData['stride_frame']?.[0] || Math.floor((csvData['rel_frame']?.length || 100) * 0.2),
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
 * Map ME CSV data to structured MEData
 */
function mapMEData(csvData: Record<string, number[]>): MEData {
  return {
    rel_frame: csvData['rel_frame'] || csvData['frame'] || [],
    contact_frame: csvData['contact_frame']?.[0] || Math.floor((csvData['rel_frame']?.length || 100) * 0.8),
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
      .select('*, players(id, handedness)')
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

    // Parse CSV files
    const ikParsed = parseCSV(ikCsvContent);
    const meParsed = parseCSV(meCsvContent);

    // Map to structured data
    const ikData = mapIKData(ikParsed);
    const meData = mapMEData(meParsed);

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

    // Extract bat speed
    const vBatActual = extractBatSpeed(meData);

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
          primaryIssue: primary,
          bucketBreakdown: breakdown,
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
