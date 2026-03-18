/**
 * supabase/functions/compute-4b-from-csv/index.ts
 *
 * CSV PARSER ONLY — no scoring math lives here.
 *
 * Responsibility: parse Reboot Motion IK + ME CSV data,
 * normalize to ScoreCalculationInput, then call the deployed
 * calculate-4b-scores edge function via HTTP.
 *
 * v2.2 changes:
 *   - bat_omega derived from bat_rot_energy via KE inversion (I_BAT = 0.048)
 *   - Capped at MAX_BAT_OMEGA_DEGS = 2800
 *   - arm_omega from 5-frame centred finite difference (was single frame)
 *   - mass_total_kg read from ME row 0
 *   - Passes bat_omega_from_ke (not bat_omega_peak) to scoring engine
 *   - Passes measured_bat_speed_mph and measured_ev_mph when available
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// PHYSICS CONSTANTS (must match calculate-4b-scores)
// ---------------------------------------------------------------------------

const I_BAT_KGM2 = 0.048;
const MAX_BAT_OMEGA_DEGS = 2800;
const FPS = 240;
const MS_PER_FRAME = 1000 / FPS;
const RAD_TO_DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// SCORING ENGINE CALLER (delegates to calculate-4b-scores via HTTP)
// ---------------------------------------------------------------------------

async function computeScoringResult(input: ScoreCalculationInput): Promise<ScoringResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const response = await fetch(`${supabaseUrl}/functions/v1/calculate-4b-scores`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Scoring engine returned ${response.status}: ${errText.substring(0, 300)}`);
  }

  return await response.json() as ScoringResult;
}

// ---------------------------------------------------------------------------
// TYPES (inlined — edge functions cannot import from src/)
// ---------------------------------------------------------------------------

type ScoreSource   = 'reboot_csv' | 'sensor' | 'manual';
type PlayerLevel   = 'youth' | 'high_school' | 'college' | 'pro';
type ScoringMode   = 'full' | 'training';
type ScoringVersion = 'v1_legacy' | 'v2';
type FourBRating   = 'Elite' | 'Good' | 'Working' | 'Priority';

interface ScoreCalculationInput {
  source: ScoreSource;
  pelvis_omega_peak: number;
  trunk_omega_peak: number;
  arm_omega_peak: number;
  arm_omega_source?: string;
  bat_omega_from_ke?: number | null;
  measured_bat_speed_mph?: number | null;
  measured_ev_mph?: number | null;
  pelvis_omega_time: number;
  trunk_omega_time: number;
  hip_shoulder_sep_max_deg: number;
  stride_length_rel_hip: number;
  front_foot_angle_deg: number;
  load_duration_ms: number;
  launch_duration_ms: number;
  transfer_ratio: number;
  exit_velocity_mph?: number;
  launch_angle_deg?: number;
  spray_angle_deg?: number;
  hard_hit_rate?: number;
  player_level: PlayerLevel;
  motor_profile?: string;
  mass_total_kg?: number;
  bat_energy_j?: number;
  total_body_energy_j?: number;
}

interface ScoringResult {
  score_4bkrs: number;
  mode: ScoringMode;
  version: ScoringVersion;
  body: number;
  brain: number;
  bat: number;
  ball: number | null;
  rating: FourBRating;
  color: string;
  creation: number;
  transfer: number;
  transfer_ratio: number;
  timing_gap_pct: number;
  bat_speed_mph: number | null;
  exit_velocity_mph: number | null;
  predicted_bat_speed_mph?: number | null;
  predicted_exit_velocity_mph?: number | null;
  predicted_entry_bucket?: string | null;
  actual_bat_speed_mph?: number | null;
  actual_exit_velocity_mph?: number | null;
  actual_entry_bucket?: string | null;
  bat_speed_path?: string | null;
  bat_speed_confidence?: string | null;
  scoring_timestamp: string;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---------------------------------------------------------------------------
// CSV PARSING
// ---------------------------------------------------------------------------

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvRows(csvText: string): Record<string, number>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const rows: Record<string, number>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row: Record<string, number> = {};

    headers.forEach((header, index) => {
      if (!header) return;
      const raw = cols[index];
      if (raw == null || raw === '') return;
      const value = Number(raw);
      if (Number.isFinite(value)) {
        row[header] = value;
      }
    });

    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// BAT OMEGA FROM KE INVERSION (NEW — replaces position-based derivative)
// ---------------------------------------------------------------------------

/**
 * Derive bat angular velocity from bat_rot_energy using KE inversion:
 *   ω_rad = √(2 × KE / I_BAT)
 *   ω_deg = ω_rad × (180/π)
 * Cap at MAX_BAT_OMEGA_DEGS (2800 deg/s ≈ 76.5 mph).
 */
function extractBatOmegaFromKE(meRows: Record<string, number>[]): number | null {
  // Find peak bat_rot_energy across all ME rows
  let peakKE = 0;
  for (const row of meRows) {
    const ke = row['bat_rot_energy'] ?? row['bat_rotational_energy'] ?? 0;
    if (ke > peakKE) peakKE = ke;
  }

  if (peakKE <= 0) return null;

  const omega_rad = Math.sqrt(2 * peakKE / I_BAT_KGM2);
  const omega_deg = omega_rad * RAD_TO_DEG;
  const capped = Math.min(omega_deg, MAX_BAT_OMEGA_DEGS);

  console.log(`[CSV→Score] bat_rot_energy=${peakKE.toFixed(2)} J → omega=${omega_deg.toFixed(0)} deg/s → capped=${capped.toFixed(0)} deg/s`);
  return capped;
}

// ---------------------------------------------------------------------------
// ANGULAR VELOCITY — 5-FRAME CENTRED FINITE DIFFERENCE
// ---------------------------------------------------------------------------

/**
 * Compute peak angular velocity from IK joint angle timeseries
 * using 5-frame centred finite difference (2-frame stencil each side).
 *
 * @param maxOmegaDegS  physical cap — use 1200 for pelvis/torso, 3000 for arm/hand
 */
function peakAngularVelocity5Frame(
  rows: Record<string, number>[],
  columnName: string,
  maxOmegaDegS = 1200
): { peak: number; peakIdx: number } {
  const angles = rows.map(r => r[columnName] ?? 0);
  let peak = 0;
  let peakIdx = 0;

  // 5-frame centred: (angle[i+2] - angle[i-2]) / (4 × dt)
  const dt4 = 4 / FPS; // 4 frame intervals

  for (let i = 2; i < angles.length - 2; i++) {
    const omega = Math.abs((angles[i + 2] - angles[i - 2]) / dt4) * RAD_TO_DEG;
    if (omega > peak && omega <= maxOmegaDegS) {
      peak = omega;
      peakIdx = i;
    }
  }

  return { peak, peakIdx };
}

/**
 * Find the contact frame index.
 * Strategy: find the frame of peak hand speed (proxy for max-hand / contact).
 * If hand position columns aren't available, use peak pelvis omega as anchor.
 */
function findContactFrameIndex(
  rows: Record<string, number>[],
  pelvisPeakIdx: number
): number {
  // Try to find peak hand speed from position data
  const handCols = [
    { x: 'rhand_x', y: 'rhand_y', z: 'rhand_z' },
    { x: 'lhand_x', y: 'lhand_y', z: 'lhand_z' },
  ];

  let bestSpeed = 0;
  let contactIdx = pelvisPeakIdx; // fallback

  for (const { x, y, z } of handCols) {
    const hasData = rows.some(r => r[x] != null && r[x] !== 0);
    if (!hasData) continue;

    const dt = 1 / FPS;
    for (let i = 1; i < rows.length; i++) {
      const dx = (rows[i]?.[x] ?? 0) - (rows[i - 1]?.[x] ?? 0);
      const dy = (rows[i]?.[y] ?? 0) - (rows[i - 1]?.[y] ?? 0);
      const dz = (rows[i]?.[z] ?? 0) - (rows[i - 1]?.[z] ?? 0);
      const speed = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
      if (speed > bestSpeed) {
        bestSpeed = speed;
        contactIdx = i;
      }
    }
  }

  if (bestSpeed > 0) {
    console.log(`[CSV→Score] Contact frame from peak hand speed: frame ${contactIdx} (speed=${(bestSpeed * 2.23694).toFixed(1)} mph)`);
  } else {
    console.log(`[CSV→Score] No hand position data — using pelvis peak frame ${pelvisPeakIdx} as contact proxy`);
  }

  return contactIdx;
}

/**
 * Compute peak angular velocity within a delivery window using 5-frame centred diff.
 * Window defined by [startFrame, endFrame]. Max within window, capped at maxOmega.
 */
function windowedPeakAngularVelocity(
  rows: Record<string, number>[],
  columnName: string,
  startFrame: number,
  endFrame: number,
  maxOmegaDegS: number
): { peak: number; peakIdx: number } {
  const angles = rows.map(r => r[columnName] ?? 0);
  const dt4 = 4 / FPS;
  let peak = 0;
  let peakIdx = 0;

  const lo = Math.max(2, startFrame);
  const hi = Math.min(angles.length - 3, endFrame);

  for (let i = lo; i <= hi; i++) {
    const omega = Math.abs((angles[i + 2] - angles[i - 2]) / dt4) * RAD_TO_DEG;
    if (omega > peak && omega <= maxOmegaDegS) {
      peak = omega;
      peakIdx = i;
    }
  }

  return { peak, peakIdx };
}

// ---------------------------------------------------------------------------
// MASS EXTRACTION
// ---------------------------------------------------------------------------

function parseMassFromMERow(meRows: Record<string, number>[]): number {
  const raw = meRows[0]?.['masstotal'] ?? meRows[0]?.['mass_total'] ?? 0;
  if (!raw || raw <= 0 || raw > 200) {
    console.warn('[mass] mass_total missing or implausible — defaulting to 80 kg');
    return 80;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// NORMALIZE CSV → ScoreCalculationInput
// ---------------------------------------------------------------------------

function parseRebootCSV(
  ikRows: Record<string, number>[],
  meRows: Record<string, number>[],
  context: {
    player_level: PlayerLevel;
    motor_profile?: string;
    exit_velocity_mph?: number;
    launch_angle_deg?: number;
    spray_angle_deg?: number;
    hard_hit_rate?: number;
    measured_bat_speed_mph?: number | null;
    measured_ev_mph?: number | null;
  }
): ScoreCalculationInput {
  // --- Angular velocities from IK (5-frame centred finite difference) ---
  // Initial full-capture peaks (used only for fallback/magnitude)
  const pelvisOmegaFull = peakAngularVelocity5Frame(ikRows, 'pelvis_rot');
  const torsoOmegaFull  = peakAngularVelocity5Frame(ikRows, 'torso_rot');

  // --- Contact frame detection ---
  // Strategy 1: use time_from_max_hand from ME rows (most accurate — this column exists in ME, not IK)
  let contactFrameIdx = -1;
  let meContactIdx = -1;
  const meTfmh = meRows.map(r => r['time_from_max_hand'] ?? r['time_from_contact'] ?? null);
  const hasMeTfmh = meTfmh.some(v => v !== null);
  if (hasMeTfmh) {
    let minAbs = Infinity;
    for (let i = 0; i < meTfmh.length; i++) {
      if (meTfmh[i] === null) continue;
      const absVal = Math.abs(meTfmh[i]!);
      if (absVal < minAbs) {
        minAbs = absVal;
        meContactIdx = i;
      }
    }
    // ME and IK rows may have different lengths; map ME contact time to IK frame index
    // ME time_from_max_hand at contact ≈ 0; use the ME frame ratio to estimate IK contact frame
    if (meContactIdx >= 0 && meRows.length > 1 && ikRows.length > 1) {
      const meRatio = meContactIdx / (meRows.length - 1);
      contactFrameIdx = Math.round(meRatio * (ikRows.length - 1));
      console.log(`[CSV→Score] Contact frame from ME time_from_max_hand: ME_frame=${meContactIdx}/${meRows.length}, IK_frame=${contactFrameIdx}/${ikRows.length} (tfmh=${meTfmh[meContactIdx]?.toFixed(4)})`);
    }
  }
  // Strategy 2: try IK time_from_max_hand column
  if (contactFrameIdx < 0) {
    const ikTfmh = ikRows.map(r => r['time_from_max_hand'] ?? r['time_from_contact'] ?? null);
    const hasIkTfmh = ikTfmh.some(v => v !== null);
    if (hasIkTfmh) {
      let minAbs = Infinity;
      for (let i = 0; i < ikTfmh.length; i++) {
        if (ikTfmh[i] === null) continue;
        const absVal = Math.abs(ikTfmh[i]!);
        if (absVal < minAbs) {
          minAbs = absVal;
          contactFrameIdx = i;
        }
      }
      console.log(`[CSV→Score] Contact frame from IK time_from_max_hand: frame ${contactFrameIdx} (value=${ikTfmh[contactFrameIdx]?.toFixed(4)})`);
    }
  }
  // Strategy 3: fallback to peak hand speed
  if (contactFrameIdx < 0) {
    contactFrameIdx = findContactFrameIndex(ikRows, pelvisOmegaFull.peakIdx);
  }

  // --- Delivery window: -600ms to +50ms relative to contact ---
  const deliveryStart = Math.max(0, contactFrameIdx - 144); // 144 frames = 600ms at 240fps
  const deliveryEnd = Math.min(ikRows.length - 1, contactFrameIdx + 12); // 12 frames = 50ms
  console.log(`[CSV→Score] delivery window: contactFrame=${contactFrameIdx}, range=[${deliveryStart}, ${deliveryEnd}] (${deliveryEnd - deliveryStart + 1} frames)`);

  // --- Pelvis peak WITHIN delivery window (unchanged) ---
  const pelvisOmega = windowedPeakAngularVelocity(ikRows, 'pelvis_rot', deliveryStart, deliveryEnd, 1200);

  // --- Trunk peak PRE-CONTACT only: [contact-600ms, contact-2 frames] ---
  const trunkWindowEnd = Math.min(ikRows.length - 1, contactFrameIdx - 2);
  const torsoOmega  = windowedPeakAngularVelocity(ikRows, 'torso_rot', deliveryStart, trunkWindowEnd, 1200);

  // --- Pelvis/trunk omega times as time-from-contact (ms) ---
  // peakIdx is within the delivery window; subtract contactFrameIdx to get relative ms
  const final_pelvis_omega_time = (pelvisOmega.peakIdx - contactFrameIdx) * MS_PER_FRAME;
  const final_trunk_omega_time  = (torsoOmega.peakIdx - contactFrameIdx) * MS_PER_FRAME;
  const timingGapPct = Math.abs(final_pelvis_omega_time - final_trunk_omega_time) / 200 * 100;

  console.log(`[CSV→Score] TIMING: { contactFrameIndex: ${contactFrameIdx}, pelvis_omega_time_ms: ${final_pelvis_omega_time.toFixed(1)}, trunk_omega_time_ms: ${final_trunk_omega_time.toFixed(1)}, timingGapPct: ${timingGapPct.toFixed(1)} }`);

  // --- Arm omega: delivery-windowed max of 5-frame centred diff ---
  const MAX_ARM_OMEGA_DEGS = 2200;

  let armOmega = { peak: 0, peakIdx: 0 };
  let armSourceColumn = 'none';

  const armCandidateColumns = [
    'right_shoulder_rot', 'right_elbow', 'left_elbow',
    'rshoulder_rot', 'relbow_rot', 'lelbow_rot',
    'rhand_rot', 'lhand_rot',
  ];

  for (const col of armCandidateColumns) {
    const hasData = ikRows.some(r => r[col] != null && r[col] !== 0);
    if (!hasData) continue;

    const result = windowedPeakAngularVelocity(ikRows, col, deliveryStart, deliveryEnd, MAX_ARM_OMEGA_DEGS);
    console.log(`[CSV→Score] arm_omega candidate ${col}: windowed_peak=${result.peak.toFixed(1)} deg/s at frame ${result.peakIdx}`);
    if (result.peak > armOmega.peak) {
      armOmega = result;
      armSourceColumn = col;
    }
  }

  // Also try hand position speed → angular velocity proxy (WITHIN delivery window only)
  const hasRhand = ikRows.some(r => r['rhand_x'] != null && r['rhand_x'] !== 0);
  const handPrefix = hasRhand ? 'rhand' : 'lhand';
  const windowedRows = ikRows.slice(deliveryStart, deliveryEnd + 1);
  const handSpeed = peak3DSpeed(windowedRows, `${handPrefix}_x`, `${handPrefix}_y`, `${handPrefix}_z`, 25);
  if (handSpeed.speed_ms > 0) {
    const handOmega = Math.min((handSpeed.speed_ms / 0.55) * RAD_TO_DEG, MAX_ARM_OMEGA_DEGS);
    console.log(`[CSV→Score] arm_omega candidate hand_speed (windowed): ${handOmega.toFixed(1)} deg/s (${(handSpeed.speed_ms * 2.23694).toFixed(1)} mph)`);
    if (handOmega > armOmega.peak) {
      armOmega = { peak: handOmega, peakIdx: deliveryStart + handSpeed.peakIdx };
      armSourceColumn = 'hand_speed';
    }
  }

  // Fallback: torso × 1.5 if nothing worked
  if (armOmega.peak === 0) {
    armOmega.peak = Math.min(torsoOmega.peak * 1.5, MAX_ARM_OMEGA_DEGS);
    armSourceColumn = 'torso_fallback';
    console.log(`[CSV→Score] arm_omega from torso fallback: ${armOmega.peak.toFixed(1)} deg/s`);
  }

  // Hard cap
  const clampedArm = Math.min(armOmega.peak, MAX_ARM_OMEGA_DEGS);

  console.log(`[CSV→Score] arm_omega FINAL: { delivery_window_start_frame: ${deliveryStart}, delivery_window_end_frame: ${deliveryEnd}, windowed_peak_degs: ${armOmega.peak.toFixed(1)}, clamped_degs: ${clampedArm.toFixed(1)}, source_column: "${armSourceColumn}" }`);
  armOmega.peak = clampedArm;
  console.log(`[CSV→Score] ✅ FINAL arm_omega_peak=${armOmega.peak.toFixed(1)} deg/s (entering predictBatSpeed)`);

  // --- Bat omega from KE inversion ---
  const bat_omega_from_ke = extractBatOmegaFromKE(meRows);

  // --- Mass ---
  const mass_total_kg = parseMassFromMERow(meRows);

  // --- Hip-shoulder separation ---
  const xFactorPeaks = ikRows.map(r => {
    const torsoRot  = r['torso_rot']  ?? 0;
    const pelvisRot = r['pelvis_rot'] ?? 0;
    return Math.abs((torsoRot - pelvisRot) * RAD_TO_DEG);
  });
  const hip_shoulder_sep_max_deg = Math.max(...xFactorPeaks);

  // --- Transfer ratio ---
  const transfer_ratio = pelvisOmega.peak > 0 ? torsoOmega.peak / pelvisOmega.peak : 1;

  // --- Timing (load/launch durations relative to contact) ---
  const load_duration_ms   = Math.max(1, (contactFrameIdx - deliveryStart) * MS_PER_FRAME);
  const launch_duration_ms = Math.max(1, (deliveryEnd - contactFrameIdx) * MS_PER_FRAME);

  // --- Energy from ME ---
  let bat_energy_j: number | undefined;
  let total_body_energy_j: number | undefined;
  const peakBatKE = meRows.reduce((max, r) => Math.max(max, r['bat_rot_energy'] ?? r['bat_rotational_energy'] ?? 0), 0);
  if (peakBatKE > 0) bat_energy_j = peakBatKE;
  const peakTotalKE = meRows.reduce((max, r) => Math.max(max, r['total_ke'] ?? r['total_kinetic_energy'] ?? 0), 0);
  if (peakTotalKE > 0) total_body_energy_j = peakTotalKE;

  console.log(`[CSV→Score] 5-frame ω (deg/s): pelvis=${pelvisOmega.peak.toFixed(1)}, trunk=${torsoOmega.peak.toFixed(1)}, arm=${armOmega.peak.toFixed(1)}`);
  console.log(`[CSV→Score] bat_omega_from_ke=${bat_omega_from_ke ?? 'null'}, mass=${mass_total_kg}kg`);

  return {
    source: 'reboot_csv',
    pelvis_omega_peak: pelvisOmega.peak,
    trunk_omega_peak: torsoOmega.peak,
    arm_omega_peak: armOmega.peak,
    arm_omega_source: armSourceColumn,
    bat_omega_from_ke,
    measured_bat_speed_mph: context.measured_bat_speed_mph ?? null,
    measured_ev_mph: context.measured_ev_mph ?? null,
    pelvis_omega_time: final_pelvis_omega_time,
    trunk_omega_time: final_trunk_omega_time,
    hip_shoulder_sep_max_deg,
    stride_length_rel_hip: 0.85,
    front_foot_angle_deg: 20,
    load_duration_ms,
    launch_duration_ms,
    transfer_ratio,
    exit_velocity_mph:   context.exit_velocity_mph,
    launch_angle_deg:    context.launch_angle_deg,
    spray_angle_deg:     context.spray_angle_deg,
    hard_hit_rate:       context.hard_hit_rate,
    player_level:        context.player_level,
    motor_profile:       context.motor_profile,
    mass_total_kg,
    bat_energy_j,
    total_body_energy_j,
  };
}

// ---------------------------------------------------------------------------
// HELPER: 3D speed from position columns (fallback for arm omega)
// ---------------------------------------------------------------------------

function peak3DSpeed(
  rows: Record<string, number>[],
  xCol: string, yCol: string, zCol: string,
  maxSpeedMs: number
): { speed_ms: number; peakIdx: number } {
  const dt = 1 / FPS;
  const speeds: number[] = [0];

  for (let i = 1; i < rows.length; i++) {
    const dx = (rows[i]?.[xCol] ?? 0) - (rows[i - 1]?.[xCol] ?? 0);
    const dy = (rows[i]?.[yCol] ?? 0) - (rows[i - 1]?.[yCol] ?? 0);
    const dz = (rows[i]?.[zCol] ?? 0) - (rows[i - 1]?.[zCol] ?? 0);
    speeds.push(Math.sqrt(dx * dx + dy * dy + dz * dz) / dt);
  }

  // Simple 5-point smooth
  const smoothed = smooth5(speeds);
  let peak = 0;
  let peakIdx = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > peak && smoothed[i] <= maxSpeedMs) {
      peak = smoothed[i];
      peakIdx = i;
    }
  }

  return { speed_ms: peak, peakIdx };
}

function smooth5(values: number[]): number[] {
  const out: number[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - 2);
    const end = Math.min(values.length - 1, i + 2);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += values[j];
      count++;
    }
    out[i] = sum / count;
  }
  return out;
}

// ---------------------------------------------------------------------------
// BUILD RAW_METRICS for Kinetic Sequence / Stability tabs
// ---------------------------------------------------------------------------

function buildRawMetrics(input: ScoreCalculationInput, result: ScoringResult): Record<string, unknown> {
  const pelvis = input.pelvis_omega_peak;
  const torso = input.trunk_omega_peak;
  const arm = input.arm_omega_peak;

  // Gains
  const pelvis_torso_gain = pelvis > 0 ? Math.round((torso / pelvis) * 100) / 100 : null;
  const torso_arm_gain = torso > 0 ? Math.round((arm / torso) * 100) / 100 : null;
  
  // Estimate bat omega (from KE or predicted bat speed)
  const batSpeedMph = result.bat_speed_mph || result.predicted_bat_speed_mph || 0;
  // Convert mph to deg/s approximation: bat speed mph × ~30 ≈ deg/s (rough)
  const estimatedBatOmega = batSpeedMph > 0 ? batSpeedMph * 30 : arm * 1.3;
  const arm_bat_gain = arm > 0 ? Math.round((estimatedBatOmega / arm) * 100) / 100 : null;

  // Flow labels
  function flowLabel(gain: number | null): string {
    if (gain == null) return 'OK';
    if (gain >= 1.3) return 'STRONG';
    if (gain >= 1.0) return 'OK';
    return 'LOSING';
  }

  // Timing gap (pelvis → torso)
  const pelvis_torso_gap_ms = Math.round(Math.abs(input.trunk_omega_time - input.pelvis_omega_time) * 10) / 10;

  // Beat pattern
  const pelvisFirst = input.pelvis_omega_time <= input.trunk_omega_time;
  const beat = pelvisFirst ? 'Hips → Torso → Arms' : 'Torso → Hips (reversed)';

  // KE cascade timing estimates from load/launch durations
  const ke_brake_ms = Math.round(input.load_duration_ms * 0.03); // ~3% of load phase
  const ke_cascade_ms = Math.round(input.launch_duration_ms * 0.8); // ~80% of launch
  const brake_efficiency = result.transfer_efficiency != null
    ? Math.round(result.transfer_efficiency * 1000) / 1000
    : null;

  // Root cause analysis
  let rootCause: Record<string, string> = { issue: 'None detected', what: 'Swing is functioning well', build: '' };
  if (pelvis_torso_gain != null && pelvis_torso_gain < 1.0) {
    rootCause = {
      issue: 'Energy Loss: Hip → Torso',
      what: 'Torso is not amplifying hip rotation. Energy is dying at the core.',
      build: 'Core connection drills — medicine ball rotations, plank anti-rotation holds, hip-lead sequencing.',
    };
  } else if (torso_arm_gain != null && torso_arm_gain < 1.0) {
    rootCause = {
      issue: 'Energy Loss: Torso → Arms',
      what: 'Arm action is decoupled from trunk rotation. Upper body is casting.',
      build: 'Connection drills — knob-to-ball, short bat work, towel drills for lag.',
    };
  } else if (arm_bat_gain != null && arm_bat_gain < 1.0) {
    rootCause = {
      issue: 'Energy Loss: Arms → Barrel',
      what: 'Bat head is not releasing through the zone. Wrist snap is weak or early.',
      build: 'Wrist snap drills, overload/underload training, bat path work.',
    };
  } else if (pelvis_torso_gap_ms < 10) {
    rootCause = {
      issue: 'Timing: Simultaneous Rotation',
      what: 'Hips and torso are firing together instead of sequentially.',
      build: 'Separation drills — stride & hold, wall drills, hip-lead tempo work.',
    };
  }

  // Energy flow
  const energyFlow = {
    hip_to_body: flowLabel(pelvis_torso_gain),
    body_to_arms: flowLabel(torso_arm_gain),
    arms_to_barrel: flowLabel(arm_bat_gain),
  };

  // Coaching story
  const story: Record<string, string> = {};
  story.base = `Pelvis peak velocity: ${Math.round(pelvis)}°/s. ${
    pelvis >= 600 ? 'Strong foundation.' : 'Below target — needs more ground-force production.'
  }`;
  story.rhythm = `Pelvis→Torso gap: ${pelvis_torso_gap_ms}ms. ${
    pelvis_torso_gap_ms >= 14 ? 'Good sequential timing.' : 'Gap is tight — work on separation.'
  }`;
  story.barrel = `Estimated bat speed: ${batSpeedMph > 0 ? Math.round(batSpeedMph) + ' mph' : 'N/A'}. Transfer ratio: ${input.transfer_ratio.toFixed(2)}.`;

  return {
    avgPelvisVelocity: Math.round(pelvis),
    pelvis_torso_gain,
    torso_arm_gain,
    arm_bat_gain,
    pelvis_torso_gap_ms,
    beat,
    ke_brake_ms,
    ke_cascade_ms,
    brake_efficiency,
    root_cause: rootCause,
    energy_flow: energyFlow,
    story,
    // Additional raw data for other tabs
    torso_velocity: Math.round(torso),
    arm_velocity: Math.round(arm),
    x_factor_deg: Math.round(input.hip_shoulder_sep_max_deg),
    transfer_ratio: Math.round(input.transfer_ratio * 1000) / 1000,
    timing_gap_pct: result.timing_gap_pct,
    transfer_efficiency: result.transfer_efficiency,
    bat_speed_mph: result.bat_speed_mph || result.predicted_bat_speed_mph,
    exit_velocity_mph: result.exit_velocity_mph || result.predicted_exit_velocity_mph,
  };
}

// ---------------------------------------------------------------------------
// EDGE FUNCTION HANDLER
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      ik_csv_rows,
      me_csv_rows,
      raw_csv_ik,
      raw_csv_me,
      player_level = 'pro',
      motor_profile,
      exit_velocity_mph,
      launch_angle_deg,
      spray_angle_deg,
      hard_hit_rate,
      measured_bat_speed_mph,
      measured_ev_mph,
      session_id,
      player_id,
      session_date,
    } = body;

    const ikRows: Record<string, number>[] = Array.isArray(ik_csv_rows)
      ? ik_csv_rows
      : typeof raw_csv_ik === 'string'
        ? parseCsvRows(raw_csv_ik)
        : [];

    const meRows: Record<string, number>[] = Array.isArray(me_csv_rows)
      ? me_csv_rows
      : typeof raw_csv_me === 'string'
        ? parseCsvRows(raw_csv_me)
        : [];

    if (ikRows.length === 0 || meRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Provide either ik_csv_rows/me_csv_rows arrays or raw_csv_ik/raw_csv_me strings' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPlayerLevel: PlayerLevel =
      player_level === 'youth' || player_level === 'high_school' || player_level === 'college' || player_level === 'pro'
        ? player_level
        : 'pro';

    // 1. Normalize CSV → ScoreCalculationInput
    const input: ScoreCalculationInput = parseRebootCSV(
      ikRows,
      meRows,
      {
        player_level: normalizedPlayerLevel,
        motor_profile,
        exit_velocity_mph,
        launch_angle_deg,
        spray_angle_deg,
        hard_hit_rate,
        measured_bat_speed_mph: measured_bat_speed_mph ?? null,
        measured_ev_mph: measured_ev_mph ?? null,
      }
    );

    // 2. Score — HTTP call to shared engine
    const result = await computeScoringResult(input);

    // 2b. Build raw_metrics for Kinetic Sequence / Stability tabs
    const rawMetrics = buildRawMetrics(input, result);

    // 3. Persist to player_sessions if session context provided
    if (session_id && player_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const sessionPayload = {
        player_id,
        reboot_session_id: session_id,
        session_date: session_date ?? new Date().toISOString(),
        overall_score: result.score_4bkrs,
        score_4bkrs: result.score_4bkrs,
        scoring_mode: result.mode,
        scoring_version: result.version,
        body_score: result.body,
        brain_score: result.brain,
        bat_score: result.bat,
        ball_score: result.ball,
        creation_score: result.creation,
        transfer_score: result.transfer,
        rating: result.rating,
        rating_color: result.color,
        transfer_ratio: result.transfer_ratio,
        timing_gap_pct: result.timing_gap_pct,
        bat_speed_mph: result.bat_speed_mph,
        exit_velocity_mph: result.exit_velocity_mph,
        predicted_bat_speed_mph: result.predicted_bat_speed_mph,
        predicted_exit_velocity_mph: result.predicted_exit_velocity_mph,
        predicted_entry_bucket: result.predicted_entry_bucket,
        actual_bat_speed_mph: result.actual_bat_speed_mph,
        actual_exit_velocity_mph: result.actual_exit_velocity_mph,
        actual_entry_bucket: result.actual_entry_bucket,
        bat_speed_source: result.bat_speed_path,
        bat_speed_confidence: result.bat_speed_confidence,
        scoring_timestamp: result.scoring_timestamp,
        scored_at: new Date().toISOString(),
        raw_metrics: rawMetrics,
      };

      let playerSessionId: string | null = null;

      const { data: existingSession, error: fetchSessionError } = await supabase
        .from('player_sessions')
        .select('id')
        .eq('player_id', player_id)
        .eq('reboot_session_id', session_id)
        .maybeSingle();

      if (fetchSessionError) {
        console.error('[compute-4b-from-csv] Failed to find existing player_session:', fetchSessionError);
      }

      if (existingSession?.id) {
        playerSessionId = existingSession.id;
        const { error: updateError } = await supabase
          .from('player_sessions')
          .update(sessionPayload)
          .eq('id', existingSession.id);

        if (updateError) {
          console.error('[compute-4b-from-csv] DB update error:', updateError);
        }
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from('player_sessions')
          .insert(sessionPayload)
          .select('id')
          .single();

        if (insertError) {
          console.error('[compute-4b-from-csv] DB insert error:', insertError);
        }
        if (insertedData) {
          playerSessionId = insertedData.id;
        }
      }

      // ── Session Linking: auto-pair with video_2d_sessions on same date ──
      const sessionDateStr = (session_date ?? new Date().toISOString()).substring(0, 10);
      const playerSessionId = existingSession?.id;
      
      if (playerSessionId) {
        try {
          // Find video_2d_sessions for same player on same date
          const { data: matchingVideos } = await supabase
            .from('video_2d_sessions')
            .select('id')
            .eq('player_id', player_id)
            .gte('session_date', sessionDateStr)
            .lt('session_date', sessionDateStr + 'T23:59:59')
            .eq('processing_status', 'complete')
            .limit(1);

          if (matchingVideos && matchingVideos.length > 0) {
            const videoId = matchingVideos[0].id;
            
            // Link player_sessions → video_2d_session
            await supabase
              .from('player_sessions')
              .update({ video_2d_session_id: videoId })
              .eq('id', playerSessionId);

            // Link video_2d_batch_sessions → reboot via batch_session_id lookup
            const { data: videoSession } = await supabase
              .from('video_2d_sessions')
              .select('batch_session_id')
              .eq('id', videoId)
              .maybeSingle();

            if (videoSession?.batch_session_id) {
              await supabase
                .from('video_2d_batch_sessions')
                .update({ reboot_session_id: session_id })
                .eq('id', videoSession.batch_session_id);
            }

            console.log(`[compute-4b] Linked player_session ${playerSessionId} ↔ video ${videoId} (date: ${sessionDateStr})`);
          }
        } catch (linkErr) {
          console.warn('[compute-4b] Session linking failed:', linkErr);
        }
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[compute-4b-from-csv] Error:', err);
    return new Response(
      JSON.stringify({ error: 'CSV scoring error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
