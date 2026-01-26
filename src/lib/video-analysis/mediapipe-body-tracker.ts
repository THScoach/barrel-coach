/**
 * MediaPipe Body Tracker for Baseball Swing Analysis
 * ============================================================================
 * Extracts body rotation metrics from 2D video using MediaPipe Pose
 * Outputs data compatible with the 4B Framework scoring system
 * 
 * Key Metrics Extracted:
 * - Pelvis rotation velocity (deg/s)
 * - Torso rotation velocity (deg/s)
 * - X-Factor (hip-shoulder separation)
 * - Stretch rate (rate of X-Factor change)
 * 
 * Training Target: Match Reboot Motion ground truth from 3D capture
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PoseLandmark {
  x: number;  // Normalized [0,1] from left edge
  y: number;  // Normalized [0,1] from top edge
  z: number;  // Depth (relative to hip center, negative = closer to camera)
  visibility: number;  // Confidence [0,1]
}

export interface PoseFrame {
  timestamp: number;  // ms from video start
  frameNumber: number;
  landmarks: PoseLandmark[];  // 33 MediaPipe landmarks
}

export interface RotationFrame {
  timestamp: number;
  frameNumber: number;
  
  // Raw angles (degrees, from camera perspective)
  pelvisAngle: number;      // Angle of hip line relative to camera
  torsoAngle: number;       // Angle of shoulder line relative to camera
  
  // Derived metrics
  xFactor: number;          // torsoAngle - pelvisAngle (hip-shoulder separation)
  
  // Quality indicators
  confidence: number;       // Average landmark visibility
  isValid: boolean;         // Meets minimum visibility threshold
}

export interface VelocityFrame {
  timestamp: number;
  frameNumber: number;
  
  pelvisVelocity: number;   // deg/s
  torsoVelocity: number;    // deg/s
  xFactorVelocity: number;  // deg/s (stretch rate)
}

export interface SwingWindow {
  startFrame: number;
  endFrame: number;
  contactFrame: number;
  strideFrame: number;
}

export interface BodyAnalysisResult {
  // Frame-by-frame data
  rotationFrames: RotationFrame[];
  velocityFrames: VelocityFrame[];
  
  // Detected swing window
  swingWindow: SwingWindow | null;
  
  // Peak metrics (within swing window)
  peakPelvisVelocity: number;
  peakTorsoVelocity: number;
  peakXFactor: number;
  peakStretchRate: number;
  
  // Timing metrics
  pelvisPeakFrame: number;
  torsoPeakFrame: number;
  sequencingGap: number;  // frames between pelvis and torso peak
  
  // Quality metrics
  frameRate: number;
  totalFrames: number;
  validFramePercent: number;
  
  // Compatibility with 4B scoring
  fourBInputs: FourBBodyInputs;
}

export interface FourBBodyInputs {
  pelvis_velocity: number;
  torso_velocity: number;
  x_factor: number;
  stretch_rate: number;
  consistency_cv: number;
  tp_ratio: number;  // Estimated from velocity sequencing
  sequencing_quality: 'good' | 'average' | 'poor';
}

// ============================================================================
// MEDIAPIPE LANDMARK INDICES
// ============================================================================

const LANDMARK = {
  // Face
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  
  // Upper body
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  
  // Lower body
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Minimum landmark visibility to consider valid
  MIN_VISIBILITY: 0.5,
  
  // Minimum percentage of valid frames required
  MIN_VALID_FRAME_PERCENT: 0.7,
  
  // Velocity smoothing window (frames)
  VELOCITY_SMOOTHING_WINDOW: 3,
  
  // Swing detection thresholds
  SWING_PELVIS_VELOCITY_THRESHOLD: 200,  // deg/s to detect swing start
  SWING_MIN_DURATION_FRAMES: 10,
  SWING_MAX_DURATION_FRAMES: 60,
  
  // Camera angle compensation (for non-perpendicular views)
  // 0 = perpendicular to batter, 90 = behind batter
  DEFAULT_CAMERA_ANGLE: 0,
};

// ============================================================================
// CORE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Calculate angle of a line between two points (in degrees)
 * Returns angle relative to horizontal (0° = horizontal, positive = counterclockwise)
 */
function calculateLineAngle(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * Calculate pelvis rotation angle from hip landmarks
 * Assumes camera is roughly perpendicular to batter (side view)
 */
function calculatePelvisAngle(landmarks: PoseLandmark[]): number | null {
  const leftHip = landmarks[LANDMARK.LEFT_HIP];
  const rightHip = landmarks[LANDMARK.RIGHT_HIP];
  
  if (leftHip.visibility < CONFIG.MIN_VISIBILITY || rightHip.visibility < CONFIG.MIN_VISIBILITY) {
    return null;
  }
  
  // For a right-handed batter in side view:
  // - At load, hips are closed (line points toward camera = ~0°)
  // - At contact, hips are open (line points away = ~90°)
  return calculateLineAngle(rightHip, leftHip);
}

/**
 * Calculate torso rotation angle from shoulder landmarks
 */
function calculateTorsoAngle(landmarks: PoseLandmark[]): number | null {
  const leftShoulder = landmarks[LANDMARK.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARK.RIGHT_SHOULDER];
  
  if (leftShoulder.visibility < CONFIG.MIN_VISIBILITY || rightShoulder.visibility < CONFIG.MIN_VISIBILITY) {
    return null;
  }
  
  return calculateLineAngle(rightShoulder, leftShoulder);
}

/**
 * Calculate average visibility of key landmarks
 */
function calculateConfidence(landmarks: PoseLandmark[]): number {
  const keyLandmarks = [
    landmarks[LANDMARK.LEFT_HIP],
    landmarks[LANDMARK.RIGHT_HIP],
    landmarks[LANDMARK.LEFT_SHOULDER],
    landmarks[LANDMARK.RIGHT_SHOULDER],
  ];
  
  const totalVisibility = keyLandmarks.reduce((sum, lm) => sum + lm.visibility, 0);
  return totalVisibility / keyLandmarks.length;
}

/**
 * Process a single frame to extract rotation data
 */
function processFrame(frame: PoseFrame): RotationFrame {
  const pelvisAngle = calculatePelvisAngle(frame.landmarks);
  const torsoAngle = calculateTorsoAngle(frame.landmarks);
  const confidence = calculateConfidence(frame.landmarks);
  
  const isValid = pelvisAngle !== null && torsoAngle !== null && confidence >= CONFIG.MIN_VISIBILITY;
  
  return {
    timestamp: frame.timestamp,
    frameNumber: frame.frameNumber,
    pelvisAngle: pelvisAngle ?? 0,
    torsoAngle: torsoAngle ?? 0,
    xFactor: isValid ? (torsoAngle! - pelvisAngle!) : 0,
    confidence,
    isValid,
  };
}

/**
 * Calculate velocities from rotation frames using central difference
 */
function calculateVelocities(
  rotationFrames: RotationFrame[],
  frameRate: number
): VelocityFrame[] {
  const dt = 1 / frameRate;  // Time between frames in seconds
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
    
    // Central difference: (f(x+h) - f(x-h)) / (2h)
    const pelvisVelocity = (next.pelvisAngle - prev.pelvisAngle) / (2 * dt);
    const torsoVelocity = (next.torsoAngle - prev.torsoAngle) / (2 * dt);
    const xFactorVelocity = (next.xFactor - prev.xFactor) / (2 * dt);
    
    velocityFrames.push({
      timestamp: curr.timestamp,
      frameNumber: curr.frameNumber,
      pelvisVelocity: Math.abs(pelvisVelocity),  // Always positive (magnitude)
      torsoVelocity: Math.abs(torsoVelocity),
      xFactorVelocity,  // Can be negative (closing) or positive (opening)
    });
  }
  
  return velocityFrames;
}

/**
 * Apply moving average smoothing to velocity data
 */
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

/**
 * Detect the swing window from velocity data
 * Looks for rapid pelvis rotation followed by torso rotation
 */
function detectSwingWindow(
  velocityFrames: VelocityFrame[],
  rotationFrames: RotationFrame[]
): SwingWindow | null {
  // Find frame where pelvis velocity exceeds threshold (swing initiation)
  let startFrame = -1;
  for (let i = 0; i < velocityFrames.length; i++) {
    if (velocityFrames[i].pelvisVelocity > CONFIG.SWING_PELVIS_VELOCITY_THRESHOLD) {
      startFrame = i;
      break;
    }
  }
  
  if (startFrame === -1) {
    return null;
  }
  
  // Find peak torso velocity after start (approximate contact)
  let maxTorsoVelocity = 0;
  let contactFrame = startFrame;
  
  for (let i = startFrame; i < Math.min(startFrame + CONFIG.SWING_MAX_DURATION_FRAMES, velocityFrames.length); i++) {
    if (velocityFrames[i].torsoVelocity > maxTorsoVelocity) {
      maxTorsoVelocity = velocityFrames[i].torsoVelocity;
      contactFrame = i;
    }
  }
  
  // End frame is shortly after contact (follow-through)
  const endFrame = Math.min(contactFrame + 10, velocityFrames.length - 1);
  
  // Stride frame is approximately 30-40% into swing
  const swingLength = contactFrame - startFrame;
  const strideFrame = startFrame + Math.floor(swingLength * 0.35);
  
  if (swingLength < CONFIG.SWING_MIN_DURATION_FRAMES) {
    return null;
  }
  
  return {
    startFrame,
    endFrame,
    contactFrame,
    strideFrame,
  };
}

/**
 * Calculate coefficient of variation for consistency metric
 */
function calculateCV(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return (stdDev / mean) * 100;  // Return as percentage
}

/**
 * Estimate T:P ratio from velocity sequencing
 * In proper sequencing, pelvis peaks first, then torso
 */
function estimateTPRatio(
  velocityFrames: VelocityFrame[],
  swingWindow: SwingWindow
): { ratio: number; quality: 'good' | 'average' | 'poor' } {
  const windowFrames = velocityFrames.slice(swingWindow.startFrame, swingWindow.endFrame + 1);
  
  // Find peak frames
  let pelvisPeakIdx = 0;
  let torsoPeakIdx = 0;
  let maxPelvis = 0;
  let maxTorso = 0;
  
  windowFrames.forEach((frame, i) => {
    if (frame.pelvisVelocity > maxPelvis) {
      maxPelvis = frame.pelvisVelocity;
      pelvisPeakIdx = i;
    }
    if (frame.torsoVelocity > maxTorso) {
      maxTorso = frame.torsoVelocity;
      torsoPeakIdx = i;
    }
  });
  
  // T:P ratio approximation: torso peak velocity / pelvis peak velocity
  // Good sequencing: torso > pelvis (ratio > 1.0)
  const ratio = maxPelvis > 0 ? maxTorso / maxPelvis : 1.0;
  
  // Sequencing quality: pelvis should peak before torso
  const sequenceGap = torsoPeakIdx - pelvisPeakIdx;
  
  let quality: 'good' | 'average' | 'poor';
  if (sequenceGap > 2 && ratio > 1.0) {
    quality = 'good';  // Proper sequencing: pelvis first, torso catches up
  } else if (sequenceGap >= 0 && ratio >= 0.9) {
    quality = 'average';  // Acceptable sequencing
  } else {
    quality = 'poor';  // Poor sequencing: torso fires early or weak transfer
  }
  
  return { ratio, quality };
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze pose frames to extract body rotation metrics for 4B scoring
 */
export function analyzeBodyRotation(
  poseFrames: PoseFrame[],
  frameRate: number = 30
): BodyAnalysisResult {
  // Process each frame
  const rotationFrames = poseFrames.map(processFrame);
  
  // Calculate velocities
  const rawVelocities = calculateVelocities(rotationFrames, frameRate);
  const velocityFrames = smoothVelocities(rawVelocities);
  
  // Detect swing window
  const swingWindow = detectSwingWindow(velocityFrames, rotationFrames);
  
  // Calculate valid frame percentage
  const validFrameCount = rotationFrames.filter(f => f.isValid).length;
  const validFramePercent = validFrameCount / rotationFrames.length;
  
  // Extract peak metrics within swing window
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
  
  // Calculate consistency (CV of velocities in swing window)
  const pelvisVelocities = analysisWindow.map(f => f.pelvisVelocity).filter(v => v > 50);
  const consistencyCV = calculateCV(pelvisVelocities);
  
  // Estimate T:P ratio from sequencing
  const tpEstimate = swingWindow 
    ? estimateTPRatio(velocityFrames, swingWindow)
    : { ratio: 1.0, quality: 'average' as const };
  
  // Build 4B-compatible inputs
  const fourBInputs: FourBBodyInputs = {
    pelvis_velocity: Math.round(peakPelvisVelocity),
    torso_velocity: Math.round(peakTorsoVelocity),
    x_factor: Math.round(Math.abs(peakXFactor) * 10) / 10,
    stretch_rate: Math.round(peakStretchRate),
    consistency_cv: Math.round(consistencyCV * 10) / 10,
    tp_ratio: Math.round(tpEstimate.ratio * 100) / 100,
    sequencing_quality: tpEstimate.quality,
  };
  
  return {
    rotationFrames,
    velocityFrames,
    swingWindow,
    peakPelvisVelocity,
    peakTorsoVelocity,
    peakXFactor: Math.abs(peakXFactor),
    peakStretchRate,
    pelvisPeakFrame,
    torsoPeakFrame,
    sequencingGap: torsoPeakFrame - pelvisPeakFrame,
    frameRate,
    totalFrames: poseFrames.length,
    validFramePercent,
    fourBInputs,
  };
}

// ============================================================================
// CAMERA ANGLE COMPENSATION (FUTURE)
// ============================================================================

/**
 * Adjust rotation angles based on camera position
 * TODO: Implement when we have camera calibration data
 */
export function compensateForCameraAngle(
  rotationFrames: RotationFrame[],
  cameraAngle: number  // degrees from perpendicular
): RotationFrame[] {
  // For a non-perpendicular view, the apparent rotation is reduced
  // True rotation = apparent rotation / cos(camera_angle)
  const compensationFactor = 1 / Math.cos(cameraAngle * (Math.PI / 180));
  
  return rotationFrames.map(frame => ({
    ...frame,
    pelvisAngle: frame.pelvisAngle * compensationFactor,
    torsoAngle: frame.torsoAngle * compensationFactor,
    xFactor: frame.xFactor * compensationFactor,
  }));
}

// ============================================================================
// REBOOT CALIBRATION (FUTURE)
// ============================================================================

/**
 * Calibration coefficients to align MediaPipe estimates with Reboot ground truth
 * These should be learned from paired MediaPipe + Reboot sessions
 */
export interface CalibrationCoefficients {
  pelvisVelocityScale: number;
  pelvisVelocityOffset: number;
  torsoVelocityScale: number;
  torsoVelocityOffset: number;
  xFactorScale: number;
  xFactorOffset: number;
  stretchRateScale: number;
  stretchRateOffset: number;
}

const DEFAULT_CALIBRATION: CalibrationCoefficients = {
  // Start with identity (no adjustment) - train from Reboot data
  pelvisVelocityScale: 1.0,
  pelvisVelocityOffset: 0,
  torsoVelocityScale: 1.0,
  torsoVelocityOffset: 0,
  xFactorScale: 1.0,
  xFactorOffset: 0,
  stretchRateScale: 1.0,
  stretchRateOffset: 0,
};

/**
 * Apply calibration to align MediaPipe output with Reboot scale
 */
export function applyCalibration(
  result: BodyAnalysisResult,
  calibration: CalibrationCoefficients = DEFAULT_CALIBRATION
): BodyAnalysisResult {
  return {
    ...result,
    peakPelvisVelocity: result.peakPelvisVelocity * calibration.pelvisVelocityScale + calibration.pelvisVelocityOffset,
    peakTorsoVelocity: result.peakTorsoVelocity * calibration.torsoVelocityScale + calibration.torsoVelocityOffset,
    peakXFactor: result.peakXFactor * calibration.xFactorScale + calibration.xFactorOffset,
    peakStretchRate: result.peakStretchRate * calibration.stretchRateScale + calibration.stretchRateOffset,
    fourBInputs: {
      ...result.fourBInputs,
      pelvis_velocity: Math.round((result.fourBInputs.pelvis_velocity * calibration.pelvisVelocityScale + calibration.pelvisVelocityOffset)),
      torso_velocity: Math.round((result.fourBInputs.torso_velocity * calibration.torsoVelocityScale + calibration.torsoVelocityOffset)),
      x_factor: Math.round((result.fourBInputs.x_factor * calibration.xFactorScale + calibration.xFactorOffset) * 10) / 10,
      stretch_rate: Math.round((result.fourBInputs.stretch_rate * calibration.stretchRateScale + calibration.stretchRateOffset)),
    },
  };
}
