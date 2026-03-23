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

  const raw = await response.json();

  // calculate-4b-scores v2 returns scores nested under legacy_4b + scores.*
  // Flatten into the ScoringResult shape expected downstream
  const legacy = raw.legacy_4b ?? {};
  const scores = raw.scores ?? {};
  const gf = scores.ground_flow ?? {};
  const cf = scores.core_flow ?? {};
  const af = scores.arm_flow ?? {};

  return {
    score_4bkrs: legacy.score_4bkrs ?? raw.score_4bkrs ?? 0,
    mode: raw.scoring_method === 'ik_fallback' ? 'training' : 'full',
    version: raw.version ?? 'v2',
    body: legacy.body ?? gf.score ?? 0,
    brain: legacy.brain ?? cf.score ?? 0,
    bat: legacy.bat ?? af.score ?? 0,
    ball: legacy.ball ?? null,
    rating: legacy.rating ?? raw.rating ?? 'Working',
    color: legacy.color ?? raw.color ?? '#888',
    creation: gf.score ?? legacy.body ?? 0,
    transfer: cf.score ?? legacy.brain ?? 0,
    transfer_ratio: raw.energy_ledger?.transfer_ratio ?? cf.components?.transfer_ratio ?? 0,
    timing_gap_pct: raw.energy_ledger?.p_to_t_gap_ms ?? cf.components?.timing_gap_pct ?? 0,
    bat_speed_mph: raw.bat_speed_mph ?? null,
    exit_velocity_mph: raw.exit_velocity_mph ?? null,
    predicted_bat_speed_mph: raw.predicted_bat_speed_mph ?? raw.predictions?.predicted_bat_speed_mph ?? null,
    predicted_exit_velocity_mph: raw.predicted_exit_velocity_mph ?? raw.predictions?.predicted_exit_velocity_mph ?? null,
    predicted_entry_bucket: raw.predicted_entry_bucket ?? null,
    actual_bat_speed_mph: raw.actual_bat_speed_mph ?? null,
    actual_exit_velocity_mph: raw.actual_exit_velocity_mph ?? null,
    actual_entry_bucket: raw.actual_entry_bucket ?? null,
    bat_speed_path: raw.bat_speed_path ?? raw.predictions?.bat_speed_path ?? null,
    bat_speed_confidence: raw.bat_speed_confidence ?? raw.predictions?.bat_speed_confidence ?? null,
    scoring_timestamp: raw.scoring_timestamp ?? new Date().toISOString(),
  } as ScoringResult;
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

// Columns actually used by the scoring engine — only parse these to save memory
const NEEDED_COLUMNS = new Set([
  'pelvis_rot', 'torso_rot', 'torso_side',
  'right_elbow', 'left_elbow', 'r_elbow', 'relbow', 'relbow_rot', 'lelbow_rot',
  'right_shoulder_rot', 'rshoulder_rot', 'rhand_rot', 'lhand_rot',
  'rhand_x', 'rhand_y', 'rhand_z', 'lhand_x', 'lhand_y', 'lhand_z',
  'left_knee', 'right_knee',
  'time', 'time_from_max_hand', 'time_from_contact',
  'org_movement_id', 'movement_id',
  'bat_rot_energy', 'bat_rotational_energy',
  'bat_kinetic_energy', 'arms_kinetic_energy', 'arms_ke',
  'torso_kinetic_energy', 'total_kinetic_energy', 'total_ke',
  'lowerhalf_kinetic_energy', 'pelvis_ke', 'pelvis_kinetic_energy',
  'legs_kinetic_energy', 'upperhalf_kinetic_energy', 'upperlimb_kinetic_energy',
  'mass_total', 'masstotal',
  'lowertorso_angular_momentum_mag', 'pelvis_angular_momentum', 'lowertorso_angmom_mag',
  'torso_angular_momentum_mag', 'uppertorso_angular_momentum_mag', 'torso_angmom_mag',
]);

function parseCsvRows(csvText: string): Record<string, number>[] {
  if (!csvText || csvText.length === 0) return [];

  const rows: Record<string, number>[] = [];
  let keepIndices: { idx: number; name: string }[] | null = null;

  let cursor = 0;
  const len = csvText.length;

  while (cursor <= len) {
    let nextNewline = csvText.indexOf('\n', cursor);
    if (nextNewline === -1) nextNewline = len;

    let line = csvText.slice(cursor, nextNewline);
    cursor = nextNewline + 1;

    if (line.endsWith('\r')) line = line.slice(0, -1);
    line = line.trim();
    if (line.length === 0) continue;

    if (!keepIndices) {
      const headers = splitCsvLine(line).map((header) => header.toLowerCase());
      const computedKeepIndices: { idx: number; name: string }[] = [];
      headers.forEach((header, index) => {
        if (header && NEEDED_COLUMNS.has(header)) {
          computedKeepIndices.push({ idx: index, name: header });
        }
      });
      keepIndices = computedKeepIndices;
      if (keepIndices.length === 0) return [];
      continue;
    }

    const cols = splitCsvLine(line);
    const row: Record<string, number> = {};
    let hasNumericValue = false;

    for (const { idx, name } of keepIndices) {
      const raw = cols[idx];
      if (raw == null || raw === '') continue;
      const value = Number(raw);
      if (Number.isFinite(value)) {
        row[name] = value;
        hasNumericValue = true;
      }
    }

    if (hasNumericValue) {
      rows.push(row);
    }
  }

  return keepIndices ? rows : [];
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
  let peak = 0;
  let peakIdx = 0;

  // 5-frame centred: (angle[i+2] - angle[i-2]) / (4 × dt)
  const dt4 = 4 / FPS; // 4 frame intervals

  for (let i = 2; i < rows.length - 2; i++) {
    const next2 = rows[i + 2]?.[columnName] ?? 0;
    const prev2 = rows[i - 2]?.[columnName] ?? 0;
    const omega = Math.abs((next2 - prev2) / dt4) * RAD_TO_DEG;
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
  const dt4 = 4 / FPS;
  let peak = 0;
  let peakIdx = 0;

  const lo = Math.max(2, startFrame);
  const hi = Math.min(rows.length - 3, endFrame);

  for (let i = lo; i <= hi; i++) {
    const next2 = rows[i + 2]?.[columnName] ?? 0;
    const prev2 = rows[i - 2]?.[columnName] ?? 0;
    const omega = Math.abs((next2 - prev2) / dt4) * RAD_TO_DEG;
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

interface ParseResult {
  input: ScoreCalculationInput;
  contactFrameIdx: number;
}

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
): ParseResult {
  // --- Angular velocities from IK (5-frame centred finite difference) ---
  // Initial full-capture peaks (used only for fallback/magnitude)
  const pelvisOmegaFull = peakAngularVelocity5Frame(ikRows, 'pelvis_rot');
  const torsoOmegaFull  = peakAngularVelocity5Frame(ikRows, 'torso_rot');

  // --- Contact frame detection ---
  // Strategy 1: use time_from_max_hand from ME rows (most accurate — this column exists in ME, not IK)
  let contactFrameIdx = -1;
  let meContactIdx = -1;
  let meContactValue: number | null = null;
  let minAbsMe = Infinity;
  for (let i = 0; i < meRows.length; i++) {
    const tfmh = meRows[i]['time_from_max_hand'] ?? meRows[i]['time_from_contact'];
    if (tfmh == null) continue;
    const absVal = Math.abs(tfmh);
    if (absVal < minAbsMe) {
      minAbsMe = absVal;
      meContactIdx = i;
      meContactValue = tfmh;
    }
  }
  // ME and IK rows may have different lengths; map ME contact time to IK frame index
  // ME time_from_max_hand at contact ≈ 0; use the ME frame ratio to estimate IK contact frame
  if (meContactIdx >= 0 && meRows.length > 1 && ikRows.length > 1) {
    const meRatio = meContactIdx / (meRows.length - 1);
    contactFrameIdx = Math.round(meRatio * (ikRows.length - 1));
    console.log(`[CSV→Score] Contact frame from ME time_from_max_hand: ME_frame=${meContactIdx}/${meRows.length}, IK_frame=${contactFrameIdx}/${ikRows.length} (tfmh=${meContactValue?.toFixed(4)})`);
  }
  // Strategy 2: try IK time_from_max_hand column
  if (contactFrameIdx < 0) {
    let minAbsIk = Infinity;
    let ikContactValue: number | null = null;
    for (let i = 0; i < ikRows.length; i++) {
      const tfmh = ikRows[i]['time_from_max_hand'] ?? ikRows[i]['time_from_contact'];
      if (tfmh == null) continue;
      const absVal = Math.abs(tfmh);
      if (absVal < minAbsIk) {
        minAbsIk = absVal;
        contactFrameIdx = i;
        ikContactValue = tfmh;
      }
    }
    if (contactFrameIdx >= 0) {
      console.log(`[CSV→Score] Contact frame from IK time_from_max_hand: frame ${contactFrameIdx} (value=${ikContactValue?.toFixed(4)})`);
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
  // Delivery window = actual foot plant to contact duration (Section E appendix)
  // DO NOT use hardcoded 200ms — calculate per swing
  const deliveryDurationMs = Math.max(1, contactFrameIdx * MS_PER_FRAME - (deliveryStart * MS_PER_FRAME));
  const effectiveDeliveryWindow = deliveryDurationMs > 0 ? deliveryDurationMs : 200; // fallback only if no data
  const timingGapPct = Math.abs(final_pelvis_omega_time - final_trunk_omega_time) / effectiveDeliveryWindow * 100;

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
  const handSpeed = peak3DSpeedInRange(
    ikRows,
    `${handPrefix}_x`,
    `${handPrefix}_y`,
    `${handPrefix}_z`,
    deliveryStart,
    deliveryEnd,
    25
  );
  if (handSpeed.speed_ms > 0) {
    const handOmega = Math.min((handSpeed.speed_ms / 0.55) * RAD_TO_DEG, MAX_ARM_OMEGA_DEGS);
    console.log(`[CSV→Score] arm_omega candidate hand_speed (windowed): ${handOmega.toFixed(1)} deg/s (${(handSpeed.speed_ms * 2.23694).toFixed(1)} mph)`);
    if (handOmega > armOmega.peak) {
      armOmega = { peak: handOmega, peakIdx: handSpeed.peakIdx };
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
  let hip_shoulder_sep_max_deg = 0;
  for (const r of ikRows) {
    const torsoRot  = r['torso_rot']  ?? 0;
    const pelvisRot = r['pelvis_rot'] ?? 0;
    const sep = Math.abs((torsoRot - pelvisRot) * RAD_TO_DEG);
    if (sep > hip_shoulder_sep_max_deg) hip_shoulder_sep_max_deg = sep;
  }

  // --- Transfer ratio ---
  const transfer_ratio = pelvisOmega.peak > 0 ? torsoOmega.peak / pelvisOmega.peak : 1;

  // --- Timing (load/launch durations relative to contact) ---
  const load_duration_ms   = Math.max(1, (contactFrameIdx - deliveryStart) * MS_PER_FRAME);
  const launch_duration_ms = Math.max(1, (deliveryEnd - contactFrameIdx) * MS_PER_FRAME);

  // --- Energy from ME ---
  let bat_energy_j: number | undefined;
  let total_body_energy_j: number | undefined;
  let peakBatKE = 0;
  let peakTotalKE = 0;
  for (const r of meRows) {
    const batKE = r['bat_rot_energy'] ?? r['bat_rotational_energy'] ?? 0;
    if (batKE > peakBatKE) peakBatKE = batKE;

    const totalKE = r['total_ke'] ?? r['total_kinetic_energy'] ?? 0;
    if (totalKE > peakTotalKE) peakTotalKE = totalKE;
  }
  if (peakBatKE > 0) bat_energy_j = peakBatKE;
  if (peakTotalKE > 0) total_body_energy_j = peakTotalKE;

  console.log(`[CSV→Score] 5-frame ω (deg/s): pelvis=${pelvisOmega.peak.toFixed(1)}, trunk=${torsoOmega.peak.toFixed(1)}, arm=${armOmega.peak.toFixed(1)}`);
  console.log(`[CSV→Score] bat_omega_from_ke=${bat_omega_from_ke ?? 'null'}, mass=${mass_total_kg}kg`);

  return {
    input: {
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
    },
    contactFrameIdx,
  };
}

// ---------------------------------------------------------------------------
// SWING DURATION GATING — classify swings before scoring
// ---------------------------------------------------------------------------

type SwingClassification = 'competitive' | 'load_overweight' | 'walkthrough' | 'partial_capture' | 'unknown';

interface DurationGateResult {
  swing_duration_ms: number;
  classification: SwingClassification;
  scoreable: boolean;
}

/**
 * Calculate swing duration from IK data and classify the swing.
 * Duration = time from first frame to frame of max dominant hand velocity (contact proxy).
 * 
 * Rules:
 *   duration > 550ms AND r_elbow at contact < 50° → "load_overweight", scoreable=false
 *   duration > 600ms → "walkthrough", scoreable=false
 *   duration < 200ms → "partial_capture", scoreable=false
 *   200-550ms → "competitive", scoreable=true
 */
function classifySwingDuration(
  ikRows: Record<string, number>[],
  contactFrameIdx: number
): DurationGateResult {
  if (ikRows.length === 0) {
    return { swing_duration_ms: 0, classification: 'unknown', scoreable: true };
  }

  // Duration = frames from start to contact × ms_per_frame
  const durationMs = contactFrameIdx * MS_PER_FRAME;
  
  console.log(`[Duration Gate] frames=${ikRows.length}, contactFrame=${contactFrameIdx}, duration=${durationMs.toFixed(0)}ms`);

  // Check for partial capture first (200ms minimum — typical competitive swings are 250-400ms)
  if (durationMs < 200) {
    console.log(`[Duration Gate] PARTIAL_CAPTURE: ${durationMs.toFixed(0)}ms < 200ms`);
    return { swing_duration_ms: durationMs, classification: 'partial_capture', scoreable: false };
  }

  // Check walkthrough (> 600ms always)
  if (durationMs > 600) {
    console.log(`[Duration Gate] WALKTHROUGH: ${durationMs.toFixed(0)}ms > 600ms`);
    return { swing_duration_ms: durationMs, classification: 'walkthrough', scoreable: false };
  }

  // Check load/overweight (> 550ms AND elbow angle < 50°)
  if (durationMs > 550) {
    // Check r_elbow angle at contact frame
    const elbowAngle = ikRows[contactFrameIdx]?.['r_elbow'] ?? 
                        ikRows[contactFrameIdx]?.['relbow'] ?? 
                        ikRows[contactFrameIdx]?.['right_elbow'] ?? 999;
    const elbowDeg = Math.abs(elbowAngle * RAD_TO_DEG);
    
    console.log(`[Duration Gate] Checking load: duration=${durationMs.toFixed(0)}ms, r_elbow_at_contact=${elbowDeg.toFixed(1)}°`);
    
    if (elbowDeg < 50) {
      console.log(`[Duration Gate] LOAD_OVERWEIGHT: ${durationMs.toFixed(0)}ms > 550ms AND elbow ${elbowDeg.toFixed(1)}° < 50°`);
      return { swing_duration_ms: durationMs, classification: 'load_overweight', scoreable: false };
    }
    // If elbow >= 50°, it might still be competitive despite being 550-600ms
    // Fall through to competitive
  }

  console.log(`[Duration Gate] COMPETITIVE: ${durationMs.toFixed(0)}ms`);
  return { swing_duration_ms: durationMs, classification: 'competitive', scoreable: true };
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

function peak3DSpeedInRange(
  rows: Record<string, number>[],
  xCol: string,
  yCol: string,
  zCol: string,
  startIdx: number,
  endIdx: number,
  maxSpeedMs: number
): { speed_ms: number; peakIdx: number } {
  const lo = Math.max(0, startIdx);
  const hi = Math.min(rows.length - 1, endIdx);
  if (hi <= lo) return { speed_ms: 0, peakIdx: lo };

  const dt = 1 / FPS;
  const speeds = new Array<number>(hi - lo + 1).fill(0);

  for (let globalIdx = lo + 1; globalIdx <= hi; globalIdx++) {
    const prev = rows[globalIdx - 1];
    const curr = rows[globalIdx];
    const dx = (curr?.[xCol] ?? 0) - (prev?.[xCol] ?? 0);
    const dy = (curr?.[yCol] ?? 0) - (prev?.[yCol] ?? 0);
    const dz = (curr?.[zCol] ?? 0) - (prev?.[zCol] ?? 0);
    speeds[globalIdx - lo] = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
  }

  const smoothed = smooth5(speeds);
  let peak = 0;
  let peakLocalIdx = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] > peak && smoothed[i] <= maxSpeedMs) {
      peak = smoothed[i];
      peakLocalIdx = i;
    }
  }

  return { speed_ms: peak, peakIdx: lo + peakLocalIdx };
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
// PER-SWING HELPERS (grouped by org_movement_id)
// ---------------------------------------------------------------------------

/** Group rows by org_movement_id. Returns map of id → rows */
function groupBySwing(rows: Record<string, number>[]): Map<number, Record<string, number>[]> {
  const map = new Map<number, Record<string, number>[]>();
  for (const row of rows) {
    const id = row['org_movement_id'] ?? row['movement_id'] ?? 0;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(row);
  }
  return map;
}

/** Filter rows to delivery window (time_from_max_hand >= -0.600) */
function deliveryWindow(rows: Record<string, number>[]): Record<string, number>[] {
  const tfmhCol = rows.some(r => r['time_from_max_hand'] != null) ? 'time_from_max_hand' : 'time_from_contact';
  const hasCol = rows.some(r => r[tfmhCol] != null);
  if (!hasCol) return rows; // fallback: use all rows
  return rows.filter(r => (r[tfmhCol] ?? -999) >= -0.600);
}

/** Find peak value of a column within rows */
function peakValue(rows: Record<string, number>[], ...cols: string[]): number {
  let peak = 0;
  for (const row of rows) {
    for (const col of cols) {
      const v = row[col];
      if (v != null && v > peak) peak = v;
    }
  }
  return peak;
}

interface PerSwingKEResult {
  pelvis_ke: number | null;
  arms_ke: number | null;
  total_ke: number | null;
  arms_ke_pct: number | null;
  swing_count: number;
}

function computePerSwingKE(meRows: Record<string, number>[]): PerSwingKEResult {
  try {
    const swings = groupBySwing(meRows);
    const swingCount = swings.size;
    if (swingCount === 0) return { pelvis_ke: null, arms_ke: null, total_ke: null, arms_ke_pct: null, swing_count: 0 };

    let sumPelvisKE = 0, countPelvis = 0;
    let sumArmsKE = 0, countArms = 0;
    let sumTotalKE = 0, countTotal = 0;

    for (const [, rows] of swings) {
      const dw = deliveryWindow(rows);
      if (dw.length === 0) continue;

      const pke = peakValue(dw, 'pelvis_ke', 'lowerhalf_kinetic_energy', 'pelvis_kinetic_energy');
      if (pke > 0) { sumPelvisKE += pke; countPelvis++; }

      const ake = peakValue(dw, 'arms_kinetic_energy', 'arms_ke', 'upperlimb_kinetic_energy');
      if (ake > 0) { sumArmsKE += ake; countArms++; }

      // total_ke: try direct column, else sum segments
      let tke = peakValue(dw, 'total_kinetic_energy', 'total_ke');
      if (tke <= 0) {
        // Sum segments at each frame, take peak
        let maxSum = 0;
        for (const r of dw) {
          const s = (r['lowerhalf_kinetic_energy'] ?? r['pelvis_ke'] ?? 0)
            + (r['upperhalf_kinetic_energy'] ?? r['torso_kinetic_energy'] ?? 0)
            + (r['arms_kinetic_energy'] ?? r['arms_ke'] ?? 0)
            + (r['bat_kinetic_energy'] ?? r['bat_rot_energy'] ?? 0);
          if (s > maxSum) maxSum = s;
        }
        tke = maxSum;
      }
      if (tke > 0) { sumTotalKE += tke; countTotal++; }
    }

    const pelvis_ke = countPelvis > 0 ? Math.round((sumPelvisKE / countPelvis) * 10) / 10 : null;
    const arms_ke = countArms > 0 ? Math.round((sumArmsKE / countArms) * 10) / 10 : null;
    const total_ke = countTotal > 0 ? Math.round((sumTotalKE / countTotal) * 10) / 10 : null;
    const arms_ke_pct = (arms_ke != null && total_ke != null && total_ke > 0)
      ? Math.round((arms_ke / total_ke) * 1000) / 10
      : null;

    console.log(`[KE] swings=${swingCount} pelvis_ke=${pelvis_ke} arms_ke=${arms_ke} total_ke=${total_ke} arms_ke_pct=${arms_ke_pct}`);
    return { pelvis_ke, arms_ke, total_ke, arms_ke_pct, swing_count: swingCount };
  } catch (err) {
    console.error('[KE] Per-swing KE computation failed:', err);
    return { pelvis_ke: null, arms_ke: null, total_ke: null, arms_ke_pct: null, swing_count: 0 };
  }
}

/** Trunk tilt at contact from IK CSV torso_side column */
function computeTrunkTiltContact(ikRows: Record<string, number>[], meRows: Record<string, number>[]): number | null {
  try {
    const hasCol = ikRows.some(r => r['torso_side'] != null);
    if (!hasCol) return null;

    const swingsIK = groupBySwing(ikRows);
    const swingsME = groupBySwing(meRows);
    let sumTilt = 0, count = 0;

    // For each swing, find the contact frame (time_from_max_hand closest to 0)
    for (const [swingId, meSwingRows] of swingsME) {
      const ikSwingRows = swingsIK.get(swingId);
      if (!ikSwingRows) continue;

      // Find contact index in IK rows for this swing
      const ikTfmh = ikSwingRows.map(r => r['time_from_max_hand'] ?? r['time_from_contact'] ?? null);
      let contactIdx = -1;
      let minAbs = Infinity;
      for (let i = 0; i < ikTfmh.length; i++) {
        if (ikTfmh[i] === null) continue;
        const a = Math.abs(ikTfmh[i]!);
        if (a < minAbs) { minAbs = a; contactIdx = i; }
      }

      // Fallback: use ME contact ratio
      if (contactIdx < 0) {
        const meTfmh = meSwingRows.map(r => r['time_from_max_hand'] ?? null);
        let meContactIdx = -1;
        let meMinAbs = Infinity;
        for (let i = 0; i < meTfmh.length; i++) {
          if (meTfmh[i] === null) continue;
          const a = Math.abs(meTfmh[i]!);
          if (a < meMinAbs) { meMinAbs = a; meContactIdx = i; }
        }
        if (meContactIdx >= 0 && meSwingRows.length > 1 && ikSwingRows.length > 1) {
          contactIdx = Math.round((meContactIdx / (meSwingRows.length - 1)) * (ikSwingRows.length - 1));
        }
      }

      if (contactIdx < 0 || contactIdx >= ikSwingRows.length) continue;
      const torsoSideRad = ikSwingRows[contactIdx]['torso_side'];
      if (torsoSideRad == null) continue;

      const tiltDeg = Math.abs(torsoSideRad) * RAD_TO_DEG;
      sumTilt += tiltDeg;
      count++;
    }

    if (count === 0) {
      // Fallback: use global contact frame approach
      const tfmh = ikRows.map(r => r['time_from_max_hand'] ?? r['time_from_contact'] ?? null);
      let contactIdx = -1;
      let minAbs = Infinity;
      for (let i = 0; i < tfmh.length; i++) {
        if (tfmh[i] === null) continue;
        const a = Math.abs(tfmh[i]!);
        if (a < minAbs) { minAbs = a; contactIdx = i; }
      }
      if (contactIdx >= 0 && ikRows[contactIdx]['torso_side'] != null) {
        return Math.round(Math.abs(ikRows[contactIdx]['torso_side']) * RAD_TO_DEG * 10) / 10;
      }
      return null;
    }

    return Math.round((sumTilt / count) * 10) / 10;
  } catch (err) {
    console.error('[TrunkTilt] Computation failed:', err);
    return null;
  }
}

/** TKE shape classification */
function classifyTKEShape(meRows: Record<string, number>[]): string | null {
  try {
    const swings = groupBySwing(meRows);
    if (swings.size === 0) return null;

    const classifications: string[] = [];

    for (const [, rows] of swings) {
      const dw = deliveryWindow(rows);
      if (dw.length < 5) continue;

      // Read total KE values
      let tkeValues = dw.map(r => r['total_kinetic_energy'] ?? r['total_ke'] ?? 0);

      // 5-point moving average smoothing
      const smoothed: number[] = [];
      for (let i = 0; i < tkeValues.length; i++) {
        const start = Math.max(0, i - 2);
        const end = Math.min(tkeValues.length - 1, i + 2);
        let sum = 0, cnt = 0;
        for (let j = start; j <= end; j++) { sum += tkeValues[j]; cnt++; }
        smoothed.push(sum / cnt);
      }
      tkeValues = smoothed;

      const globalMax = Math.max(...tkeValues);
      if (globalMax <= 0) continue;

      // Find local maxima
      const peaks: { idx: number; val: number }[] = [];
      for (let i = 1; i < tkeValues.length - 1; i++) {
        if (tkeValues[i] > tkeValues[i - 1] && tkeValues[i] > tkeValues[i + 1]) {
          peaks.push({ idx: i, val: tkeValues[i] });
        }
      }

      // Filter minor peaks (< 60% of global max)
      const significantPeaks = peaks.filter(p => p.val >= globalMax * 0.60);

      // Check for plateau: region within 95% of max spans > 50ms (12 frames at 240fps)
      const plateauThreshold = globalMax * 0.95;
      let plateauFrames = 0;
      for (const v of tkeValues) {
        if (v >= plateauThreshold) plateauFrames++;
      }
      if (plateauFrames > 12) {
        classifications.push('plateau');
        continue;
      }

      if (significantPeaks.length <= 1) {
        classifications.push('single_spike');
      } else {
        classifications.push('double_bump');
      }
    }

    if (classifications.length === 0) return null;

    // Mode, prefer double_bump on tie
    const counts: Record<string, number> = {};
    for (const c of classifications) counts[c] = (counts[c] ?? 0) + 1;
    let best = '';
    let bestCount = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > bestCount || (v === bestCount && k === 'double_bump')) {
        best = k;
        bestCount = v;
      }
    }
    console.log(`[TKE Shape] classifications=${JSON.stringify(counts)} → ${best}`);
    return best;
  } catch (err) {
    console.error('[TKE Shape] Classification failed:', err);
    return null;
  }
}

/** Per-swing correct sequence count */
function computeCorrectSequenceCount(meRows: Record<string, number>[]): number {
  try {
    const swings = groupBySwing(meRows);
    let correctCount = 0;

    for (const [, rows] of swings) {
      const dw = deliveryWindow(rows);
      if (dw.length < 3) continue;

      // Find time of peak pelvis angular momentum
      let pelvisPeakTime = -Infinity;
      let pelvisPeakVal = 0;
      let torsoPeakTime = -Infinity;
      let torsoPeakVal = 0;

      for (const r of dw) {
        const tfmh = r['time_from_max_hand'] ?? r['time_from_contact'] ?? 0;
        const pam = r['lowertorso_angular_momentum_mag'] ?? r['pelvis_angular_momentum'] ?? r['lowertorso_angmom_mag'] ?? 0;
        if (pam > pelvisPeakVal) { pelvisPeakVal = pam; pelvisPeakTime = tfmh; }
        const tam = r['torso_angular_momentum_mag'] ?? r['uppertorso_angular_momentum_mag'] ?? r['torso_angmom_mag'] ?? 0;
        if (tam > torsoPeakVal) { torsoPeakVal = tam; torsoPeakTime = tfmh; }
      }

      if (pelvisPeakTime < torsoPeakTime) correctCount++;
    }

    console.log(`[Sequence] correct_sequence_count=${correctCount}/${swings.size}`);
    return correctCount;
  } catch (err) {
    console.error('[Sequence] Correct sequence detection failed:', err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// BUILD RAW_METRICS for Kinetic Sequence / Stability tabs
// ---------------------------------------------------------------------------

interface ExtraSwingData {
  pelvis_ke: number | null;
  arms_ke: number | null;
  total_ke: number | null;
  arms_ke_pct: number | null;
  trunk_tilt_contact: number | null;
  tke_shape: string | null;
  swing_count: number;
  correct_sequence_count: number;
}

function buildRawMetrics(
  input: ScoreCalculationInput,
  result: ScoringResult,
  extra: ExtraSwingData
): Record<string, unknown> {
  const pelvis = input.pelvis_omega_peak;
  const torso = input.trunk_omega_peak;
  const arm = input.arm_omega_peak;

  // Gains
  const pelvis_torso_gain = pelvis > 0 ? Math.round((torso / pelvis) * 100) / 100 : null;
  const torso_arm_gain = torso > 0 ? Math.round((arm / torso) * 100) / 100 : null;
  
  // Estimate bat omega (from KE or predicted bat speed)
  const batSpeedMph = result.bat_speed_mph || result.predicted_bat_speed_mph || 0;
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
  const ke_brake_ms = Math.round(input.load_duration_ms * 0.03);
  const ke_cascade_ms = Math.round(input.launch_duration_ms * 0.8);
  const brake_efficiency = result.transfer_efficiency != null
    ? Math.round(result.transfer_efficiency * 1000) / 1000
    : null;

  // ── FIXED root_cause logic (Section A — 3-tier pelvis classification) ──
  const isInverted = !pelvisFirst;
  const pelvisVelocity = Math.round(pelvis);
  const hasBrakeFailure = brake_efficiency != null && brake_efficiency === 0;

  let rootCause: Record<string, string>;

  // HARD CONSTRAINT: NEVER call pelvis "dead" if velocity >= 600°/s
  if (pelvisVelocity < 600) {
    // DEAD PELVIS — insufficient force production (regardless of sequence)
    rootCause = {
      issue: isInverted
        ? 'Dead pelvis — force production deficit + inverted sequence'
        : 'Dead pelvis — force production deficit',
      what: isInverted
        ? `Pelvis is not generating enough force (${pelvisVelocity}°/s) AND sequence is inverted. Energy is both low and late.`
        : `Pelvis sequence is correct but force production is low (${pelvisVelocity}°/s). The engine needs more fuel.`,
      build: 'pelvis_force',
    };
  } else if (isInverted) {
    // LATE PELVIS — velocity >= 600 but timing wrong
    rootCause = {
      issue: 'Energy Arriving Late: Pelvis Fires After Torso',
      what: `Your pelvis has real velocity (${pelvisVelocity}°/s) but it peaks AFTER your torso. That means the energy shows up after the barrel is already on its way. Instead of going into the ball, that late pelvis energy pushes your body open toward the pull side. This is a LATE pelvis, not a weak pelvis — the fix is about WHEN it fires, not how hard.`,
      build: 'pelvis_initiation',
    };
  } else if (hasBrakeFailure) {
    // Brake failure — correct sequence but no deceleration
    rootCause = {
      issue: 'Energy Not Concentrating: Brake System Offline',
      what: `Your front side isn't decelerating. When the lower body doesn't brake, energy passes through your body like water through a pipe with no faucet — it never concentrates into the barrel. Brake efficiency is near zero.`,
      build: 'brake_mechanism',
    };
  } else {
    // Healthy: correct sequence, velocity > 600, brake working
    rootCause = {
      issue: 'None detected',
      what: 'Swing is functioning well',
      build: '',
    };
  }

  // Append brake flag if brake is zero and not already the primary issue
  if (hasBrakeFailure && !rootCause.issue.includes('Brake') && !rootCause.issue.includes('brake')) {
    rootCause.issue += ' + Brake failure (0% efficiency)';
  }

  // Energy flow
  const energyFlow = {
    hip_to_body: flowLabel(pelvis_torso_gain),
    body_to_arms: flowLabel(torso_arm_gain),
    arms_to_barrel: flowLabel(arm_bat_gain),
  };

  // Coaching story — must reflect the SAME thresholds as flag detection
  const story: Record<string, string> = {};

  if (isInverted) {
    story.base = `Pelvis peak velocity: ${pelvisVelocity}°/s. ${
      pelvisVelocity >= 600
        ? 'Your hips have real energy but it arrives LATE — after your torso has already fired. This is a late pelvis, not a dead pelvis. The energy exists but shows up after the barrel is already on its way.'
        : 'Below target AND sequence is reversed — needs ground-force production with proper hip-first initiation. Energy is both low and late.'
    }`;
  } else {
    story.base = `Pelvis peak velocity: ${pelvisVelocity}°/s. ${
      pelvisVelocity >= 600 ? 'Good energy production — hips are leading and delivering energy in the right order.' : 'Below target — the body isn\'t producing enough energy at the source. Needs ground-force production work.'
    }`;
  }

  if (isInverted) {
    story.rhythm = `Sequence is reversed (torso peaks before pelvis). The P→T gap of ${pelvis_torso_gap_ms}ms is between the wrong peaks — timing measurement isn't meaningful when the energy chain is inverted.`;
  } else if (pelvis_torso_gap_ms >= 14 && pelvis_torso_gap_ms <= 18) {
    story.rhythm = `Pelvis→Torso gap: ${pelvis_torso_gap_ms}ms. Energy is flowing in the right order with good timing — within the 14-18ms window that creates the whip effect.`;
  } else if (pelvis_torso_gap_ms < 10) {
    story.rhythm = `Pelvis→Torso gap: ${pelvis_torso_gap_ms}ms. Energy is arriving as a block — nearly simultaneous firing. The gap creates the whip; without it, there's no snap. Target: 14-18ms.`;
  } else if (pelvis_torso_gap_ms < 14) {
    story.rhythm = `Pelvis→Torso gap: ${pelvis_torso_gap_ms}ms. Slightly tight — the whip effect is reduced. Energy needs a wider gap (14-18ms) to build the wave.`;
  } else {
    story.rhythm = `Pelvis→Torso gap: ${pelvis_torso_gap_ms}ms. Energy is dying in transit — the wave loses momentum before the torso picks it up. Like a relay baton handoff where the second runner starts too late. Target: 14-18ms.`;
  }

  const isBrakeFailure = hasBrakeFailure;
  const brakeNote = isBrakeFailure
    ? ` Brake system offline (${brake_efficiency != null ? Math.round(brake_efficiency * 100) + '%' : '0%'} efficiency) — energy passes through like water through a pipe with no faucet. It never concentrates into the barrel.`
    : '';
  story.barrel = `Estimated bat speed: ${batSpeedMph > 0 ? Math.round(batSpeedMph) + ' mph' : 'N/A'}. Transfer ratio: ${input.transfer_ratio.toFixed(2)}.${brakeNote}`;

  return {
    avgPelvisVelocity: pelvisVelocity,
    pelvis_angular_velocity: pelvisVelocity, // alias for naming consistency
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
    // NEW: Energy Delivery Report fields
    pelvis_ke: extra.pelvis_ke,
    arms_ke: extra.arms_ke,
    total_ke: extra.total_ke,
    arms_ke_pct: extra.arms_ke_pct,
    trunk_tilt_contact: extra.trunk_tilt_contact,
    tke_shape: extra.tke_shape,
    swing_count: extra.swing_count,
    correct_sequence_count: extra.correct_sequence_count,
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
      me_storage_path,
      ik_storage_path,
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

    let rawCsvMe: string | null = typeof body.raw_csv_me === 'string' ? body.raw_csv_me : null;
    let rawCsvIk: string | null = typeof body.raw_csv_ik === 'string' ? body.raw_csv_ik : null;

    // Helper: download CSV from storage bucket
    async function downloadFromStorage(storagePath: string): Promise<string | null> {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sb = createClient(supabaseUrl, serviceKey);
        const { data: blob, error } = await sb.storage.from('reboot-uploads').download(storagePath);
        if (error || !blob) {
          console.warn(`[CSV] Storage download failed for ${storagePath}:`, error);
          return null;
        }
        const text = await blob.text();
        console.log(`[CSV] Downloaded ${storagePath}: ${(text.length/1024).toFixed(0)}KB`);
        return text;
      } catch (e) {
        console.warn(`[CSV] Storage download error for ${storagePath}:`, e);
        return null;
      }
    }

    // ── Resolve CSV data ──
    // Priority: pre-parsed rows > raw string > DB fetch by reboot_db_session_id > storage path
    let meRows: Record<string, number>[] = [];
    let ikRows: Record<string, number>[] = [];

    // NEW: fetch CSVs from DB if reboot_db_session_id provided (avoids sending MB payloads)
    const reboot_db_session_id = body.reboot_db_session_id;
    let dbCsvMe: string | null = null;
    let dbCsvIk: string | null = null;

    if (reboot_db_session_id && !rawCsvMe && !me_csv_rows?.length) {
      console.log(`[CSV] Fetching CSVs from DB for reboot_db_session_id=${reboot_db_session_id}`);
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, serviceKey);
      const { data: dbRow, error: dbErr } = await sb
        .from('reboot_sessions')
        .select('raw_csv_me, raw_csv_ik, me_file_path, ik_file_path')
        .eq('id', reboot_db_session_id)
        .single();
      if (dbErr) {
        console.warn(`[CSV] DB fetch failed:`, dbErr.message);
      } else if (dbRow) {
        dbCsvMe = dbRow.raw_csv_me;
        dbCsvIk = dbRow.raw_csv_ik;
        // If no inline CSV, try storage paths from the DB row
        if (!dbCsvMe && dbRow.me_file_path) {
          dbCsvMe = await downloadFromStorage(dbRow.me_file_path);
        }
        if (!dbCsvIk && dbRow.ik_file_path) {
          dbCsvIk = await downloadFromStorage(dbRow.ik_file_path);
        }
      }
    }

    // Resolve ME rows
    if (Array.isArray(me_csv_rows) && me_csv_rows.length > 0) {
      meRows = me_csv_rows;
    } else if (rawCsvMe && rawCsvMe.length > 0) {
      meRows = parseCsvRows(rawCsvMe);
      rawCsvMe = null;
    } else if (dbCsvMe && dbCsvMe.length > 0) {
      meRows = parseCsvRows(dbCsvMe);
      dbCsvMe = null; // free memory
    } else if (typeof me_storage_path === 'string') {
      const csv = await downloadFromStorage(me_storage_path);
      if (csv) meRows = parseCsvRows(csv);
    }

    // Resolve IK rows
    if (Array.isArray(ik_csv_rows) && ik_csv_rows.length > 0) {
      ikRows = ik_csv_rows;
    } else if (rawCsvIk && rawCsvIk.length > 0) {
      ikRows = parseCsvRows(rawCsvIk);
      rawCsvIk = null;
    } else if (dbCsvIk && dbCsvIk.length > 0) {
      ikRows = parseCsvRows(dbCsvIk);
      dbCsvIk = null; // free memory
    } else if (typeof ik_storage_path === 'string') {
      const csv = await downloadFromStorage(ik_storage_path);
      if (csv) ikRows = parseCsvRows(csv);
    }

    // ME is required; IK is optional (ME-only scoring is valid)
    if (meRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'ME data required. Provide me_csv_rows, raw_csv_me, or me_storage_path.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // If no IK rows, create minimal synthetic IK from ME data
    if (ikRows.length === 0) {
      console.warn('[CSV] No IK data — creating synthetic IK from ME rows');
      ikRows = meRows; // Reuse parsed rows to avoid a second large clone in memory
    }

    console.log(`[CSV] Processing: ME=${meRows.length} rows, IK=${ikRows.length} rows`);

    const normalizedPlayerLevel: PlayerLevel =
      player_level === 'youth' || player_level === 'high_school' || player_level === 'college' || player_level === 'pro'
        ? player_level
        : 'pro';

    // 1. Normalize CSV → ScoreCalculationInput + contact frame
    const { input, contactFrameIdx } = parseRebootCSV(
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

    // 1b. Swing duration gating — classify before scoring
    const durationGate = classifySwingDuration(ikRows, contactFrameIdx);
    console.log(`[compute-4b-from-csv] Duration gate: ${durationGate.swing_duration_ms.toFixed(0)}ms → ${durationGate.classification} (scoreable=${durationGate.scoreable})`);

    // 2. Score — HTTP call to shared engine (always score, but mark non-scoreable)
    const result = await computeScoringResult(input);

    // 2b. Compute per-swing extra data for Energy Delivery Report
    const keResult = computePerSwingKE(meRows);
    const trunkTilt = computeTrunkTiltContact(ikRows, meRows);
    const tkeShape = classifyTKEShape(meRows);
    const correctSeqCount = computeCorrectSequenceCount(meRows);

    const extraSwingData: ExtraSwingData = {
      pelvis_ke: keResult.pelvis_ke,
      arms_ke: keResult.arms_ke,
      total_ke: keResult.total_ke,
      arms_ke_pct: keResult.arms_ke_pct,
      trunk_tilt_contact: trunkTilt,
      tke_shape: tkeShape,
      swing_count: keResult.swing_count || 1,
      correct_sequence_count: correctSeqCount,
    };

    // 2c. Build raw_metrics for Kinetic Sequence / Stability tabs
    const rawMetrics = buildRawMetrics(input, result, extraSwingData);
    // Add duration gate info to raw_metrics
    rawMetrics.swing_duration_ms = Math.round(durationGate.swing_duration_ms);
    rawMetrics.swing_classification = durationGate.classification;
    // ALWAYS persist computed scores — duration gate is metadata only, not a scoring blocker.
    // Multi-swing CSVs produce misleading durations; blocking scores hides valid data.

    // Release parsed row buffers before DB writes/response serialization.
    meRows = [];
    ikRows = [];

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
        scoring_status: 'scored',
        raw_metrics: rawMetrics,
        swing_duration_ms: Math.round(durationGate.swing_duration_ms),
        swing_classification: durationGate.classification,
        scoreable: durationGate.scoreable,
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

    return new Response(JSON.stringify({
      ...result,
      swing_duration_ms: Math.round(durationGate.swing_duration_ms),
      swing_classification: durationGate.classification,
      scoreable: durationGate.scoreable,
    }), {
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
