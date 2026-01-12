/**
 * Momentum Sequence Analysis Engine
 * ==================================
 * Analyzes momentum-peak order of body segments during a swing
 * and compares against the ideal 4B Body→Bat kinetic chain.
 * 
 * IDEAL SEQUENCE (6 segments):
 * 1. Rear Leg (back leg)
 * 2. Lead Leg (front leg)  
 * 3. Torso (core/upper body rotation)
 * 4. Bottom Arm / Bottom Hand
 * 5. Top Arm
 * 6. Bat
 */

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type SegmentName = 
  | 'rear_leg'
  | 'lead_leg'
  | 'torso'
  | 'bottom_arm'
  | 'top_arm'
  | 'bat';

export const IDEAL_SEQUENCE: SegmentName[] = [
  'rear_leg',
  'lead_leg',
  'torso',
  'bottom_arm',
  'top_arm',
  'bat',
];

export const SEGMENT_DISPLAY_NAMES: Record<SegmentName, string> = {
  rear_leg: 'Rear Leg',
  lead_leg: 'Lead Leg',
  torso: 'Torso',
  bottom_arm: 'Bottom Arm',
  top_arm: 'Top Arm',
  bat: 'Bat',
};

export const SEGMENT_COLORS = {
  in_sequence: 'hsl(142 76% 55%)',    // Green
  out_of_sequence: 'hsl(0 84% 60%)',  // Red
  warning: 'hsl(45 93% 58%)',         // Amber
  inactive: 'hsl(var(--muted-foreground) / 0.3)',
  pending: 'hsl(var(--muted-foreground) / 0.5)',
};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

export interface SegmentMomentumData {
  segment: SegmentName;
  momentumCurve: number[];   // Velocity magnitude per frame
  frameTimes: number[];      // Time (ms) per frame
  peakFrameIndex: number;    // Index of peak momentum frame
  peakTimeMs: number;        // Time of peak in milliseconds
  peakValue: number;         // Peak momentum value
}

export interface SequenceError {
  segment: SegmentName;
  expectedPosition: number;
  actualPosition: number;
  description: string;
}

export interface SwingSequenceAnalysis {
  swingId: string;
  frameTimes: number[];
  segments: Record<SegmentName, SegmentMomentumData>;
  actualOrder: SegmentName[];
  idealOrder: SegmentName[];
  sequenceMatch: boolean;
  sequenceErrors: SequenceError[];
  sequenceScore: number;  // 0-100
  summary: string;
}

// ============================================================================
// POSE DATA TYPES (assumed inputs from 2D pose model)
// ============================================================================

export interface JointPosition {
  x: number;
  y: number;
  confidence?: number;
}

export interface FramePoseData {
  frameIndex: number;
  timeMs: number;
  joints: {
    // Hips/Pelvis
    left_hip: JointPosition;
    right_hip: JointPosition;
    pelvis?: JointPosition;
    
    // Legs
    left_knee: JointPosition;
    right_knee: JointPosition;
    left_ankle: JointPosition;
    right_ankle: JointPosition;
    
    // Torso
    left_shoulder: JointPosition;
    right_shoulder: JointPosition;
    spine?: JointPosition;
    
    // Arms
    left_elbow: JointPosition;
    right_elbow: JointPosition;
    left_wrist: JointPosition;
    right_wrist: JointPosition;
    
    // Bat (estimated from wrist positions or external tracker)
    bat_end?: JointPosition;
  };
}

export interface SwingPoseSequence {
  swingId: string;
  dominantHand: 'L' | 'R';
  frames: FramePoseData[];
  loadFrameIndex?: number;
  contactFrameIndex?: number;
  finishFrameIndex?: number;
}

// ============================================================================
// MOMENTUM COMPUTATION (from pose data)
// ============================================================================

/**
 * Calculate velocity magnitude between two positions
 */
function calculateVelocity(
  p1: JointPosition,
  p2: JointPosition,
  deltaTimeMs: number
): number {
  if (deltaTimeMs <= 0) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance / (deltaTimeMs / 1000); // pixels per second
}

/**
 * Calculate angular velocity around a pivot point
 */
function calculateAngularVelocity(
  p1: JointPosition,
  p2: JointPosition,
  pivot: JointPosition,
  deltaTimeMs: number
): number {
  if (deltaTimeMs <= 0) return 0;
  
  const angle1 = Math.atan2(p1.y - pivot.y, p1.x - pivot.x);
  const angle2 = Math.atan2(p2.y - pivot.y, p2.x - pivot.x);
  
  let deltaAngle = angle2 - angle1;
  // Normalize to [-PI, PI]
  while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
  while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
  
  return Math.abs(deltaAngle) / (deltaTimeMs / 1000) * (180 / Math.PI); // degrees per second
}

/**
 * Average position of multiple joints
 */
function averagePosition(...joints: JointPosition[]): JointPosition {
  const valid = joints.filter(j => j && !isNaN(j.x) && !isNaN(j.y));
  if (valid.length === 0) return { x: 0, y: 0 };
  return {
    x: valid.reduce((s, j) => s + j.x, 0) / valid.length,
    y: valid.reduce((s, j) => s + j.y, 0) / valid.length,
  };
}

/**
 * Compute momentum proxy for each segment from pose data
 */
export function computeSegmentMomentum(
  poseSequence: SwingPoseSequence
): Record<SegmentName, SegmentMomentumData> {
  const { frames, dominantHand } = poseSequence;
  const isRightHanded = dominantHand === 'R';
  
  // Initialize result
  const result: Record<SegmentName, SegmentMomentumData> = {} as any;
  
  const segmentCurves: Record<SegmentName, number[]> = {
    rear_leg: [],
    lead_leg: [],
    torso: [],
    bottom_arm: [],
    top_arm: [],
    bat: [],
  };
  
  const frameTimes = frames.map(f => f.timeMs);
  
  // Calculate velocities for each frame transition
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const curr = frames[i];
    const dt = curr.timeMs - prev.timeMs;
    
    // Rear leg (back leg) - use knee and ankle velocity
    const rearKnee = isRightHanded ? 'right_knee' : 'left_knee';
    const rearAnkle = isRightHanded ? 'right_ankle' : 'left_ankle';
    const rearLegVel = (
      calculateVelocity(prev.joints[rearKnee], curr.joints[rearKnee], dt) +
      calculateVelocity(prev.joints[rearAnkle], curr.joints[rearAnkle], dt)
    ) / 2;
    segmentCurves.rear_leg.push(rearLegVel);
    
    // Lead leg (front leg)
    const leadKnee = isRightHanded ? 'left_knee' : 'right_knee';
    const leadAnkle = isRightHanded ? 'left_ankle' : 'right_ankle';
    const leadLegVel = (
      calculateVelocity(prev.joints[leadKnee], curr.joints[leadKnee], dt) +
      calculateVelocity(prev.joints[leadAnkle], curr.joints[leadAnkle], dt)
    ) / 2;
    segmentCurves.lead_leg.push(leadLegVel);
    
    // Torso - use angular velocity of shoulders around pelvis
    const pelvisPrev = prev.joints.pelvis || averagePosition(prev.joints.left_hip, prev.joints.right_hip);
    const pelvisCurr = curr.joints.pelvis || averagePosition(curr.joints.left_hip, curr.joints.right_hip);
    const shoulderPrev = averagePosition(prev.joints.left_shoulder, prev.joints.right_shoulder);
    const shoulderCurr = averagePosition(curr.joints.left_shoulder, curr.joints.right_shoulder);
    const torsoAngVel = calculateAngularVelocity(shoulderPrev, shoulderCurr, pelvisPrev, dt);
    segmentCurves.torso.push(torsoAngVel);
    
    // Bottom arm (lead arm for RH batter)
    const bottomElbow = isRightHanded ? 'left_elbow' : 'right_elbow';
    const bottomWrist = isRightHanded ? 'left_wrist' : 'right_wrist';
    const bottomArmVel = (
      calculateVelocity(prev.joints[bottomElbow], curr.joints[bottomElbow], dt) +
      calculateVelocity(prev.joints[bottomWrist], curr.joints[bottomWrist], dt)
    ) / 2;
    segmentCurves.bottom_arm.push(bottomArmVel);
    
    // Top arm (rear arm for RH batter)
    const topElbow = isRightHanded ? 'right_elbow' : 'left_elbow';
    const topWrist = isRightHanded ? 'right_wrist' : 'left_wrist';
    const topArmVel = (
      calculateVelocity(prev.joints[topElbow], curr.joints[topElbow], dt) +
      calculateVelocity(prev.joints[topWrist], curr.joints[topWrist], dt)
    ) / 2;
    segmentCurves.top_arm.push(topArmVel);
    
    // Bat - use bat end position if available, else estimate from wrists
    if (prev.joints.bat_end && curr.joints.bat_end) {
      const batVel = calculateVelocity(prev.joints.bat_end, curr.joints.bat_end, dt);
      segmentCurves.bat.push(batVel);
    } else {
      // Estimate bat from wrist positions (average + offset)
      const avgWristPrev = averagePosition(prev.joints.left_wrist, prev.joints.right_wrist);
      const avgWristCurr = averagePosition(curr.joints.left_wrist, curr.joints.right_wrist);
      const batVel = calculateVelocity(avgWristPrev, avgWristCurr, dt) * 1.5; // Bat moves faster than hands
      segmentCurves.bat.push(batVel);
    }
  }
  
  // Smooth curves with simple moving average
  const smoothWindow = 3;
  for (const seg of Object.keys(segmentCurves) as SegmentName[]) {
    segmentCurves[seg] = smoothCurve(segmentCurves[seg], smoothWindow);
  }
  
  // Find peaks and build result
  for (const seg of Object.keys(segmentCurves) as SegmentName[]) {
    const curve = segmentCurves[seg];
    const peakIdx = findPeakIndex(curve);
    const peakValue = curve[peakIdx] || 0;
    const peakTimeMs = frameTimes[peakIdx + 1] || 0; // +1 because velocity is between frames
    
    result[seg] = {
      segment: seg,
      momentumCurve: curve,
      frameTimes: frameTimes.slice(1), // Velocities are between frames
      peakFrameIndex: peakIdx,
      peakTimeMs,
      peakValue,
    };
  }
  
  return result;
}

/**
 * Simple moving average smoothing
 */
function smoothCurve(curve: number[], window: number): number[] {
  if (curve.length < window) return curve;
  
  const result: number[] = [];
  const halfWindow = Math.floor(window / 2);
  
  for (let i = 0; i < curve.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(curve.length - 1, i + halfWindow); j++) {
      sum += curve[j];
      count++;
    }
    result.push(sum / count);
  }
  
  return result;
}

/**
 * Find index of peak value in curve
 */
function findPeakIndex(curve: number[]): number {
  if (curve.length === 0) return 0;
  return curve.reduce((maxIdx, v, i) => v > curve[maxIdx] ? i : maxIdx, 0);
}

// ============================================================================
// SEQUENCE ANALYSIS
// ============================================================================

/**
 * Analyze the momentum-peak sequence of a swing
 */
export function analyzeSequence(
  swingId: string,
  segmentData: Record<SegmentName, SegmentMomentumData>
): SwingSequenceAnalysis {
  // Get all frame times
  const allTimes = segmentData[IDEAL_SEQUENCE[0]]?.frameTimes || [];
  
  // Sort segments by peak time to get actual order
  const sortedSegments = [...IDEAL_SEQUENCE].sort((a, b) => {
    return segmentData[a].peakTimeMs - segmentData[b].peakTimeMs;
  });
  
  // Compare to ideal order
  const sequenceErrors: SequenceError[] = [];
  let sequenceMatch = true;
  
  for (let i = 0; i < IDEAL_SEQUENCE.length; i++) {
    const expectedSegment = IDEAL_SEQUENCE[i];
    const actualPosition = sortedSegments.indexOf(expectedSegment);
    
    if (actualPosition !== i) {
      sequenceMatch = false;
      sequenceErrors.push({
        segment: expectedSegment,
        expectedPosition: i + 1,
        actualPosition: actualPosition + 1,
        description: generateErrorDescription(expectedSegment, i, actualPosition),
      });
    }
  }
  
  // Calculate sequence score (0-100)
  const sequenceScore = calculateSequenceScore(sortedSegments, segmentData);
  
  // Generate summary
  const summary = generateSummary(sequenceMatch, sortedSegments, sequenceErrors);
  
  return {
    swingId,
    frameTimes: allTimes,
    segments: segmentData,
    actualOrder: sortedSegments,
    idealOrder: IDEAL_SEQUENCE,
    sequenceMatch,
    sequenceErrors,
    sequenceScore,
    summary,
  };
}

/**
 * Generate error description
 */
function generateErrorDescription(
  segment: SegmentName,
  expectedIdx: number,
  actualIdx: number
): string {
  const segName = SEGMENT_DISPLAY_NAMES[segment];
  
  if (actualIdx < expectedIdx) {
    return `${segName} fired early (position ${actualIdx + 1} instead of ${expectedIdx + 1})`;
  } else {
    return `${segName} fired late (position ${actualIdx + 1} instead of ${expectedIdx + 1})`;
  }
}

/**
 * Calculate sequence score based on order accuracy and timing tightness
 */
function calculateSequenceScore(
  actualOrder: SegmentName[],
  segmentData: Record<SegmentName, SegmentMomentumData>
): number {
  // Order accuracy: Kendall tau distance (inversions)
  let inversions = 0;
  for (let i = 0; i < actualOrder.length; i++) {
    for (let j = i + 1; j < actualOrder.length; j++) {
      const idealPosI = IDEAL_SEQUENCE.indexOf(actualOrder[i]);
      const idealPosJ = IDEAL_SEQUENCE.indexOf(actualOrder[j]);
      if (idealPosI > idealPosJ) inversions++;
    }
  }
  
  const maxInversions = (actualOrder.length * (actualOrder.length - 1)) / 2;
  const orderScore = maxInversions > 0 ? (1 - inversions / maxInversions) * 100 : 100;
  
  // Timing tightness: how evenly spaced are the peaks?
  const peakTimes = actualOrder.map(s => segmentData[s].peakTimeMs);
  const intervals: number[] = [];
  for (let i = 1; i < peakTimes.length; i++) {
    intervals.push(peakTimes[i] - peakTimes[i - 1]);
  }
  
  if (intervals.length === 0) return orderScore;
  
  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) / intervals.length;
  const cv = avgInterval > 0 ? Math.sqrt(variance) / avgInterval : 0;
  
  // Lower CV = better timing (more consistent spacing)
  const timingScore = Math.max(0, 100 - cv * 50);
  
  // Weighted average (order matters more)
  return Math.round(orderScore * 0.7 + timingScore * 0.3);
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  sequenceMatch: boolean,
  actualOrder: SegmentName[],
  errors: SequenceError[]
): string {
  if (sequenceMatch) {
    const orderStr = actualOrder.map(s => SEGMENT_DISPLAY_NAMES[s]).join(' → ');
    return `Body-to-Bat sequence: in sequence (${orderStr}).`;
  }
  
  // Find most significant errors
  const earlyErrors = errors.filter(e => e.actualPosition < e.expectedPosition);
  const lateErrors = errors.filter(e => e.actualPosition > e.expectedPosition);
  
  const errorParts: string[] = [];
  if (earlyErrors.length > 0) {
    const names = earlyErrors.map(e => SEGMENT_DISPLAY_NAMES[e.segment]).join(', ');
    errorParts.push(`${names} fired early`);
  }
  if (lateErrors.length > 0) {
    const names = lateErrors.map(e => SEGMENT_DISPLAY_NAMES[e.segment]).join(', ');
    errorParts.push(`${names} fired late`);
  }
  
  return `Body-to-Bat sequence: out of sequence. ${errorParts.join('. ')}.`;
}

// ============================================================================
// MOCK DATA FOR TESTING (when no pose data available)
// ============================================================================

/**
 * Generate synthetic momentum data for testing
 * Creates a sequence with optional sequence errors
 */
export function generateMockSequenceData(
  swingId: string,
  options?: {
    sequenceErrors?: Array<{ segment: SegmentName; offset: number }>;
    durationMs?: number;
    fps?: number;
  }
): SwingSequenceAnalysis {
  const durationMs = options?.durationMs || 500;
  const fps = options?.fps || 60;
  const frameCount = Math.round((durationMs / 1000) * fps);
  
  const frameTimes = Array.from({ length: frameCount }, (_, i) => (i / fps) * 1000);
  
  // Base peak times for ideal sequence (evenly spaced)
  const baseInterval = durationMs / (IDEAL_SEQUENCE.length + 1);
  const basePeakTimes: Record<SegmentName, number> = {
    rear_leg: baseInterval * 1,
    lead_leg: baseInterval * 2,
    torso: baseInterval * 3,
    bottom_arm: baseInterval * 4,
    top_arm: baseInterval * 5,
    bat: baseInterval * 6,
  };
  
  // Apply offsets for sequence errors
  if (options?.sequenceErrors) {
    for (const error of options.sequenceErrors) {
      basePeakTimes[error.segment] += error.offset;
    }
  }
  
  // Generate momentum curves
  const segments: Record<SegmentName, SegmentMomentumData> = {} as any;
  
  for (const seg of IDEAL_SEQUENCE) {
    const peakTime = basePeakTimes[seg];
    const curve = generateGaussianCurve(frameTimes, peakTime, durationMs / 10, 100);
    const peakIdx = findPeakIndex(curve);
    
    segments[seg] = {
      segment: seg,
      momentumCurve: curve,
      frameTimes,
      peakFrameIndex: peakIdx,
      peakTimeMs: peakTime,
      peakValue: curve[peakIdx],
    };
  }
  
  return analyzeSequence(swingId, segments);
}

/**
 * Generate a Gaussian curve for mock data
 */
function generateGaussianCurve(
  times: number[],
  peakTime: number,
  sigma: number,
  amplitude: number
): number[] {
  return times.map(t => {
    const x = (t - peakTime) / sigma;
    return amplitude * Math.exp(-0.5 * x * x);
  });
}

// ============================================================================
// REALTIME PLAYBACK STATE
// ============================================================================

export interface SequencePlaybackState {
  currentTimeMs: number;
  segmentStates: Record<SegmentName, 'pending' | 'active' | 'peaked' | 'inactive'>;
  peakedSegments: SegmentName[];
  nextSegmentToPeak: SegmentName | null;
}

/**
 * Get playback state for a given time during video playback
 */
export function getPlaybackState(
  analysis: SwingSequenceAnalysis,
  currentTimeMs: number
): SequencePlaybackState {
  const segmentStates: Record<SegmentName, 'pending' | 'active' | 'peaked' | 'inactive'> = {} as any;
  const peakedSegments: SegmentName[] = [];
  let nextSegmentToPeak: SegmentName | null = null;
  
  for (const seg of IDEAL_SEQUENCE) {
    const data = analysis.segments[seg];
    const peakTime = data.peakTimeMs;
    
    // Determine state based on current time relative to peak
    const timeToPeak = peakTime - currentTimeMs;
    const activationWindow = 50; // ms before/after peak where segment is "active"
    
    if (currentTimeMs >= peakTime + activationWindow) {
      segmentStates[seg] = 'peaked';
      peakedSegments.push(seg);
    } else if (Math.abs(timeToPeak) <= activationWindow) {
      segmentStates[seg] = 'active';
    } else if (timeToPeak > activationWindow) {
      segmentStates[seg] = 'pending';
      if (!nextSegmentToPeak) {
        nextSegmentToPeak = seg;
      }
    } else {
      segmentStates[seg] = 'inactive';
    }
  }
  
  // Find next segment to peak (in actual order)
  for (const seg of analysis.actualOrder) {
    if (!peakedSegments.includes(seg) && segmentStates[seg] !== 'active') {
      nextSegmentToPeak = seg;
      break;
    }
  }
  
  return {
    currentTimeMs,
    segmentStates,
    peakedSegments,
    nextSegmentToPeak,
  };
}
