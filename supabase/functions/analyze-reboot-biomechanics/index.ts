import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * analyze-reboot-biomechanics
 * 
 * Processes Reboot Motion CSV data to generate momentum-based plane analysis
 * and player-friendly swing reports.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisRequest {
  player_id: string;
  session_id: string;
  upload_id?: string;
  inverse_kinematics_url: string;
  momentum_energy_url: string;
}

interface MomentumRow {
  time_from_max_hand: number;
  lowertorso_angular_momentum_x: number;
  lowertorso_angular_momentum_y: number;
  lowertorso_angular_momentum_z: number;
  torso_angular_momentum_x: number;
  torso_angular_momentum_y: number;
  torso_angular_momentum_z: number;
  arms_angular_momentum_x: number;
  arms_angular_momentum_y: number;
  arms_angular_momentum_z: number;
  bat_angular_momentum_z: number;
  bat_kinetic_energy: number;
  total_kinetic_energy: number;
}

interface KinematicsRow {
  pelvis_rot: number;
  torso_rot: number;
  torso_ext: number;
  torso_side: number;
}

interface AnalysisMetrics {
  pelvisPeakMomentum: number;
  torsoPeakMomentum: number;
  armsPeakMomentum: number;
  batPeakMomentum: number;
  transferRatio: number;
  timingGapPercent: number;
  pelvisPlaneTilt: number;
  torsoPlaneTilt: number;
  armsPlaneTilt: number;
  planeAlignmentPelvisToTorso: number;
  planeAlignmentTorsoToArms: number;
  xFactor: number;
  pelvisRom: number;
  torsoRom: number;
  trunkPitchSd: number;
  trunkLatSd: number;
  trunkRotCv: number;
  trunkLatMean: number;
  trunkSsi: number;
  dumpDirection: string;
  ssiBandwidth: number;
  interSagIqr: number;
  interFrontIqr: number;
}

interface PerSwingStability {
  sagSd: number;
  frontSd: number;
  rotCv: number;
  latMean: number;
  ssi: number;
}

interface Flag {
  type: string;
  severity: "priority" | "warning" | "info";
  message: string;
  drillTags: string[];
}

// Parse CSV string into array of objects
function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",").map(h => h.trim());
  const rows: T[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, number> = {};
    
    headers.forEach((header, j) => {
      const value = parseFloat(values[j]?.trim() || "0");
      row[header] = isNaN(value) ? 0 : value;
    });
    
    rows.push(row as T);
  }
  
  return rows;
}

// Find index of peak absolute value
function findPeakIndex(data: number[]): number {
  let maxIndex = 0;
  let maxValue = 0;
  
  data.forEach((val, i) => {
    const absVal = Math.abs(val);
    if (absVal > maxValue) {
      maxValue = absVal;
      maxIndex = i;
    }
  });
  
  return maxIndex;
}

// Calculate transfer ratio
function calculateTransferRatio(pelvisMomentum: number[], torsoMomentum: number[]): number {
  const pelvisPeak = Math.max(...pelvisMomentum.map(Math.abs));
  const torsoPeak = Math.max(...torsoMomentum.map(Math.abs));
  
  if (pelvisPeak === 0) return 0;
  return torsoPeak / pelvisPeak;
}

// Calculate timing gap percentage
function calculateTimingGap(
  pelvisMomentum: number[],
  torsoMomentum: number[],
  timeFromMaxHand: number[]
): number {
  const pelvisPeakIndex = findPeakIndex(pelvisMomentum);
  const torsoPeakIndex = findPeakIndex(torsoMomentum);
  
  // Contact frame is where time_from_max_hand ≈ 0
  let contactIndex = timeFromMaxHand.findIndex(t => Math.abs(t) < 0.01);
  if (contactIndex === -1) contactIndex = timeFromMaxHand.length - 1;
  
  if (contactIndex === 0) return 0;
  
  const timingGapPercent = ((torsoPeakIndex - pelvisPeakIndex) / contactIndex) * 100;
  return timingGapPercent;
}

// Calculate plane tilt at peak momentum
function calculatePlaneTilt(
  momentumX: number[],
  momentumY: number[],
  momentumZ: number[],
  peakIndex: number
): number {
  const x = momentumX[peakIndex] || 0;
  const y = momentumY[peakIndex] || 0;
  const z = momentumZ[peakIndex] || 0;
  
  const horizontal = Math.sqrt(x * x + y * y);
  const vertical = z;
  
  if (horizontal === 0 && vertical === 0) return 0;
  
  const tiltDegrees = Math.atan2(vertical, horizontal) * (180 / Math.PI);
  return tiltDegrees;
}

// Calculate X-Factor (hip-shoulder separation)
function calculateXFactor(pelvisRot: number[], torsoRot: number[]): number {
  if (pelvisRot.length === 0 || torsoRot.length === 0) return 0;
  
  const separations = pelvisRot.map((p, i) => {
    const t = torsoRot[i] || 0;
    return Math.abs(t - p) * (180 / Math.PI);
  });
  
  return Math.max(...separations);
}

// Standard deviation helper
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// Median helper (robust to outliers)
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// IQR helper
function iqr(arr: number[]): number {
  if (arr.length < 4) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return q3 - q1;
}

// Unwrap angles to prevent false spikes at ±180° boundaries
function unwrapAngles(angles: number[]): number[] {
  if (angles.length === 0) return [];
  const unwrapped = [angles[0]];
  for (let i = 1; i < angles.length; i++) {
    let diff = angles[i] - angles[i - 1];
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    unwrapped.push(unwrapped[i - 1] + diff);
  }
  return unwrapped;
}

// Compute angular velocity from unwrapped rotation signal (deg/s)
function angularVelocity(rot: number[], frameRate: number = 240): number[] {
  const dt = 1 / frameRate;
  const unwrapped = unwrapAngles(rot);
  const vels: number[] = [];
  for (let i = 1; i < unwrapped.length; i++) {
    vels.push((unwrapped[i] - unwrapped[i - 1]) / dt);
  }
  return vels;
}

// Filtered CV: only use velocities > 20% of peak to prevent near-zero mean blowup
function filteredCoeffOfVariation(vels: number[]): number {
  if (vels.length < 2) return 0;
  const absVels = vels.map(Math.abs);
  const peak = Math.max(...absVels);
  if (peak < 1e-9) return 0;
  const threshold = peak * 0.2;
  const filtered = vels.filter((_, i) => absVels[i] > threshold);
  if (filtered.length < 2) return 0;
  const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  if (Math.abs(mean) < 1e-9) return 0;
  return stdDev(filtered) / Math.abs(mean);
}

// Normalize "good" score: 100 = rock solid (raw=0), 0 = worst (raw≥maxBad)
function normalizeGood(raw: number, maxBad: number): number {
  return (1 - Math.min(raw, maxBad) / maxBad) * 100;
}

// V1 calibration bounds
const SAG_SD_MAX = 8.0;   // degrees
const FRONTAL_SD_MAX = 6.0; // degrees
const TRANS_CV_MAX = 1.5;   // dimensionless


function calculateROM(rotationData: number[]): number {
  if (rotationData.length === 0) return 0;
  
  const minRot = Math.min(...rotationData);
  const maxRot = Math.max(...rotationData);
  return (maxRot - minRot) * (180 / Math.PI);
}

// Run full analysis on CSV data
function analyzeSwingData(
  momentumData: MomentumRow[],
  kinematicsData: KinematicsRow[]
): AnalysisMetrics {
  // Extract momentum arrays
  const pelvisMomentumZ = momentumData.map(r => r.lowertorso_angular_momentum_z);
  const torsoMomentumZ = momentumData.map(r => r.torso_angular_momentum_z);
  const armsMomentumZ = momentumData.map(r => r.arms_angular_momentum_z);
  const batMomentumZ = momentumData.map(r => r.bat_angular_momentum_z);
  const timeFromMaxHand = momentumData.map(r => r.time_from_max_hand);
  
  // Plane analysis components
  const pelvisMomentumX = momentumData.map(r => r.lowertorso_angular_momentum_x);
  const pelvisMomentumY = momentumData.map(r => r.lowertorso_angular_momentum_y);
  const torsoMomentumX = momentumData.map(r => r.torso_angular_momentum_x);
  const torsoMomentumY = momentumData.map(r => r.torso_angular_momentum_y);
  const armsMomentumX = momentumData.map(r => r.arms_angular_momentum_x);
  const armsMomentumY = momentumData.map(r => r.arms_angular_momentum_y);
  
  // Rotation data — Reboot values are in RADIANS, convert to degrees
  const RAD2DEG = 180 / Math.PI;
  const pelvisRot = kinematicsData.map(r => r.pelvis_rot * RAD2DEG);
  const torsoRot = kinematicsData.map(r => r.torso_rot * RAD2DEG);
  const torsoExt = kinematicsData.map(r => r.torso_ext * RAD2DEG);
  const torsoSide = kinematicsData.map(r => r.torso_side * RAD2DEG);
  
  // Calculate peak indices
  const pelvisPeakIndex = findPeakIndex(pelvisMomentumZ);
  const torsoPeakIndex = findPeakIndex(torsoMomentumZ);
  const armsPeakIndex = findPeakIndex(armsMomentumZ);
  
  // Calculate metrics
  const transferRatio = calculateTransferRatio(pelvisMomentumZ, torsoMomentumZ);
  const timingGapPercent = calculateTimingGap(pelvisMomentumZ, torsoMomentumZ, timeFromMaxHand);
  
  // Plane tilts
  const pelvisPlaneTilt = calculatePlaneTilt(pelvisMomentumX, pelvisMomentumY, pelvisMomentumZ, pelvisPeakIndex);
  const torsoPlaneTilt = calculatePlaneTilt(torsoMomentumX, torsoMomentumY, torsoMomentumZ, torsoPeakIndex);
  const armsPlaneTilt = calculatePlaneTilt(armsMomentumX, armsMomentumY, armsMomentumZ, armsPeakIndex);
  
  // Plane alignment
  const planeAlignmentPelvisToTorso = Math.abs(pelvisPlaneTilt - torsoPlaneTilt);
  const planeAlignmentTorsoToArms = Math.abs(torsoPlaneTilt - armsPlaneTilt);
  
  // X-Factor and ROM (already in degrees after conversion above)
  const xFactor = calculateXFactor(pelvisRot.map(r => r * Math.PI / 180), torsoRot.map(r => r * Math.PI / 180));
  const pelvisRom = calculateROM(pelvisRot.map(r => r * Math.PI / 180));
  const torsoRom = calculateROM(torsoRot.map(r => r * Math.PI / 180));

  // ===================================================================
  // TRUNK STABILITY v3 — Per-swing detection + session rollup
  // ===================================================================

  // Detect frame rate from time_from_max_hand (Fix 2: explicit dt)
  const dtEstimates: number[] = [];
  for (let i = 1; i < timeFromMaxHand.length; i++) {
    const d = Math.abs(timeFromMaxHand[i] - timeFromMaxHand[i - 1]);
    if (d > 0) dtEstimates.push(d);
  }
  const detectedDt = dtEstimates.length > 0 ? median(dtEstimates) : 1 / 240;
  const frameRate = Math.round(1 / detectedDt) || 240;

  // Fix 5: Detect individual swings via pelvis rotational velocity peaks >150 deg/s
  // pelvisRot is already in degrees; angularVelocity unwraps + uses dt = 1/frameRate
  const pelvisRotVel = angularVelocity(pelvisRot, frameRate);
  const SWING_PEAK_THRESHOLD = 150; // deg/s
  const PRE_PEAK_FRAMES = 36;
  const POST_PEAK_FRAMES = 24;
  const SWING_WINDOW = PRE_PEAK_FRAMES + POST_PEAK_FRAMES;
  const MIN_PEAK_SEPARATION = SWING_WINDOW; // prevent overlapping windows

  // Find pelvis rotational velocity peaks
  const swingPeakIndices: number[] = [];
  for (let i = 1; i < pelvisRotVel.length - 1; i++) {
    const v = Math.abs(pelvisRotVel[i]);
    if (v > SWING_PEAK_THRESHOLD &&
        v >= Math.abs(pelvisRotVel[i - 1]) &&
        v >= Math.abs(pelvisRotVel[i + 1])) {
      // Check minimum separation from last detected peak
      if (swingPeakIndices.length === 0 || i - swingPeakIndices[swingPeakIndices.length - 1] >= MIN_PEAK_SEPARATION) {
        swingPeakIndices.push(i);
      }
    }
  }

  // Compute per-swing stability metrics
  const perSwingResults: PerSwingStability[] = [];
  for (const peakIdx of swingPeakIndices) {
    const wStart = Math.max(0, peakIdx - PRE_PEAK_FRAMES);
    const wEnd = Math.min(torsoExt.length, peakIdx + POST_PEAK_FRAMES);
    if (wEnd - wStart < 10) continue;

    const winExt = torsoExt.slice(wStart, wEnd);
    const winSide = torsoSide.slice(wStart, wEnd);
    const winRot = torsoRot.slice(wStart, wEnd);

    const sagSd = winExt.length >= 2 ? stdDev(winExt) : 0;
    const frontSd = winSide.length >= 2 ? stdDev(winSide) : 0;
    const rotVels = angularVelocity(winRot, frameRate);
    const rotCv = filteredCoeffOfVariation(rotVels);
    const latMean = winSide.length > 0 ? winSide.reduce((a, b) => a + b, 0) / winSide.length : 0;

    // Per-swing SSI (Fix 1: normalizeGood, no double inversion)
    const sagScore = normalizeGood(sagSd, SAG_SD_MAX);
    const frontScore = normalizeGood(frontSd, FRONTAL_SD_MAX);
    const transScore = normalizeGood(rotCv, TRANS_CV_MAX);
    const ssi = 0.25 * sagScore + 0.40 * frontScore + 0.35 * transScore;

    perSwingResults.push({ sagSd, frontSd, rotCv, latMean, ssi });
  }

  // Session rollup: use MEDIAN of per-swing values (robust to outliers)
  let trunkPitchSd: number, trunkLatSd: number, trunkRotCv: number, trunkLatMean: number, trunkSsi: number;
  let ssiBandwidth = 0, interSagIqr = 0, interFrontIqr = 0;

  if (perSwingResults.length >= 2) {
    trunkPitchSd = median(perSwingResults.map(r => r.sagSd));
    trunkLatSd = median(perSwingResults.map(r => r.frontSd));
    trunkRotCv = median(perSwingResults.map(r => r.rotCv));
    trunkLatMean = median(perSwingResults.map(r => r.latMean));
    trunkSsi = median(perSwingResults.map(r => r.ssi));

    // Inter-swing repeatability (IQR)
    ssiBandwidth = iqr(perSwingResults.map(r => r.ssi));
    interSagIqr = iqr(perSwingResults.map(r => r.sagSd));
    interFrontIqr = iqr(perSwingResults.map(r => r.frontSd));
  } else {
    // Fallback: single-window approach (stride-to-contact)
    let contactIndex = timeFromMaxHand.findIndex(t => Math.abs(t) < 0.01);
    if (contactIndex === -1) contactIndex = timeFromMaxHand.length - 1;
    const winStart = Math.min(pelvisPeakIndex, contactIndex);
    const winEnd = Math.max(pelvisPeakIndex, contactIndex) + 1;

    const winExt = torsoExt.slice(winStart, winEnd);
    const winSide = torsoSide.slice(winStart, winEnd);
    const winRot = torsoRot.slice(winStart, winEnd);

    trunkPitchSd = winExt.length >= 2 ? stdDev(winExt) : 0;
    trunkLatSd = winSide.length >= 2 ? stdDev(winSide) : 0;
    const rotVels = angularVelocity(winRot, frameRate);
    trunkRotCv = filteredCoeffOfVariation(rotVels);
    trunkLatMean = winSide.length > 0 ? winSide.reduce((a, b) => a + b, 0) / winSide.length : 0;

    const sagScore = normalizeGood(trunkPitchSd, SAG_SD_MAX);
    const frontScore = normalizeGood(trunkLatSd, FRONTAL_SD_MAX);
    const transScore = normalizeGood(trunkRotCv, TRANS_CV_MAX);
    trunkSsi = 0.25 * sagScore + 0.40 * frontScore + 0.35 * transScore;
  }

  // Fix 6: Dump direction from session-level lat mean
  let dumpDirection = "neutral";
  if (Math.abs(trunkLatMean) >= 1.0) {
    dumpDirection = trunkLatMean > 0 ? "glove_side" : "pull_side";
  }

  return {
    pelvisPeakMomentum: Math.max(...pelvisMomentumZ.map(Math.abs)),
    torsoPeakMomentum: Math.max(...torsoMomentumZ.map(Math.abs)),
    armsPeakMomentum: Math.max(...armsMomentumZ.map(Math.abs)),
    batPeakMomentum: Math.max(...batMomentumZ.map(Math.abs)),
    transferRatio,
    timingGapPercent,
    pelvisPlaneTilt,
    torsoPlaneTilt,
    armsPlaneTilt,
    planeAlignmentPelvisToTorso,
    planeAlignmentTorsoToArms,
    xFactor,
    pelvisRom,
    torsoRom,
    trunkPitchSd: Math.round(trunkPitchSd * 1000) / 1000,
    trunkLatSd: Math.round(trunkLatSd * 1000) / 1000,
    trunkRotCv: Math.round(trunkRotCv * 1000) / 1000,
    trunkLatMean: Math.round(trunkLatMean * 1000) / 1000,
    trunkSsi: Math.round(trunkSsi * 100) / 100,
    dumpDirection,
    ssiBandwidth: Math.round(ssiBandwidth * 100) / 100,
    interSagIqr: Math.round(interSagIqr * 1000) / 1000,
    interFrontIqr: Math.round(interFrontIqr * 1000) / 1000,
  };
}

// Generate flags based on metrics
function generateFlags(metrics: AnalysisMetrics): Flag[] {
  const flags: Flag[] = [];
  
  // Transfer ratio issues
  if (metrics.transferRatio > 2.5) {
    flags.push({
      type: "ARM_SWINGING",
      severity: "priority",
      message: "Arms doing all the work - no ground-up power",
      drillTags: ["#BoxStepDown", "#Load"],
    });
  } else if (metrics.transferRatio < 1.1) {
    flags.push({
      type: "LOW_TRANSFER",
      severity: "priority",
      message: "Energy not transferring efficiently through the chain",
      drillTags: ["#Connection", "#ViolentBrake"],
    });
  }
  
  // Timing gap issues
  if (metrics.timingGapPercent < 5) {
    flags.push({
      type: "SIMULTANEOUS_FIRING",
      severity: "priority",
      message: "Hips and torso firing together - no separation",
      drillTags: ["#StepAndTurn", "#Tempo"],
    });
  } else if (metrics.timingGapPercent > 22) {
    flags.push({
      type: "OVER_SEPARATED",
      severity: "warning",
      message: "Too much separation - energy disconnecting",
      drillTags: ["#Connection", "#Sync"],
    });
  }
  
  // Plane alignment issues
  if (metrics.planeAlignmentPelvisToTorso > 20 || metrics.planeAlignmentTorsoToArms > 20) {
    flags.push({
      type: "PLANE_LEAK",
      severity: "warning",
      message: "Body segments rotating on different planes",
      drillTags: ["#PlaneWork", "#Direction"],
    });
  }
  
  // X-Factor issues
  if (metrics.xFactor < 35) {
    flags.push({
      type: "LIMITED_ROM",
      severity: "warning",
      message: "Limited hip-shoulder separation",
      drillTags: ["#Mobility", "#Load"],
    });
  } else if (metrics.xFactor > 65) {
    flags.push({
      type: "OVER_ROTATION",
      severity: "warning",
      message: "Over-rotating during load",
      drillTags: ["#Stability", "#Control"],
    });
  }
  
  // Sort by severity (priority first)
  flags.sort((a, b) => {
    const order = { priority: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
  
  return flags;
}

// Calculate body score
function calculateBodyScore(metrics: AnalysisMetrics, flags: Flag[]): number {
  let score = 100;
  
  // Transfer Ratio (25 points)
  if (metrics.transferRatio >= 1.5 && metrics.transferRatio <= 1.8) {
    score -= 0; // Elite
  } else if (metrics.transferRatio >= 1.3 && metrics.transferRatio < 1.5) {
    score -= 5; // Good
  } else if (metrics.transferRatio >= 1.1 && metrics.transferRatio < 1.3) {
    score -= 15; // Developing
  } else {
    score -= 25; // Poor or over-whipped
  }
  
  // Timing Gap (25 points)
  if (metrics.timingGapPercent >= 14 && metrics.timingGapPercent <= 18) {
    score -= 0; // Elite
  } else if (metrics.timingGapPercent >= 10 && metrics.timingGapPercent < 14) {
    score -= 5; // Good
  } else if (metrics.timingGapPercent < 5) {
    score -= 25; // Simultaneous
  } else {
    score -= 15; // Other
  }
  
  // Plane Alignment (25 points)
  const avgAlignment = (metrics.planeAlignmentPelvisToTorso + metrics.planeAlignmentTorsoToArms) / 2;
  if (avgAlignment < 10) {
    score -= 0; // Elite
  } else if (avgAlignment < 15) {
    score -= 5; // Good
  } else if (avgAlignment < 25) {
    score -= 15; // Leaking
  } else {
    score -= 25; // Misaligned
  }
  
  // X-Factor (25 points)
  if (metrics.xFactor >= 45 && metrics.xFactor <= 55) {
    score -= 0; // Elite
  } else if (metrics.xFactor >= 40 && metrics.xFactor < 45) {
    score -= 5; // Good
  } else if (metrics.xFactor < 35) {
    score -= 20; // Limited
  } else {
    score -= 10; // Other
  }
  
  return Math.max(0, score);
}

// Translation dictionary for player-friendly reports
const flagTranslations: Record<string, {
  finding: string;
  explanation: string;
  analogy: string;
  fix: string;
  drill: string;
  drillExplain: string;
  cue: string;
}> = {
  ARM_SWINGING: {
    finding: "Your arms are doing all the work right now.",
    explanation: "Your legs and hips should start the swing. They're like the engine. But your engine isn't turning on.",
    analogy: "Think of it like throwing a ball. You wouldn't throw with just your arm, right? You'd step and turn your whole body.",
    fix: "Load into your back hip. Before you swing, sit into your back leg. Feel your weight drop into your back pocket. That's the load.",
    drill: "Box Step-Down",
    drillExplain: "Stand on a small box. Step DOWN with your back foot first. Feel your weight sink into that back hip. Hold it. Feel it. NOW turn and swing.",
    cue: "Drop into your back pocket. Feel it. Now turn.",
  },
  SIMULTANEOUS_FIRING: {
    finding: "Your hips and body are moving at the same time.",
    explanation: "Your hips need to go FIRST, then your body follows. Right now they're tied together.",
    analogy: "It's like cracking a whip. The handle moves first, then the energy travels down and the tip snaps. Your hips are the handle.",
    fix: "Feel the separation. Hips turn, body stays back for a split second, THEN body turns.",
    drill: "Step and Turn SOP",
    drillExplain: "Take your stance. Step toward the pitcher. Feel your hips start to open while your hands stay back. THEN let it go.",
    cue: "Step, wait, turn.",
  },
  LOW_TRANSFER: {
    finding: "You're creating power but it's not getting to the bat.",
    explanation: "Your body is working but the energy is getting stuck somewhere.",
    analogy: "It's like a garden hose with a kink in it. Water is flowing but not getting through.",
    fix: "Let your front side stop so the energy transfers.",
    drill: "Violent Brake",
    drillExplain: "Swing and STOP your front hip hard at contact. Feel the energy whip through to your hands.",
    cue: "Slam the brakes. Let it whip.",
  },
  PLANE_LEAK: {
    finding: "Your body parts aren't working together.",
    explanation: "Your hips are rotating one way, your body another way. The energy is leaking out instead of going to the bat.",
    analogy: "Imagine pushing a shopping cart but the wheels are pointed different directions. Hard to go straight, right?",
    fix: "Get everything rotating the same direction.",
    drill: "Connection Drill",
    drillExplain: "Put a towel under your front armpit. Swing without dropping the towel. This keeps your body connected.",
    cue: "Stay connected. Everything moves together.",
  },
  LIMITED_ROM: {
    finding: "You're not loading up enough before you swing.",
    explanation: "The best hitters coil up like a spring before they swing. You're skipping that step.",
    analogy: "It's like a slingshot. You have to pull it back before you let it go. More pullback = more power.",
    fix: "Turn your back to the pitcher more during your load.",
    drill: "Coil Drill",
    drillExplain: "In your stance, turn your back shoulder toward the pitcher. Feel the stretch in your core. THAT'S the load.",
    cue: "Show your back to the pitcher.",
  },
  OVER_SEPARATED: {
    finding: "Your hips are getting too far ahead of your hands.",
    explanation: "Separation is good, but too much separation means you lose the connection.",
    analogy: "It's like a rubber band - stretch it too far and it snaps. You want tension, not disconnect.",
    fix: "Keep your hands loaded while your hips turn. Don't let them lag behind.",
    drill: "Rhythm Drill",
    drillExplain: "Swing at 75% speed. Focus on everything arriving together. Smooth, connected, powerful.",
    cue: "Together. Smooth. Now go.",
  },
  OVER_ROTATION: {
    finding: "You're turning too much in your load.",
    explanation: "Some coil is good, but too much makes it hard to get back to the ball in time.",
    analogy: "It's like winding up a toy too tight - it can jam up instead of spinning smooth.",
    fix: "Feel your back hip, not your whole back. Small coil, big turn.",
    drill: "Mirror Check",
    drillExplain: "Load in front of a mirror. Your belly button should point toward the catcher, not all the way back.",
    cue: "Small coil. Big explosion.",
  },
};

// Generate player-friendly report
function generatePlayerReport(
  playerName: string,
  metrics: AnalysisMetrics,
  flags: Flag[],
  bodyScore: number
): string {
  const topFlag = flags[0];
  const translation = flagTranslations[topFlag?.type] || flagTranslations.LOW_TRANSFER;
  
  const firstName = playerName.split(" ")[0].toUpperCase();
  
  return `${firstName}'S SWING REPORT ⚾

---

WHAT I FOUND

${translation.finding}

${translation.explanation}

---

THE GOOD NEWS

This is super fixable. Once you get this, everything else gets easier.

---

WHAT'S HAPPENING

${translation.analogy}

---

YOUR ONE THING TO FIX

${translation.fix}

---

YOUR DRILL

*${translation.drill}*

${translation.drillExplain}

The cue: "${translation.cue}"

Do 10 reps before every practice. Slow. Feel it every time.

---

WHAT HAPPENS WHEN YOU FIX THIS

✅ More power (from the ground, not just arms)
✅ Better balance
✅ More consistent contact

---

NEXT STEPS

1. Do the drill 10 times before practice
2. Send me a video after a week
3. We'll check if it's clicking

You got this! 💪

- Coach Rick`.trim();
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: AnalysisRequest = await req.json();
    const { player_id, session_id, upload_id, inverse_kinematics_url, momentum_energy_url } = body;

    if (!player_id || !session_id) {
      throw new Error("Missing required fields: player_id and session_id");
    }

    if (!inverse_kinematics_url || !momentum_energy_url) {
      throw new Error("Missing CSV URLs: inverse_kinematics_url and momentum_energy_url required");
    }

    console.log(`[Analysis] Starting analysis for session ${session_id}, player ${player_id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, phone, email")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${player_id}`);
    }

    console.log(`[Analysis] Downloading CSV files for ${player.name}`);

    // Download CSV files
    const [momentumResponse, kinematicsResponse] = await Promise.all([
      fetch(momentum_energy_url),
      fetch(inverse_kinematics_url),
    ]);

    if (!momentumResponse.ok) {
      throw new Error(`Failed to download momentum CSV: ${momentumResponse.status}`);
    }
    if (!kinematicsResponse.ok) {
      throw new Error(`Failed to download kinematics CSV: ${kinematicsResponse.status}`);
    }

    const [momentumCsv, kinematicsCsv] = await Promise.all([
      momentumResponse.text(),
      kinematicsResponse.text(),
    ]);

    console.log(`[Analysis] Parsing CSV data...`);

    // Parse CSVs
    const momentumData = parseCSV<MomentumRow>(momentumCsv);
    const kinematicsData = parseCSV<KinematicsRow>(kinematicsCsv);

    if (momentumData.length === 0) {
      throw new Error("No data found in momentum CSV");
    }

    console.log(`[Analysis] Analyzing ${momentumData.length} frames of momentum data`);

    // Run analysis
    const metrics = analyzeSwingData(momentumData, kinematicsData);
    const flags = generateFlags(metrics);
    const bodyScore = calculateBodyScore(metrics, flags);
    const playerReport = generatePlayerReport(player.name || "Player", metrics, flags, bodyScore);

    console.log(`[Analysis v3] Results: TR=${metrics.transferRatio.toFixed(2)}, ` +
      `Gap=${metrics.timingGapPercent.toFixed(1)}%, XF=${metrics.xFactor.toFixed(1)}°, ` +
      `Body=${bodyScore}, SSI=${metrics.trunkSsi}(bw=${metrics.ssiBandwidth}), ` +
      `Dump=${metrics.dumpDirection}, SagSD=${metrics.trunkPitchSd}, ` +
      `FrontSD=${metrics.trunkLatSd}, RotCV=${metrics.trunkRotCv}, LatMean=${metrics.trunkLatMean}`);

    // Store results
    const { data: analysisResult, error: insertError } = await supabase
      .from("swing_analysis_results")
      .upsert({
        player_id,
        session_id,
        upload_id,
        pelvis_peak_momentum: metrics.pelvisPeakMomentum,
        torso_peak_momentum: metrics.torsoPeakMomentum,
        arms_peak_momentum: metrics.armsPeakMomentum,
        bat_peak_momentum: metrics.batPeakMomentum,
        transfer_ratio: metrics.transferRatio,
        timing_gap_percent: metrics.timingGapPercent,
        pelvis_plane_tilt: metrics.pelvisPlaneTilt,
        torso_plane_tilt: metrics.torsoPlaneTilt,
        arms_plane_tilt: metrics.armsPlaneTilt,
        plane_alignment_pelvis_torso: metrics.planeAlignmentPelvisToTorso,
        plane_alignment_torso_arms: metrics.planeAlignmentTorsoToArms,
        x_factor: metrics.xFactor,
        pelvis_rom: metrics.pelvisRom,
        torso_rom: metrics.torsoRom,
        body_score: bodyScore,
        flags: flags,
        top_priority_flag: flags[0]?.type || null,
        recommended_drill: flagTranslations[flags[0]?.type]?.drill || null,
        recommended_drill_cue: flagTranslations[flags[0]?.type]?.cue || null,
        player_report: playerReport,
        momentum_csv_url: momentum_energy_url,
        kinematics_csv_url: inverse_kinematics_url,
        trunk_pitch_sd: metrics.trunkPitchSd,
        trunk_lat_sd: metrics.trunkLatSd,
        trunk_rot_cv: metrics.trunkRotCv,
        trunk_lat_mean: metrics.trunkLatMean,
        trunk_ssi: metrics.trunkSsi,
        dump_direction: metrics.dumpDirection,
        ssi_bandwidth: metrics.ssiBandwidth,
        inter_sag_iqr: metrics.interSagIqr,
        inter_front_iqr: metrics.interFrontIqr,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "session_id",
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[Analysis] Failed to store results: ${insertError.message}`);
      throw new Error(`Failed to store analysis results: ${insertError.message}`);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "biomechanics_analysis_complete",
      description: `Biomechanics analysis completed: Body Score ${bodyScore}`,
      player_id,
      metadata: {
        session_id,
        body_score: bodyScore,
        transfer_ratio: metrics.transferRatio,
        timing_gap: metrics.timingGapPercent,
        x_factor: metrics.xFactor,
        top_flag: flags[0]?.type,
      },
    });

    console.log(`[Analysis] Analysis complete and stored for session ${session_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id: analysisResult?.id,
        body_score: bodyScore,
        metrics: {
          transfer_ratio: metrics.transferRatio,
          timing_gap_percent: metrics.timingGapPercent,
          x_factor: metrics.xFactor,
          plane_alignment: (metrics.planeAlignmentPelvisToTorso + metrics.planeAlignmentTorsoToArms) / 2,
        },
        flags: flags.map(f => ({ type: f.type, severity: f.severity })),
        top_priority: flags[0]?.type || null,
        recommended_drill: flagTranslations[flags[0]?.type]?.drill || null,
        report: playerReport,
        player_phone: player.phone,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Analysis] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
