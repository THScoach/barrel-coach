/**
 * Video Analysis Module - Main Entry Point
 * ============================================================================
 * Combines MediaPipe pose extraction with 4B body scoring
 * 
 * Usage:
 *   import { analyzeSwingVideo } from '@/lib/video-analysis';
 *   
 *   const result = await analyzeSwingVideo(videoFile, {
 *     onProgress: (p, s) => console.log(`${p}% - ${s}`)
 *   });
 *   
 *   console.log(result.fourBInputs);  // Ready for 4B scoring
 */

export { 
  analyzeBodyRotation,
  applyCalibration,
  type BodyAnalysisResult,
  type FourBBodyInputs,
  type RotationFrame,
  type VelocityFrame,
  type SwingWindow,
  type CalibrationCoefficients,
} from './mediapipe-body-tracker';

export {
  BrowserPoseExtractor,
  extractPosesServer,
  loadVideo,
  fileToDataUrl,
  estimateFrameRate,
  type ExtractionOptions,
  type ExtractionResult,
} from './video-pose-extractor';

import { analyzeBodyRotation, applyCalibration, type BodyAnalysisResult, type CalibrationCoefficients } from './mediapipe-body-tracker';
import { BrowserPoseExtractor, loadVideo, type ExtractionOptions } from './video-pose-extractor';

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

export interface SwingAnalysisOptions extends ExtractionOptions {
  /** Apply Reboot calibration to results */
  calibration?: CalibrationCoefficients;
}

export interface SwingVideoAnalysisResult {
  /** Body rotation analysis */
  bodyAnalysis: BodyAnalysisResult;
  
  /** Video metadata */
  video: {
    duration: number;
    frameRate: number;
    width: number;
    height: number;
    totalFrames: number;
    validFrames: number;
  };
  
  /** Processing stats */
  processing: {
    extractionTimeMs: number;
    analysisTimeMs: number;
    totalTimeMs: number;
  };
  
  /** Quality assessment */
  quality: {
    isUsable: boolean;
    issues: string[];
    validFramePercent: number;
    swingDetected: boolean;
  };
}

/**
 * Analyze a swing video from a File input
 * All-in-one function for browser-side analysis
 */
export async function analyzeSwingVideo(
  videoFile: File | string,
  options: SwingAnalysisOptions = {}
): Promise<SwingVideoAnalysisResult> {
  const totalStart = performance.now();
  const issues: string[] = [];
  
  // Load video
  let videoUrl: string;
  if (typeof videoFile === 'string') {
    videoUrl = videoFile;
  } else {
    videoUrl = URL.createObjectURL(videoFile);
  }
  
  const video = await loadVideo(videoUrl);
  
  // Extract poses
  const extractor = new BrowserPoseExtractor();
  
  try {
    const extractionResult = await extractor.processVideo(video, options);
    const extractionTimeMs = extractionResult.processingTimeMs;
    
    // Analyze body rotation
    const analysisStart = performance.now();
    let bodyAnalysis = analyzeBodyRotation(extractionResult.frames, extractionResult.frameRate);
    const analysisTimeMs = performance.now() - analysisStart;
    
    // Apply calibration if provided
    if (options.calibration) {
      bodyAnalysis = applyCalibration(bodyAnalysis, options.calibration);
    }
    
    // Assess quality
    const validFramePercent = extractionResult.validFrameCount / extractionResult.extractedFrameCount;
    
    if (validFramePercent < 0.5) {
      issues.push('Low pose detection rate - check video quality and framing');
    }
    
    if (!bodyAnalysis.swingWindow) {
      issues.push('Could not detect swing - ensure full swing is visible');
    }
    
    if (bodyAnalysis.fourBInputs.pelvis_velocity < 200) {
      issues.push('Low pelvis velocity detected - may not be a full swing');
    }
    
    const isUsable = validFramePercent >= 0.5 && bodyAnalysis.swingWindow !== null;
    
    const totalTimeMs = performance.now() - totalStart;
    
    return {
      bodyAnalysis,
      video: {
        duration: extractionResult.duration,
        frameRate: extractionResult.frameRate,
        width: extractionResult.width,
        height: extractionResult.height,
        totalFrames: extractionResult.extractedFrameCount,
        validFrames: extractionResult.validFrameCount,
      },
      processing: {
        extractionTimeMs,
        analysisTimeMs,
        totalTimeMs,
      },
      quality: {
        isUsable,
        issues,
        validFramePercent: Math.round(validFramePercent * 100),
        swingDetected: bodyAnalysis.swingWindow !== null,
      },
    };
    
  } finally {
    extractor.close();
    
    // Clean up blob URL if we created one
    if (typeof videoFile !== 'string') {
      URL.revokeObjectURL(videoUrl);
    }
  }
}

/**
 * Combine MediaPipe body analysis with DK sensor data
 * Creates unified 4B inputs from both sources
 */
export interface CombinedSwingData {
  // From MediaPipe (body)
  pelvis_velocity?: number;
  torso_velocity?: number;
  x_factor?: number;
  stretch_rate?: number;
  body_consistency_cv?: number;
  tp_ratio?: number;
  sequencing_quality?: 'good' | 'average' | 'poor';
  
  // From DK sensor (bat)
  bat_speed_mph?: number;
  hand_speed_mph?: number;
  trigger_to_impact_ms?: number;
  attack_angle_deg?: number;
  attack_direction_deg?: number;
  hand_to_bat_ratio?: number;
}

export interface UnifiedFourBInputs {
  // Brain (timing/consistency)
  timing_cv: number;           // From DK if available, else body_consistency_cv
  trigger_to_impact_ms: number | null;
  
  // Body (power generation)
  pelvis_velocity: number;
  torso_velocity: number;
  x_factor: number;
  stretch_rate: number;
  tp_ratio: number;
  sequencing_quality: 'good' | 'average' | 'poor';
  
  // Bat (path and speed)
  bat_speed_mph: number | null;
  hand_speed_mph: number | null;
  attack_angle_deg: number | null;
  attack_direction_deg: number | null;
  
  // Ball (transfer efficiency)
  hand_to_bat_ratio: number | null;  // True transfer ratio if both speeds available
  body_to_bat_efficiency: number | null;  // pelvis energy → bat speed
  
  // Data source flags
  has_video_data: boolean;
  has_sensor_data: boolean;
}

/**
 * Merge body (MediaPipe) and bat (DK sensor) data into unified 4B inputs
 */
export function combineDataSources(data: CombinedSwingData): UnifiedFourBInputs {
  const hasVideo = data.pelvis_velocity !== undefined;
  const hasSensor = data.bat_speed_mph !== undefined;
  
  // Calculate body-to-bat efficiency if we have both
  let bodyToBatEfficiency: number | null = null;
  if (hasVideo && hasSensor && data.pelvis_velocity && data.bat_speed_mph) {
    // Simplified efficiency: bat speed relative to pelvis velocity
    // Elite: bat speed ~1.0-1.2x pelvis velocity (in different units, so normalize)
    // Pelvis: 600-900 deg/s → normalize to ~1.0
    // Bat: 60-80 mph → normalize to ~1.0
    const normalizedPelvis = (data.pelvis_velocity / 750);  // 750 = reference elite pelvis
    const normalizedBat = (data.bat_speed_mph / 70);  // 70 = reference good bat speed
    bodyToBatEfficiency = Math.round((normalizedBat / normalizedPelvis) * 100) / 100;
  }
  
  return {
    // Brain
    timing_cv: data.body_consistency_cv ?? 15,  // Default to average if no data
    trigger_to_impact_ms: data.trigger_to_impact_ms ?? null,
    
    // Body (from video)
    pelvis_velocity: data.pelvis_velocity ?? 0,
    torso_velocity: data.torso_velocity ?? 0,
    x_factor: data.x_factor ?? 0,
    stretch_rate: data.stretch_rate ?? 0,
    tp_ratio: data.tp_ratio ?? 1.0,
    sequencing_quality: data.sequencing_quality ?? 'average',
    
    // Bat (from sensor)
    bat_speed_mph: data.bat_speed_mph ?? null,
    hand_speed_mph: data.hand_speed_mph ?? null,
    attack_angle_deg: data.attack_angle_deg ?? null,
    attack_direction_deg: data.attack_direction_deg ?? null,
    
    // Ball (transfer)
    hand_to_bat_ratio: data.hand_to_bat_ratio ?? null,
    body_to_bat_efficiency: bodyToBatEfficiency,
    
    // Flags
    has_video_data: hasVideo,
    has_sensor_data: hasSensor,
  };
}

// ============================================================================
// MOTOR PROFILE INFERENCE (EXPERIMENTAL)
// ============================================================================

export type MotorProfile = 'Spinner' | 'Slingshotter' | 'Whipper' | 'Titan' | 'Unknown';

export interface MotorProfileResult {
  primary: MotorProfile;
  confidence: number;
  scores: Record<MotorProfile, number>;
  evidence: string[];
}

/**
 * Infer motor profile from combined swing data
 * This is a simplified heuristic - should be trained on Reboot data
 */
export function inferMotorProfile(data: UnifiedFourBInputs): MotorProfileResult {
  const scores: Record<MotorProfile, number> = {
    'Spinner': 0,
    'Slingshotter': 0,
    'Whipper': 0,
    'Titan': 0,
    'Unknown': 0,
  };
  
  const evidence: string[] = [];
  
  // Spinner: Rotational power, turns hard
  // Indicators: High pelvis velocity, early hip lead, good X-factor
  if (data.pelvis_velocity > 650) {
    scores['Spinner'] += 30;
    evidence.push('High pelvis velocity suggests rotational power');
  }
  if (data.sequencing_quality === 'good' && data.tp_ratio > 1.1) {
    scores['Spinner'] += 25;
    evidence.push('Good kinetic sequence with torso catching up');
  }
  
  // Slingshotter: Elastic energy, stretch-shortening cycle
  // Indicators: High stretch rate, good X-factor, elastic sequencing
  if (data.stretch_rate > 800) {
    scores['Slingshotter'] += 35;
    evidence.push('High stretch rate indicates elastic loading');
  }
  if (data.x_factor > 40) {
    scores['Slingshotter'] += 20;
    evidence.push('Large X-factor supports slingshot pattern');
  }
  
  // Whipper: Hand/bat speed dominant
  // Indicators: High bat speed relative to body metrics, late hand fire
  if (data.bat_speed_mph && data.bat_speed_mph > 70) {
    scores['Whipper'] += 25;
    evidence.push('High bat speed');
  }
  if (data.hand_to_bat_ratio && data.hand_to_bat_ratio > 1.6) {
    scores['Whipper'] += 30;
    evidence.push('High hand-to-bat ratio suggests whip action');
  }
  
  // Titan: Strength-based, drives through
  // Indicators: Consistent velocities, high power, steady metrics
  if (data.timing_cv < 8) {
    scores['Titan'] += 20;
    evidence.push('Very consistent timing suggests strength-based approach');
  }
  if (data.body_to_bat_efficiency && data.body_to_bat_efficiency > 1.1) {
    scores['Titan'] += 25;
    evidence.push('Efficient energy transfer through strength');
  }
  
  // Find primary profile
  let maxScore = 0;
  let primary: MotorProfile = 'Unknown';
  
  for (const [profile, score] of Object.entries(scores) as [MotorProfile, number][]) {
    if (profile !== 'Unknown' && score > maxScore) {
      maxScore = score;
      primary = profile;
    }
  }
  
  // Calculate confidence (0-100)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.round((maxScore / 100) * 100) : 0;
  
  // If no clear signal, mark as Unknown
  if (maxScore < 30) {
    primary = 'Unknown';
  }
  
  return {
    primary,
    confidence,
    scores,
    evidence,
  };
}
