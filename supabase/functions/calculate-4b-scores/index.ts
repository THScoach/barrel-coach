import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * calculate-4b-scores Edge Function
 * 
 * Real 4B Bio Engine - Momentum-First KRS (Kinetic Report Scoring)
 * Ported from src/lib/reboot-parser.ts
 * 
 * ME (Momentum-Energy) CSV is PRIMARY + REQUIRED
 * IK (Inverse Kinematics) CSV is OPTIONAL (support only)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

interface Calculate4BRequest {
  player_id: string;
  session_id?: string;
  download_urls?: Record<string, string[]>;
  session_data?: {
    brain_score?: number;
    body_score?: number;
    bat_score?: number;
    ball_score?: number;
    ground_flow?: number;
    core_flow?: number;
    upper_flow?: number;
    swing_count?: number;
  };
}

enum LeakType {
  CLEAN_TRANSFER = 'clean_transfer',
  LATE_LEGS = 'late_legs',
  EARLY_ARMS = 'early_arms',
  TORSO_BYPASS = 'torso_bypass',
  NO_BAT_DELIVERY = 'no_bat_delivery',
  UNKNOWN = 'unknown',
}

interface MERow {
  time: string;
  org_movement_id: string;
  time_from_max_hand?: string;
  bat_kinetic_energy?: string;
  arms_kinetic_energy?: string;
  larm_kinetic_energy?: string;
  rarm_kinetic_energy?: string;
  legs_kinetic_energy: string;
  torso_kinetic_energy: string;
  total_kinetic_energy: string;
  [key: string]: string | undefined;
}

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

interface MESwingMetrics {
  movementId: string;
  batKE: number;
  armsKE: number;
  legsKE: number;
  torsoKE: number;
  totalKE: number;
  batEfficiency: number;
  torsoToArmsTransferPct: number;
  legsPeakTime: number;
  armsPeakTime: number;
  hasBatKE: boolean;
}

interface IKSwingMetrics {
  movementId: string;
  pelvisVelocity: number;
  torsoVelocity: number;
  xFactor: number;
  xFactorStretchRate: number;
  pelvisPeakTime: number;
  torsoPeakTime: number;
  contactTime: number;
  pelvisTiming: number;
  leadKneeAtContact: number;
  leadElbowAtContact: number;
  rearElbowAtContact: number;
  rearElbowExtRate: number;
  properSequence: boolean;
}

interface SwingMetrics {
  movementId: string;
  pelvisVelocity: number;
  torsoVelocity: number;
  xFactor: number;
  xFactorStretchRate: number;
  pelvisPeakTime: number;
  torsoPeakTime: number;
  contactTime: number;
  pelvisTiming: number;
  legsKE: number;
  torsoKE: number;
  armsKE: number;
  batKE: number;
  totalKE: number;
  leadKneeAtContact: number;
  leadElbowAtContact: number;
  rearElbowAtContact: number;
  rearElbowExtRate: number;
  properSequence: boolean;
  batEfficiency: number;
  torsoToArmsTransferPct: number;
  legsKEPeakTime: number;
  armsKEPeakTime: number;
}

// ============================================================================
// CONSTANTS (LOCKED - from Python 4B Bio Engine spec)
// ============================================================================

const THRESHOLDS = {
  legsKE: { min: 100, max: 500 },
  torsoKE: { min: 50, max: 250 },
  armsKE: { min: 80, max: 250 },
  batKE: { min: 100, max: 600 },
  batEfficiency: { min: 25, max: 65 },
  torsoToArmsTransfer: { min: 50, max: 150 },
  cvLegsKE: { min: 5, max: 40 },
  cvTorsoKE: { min: 5, max: 40 },
  cvOutput: { min: 10, max: 150 },
  cvTotalKE: { min: 5, max: 40 },
  cvBatEfficiency: { min: 10, max: 50 },
};

const WEIGHTS = { body: 0.35, bat: 0.30, brain: 0.20, ball: 0.15 };
const MIN_SWINGS_FOR_CV = 3;

// Kinetic Potential constants
const K_BAT_SPEED = 4.25;
const TARGET_DELIVERY_EFFICIENCY_PCT = 55;
const KP_SPEED_MULTIPLIER = 2.5;
const KP_EFFICIENCY_SCALE = 1.4;
const BASELINE_HEIGHT_INCHES = 68;

const BAT_SPEED_CLAMPS: Record<string, { min: number; max: number }> = {
  youth: { min: 45, max: 85 },
  hs: { min: 55, max: 95 },
  high_school: { min: 55, max: 95 },
  college: { min: 60, max: 105 },
  pro: { min: 65, max: 110 },
  mlb: { min: 65, max: 110 },
};

const LEAK_MESSAGES: Record<string, { caption: string; training: string }> = {
  [LeakType.CLEAN_TRANSFER]: {
    caption: 'Energy flowed through the chain.',
    training: 'Keep doing what you\'re doing.',
  },
  [LeakType.LATE_LEGS]: {
    caption: 'Your legs fired late — the energy showed up after your hands.',
    training: 'Get to the ground earlier.',
  },
  [LeakType.EARLY_ARMS]: {
    caption: 'Your arms took over before your legs finished.',
    training: 'Let the legs lead.',
  },
  [LeakType.TORSO_BYPASS]: {
    caption: 'Energy jumped from legs to arms, skipping your core.',
    training: 'Let your core catch and redirect the energy.',
  },
  [LeakType.NO_BAT_DELIVERY]: {
    caption: 'Energy didn\'t make it to the barrel.',
    training: 'Focus on delivering energy through the hands.',
  },
  [LeakType.UNKNOWN]: { caption: '', training: '' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return (Math.sqrt(variance) / Math.abs(mean)) * 100;
}

function to2080Scale(value: number, min: number, max: number, invert = false): number {
  if (max === min) return 50;
  let normalized = (value - min) / (max - min);
  if (invert) normalized = 1 - normalized;
  normalized = Math.max(0, Math.min(1, normalized));
  return Math.round(20 + normalized * 60);
}

function getGrade(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 60) return 'Plus';
  if (score >= 55) return 'Above Avg';
  if (score >= 45) return 'Average';
  if (score >= 40) return 'Below Avg';
  if (score >= 30) return 'Fringe';
  return 'Poor';
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateVelocities(values: number[], times: number[]): number[] {
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

// ============================================================================
// CSV STREAMING & PARSING
// ============================================================================

async function streamCsvFromUrl(url: string, maxChars: number = 2_000_000): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CSV download failed: ${response.status}`);
  }

  // Read enough bytes to check for gzip magic header
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let text: string;

  // Check for gzip magic bytes (0x1f, 0x8b)
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    console.log(`[4B-Engine] Detected gzip-compressed CSV (${bytes.length} bytes), decompressing...`);
    const ds = new DecompressionStream("gzip");
    const decompressedStream = new Blob([bytes]).stream().pipeThrough(ds);
    const decompressedBlob = await new Response(decompressedStream).blob();
    text = await decompressedBlob.text();
    console.log(`[4B-Engine] Decompressed to ${text.length} chars`);
  } else {
    text = new TextDecoder().decode(bytes);
  }

  // Cap at maxChars to prevent memory issues
  if (text.length > maxChars) {
    const lastNewline = text.lastIndexOf("\n", maxChars);
    if (lastNewline > 0) {
      text = text.substring(0, lastNewline);
    } else {
      text = text.substring(0, maxChars);
    }
    console.log(`[4B-Engine] Capped CSV at ${text.length} chars (max: ${maxChars})`);
  }

  return text;
}

function parseCsvToRows(csvText: string, fileLabel: string = 'CSV'): Record<string, string>[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  console.log(`[4B-Debug][${fileLabel}] Total non-empty lines: ${lines.length}`);
  if (lines.length < 2) {
    console.log(`[4B-Debug][${fileLabel}] Less than 2 lines — nothing to parse`);
    return [];
  }

  // Strip surrounding quotes from headers (Reboot CSVs use quoted headers)
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  console.log(`[4B-Debug][${fileLabel}] Headers found (${headers.length}): ${headers.slice(0, 30).map(h => `"${h}"`).join(' | ')}${headers.length > 30 ? ' ...' : ''}`);

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, j) => {
      // Strip surrounding quotes from values too
      row[header] = (values[j]?.trim() || '').replace(/^"|"$/g, '');
    });
    rows.push(row);
  }

  // Log first 5 rows as sample
  const sample = rows.slice(0, 5);
  console.log(`[4B-Debug][${fileLabel}] Parsed ${rows.length} data rows. First 5 sample:`);
  for (let i = 0; i < sample.length; i++) {
    const key_fields = {
      org_movement_id: sample[i].org_movement_id ?? '(missing)',
      time: sample[i].time ?? '(missing)',
      total_kinetic_energy: sample[i].total_kinetic_energy ?? '(missing)',
      legs_kinetic_energy: sample[i].legs_kinetic_energy ?? '(missing)',
      bat_kinetic_energy: sample[i].bat_kinetic_energy ?? '(missing)',
      time_from_max_hand: sample[i].time_from_max_hand ?? '(missing)',
    };
    console.log(`[4B-Debug][${fileLabel}] Row ${i}: ${JSON.stringify(key_fields)}`);
  }

  return rows;
}

function detectFileType(headers: string[]): 'me' | 'ik' | null {
  const lower = headers.map(h => h.toLowerCase());
  const meMarkers = ['total_kinetic_energy', 'legs_kinetic_energy', 'torso_kinetic_energy'];
  const ikMarkers = ['pelvis_rot', 'torso_rot', 'left_knee', 'right_knee'];

  if (meMarkers.some(m => lower.includes(m))) return 'me';
  if (ikMarkers.some(m => lower.includes(m))) return 'ik';
  return null;
}

// ============================================================================
// ME FILE PROCESSING (PRIMARY - REQUIRED)
// ============================================================================

function processMEFile(rows: MERow[]): Map<string, MESwingMetrics> {
  console.log(`[4B-Debug][ME-Process] Input rows to processMEFile: ${rows.length}`);
  const swingGroups = new Map<string, MERow[]>();

  let skippedNoId = 0;
  let skippedNA = 0;
  for (const row of rows) {
    const movementId = row.org_movement_id;
    if (!movementId) { skippedNoId++; continue; }
    if (movementId.toLowerCase() === 'n/a') { skippedNA++; continue; }
    if (!swingGroups.has(movementId)) swingGroups.set(movementId, []);
    swingGroups.get(movementId)!.push(row);
  }

  const movementIds = Array.from(swingGroups.keys());
  console.log(`[4B-Debug][ME-Process] Rows skipped (no org_movement_id): ${skippedNoId}`);
  console.log(`[4B-Debug][ME-Process] Rows skipped (N/A): ${skippedNA}`);
  console.log(`[4B-Debug][ME-Process] Unique movement IDs found: ${movementIds.length}`);
  console.log(`[4B-Debug][ME-Process] Movement IDs: ${movementIds.slice(0, 20).join(', ')}${movementIds.length > 20 ? '...' : ''}`);
  for (const [id, frames] of swingGroups) {
    console.log(`[4B-Debug][ME-Process]   movement "${id}": ${frames.length} frames`);
    if (movementIds.indexOf(id) >= 5) break; // Only log first 5 in detail
  }

  const swingMetrics = new Map<string, MESwingMetrics>();

  for (const [movementId, frames] of swingGroups) {
    frames.sort((a, b) => parseFloat(a.time || '0') - parseFloat(b.time || '0'));
    if (frames.length < 5) continue;

    const times = frames.map(f => parseFloat(f.time || '0'));
    const hasContactMarker = frames[0].time_from_max_hand !== undefined;

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

    const batKEs: number[] = [];
    const armsKEs: number[] = [];
    const legsKEs: number[] = [];
    const torsoKEs: number[] = [];
    const totalKEs: number[] = [];

    for (const i of validIndices) {
      const f = frames[i];
      const batKE = parseFloat(f.bat_kinetic_energy || '0');
      const totalKE = parseFloat(f.total_kinetic_energy || '0');

      if (batKE >= 0 && batKE <= totalKE && batKE < 1000) {
        batKEs.push(batKE);
      }

      let armsKE = parseFloat(f.arms_kinetic_energy || '0');
      if (armsKE === 0) {
        const larmKE = parseFloat(f.larm_kinetic_energy || '0');
        const rarmKE = parseFloat(f.rarm_kinetic_energy || '0');
        armsKE = larmKE + rarmKE;
      }
      armsKEs.push(armsKE);
      legsKEs.push(parseFloat(f.legs_kinetic_energy || '0'));
      torsoKEs.push(parseFloat(f.torso_kinetic_energy || '0'));
      totalKEs.push(totalKE);
    }

    const batKE95 = batKEs.length ? percentile(batKEs, 95) : 0;
    const armsKE95 = percentile(armsKEs, 95);
    const legsKE95 = percentile(legsKEs, 95);
    const torsoKE95 = percentile(torsoKEs, 95);
    const totalKE95 = percentile(totalKEs, 95);

    const batEfficiency = totalKE95 > 0 ? (batKE95 / totalKE95) * 100 : 0;
    const torsoToArmsTransferPct = torsoKE95 > 0 ? (armsKE95 / torsoKE95) * 100 : 0;

    const legsPeakIdx = legsKEs.length
      ? legsKEs.reduce((maxIdx, v, i) => v > legsKEs[maxIdx] ? i : maxIdx, 0) : 0;
    const armsPeakIdx = armsKEs.length
      ? armsKEs.reduce((maxIdx, v, i) => v > armsKEs[maxIdx] ? i : maxIdx, 0) : 0;

    const legsPeakTime = validIndices.length ? times[validIndices[legsPeakIdx]] * 1000 : 0;
    const armsPeakTime = validIndices.length ? times[validIndices[armsPeakIdx]] * 1000 : 0;

    const hasBatKE = batKEs.length > 0 && Math.max(...batKEs) > 1;

    swingMetrics.set(movementId, {
      movementId, batKE: batKE95, armsKE: armsKE95, legsKE: legsKE95,
      torsoKE: torsoKE95, totalKE: totalKE95, batEfficiency,
      torsoToArmsTransferPct, legsPeakTime, armsPeakTime, hasBatKE,
    });
  }

  console.log(`[4B-Debug][ME-Process] Swings surviving (>=5 frames): ${swingMetrics.size} out of ${swingGroups.size} movement groups`);
  for (const [id, metrics] of swingMetrics) {
    console.log(`[4B-Debug][ME-Process]   Swing "${id}": legsKE=${metrics.legsKE.toFixed(1)}J torsoKE=${metrics.torsoKE.toFixed(1)}J armsKE=${metrics.armsKE.toFixed(1)}J batKE=${metrics.batKE.toFixed(1)}J totalKE=${metrics.totalKE.toFixed(1)}J batEff=${metrics.batEfficiency.toFixed(1)}%`);
    if (swingMetrics.size > 5 && [...swingMetrics.keys()].indexOf(id) >= 4) {
      console.log(`[4B-Debug][ME-Process]   ... (${swingMetrics.size - 5} more swings)`);
      break;
    }
  }

  return swingMetrics;
}

// ============================================================================
// IK FILE PROCESSING (OPTIONAL - SUPPORT ONLY)
// ============================================================================

function processIKFile(rows: IKRow[], dominantHand: 'L' | 'R' = 'R'): Map<string, IKSwingMetrics> {
  const swingGroups = new Map<string, IKRow[]>();

  for (const row of rows) {
    const movementId = row.org_movement_id;
    if (!movementId || movementId.toLowerCase() === 'n/a') continue;
    if (!swingGroups.has(movementId)) swingGroups.set(movementId, []);
    swingGroups.get(movementId)!.push(row);
  }

  const swingMetrics = new Map<string, IKSwingMetrics>();

  for (const [movementId, frames] of swingGroups) {
    frames.sort((a, b) => parseFloat(a.time || '0') - parseFloat(b.time || '0'));
    if (frames.length < 10) continue;

    const hasContactMarker = frames[0].time_from_max_hand !== undefined;
    const times = frames.map(f => parseFloat(f.time || '0'));

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
      swingPhaseFrames = frames.filter(f => parseFloat(f.time || '0') <= 0.5);
      swingPhaseTimes = swingPhaseFrames.map(f => parseFloat(f.time || '0'));
      contactIdx = swingPhaseFrames.length - 1;
    }

    if (swingPhaseFrames.length < 5) {
      swingPhaseFrames = frames.slice(0, Math.min(100, frames.length));
      swingPhaseTimes = times.slice(0, Math.min(100, times.length));
      contactIdx = swingPhaseFrames.length - 1;
    }

    const pelvisRots = swingPhaseFrames.map(f => parseFloat(f.pelvis_rot || '0'));
    const torsoRots = swingPhaseFrames.map(f => parseFloat(f.torso_rot || '0'));

    const pelvisVelsRad = calculateVelocities(pelvisRots, swingPhaseTimes);
    const torsoVelsRad = calculateVelocities(torsoRots, swingPhaseTimes);
    const pelvisVelsDeg = pelvisVelsRad.map(radToDeg);
    const torsoVelsDeg = torsoVelsRad.map(radToDeg);

    const pelvisPeakVel = pelvisVelsDeg.length ? Math.max(...pelvisVelsDeg.map(Math.abs)) : 0;
    const torsoPeakVel = torsoVelsDeg.length ? Math.max(...torsoVelsDeg.map(Math.abs)) : 0;

    const xFactors = swingPhaseFrames.map((_, i) =>
      Math.abs(radToDeg(torsoRots[i]) - radToDeg(pelvisRots[i])));
    const xFactorMax = xFactors.length ? Math.max(...xFactors) : 0;

    const xFactorVels = calculateVelocities(xFactors, swingPhaseTimes);
    const xFactorStretchRate = xFactorVels.length ? Math.max(...xFactorVels.map(Math.abs)) : 0;

    const contactTime = swingPhaseTimes[Math.min(contactIdx, swingPhaseTimes.length - 1)] * 1000;

    const pelvisPeakIdx = pelvisVelsDeg.length
      ? pelvisVelsDeg.reduce((maxIdx, v, i) =>
          Math.abs(v) > Math.abs(pelvisVelsDeg[maxIdx]) ? i : maxIdx, 0) : 0;
    const pelvisPeakTime = swingPhaseTimes[pelvisPeakIdx] * 1000;

    const torsoPeakIdx = torsoVelsDeg.length
      ? torsoVelsDeg.reduce((maxIdx, v, i) =>
          Math.abs(v) > Math.abs(torsoVelsDeg[maxIdx]) ? i : maxIdx, 0) : 0;
    const torsoPeakTime = swingPhaseTimes[torsoPeakIdx] * 1000;

    const properSequence = pelvisPeakTime < torsoPeakTime;
    const pelvisTiming = contactTime - pelvisPeakTime;

    const contactFrame = swingPhaseFrames[Math.min(contactIdx, swingPhaseFrames.length - 1)];
    const leadKneeCol = dominantHand === 'R' ? 'left_knee' : 'right_knee';
    const leadElbowCol = dominantHand === 'R' ? 'left_elbow' : 'right_elbow';
    const rearElbowCol = dominantHand === 'R' ? 'right_elbow' : 'left_elbow';

    const leadKnee = Math.abs(radToDeg(parseFloat(contactFrame[leadKneeCol] || '0')));
    const leadElbow = Math.abs(radToDeg(parseFloat(contactFrame[leadElbowCol] || '0')));
    const rearElbow = Math.abs(radToDeg(parseFloat(contactFrame[rearElbowCol] || '0')));

    const rearElbowAngles = swingPhaseFrames.map(f => parseFloat(f[rearElbowCol] || '0'));
    const rearElbowVels = calculateVelocities(rearElbowAngles, swingPhaseTimes);
    const rearElbowExtRate = rearElbowVels.length ? Math.max(...rearElbowVels) * (180 / Math.PI) : 0;

    swingMetrics.set(movementId, {
      movementId, pelvisVelocity: pelvisPeakVel, torsoVelocity: torsoPeakVel,
      xFactor: xFactorMax, xFactorStretchRate, pelvisPeakTime, torsoPeakTime,
      contactTime, pelvisTiming, leadKneeAtContact: leadKnee,
      leadElbowAtContact: leadElbow, rearElbowAtContact: rearElbow,
      rearElbowExtRate, properSequence,
    });
  }

  return swingMetrics;
}

// ============================================================================
// LEAK DETECTION - MOMENTUM-BASED (Python spec)
// ============================================================================

function detectLeakType(swings: SwingMetrics[]): {
  type: LeakType; caption: string; trainingMeaning: string;
} {
  if (!swings.length) {
    return { type: LeakType.UNKNOWN, caption: '', trainingMeaning: '' };
  }

  const avgBatEfficiency = avg(swings.map(s => s.batEfficiency));
  const avgTorsoToArms = avg(swings.map(s => s.torsoToArmsTransferPct));
  const avgTorsoKE = avg(swings.map(s => s.torsoKE));
  const properSeqPct = swings.filter(s => s.legsKEPeakTime <= s.armsKEPeakTime).length / swings.length;
  const lateLegsPct = swings.filter(s => s.legsKEPeakTime > s.armsKEPeakTime).length / swings.length;
  const noBatPct = swings.filter(s => s.batKE < 10).length / swings.length;
  const torsoBypassIndicator = avgTorsoKE > 0 && avgTorsoToArms < 50;

  // Detection order per Python spec
  if (noBatPct > 0.5) {
    const msg = LEAK_MESSAGES[LeakType.NO_BAT_DELIVERY];
    return { type: LeakType.NO_BAT_DELIVERY, caption: msg.caption, trainingMeaning: msg.training };
  }
  if (lateLegsPct > 0.5) {
    const msg = LEAK_MESSAGES[LeakType.LATE_LEGS];
    return { type: LeakType.LATE_LEGS, caption: msg.caption, trainingMeaning: msg.training };
  }
  if (torsoBypassIndicator) {
    const msg = LEAK_MESSAGES[LeakType.TORSO_BYPASS];
    return { type: LeakType.TORSO_BYPASS, caption: msg.caption, trainingMeaning: msg.training };
  }
  if (properSeqPct < 0.4) {
    const msg = LEAK_MESSAGES[LeakType.EARLY_ARMS];
    return { type: LeakType.EARLY_ARMS, caption: msg.caption, trainingMeaning: msg.training };
  }
  if (properSeqPct > 0.7 && avgBatEfficiency > 30) {
    const msg = LEAK_MESSAGES[LeakType.CLEAN_TRANSFER];
    return { type: LeakType.CLEAN_TRANSFER, caption: msg.caption, trainingMeaning: msg.training };
  }

  return { type: LeakType.UNKNOWN, caption: '', trainingMeaning: '' };
}

// ============================================================================
// KINETIC PROJECTIONS (OLD)
// ============================================================================

function calculateKineticProjections(
  swings: SwingMetrics[],
  leak: { type: LeakType },
  playerLevel: string = 'hs'
) {
  if (!swings.length) {
    return {
      batSpeedCurrentMph: 0, batSpeedCeilingMph: 0,
      exitVeloCurrentMph: 0, exitVeloCeilingMph: 0,
      deliveryEfficiencyPct: 0,
      potentialDeliveryEfficiencyPct: TARGET_DELIVERY_EFFICIENCY_PCT,
      hasProjections: false,
    };
  }

  const avgBatKE = avg(swings.map(s => s.batKE));
  const avgArmsKE = avg(swings.map(s => s.armsKE));
  const avgTotalKE = avg(swings.map(s => s.totalKE));
  const avgTorsoToArmsTransfer = avg(swings.map(s => s.torsoToArmsTransferPct));
  const hasBatKE = swings.some(s => s.batKE > 1);

  let deliveredEnergyJ: number;
  let deliveryEfficiencyPct: number;

  if (hasBatKE && avgBatKE > 0) {
    deliveredEnergyJ = avgBatKE;
    deliveryEfficiencyPct = avgTotalKE > 0 ? (avgBatKE / avgTotalKE) * 100 : 0;
  } else {
    deliveredEnergyJ = avgArmsKE * (avgTorsoToArmsTransfer / 100);
    deliveryEfficiencyPct = avgTotalKE > 0
      ? (deliveredEnergyJ / avgTotalKE) * 100
      : clamp(avgTorsoToArmsTransfer * 0.5, 0, 60);
  }

  const potentialDeliveredEnergyJ = avgTotalKE * (TARGET_DELIVERY_EFFICIENCY_PCT / 100);

  let batSpeedCurrentMph = K_BAT_SPEED * Math.sqrt(Math.max(deliveredEnergyJ, 0));
  let batSpeedCeilingMph = K_BAT_SPEED * Math.sqrt(Math.max(potentialDeliveredEnergyJ, deliveredEnergyJ));

  if (leak.type === LeakType.NO_BAT_DELIVERY || deliveryEfficiencyPct < 30) {
    batSpeedCeilingMph = Math.max(batSpeedCeilingMph, batSpeedCurrentMph + 10);
  } else if (deliveryEfficiencyPct < 45) {
    batSpeedCeilingMph = Math.max(batSpeedCeilingMph, batSpeedCurrentMph + 6);
  }

  const clamps = BAT_SPEED_CLAMPS[playerLevel] || BAT_SPEED_CLAMPS.hs;
  batSpeedCurrentMph = clamp(Math.round(batSpeedCurrentMph), clamps.min, clamps.max);
  batSpeedCeilingMph = clamp(Math.round(batSpeedCeilingMph), batSpeedCurrentMph, clamps.max);

  const exitVeloCurrentMph = clamp(Math.round(1.25 * batSpeedCurrentMph + 5), 55, 115);
  const exitVeloCeilingMph = clamp(Math.round(1.25 * batSpeedCeilingMph + 5), exitVeloCurrentMph, 120);

  return {
    batSpeedCurrentMph, batSpeedCeilingMph,
    exitVeloCurrentMph, exitVeloCeilingMph,
    deliveryEfficiencyPct: Math.round(deliveryEfficiencyPct * 10) / 10,
    potentialDeliveryEfficiencyPct: TARGET_DELIVERY_EFFICIENCY_PCT,
    hasProjections: true,
  };
}

// ============================================================================
// KINETIC POTENTIAL LAYER (MASS-NORMALIZED)
// ============================================================================

function calculateKineticPotentialLayer(
  swings: SwingMetrics[],
  playerWeightLbs: number | null,
  playerHeightInches: number | null
) {
  const warnings: string[] = [];
  const bodyMassKg = playerWeightLbs ? playerWeightLbs / 2.20462 : 75;
  const heightInches = playerHeightInches || 68;

  if (!playerWeightLbs) warnings.push('Using default weight (165 lbs)');
  if (!playerHeightInches) warnings.push('Using default height (68")');

  if (!swings.length) {
    return {
      avgTotalKEPeak: 0, avgArmsKEPeak: 0, bodyMassKg, heightInches,
      properSequencePct: 0, avgLegsToTorsoTransferPct: 0, avgTorsoToArmsTransferPct: 0,
      massAdjustedEnergy: 0, leverIndex: heightInches / BASELINE_HEIGHT_INCHES,
      efficiency: 0, estimatedCurrentBatSpeedMph: 0,
      projectedBatSpeedCeilingMph: 0, mphLeftOnTable: 0,
      hasProjections: false, warnings: ['No swings available'],
    };
  }

  const avgTotalKEPeak = avg(swings.map(s => s.totalKE));
  const avgArmsKEPeak = avg(swings.map(s => s.armsKE));
  const avgLegsKEPeak = avg(swings.map(s => s.legsKE));
  const avgTorsoKEPeak = avg(swings.map(s => s.torsoKE));

  if (avgArmsKEPeak <= 0) {
    return {
      avgTotalKEPeak, avgArmsKEPeak: 0, bodyMassKg, heightInches,
      properSequencePct: 0, avgLegsToTorsoTransferPct: 0, avgTorsoToArmsTransferPct: 0,
      massAdjustedEnergy: avgTotalKEPeak / bodyMassKg,
      leverIndex: heightInches / BASELINE_HEIGHT_INCHES,
      efficiency: 0, estimatedCurrentBatSpeedMph: 0,
      projectedBatSpeedCeilingMph: 0, mphLeftOnTable: 0,
      hasProjections: false, warnings: ['Arms kinetic energy is zero'],
    };
  }

  const avgLegsToTorsoTransferPct = avgLegsKEPeak > 0 ? (avgTorsoKEPeak / avgLegsKEPeak) * 100 : 0;
  const avgTorsoToArmsTransferPct = avg(swings.map(s => s.torsoToArmsTransferPct));
  const properSequencePct = (swings.filter(s => s.properSequence).length / swings.length) * 100;

  const massAdjustedEnergy = avgTotalKEPeak / bodyMassKg;
  const leverIndex = heightInches / BASELINE_HEIGHT_INCHES;

  const rawEfficiency = avgTotalKEPeak > 0
    ? (avgArmsKEPeak / avgTotalKEPeak) * KP_EFFICIENCY_SCALE : 0;
  const efficiency = clamp(rawEfficiency, 0, 1);

  const projectedBatSpeedCeilingMph = KP_SPEED_MULTIPLIER * Math.sqrt(avgArmsKEPeak) * leverIndex;
  const estimatedCurrentBatSpeedMph = projectedBatSpeedCeilingMph * efficiency;
  const mphLeftOnTable = projectedBatSpeedCeilingMph - estimatedCurrentBatSpeedMph;

  return {
    avgTotalKEPeak: Math.round(avgTotalKEPeak * 10) / 10,
    avgArmsKEPeak: Math.round(avgArmsKEPeak * 10) / 10,
    bodyMassKg: Math.round(bodyMassKg * 10) / 10,
    heightInches,
    properSequencePct: Math.round(properSequencePct * 10) / 10,
    avgLegsToTorsoTransferPct: Math.round(avgLegsToTorsoTransferPct * 10) / 10,
    avgTorsoToArmsTransferPct: Math.round(avgTorsoToArmsTransferPct * 10) / 10,
    massAdjustedEnergy: Math.round(massAdjustedEnergy * 100) / 100,
    leverIndex: Math.round(leverIndex * 100) / 100,
    efficiency: Math.round(efficiency * 100) / 100,
    estimatedCurrentBatSpeedMph: Math.round(estimatedCurrentBatSpeedMph * 10) / 10,
    projectedBatSpeedCeilingMph: Math.round(projectedBatSpeedCeilingMph * 10) / 10,
    mphLeftOnTable: Math.round(mphLeftOnTable * 10) / 10,
    hasProjections: true,
    warnings,
  };
}

// ============================================================================
// MAIN 4B SCORING FUNCTION (ME-PRIMARY)
// ============================================================================

function calculate4BScores(
  ikRows: IKRow[] | null,
  meRows: MERow[],
  dominantHand: 'L' | 'R' = 'R',
  playerLevel: string = 'hs',
  playerWeightLbs: number | null = null,
  playerHeightInches: number | null = null
) {
  const dataQuality = {
    swingCount: 0, hasContactEvent: false, hasBatKE: false,
    batKECoverage: 0, cvScoresValid: false,
    incompleteSwings: [] as string[], warnings: [] as string[],
    hasMEData: false, hasIKData: false,
  };

  const defaultResult = {
    brain: 50, body: 50, bat: 50, ball: 50, catchBarrelScore: 50,
    grades: { brain: 'Average', body: 'Average', bat: 'Average', ball: 'Average', overall: 'Average' },
    components: { groundFlow: 50, coreFlow: 50, upperFlow: 50 },
    rawMetrics: {} as Record<string, number>,
    leak: { type: LeakType.UNKNOWN as string, caption: '', trainingMeaning: '' },
    projections: {
      batSpeedCurrentMph: 0, batSpeedCeilingMph: 0,
      exitVeloCurrentMph: 0, exitVeloCeilingMph: 0,
      deliveryEfficiencyPct: 0,
      potentialDeliveryEfficiencyPct: TARGET_DELIVERY_EFFICIENCY_PCT,
      hasProjections: false,
    },
    kineticPotential: null as any,
    dataQuality,
    swingCount: 0,
  };

  if (!meRows || meRows.length === 0) {
    dataQuality.warnings.push('ME file required for 4B scoring');
    return defaultResult;
  }

  // Process ME file (PRIMARY)
  const meMetrics = processMEFile(meRows);
  dataQuality.hasMEData = meMetrics.size > 0;

  if (meMetrics.size === 0) {
    dataQuality.warnings.push('No valid swings found in ME file');
    return defaultResult;
  }

  // Process IK file (OPTIONAL)
  const ikMetrics = ikRows && ikRows.length > 0
    ? processIKFile(ikRows, dominantHand)
    : new Map<string, IKSwingMetrics>();
  dataQuality.hasIKData = ikMetrics.size > 0;

  // Build swing data from ME (primary) with optional IK support
  const swings: SwingMetrics[] = [];
  let swingsWithBatKE = 0;

  for (const [movementId, meData] of meMetrics) {
    const ikData = ikMetrics.get(movementId);

    const swing: SwingMetrics = {
      movementId,
      pelvisVelocity: ikData?.pelvisVelocity || 0,
      torsoVelocity: ikData?.torsoVelocity || 0,
      xFactor: ikData?.xFactor || 0,
      xFactorStretchRate: ikData?.xFactorStretchRate || 0,
      pelvisPeakTime: ikData?.pelvisPeakTime || 0,
      torsoPeakTime: ikData?.torsoPeakTime || 0,
      contactTime: ikData?.contactTime || 0,
      pelvisTiming: ikData?.pelvisTiming || 0,
      leadKneeAtContact: ikData?.leadKneeAtContact || 0,
      leadElbowAtContact: ikData?.leadElbowAtContact || 0,
      rearElbowAtContact: ikData?.rearElbowAtContact || 0,
      rearElbowExtRate: ikData?.rearElbowExtRate || 0,
      properSequence: ikData?.properSequence || false,
      legsKE: meData.legsKE,
      torsoKE: meData.torsoKE,
      armsKE: meData.armsKE,
      batKE: meData.batKE,
      totalKE: meData.totalKE,
      batEfficiency: meData.batEfficiency,
      torsoToArmsTransferPct: meData.torsoToArmsTransferPct,
      legsKEPeakTime: meData.legsPeakTime,
      armsKEPeakTime: meData.armsPeakTime,
    };

    if (meData.hasBatKE) swingsWithBatKE++;
    swings.push(swing);
  }

  if (!swings.length) {
    dataQuality.warnings.push('No valid swings found in files');
    return defaultResult;
  }

  // Data quality flags
  dataQuality.swingCount = swings.length;
  dataQuality.hasBatKE = swingsWithBatKE > 0;
  dataQuality.batKECoverage = swingsWithBatKE / swings.length;
  dataQuality.cvScoresValid = swings.length >= MIN_SWINGS_FOR_CV;

  if (!dataQuality.hasBatKE) dataQuality.warnings.push('Bat KE not available - using transfer proxy');
  if (!dataQuality.cvScoresValid) dataQuality.warnings.push(`Need ${MIN_SWINGS_FOR_CV}+ swings for consistency scores`);
  if (!dataQuality.hasIKData) dataQuality.warnings.push('IK data not available - using ME-only scoring');

  // Extract values
  const legsKEs = swings.map(s => s.legsKE);
  const torsoKEs = swings.map(s => s.torsoKE);
  const armsKEs = swings.map(s => s.armsKE);
  const batKEs = swings.map(s => s.batKE);
  const totalKEs = swings.map(s => s.totalKE);
  const batEffs = swings.map(s => s.batEfficiency);
  const torsoToArmsTransfers = swings.map(s => s.torsoToArmsTransferPct);

  const avgLegsKE = avg(legsKEs);
  const avgTorsoKE = avg(torsoKEs);
  const avgArmsKE = avg(armsKEs);
  const avgBatKE = avg(batKEs);
  const avgTotalKE = avg(totalKEs);
  const avgBatEff = avg(batEffs);
  const avgTorsoToArms = avg(torsoToArmsTransfers);

  // Raw metrics
  const rawMetrics: Record<string, number> = {
    avgLegsKE: Math.round(avgLegsKE * 10) / 10,
    avgTorsoKE: Math.round(avgTorsoKE * 10) / 10,
    avgArmsKE: Math.round(avgArmsKE * 10) / 10,
    avgBatKE: Math.round(avgBatKE * 10) / 10,
    avgTotalKE: Math.round(avgTotalKE * 10) / 10,
    avgBatEfficiency: Math.round(avgBatEff * 10) / 10,
    avgTorsoToArmsTransfer: Math.round(avgTorsoToArms * 10) / 10,
    swingCount: swings.length,
  };

  if (dataQuality.hasIKData) {
    const pelvisVels = swings.map(s => s.pelvisVelocity).filter(v => v > 0);
    const torsoVels = swings.map(s => s.torsoVelocity).filter(v => v > 0);
    const xFactors = swings.map(s => s.xFactor).filter(v => v > 0);
    rawMetrics.avgPelvisVelocity = Math.round(avg(pelvisVels) * 10) / 10;
    rawMetrics.avgTorsoVelocity = Math.round(avg(torsoVels) * 10) / 10;
    rawMetrics.avgXFactor = Math.round(avg(xFactors) * 10) / 10;
  }

  // ========== GROUND FLOW ==========
  const groundFlowScore = to2080Scale(avgLegsKE, THRESHOLDS.legsKE.min, THRESHOLDS.legsKE.max);

  // ========== CORE FLOW ==========
  const coreFlowComponents = [
    to2080Scale(avgTorsoKE, THRESHOLDS.torsoKE.min, THRESHOLDS.torsoKE.max),
    to2080Scale(avgTorsoToArms, THRESHOLDS.torsoToArmsTransfer.min, THRESHOLDS.torsoToArmsTransfer.max),
  ];
  const coreFlowScore = Math.round(avg(coreFlowComponents));

  // ========== BODY (Ground + Core) ==========
  const bodyScore = Math.round((groundFlowScore + coreFlowScore) / 2);

  // ========== BAT (Upper Flow) ==========
  let upperFlowComponents: number[];
  if (dataQuality.hasBatKE) {
    upperFlowComponents = [
      to2080Scale(avgBatKE, THRESHOLDS.batKE.min, THRESHOLDS.batKE.max),
      to2080Scale(avgArmsKE, THRESHOLDS.armsKE.min, THRESHOLDS.armsKE.max),
      to2080Scale(avgBatEff, THRESHOLDS.batEfficiency.min, THRESHOLDS.batEfficiency.max),
    ];
  } else {
    const deliveryEffProxy = avgArmsKE * (avgTorsoToArms / 100);
    const proxyEffPct = avgTotalKE > 0 ? (deliveryEffProxy / avgTotalKE) * 100 : avgTorsoToArms * 0.4;
    upperFlowComponents = [
      to2080Scale(avgArmsKE, THRESHOLDS.armsKE.min, THRESHOLDS.armsKE.max),
      to2080Scale(proxyEffPct, THRESHOLDS.torsoToArmsTransfer.min, THRESHOLDS.torsoToArmsTransfer.max),
    ];
  }
  const batScore = Math.round(avg(upperFlowComponents));

  // ========== BRAIN (Consistency) ==========
  let brainScore = 50;
  if (dataQuality.cvScoresValid) {
    const cvLegsKE = calculateCV(legsKEs);
    const cvTorsoKE = calculateCV(torsoKEs);
    const cvArmsKE = calculateCV(armsKEs);
    const cvOutput = dataQuality.hasBatKE ? calculateCV(batKEs) : calculateCV(armsKEs);

    rawMetrics.cvLegsKE = Math.round(cvLegsKE * 10) / 10;
    rawMetrics.cvTorsoKE = Math.round(cvTorsoKE * 10) / 10;
    rawMetrics.cvArmsKE = Math.round(cvArmsKE * 10) / 10;
    rawMetrics.cvOutput = Math.round(cvOutput * 10) / 10;

    const brainComponents = [
      to2080Scale(cvLegsKE, THRESHOLDS.cvLegsKE.min, THRESHOLDS.cvLegsKE.max, true),
      to2080Scale(cvTorsoKE, THRESHOLDS.cvTorsoKE.min, THRESHOLDS.cvTorsoKE.max, true),
      to2080Scale(cvOutput, THRESHOLDS.cvOutput.min, THRESHOLDS.cvOutput.max, true),
    ];
    brainScore = Math.round(avg(brainComponents));
  }

  // ========== BALL (Output Consistency) ==========
  let ballScore = 50;
  if (dataQuality.cvScoresValid) {
    const cvTotalKE = calculateCV(totalKEs);
    const cvBatEff = calculateCV(batEffs.filter(e => e > 0));

    rawMetrics.cvTotalKE = Math.round(cvTotalKE * 10) / 10;
    rawMetrics.cvBatEfficiency = Math.round(cvBatEff * 10) / 10;

    const ballComponents = [
      to2080Scale(cvTotalKE, THRESHOLDS.cvTotalKE.min, THRESHOLDS.cvTotalKE.max, true),
      to2080Scale(cvBatEff, THRESHOLDS.cvBatEfficiency.min, THRESHOLDS.cvBatEfficiency.max, true),
    ];
    ballScore = Math.round(avg(ballComponents));
  }

  // ========== CATCH BARREL SCORE ==========
  const catchBarrelScore = Math.round(
    bodyScore * WEIGHTS.body + batScore * WEIGHTS.bat +
    brainScore * WEIGHTS.brain + ballScore * WEIGHTS.ball
  );

  // ========== LEAK DETECTION ==========
  const leak = detectLeakType(swings);

  // ========== KINETIC PROJECTIONS ==========
  const projections = calculateKineticProjections(swings, leak, playerLevel);

  // ========== KINETIC POTENTIAL LAYER ==========
  const kineticPotential = calculateKineticPotentialLayer(swings, playerWeightLbs, playerHeightInches);

  return {
    brain: brainScore,
    body: bodyScore,
    bat: batScore,
    ball: ballScore,
    catchBarrelScore,
    grades: {
      brain: getGrade(brainScore),
      body: getGrade(bodyScore),
      bat: getGrade(batScore),
      ball: getGrade(ballScore),
      overall: getGrade(catchBarrelScore),
    },
    components: {
      groundFlow: groundFlowScore,
      coreFlow: coreFlowScore,
      upperFlow: batScore,
    },
    rawMetrics,
    leak: {
      type: leak.type,
      caption: leak.caption,
      trainingMeaning: leak.trainingMeaning,
    },
    projections,
    kineticPotential,
    dataQuality,
    swingCount: swings.length,
  };
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as Calculate4BRequest;

    if (!body.player_id) {
      return new Response(
        JSON.stringify({ error: 'player_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[4B-Engine] Processing for player: ${body.player_id}`);

    // Fetch player info for height/weight/handedness/level
    const { data: player } = await supabase
      .from('players')
      .select('id, name, handedness, level, height_inches, weight_lbs')
      .eq('id', body.player_id)
      .maybeSingle();

    const dominantHand: 'L' | 'R' = player?.handedness === 'left' ? 'L' : 'R';
    const playerLevel = player?.level || 'hs';
    const playerWeightLbs = player?.weight_lbs ? Number(player.weight_lbs) : null;
    const playerHeightInches = player?.height_inches ? Number(player.height_inches) : null;

    console.log(`[4B-Engine] Player: ${player?.name || 'unknown'}, Hand: ${dominantHand}, Level: ${playerLevel}`);

    let scores: ReturnType<typeof calculate4BScores>;

    // If download_urls provided, stream and parse CSVs
    if (body.download_urls && Object.keys(body.download_urls).length > 0) {
      console.log("[4B-Engine] Streaming CSV data from download URLs...");

      let meRows: MERow[] = [];
      let ikRows: IKRow[] | null = null;

      // Stream momentum-energy CSV(s) (PRIMARY)
      // When we have multiple URLs (per-movement exports), concatenate all CSVs
      const meUrls = body.download_urls["momentum-energy"] || [];
      if (meUrls.length > 0) {
        console.log(`[4B-Engine] Streaming ${meUrls.length} momentum-energy CSV(s) (capped at 2MB each)...`);
        for (let urlIdx = 0; urlIdx < meUrls.length; urlIdx++) {
          const csvText = await streamCsvFromUrl(meUrls[urlIdx]);
          console.log(`[4B-Engine] ME URL ${urlIdx + 1}/${meUrls.length}: ${csvText.length} chars`);
          const rows = parseCsvToRows(csvText, `momentum-energy-${urlIdx + 1}`) as MERow[];
          console.log(`[4B-Engine] ME URL ${urlIdx + 1}: parsed ${rows.length} rows`);
          meRows.push(...rows);
        }
        console.log(`[4B-Engine] Total ME rows after concatenation: ${meRows.length}`);
      }

      // Stream inverse-kinematics CSV(s) (OPTIONAL)
      const ikUrls = body.download_urls["inverse-kinematics"] || [];
      if (ikUrls.length > 0) {
        console.log(`[4B-Engine] Streaming ${ikUrls.length} inverse-kinematics CSV(s) (capped at 2MB each)...`);
        const allIkRows: IKRow[] = [];
        for (let urlIdx = 0; urlIdx < ikUrls.length; urlIdx++) {
          try {
            const ikCsv = await streamCsvFromUrl(ikUrls[urlIdx]);
            console.log(`[4B-Engine] IK URL ${urlIdx + 1}/${ikUrls.length}: ${ikCsv.length} chars`);
            const rows = parseCsvToRows(ikCsv, `inverse-kinematics-${urlIdx + 1}`) as IKRow[];
            console.log(`[4B-Engine] IK URL ${urlIdx + 1}: parsed ${rows.length} rows`);
            allIkRows.push(...rows);
          } catch (err) {
            console.warn(`[4B-Engine] IK URL ${urlIdx + 1} streaming failed, skipping:`, err);
          }
        }
        if (allIkRows.length > 0) {
          ikRows = allIkRows;
          console.log(`[4B-Engine] Total IK rows after concatenation: ${ikRows.length}`);
        }
      }

      // Run the REAL 4B Bio Engine
      scores = calculate4BScores(
        ikRows, meRows, dominantHand, playerLevel,
        playerWeightLbs, playerHeightInches
      );

      console.log(`[4B-Engine] REAL ENGINE RESULTS: Brain=${scores.brain} Body=${scores.body} ` +
        `Bat=${scores.bat} Ball=${scores.ball} Overall=${scores.catchBarrelScore} ` +
        `Swings=${scores.swingCount} Leak=${scores.leak.type}`);
      console.log(`[4B-Engine] Flows: Ground=${scores.components.groundFlow} ` +
        `Core=${scores.components.coreFlow} Upper=${scores.components.upperFlow}`);
      console.log(`[4B-Engine] Raw: LegsKE=${scores.rawMetrics.avgLegsKE}J ` +
        `TorsoKE=${scores.rawMetrics.avgTorsoKE}J ArmsKE=${scores.rawMetrics.avgArmsKE}J ` +
        `BatKE=${scores.rawMetrics.avgBatKE}J TotalKE=${scores.rawMetrics.avgTotalKE}J`);

      if (scores.kineticPotential?.hasProjections) {
        console.log(`[4B-Engine] Kinetic Potential: Current=${scores.kineticPotential.estimatedCurrentBatSpeedMph}mph ` +
          `Ceiling=${scores.kineticPotential.projectedBatSpeedCeilingMph}mph ` +
          `Left=${scores.kineticPotential.mphLeftOnTable}mph`);
      }

    } else {
      // Fallback: use provided session_data
      const sd = body.session_data;
      const brainScore = sd?.brain_score ?? 50;
      const bodyScore = sd?.body_score ?? 50;
      const batScore = sd?.bat_score ?? 50;
      const ballScore = sd?.ball_score ?? 50;
      const groundFlow = sd?.ground_flow ?? 55;
      const coreFlow = sd?.core_flow ?? 55;
      const upperFlow = sd?.upper_flow ?? 55;
      const swingCount = sd?.swing_count ?? 1;
      const overallScore = Math.round(brainScore * 0.20 + bodyScore * 0.35 + batScore * 0.30 + ballScore * 0.15);

      // Simple leak detection for fallback
      let leakType = 'unknown', leakCaption = '', leakTraining = '';
      if (groundFlow >= 60 && coreFlow >= 60 && upperFlow >= 60) {
        leakType = 'clean_transfer';
        leakCaption = LEAK_MESSAGES[LeakType.CLEAN_TRANSFER].caption;
        leakTraining = LEAK_MESSAGES[LeakType.CLEAN_TRANSFER].training;
      } else if (groundFlow < 45) {
        leakType = 'late_legs';
        leakCaption = LEAK_MESSAGES[LeakType.LATE_LEGS].caption;
        leakTraining = LEAK_MESSAGES[LeakType.LATE_LEGS].training;
      } else if (upperFlow > groundFlow + 15) {
        leakType = 'early_arms';
        leakCaption = LEAK_MESSAGES[LeakType.EARLY_ARMS].caption;
        leakTraining = LEAK_MESSAGES[LeakType.EARLY_ARMS].training;
      }

      scores = {
        brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore,
        catchBarrelScore: overallScore,
        grades: {
          brain: getGrade(brainScore), body: getGrade(bodyScore),
          bat: getGrade(batScore), ball: getGrade(ballScore), overall: getGrade(overallScore),
        },
        components: { groundFlow, coreFlow, upperFlow },
        rawMetrics: {},
        leak: { type: leakType, caption: leakCaption, trainingMeaning: leakTraining },
        projections: {
          batSpeedCurrentMph: 0, batSpeedCeilingMph: 0,
          exitVeloCurrentMph: 0, exitVeloCeilingMph: 0,
          deliveryEfficiencyPct: 0,
          potentialDeliveryEfficiencyPct: TARGET_DELIVERY_EFFICIENCY_PCT,
          hasProjections: false,
        },
        kineticPotential: null,
        dataQuality: {
          swingCount, hasContactEvent: false, hasBatKE: false,
          batKECoverage: 0, cvScoresValid: false,
          incompleteSwings: [], warnings: ['Using provided session_data (no CSV)'],
          hasMEData: false, hasIKData: false,
        },
        swingCount,
      };
    }

    // Build session record
    const sessionRecord = {
      player_id: body.player_id,
      session_date: new Date().toISOString(),
      brain_score: scores.brain,
      body_score: scores.body,
      bat_score: scores.bat,
      ball_score: scores.ball,
      overall_score: scores.catchBarrelScore,
      brain_grade: scores.grades.brain,
      body_grade: scores.grades.body,
      bat_grade: scores.grades.bat,
      ball_grade: scores.grades.ball,
      overall_grade: scores.grades.overall,
      ground_flow: scores.components.groundFlow,
      core_flow: scores.components.coreFlow,
      upper_flow: scores.components.upperFlow,
      leak_type: scores.leak.type,
      leak_caption: scores.leak.caption,
      leak_training: scores.leak.trainingMeaning,
      swing_count: scores.swingCount,
      data_quality: scores.swingCount >= 5 ? 'good' : scores.swingCount >= 3 ? 'fair' : 'limited',
      raw_metrics: scores.rawMetrics,
      projections: scores.projections,
      kinetic_potential: scores.kineticPotential,
    };

    // Insert into player_sessions
    const { data: insertedSession, error: insertError } = await supabase
      .from('player_sessions')
      .insert(sessionRecord)
      .select()
      .single();

    if (insertError) {
      console.error('[4B-Engine] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save session', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[4B-Engine] Session saved: ${insertedSession.id}`);

    // Update reboot_sessions status to "completed"
    if (body.session_id) {
      const { error: updateError } = await supabase
        .from('reboot_sessions')
        .update({ status: 'completed' })
        .eq('reboot_session_id', body.session_id)
        .eq('player_id', body.player_id);

      if (updateError) {
        console.warn('[4B-Engine] Could not update reboot_sessions status:', updateError);
      } else {
        console.log(`[4B-Engine] Marked reboot_session ${body.session_id} as completed`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: insertedSession.id,
        scores: {
          brain: scores.brain, body: scores.body,
          bat: scores.bat, ball: scores.ball,
          overall: scores.catchBarrelScore,
        },
        grades: scores.grades,
        components: scores.components,
        leak: scores.leak,
        projections: scores.projections,
        kinetic_potential: scores.kineticPotential,
        raw_metrics: scores.rawMetrics,
        swing_count: scores.swingCount,
        data_quality: scores.dataQuality,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[4B-Engine] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
