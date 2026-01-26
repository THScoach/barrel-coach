/**
 * MediaPipe Video Analysis Edge Function
 * ============================================================================
 * Server-side video analysis using MediaPipe
 * 
 * POST /mediapipe-analyze
 * Body: {
 *   video_url: string,        // URL to video file
 *   session_id?: string,      // Optional: link to sensor_session
 *   player_id?: string,       // Optional: link to player
 *   save_results?: boolean,   // Whether to save to DB (default: true)
 * }
 * 
 * Response: {
 *   success: boolean,
 *   analysis: BodyAnalysisResult,
 *   fourBInputs: FourBBodyInputs,
 *   quality: { isUsable, issues, validFramePercent },
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPES (simplified for edge function)
// ============================================================================

interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface RotationFrame {
  timestamp: number;
  frameNumber: number;
  pelvisAngle: number;
  torsoAngle: number;
  xFactor: number;
  confidence: number;
  isValid: boolean;
}

interface VelocityFrame {
  timestamp: number;
  frameNumber: number;
  pelvisVelocity: number;
  torsoVelocity: number;
  xFactorVelocity: number;
}

interface SwingWindow {
  startFrame: number;
  endFrame: number;
  contactFrame: number;
  strideFrame: number;
}

interface FourBBodyInputs {
  pelvis_velocity: number;
  torso_velocity: number;
  x_factor: number;
  stretch_rate: number;
  consistency_cv: number;
  tp_ratio: number;
  sequencing_quality: 'good' | 'average' | 'poor';
}

interface AnalysisResult {
  swingWindow: SwingWindow | null;
  peakPelvisVelocity: number;
  peakTorsoVelocity: number;
  peakXFactor: number;
  peakStretchRate: number;
  pelvisPeakFrame: number;
  torsoPeakFrame: number;
  sequencingGap: number;
  frameRate: number;
  totalFrames: number;
  validFramePercent: number;
  fourBInputs: FourBBodyInputs;
}

// MediaPipe landmark indices
const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
};

const CONFIG = {
  MIN_VISIBILITY: 0.5,
  VELOCITY_SMOOTHING_WINDOW: 3,
  SWING_PELVIS_VELOCITY_THRESHOLD: 200,
  SWING_MIN_DURATION_FRAMES: 10,
  SWING_MAX_DURATION_FRAMES: 60,
};

// ============================================================================
// ANALYSIS FUNCTIONS (ported from TypeScript module)
// ============================================================================

function calculateLineAngle(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

function processFrame(
  landmarks: PoseLandmark[],
  timestamp: number,
  frameNumber: number
): RotationFrame {
  const leftHip = landmarks[LANDMARK.LEFT_HIP];
  const rightHip = landmarks[LANDMARK.RIGHT_HIP];
  const leftShoulder = landmarks[LANDMARK.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARK.RIGHT_SHOULDER];
  
  const keyLandmarks = [leftHip, rightHip, leftShoulder, rightShoulder];
  const confidence = keyLandmarks.reduce((sum, lm) => sum + (lm?.visibility ?? 0), 0) / 4;
  
  const hipValid = (leftHip?.visibility ?? 0) >= CONFIG.MIN_VISIBILITY && 
                   (rightHip?.visibility ?? 0) >= CONFIG.MIN_VISIBILITY;
  const shoulderValid = (leftShoulder?.visibility ?? 0) >= CONFIG.MIN_VISIBILITY && 
                        (rightShoulder?.visibility ?? 0) >= CONFIG.MIN_VISIBILITY;
  
  const isValid = hipValid && shoulderValid && confidence >= CONFIG.MIN_VISIBILITY;
  
  let pelvisAngle = 0;
  let torsoAngle = 0;
  
  if (hipValid) {
    pelvisAngle = calculateLineAngle(rightHip, leftHip);
  }
  if (shoulderValid) {
    torsoAngle = calculateLineAngle(rightShoulder, leftShoulder);
  }
  
  return {
    timestamp,
    frameNumber,
    pelvisAngle,
    torsoAngle,
    xFactor: isValid ? (torsoAngle - pelvisAngle) : 0,
    confidence,
    isValid,
  };
}

function calculateVelocities(
  rotationFrames: RotationFrame[],
  frameRate: number
): VelocityFrame[] {
  const dt = 1 / frameRate;
  const velocityFrames: VelocityFrame[] = [];
  
  for (let i = 1; i < rotationFrames.length - 1; i++) {
    const prev = rotationFrames[i - 1];
    const curr = rotationFrames[i];
    const next = rotationFrames[i + 1];
    
    if (!curr.isValid) {
      velocityFrames.push({
        timestamp: curr.timestamp,
        frameNumber: curr.frameNumber,
        pelvisVelocity: 0,
        torsoVelocity: 0,
        xFactorVelocity: 0,
      });
      continue;
    }
    
    const pelvisVelocity = Math.abs((next.pelvisAngle - prev.pelvisAngle) / (2 * dt));
    const torsoVelocity = Math.abs((next.torsoAngle - prev.torsoAngle) / (2 * dt));
    const xFactorVelocity = (next.xFactor - prev.xFactor) / (2 * dt);
    
    velocityFrames.push({
      timestamp: curr.timestamp,
      frameNumber: curr.frameNumber,
      pelvisVelocity,
      torsoVelocity,
      xFactorVelocity,
    });
  }
  
  return velocityFrames;
}

function smoothVelocities(
  velocityFrames: VelocityFrame[],
  windowSize: number = CONFIG.VELOCITY_SMOOTHING_WINDOW
): VelocityFrame[] {
  const halfWindow = Math.floor(windowSize / 2);
  
  return velocityFrames.map((frame, i) => {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(velocityFrames.length - 1, i + halfWindow);
    const window = velocityFrames.slice(start, end + 1);
    
    const avgPelvis = window.reduce((sum, f) => sum + f.pelvisVelocity, 0) / window.length;
    const avgTorso = window.reduce((sum, f) => sum + f.torsoVelocity, 0) / window.length;
    const avgXFactor = window.reduce((sum, f) => sum + f.xFactorVelocity, 0) / window.length;
    
    return {
      ...frame,
      pelvisVelocity: avgPelvis,
      torsoVelocity: avgTorso,
      xFactorVelocity: avgXFactor,
    };
  });
}

function detectSwingWindow(velocityFrames: VelocityFrame[]): SwingWindow | null {
  let startFrame = -1;
  for (let i = 0; i < velocityFrames.length; i++) {
    if (velocityFrames[i].pelvisVelocity > CONFIG.SWING_PELVIS_VELOCITY_THRESHOLD) {
      startFrame = i;
      break;
    }
  }
  
  if (startFrame === -1) return null;
  
  let maxTorsoVelocity = 0;
  let contactFrame = startFrame;
  
  for (let i = startFrame; i < Math.min(startFrame + CONFIG.SWING_MAX_DURATION_FRAMES, velocityFrames.length); i++) {
    if (velocityFrames[i].torsoVelocity > maxTorsoVelocity) {
      maxTorsoVelocity = velocityFrames[i].torsoVelocity;
      contactFrame = i;
    }
  }
  
  const endFrame = Math.min(contactFrame + 10, velocityFrames.length - 1);
  const swingLength = contactFrame - startFrame;
  const strideFrame = startFrame + Math.floor(swingLength * 0.35);
  
  if (swingLength < CONFIG.SWING_MIN_DURATION_FRAMES) return null;
  
  return { startFrame, endFrame, contactFrame, strideFrame };
}

function calculateCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return (Math.sqrt(variance) / mean) * 100;
}

function analyzeFrames(
  poseFrames: { timestamp: number; landmarks: PoseLandmark[] }[],
  frameRate: number
): AnalysisResult {
  // Process each frame
  const rotationFrames = poseFrames.map((frame, i) => 
    processFrame(frame.landmarks, frame.timestamp, i)
  );
  
  // Calculate velocities
  const rawVelocities = calculateVelocities(rotationFrames, frameRate);
  const velocityFrames = smoothVelocities(rawVelocities);
  
  // Detect swing window
  const swingWindow = detectSwingWindow(velocityFrames);
  
  // Calculate valid frame percentage
  const validFrameCount = rotationFrames.filter(f => f.isValid).length;
  const validFramePercent = validFrameCount / rotationFrames.length;
  
  // Extract peak metrics
  let peakPelvisVelocity = 0;
  let peakTorsoVelocity = 0;
  let peakXFactor = 0;
  let peakStretchRate = 0;
  let pelvisPeakFrame = 0;
  let torsoPeakFrame = 0;
  
  const analysisWindow = swingWindow 
    ? velocityFrames.slice(swingWindow.startFrame, swingWindow.endFrame + 1)
    : velocityFrames;
  
  const rotationWindow = swingWindow
    ? rotationFrames.slice(swingWindow.startFrame, swingWindow.endFrame + 1)
    : rotationFrames;
  
  analysisWindow.forEach((frame, i) => {
    if (frame.pelvisVelocity > peakPelvisVelocity) {
      peakPelvisVelocity = frame.pelvisVelocity;
      pelvisPeakFrame = (swingWindow?.startFrame ?? 0) + i;
    }
    if (frame.torsoVelocity > peakTorsoVelocity) {
      peakTorsoVelocity = frame.torsoVelocity;
      torsoPeakFrame = (swingWindow?.startFrame ?? 0) + i;
    }
    if (frame.xFactorVelocity > peakStretchRate) {
      peakStretchRate = frame.xFactorVelocity;
    }
  });
  
  rotationWindow.forEach(frame => {
    if (Math.abs(frame.xFactor) > Math.abs(peakXFactor)) {
      peakXFactor = frame.xFactor;
    }
  });
  
  // Calculate consistency
  const pelvisVelocities = analysisWindow.map(f => f.pelvisVelocity).filter(v => v > 50);
  const consistencyCV = calculateCV(pelvisVelocities);
  
  // Estimate T:P ratio
  const tpRatio = peakPelvisVelocity > 0 ? peakTorsoVelocity / peakPelvisVelocity : 1.0;
  const sequenceGap = torsoPeakFrame - pelvisPeakFrame;
  
  let sequencingQuality: 'good' | 'average' | 'poor';
  if (sequenceGap > 2 && tpRatio > 1.0) {
    sequencingQuality = 'good';
  } else if (sequenceGap >= 0 && tpRatio >= 0.9) {
    sequencingQuality = 'average';
  } else {
    sequencingQuality = 'poor';
  }
  
  const fourBInputs: FourBBodyInputs = {
    pelvis_velocity: Math.round(peakPelvisVelocity),
    torso_velocity: Math.round(peakTorsoVelocity),
    x_factor: Math.round(Math.abs(peakXFactor) * 10) / 10,
    stretch_rate: Math.round(peakStretchRate),
    consistency_cv: Math.round(consistencyCV * 10) / 10,
    tp_ratio: Math.round(tpRatio * 100) / 100,
    sequencing_quality: sequencingQuality,
  };
  
  return {
    swingWindow,
    peakPelvisVelocity,
    peakTorsoVelocity,
    peakXFactor: Math.abs(peakXFactor),
    peakStretchRate,
    pelvisPeakFrame,
    torsoPeakFrame,
    sequencingGap: sequenceGap,
    frameRate,
    totalFrames: poseFrames.length,
    validFramePercent,
    fourBInputs,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { 
      pose_frames,  // Pre-extracted pose data (from client-side MediaPipe)
      frame_rate = 30,
      session_id,
      player_id,
      save_results = true,
    } = await req.json();

    if (!pose_frames || !Array.isArray(pose_frames)) {
      return new Response(
        JSON.stringify({ error: "pose_frames array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[MediaPipe] Analyzing ${pose_frames.length} frames at ${frame_rate}fps`);

    // Run analysis
    const analysis = analyzeFrames(pose_frames, frame_rate);

    // Assess quality
    const issues: string[] = [];
    if (analysis.validFramePercent < 0.5) {
      issues.push('Low pose detection rate');
    }
    if (!analysis.swingWindow) {
      issues.push('Could not detect swing');
    }
    if (analysis.fourBInputs.pelvis_velocity < 200) {
      issues.push('Low pelvis velocity');
    }

    const isUsable = analysis.validFramePercent >= 0.5 && analysis.swingWindow !== null;

    // Save to database if requested
    if (save_results && player_id) {
      const { error: insertError } = await supabase
        .from('video_analyses')
        .insert({
          player_id,
          session_id,
          source: 'mediapipe',
          analysis_type: 'body_rotation',
          pelvis_velocity: analysis.fourBInputs.pelvis_velocity,
          torso_velocity: analysis.fourBInputs.torso_velocity,
          x_factor: analysis.fourBInputs.x_factor,
          stretch_rate: analysis.fourBInputs.stretch_rate,
          consistency_cv: analysis.fourBInputs.consistency_cv,
          tp_ratio: analysis.fourBInputs.tp_ratio,
          sequencing_quality: analysis.fourBInputs.sequencing_quality,
          is_usable: isUsable,
          quality_issues: issues,
          frame_count: analysis.totalFrames,
          valid_frame_percent: Math.round(analysis.validFramePercent * 100),
          raw_analysis: analysis,
        });

      if (insertError) {
        console.error('[MediaPipe] Failed to save analysis:', insertError);
      }
    }

    // If we have a sensor session, update its body metrics
    if (session_id && isUsable) {
      await supabase
        .from('sensor_sessions')
        .update({
          video_pelvis_velocity: analysis.fourBInputs.pelvis_velocity,
          video_torso_velocity: analysis.fourBInputs.torso_velocity,
          video_x_factor: analysis.fourBInputs.x_factor,
          video_stretch_rate: analysis.fourBInputs.stretch_rate,
          video_analyzed_at: new Date().toISOString(),
        })
        .eq('id', session_id);
    }

    console.log(`[MediaPipe] Analysis complete: Pelvis=${analysis.fourBInputs.pelvis_velocity}°/s, Torso=${analysis.fourBInputs.torso_velocity}°/s, X-Factor=${analysis.fourBInputs.x_factor}°`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          peakPelvisVelocity: analysis.peakPelvisVelocity,
          peakTorsoVelocity: analysis.peakTorsoVelocity,
          peakXFactor: analysis.peakXFactor,
          peakStretchRate: analysis.peakStretchRate,
          sequencingGap: analysis.sequencingGap,
          swingDetected: analysis.swingWindow !== null,
        },
        fourBInputs: analysis.fourBInputs,
        quality: {
          isUsable,
          issues,
          validFramePercent: Math.round(analysis.validFramePercent * 100),
          swingDetected: analysis.swingWindow !== null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[MediaPipe] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
