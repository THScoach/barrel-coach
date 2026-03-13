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

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
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
// ARM OMEGA FROM IK — 5-FRAME CENTRED FINITE DIFFERENCE (replaces single-frame)
// ---------------------------------------------------------------------------

/**
 * Compute peak angular velocity from IK joint angle timeseries
 * using 5-frame centred finite difference (2-frame stencil each side).
 * This eliminates noise spikes that plagued the old single-frame delta.
 */
function peakAngularVelocity5Frame(
  rows: Record<string, number>[],
  columnName: string
): { peak: number; peakIdx: number } {
  const angles = rows.map(r => r[columnName] ?? 0);
  let peak = 0;
  let peakIdx = 0;

  // 5-frame centred: (angle[i+2] - angle[i-2]) / (4 × dt)
  const dt4 = 4 / FPS; // 4 frame intervals

  for (let i = 2; i < angles.length - 2; i++) {
    const omega = Math.abs((angles[i + 2] - angles[i - 2]) / dt4) * RAD_TO_DEG;
    if (omega > peak && omega <= 1200) { // physical cap for body segments
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
  const pelvisOmega = peakAngularVelocity5Frame(ikRows, 'pelvis_rot');
  const torsoOmega  = peakAngularVelocity5Frame(ikRows, 'torso_rot');

  // --- Arm omega: best available IK segment ---
  // ALWAYS compute hand position speed (most distal = most accurate for estimation)
  // Then also check IK rotation columns and use the MAX across all candidates
  let armOmega = { peak: 0, peakIdx: 0 };

  // Candidate 1: Hand position speed → angular velocity proxy (preferred)
  const hasRhand = ikRows.some(r => r['rhand_x'] != null && r['rhand_x'] !== 0);
  const handPrefix = hasRhand ? 'rhand' : 'lhand';
  const handSpeed = peak3DSpeed(ikRows, `${handPrefix}_x`, `${handPrefix}_y`, `${handPrefix}_z`, 25);
  if (handSpeed.speed_ms > 0) {
    // Convert hand linear speed to angular velocity using arm length
    // Cap at 2000 deg/s for hand-level (higher than body segment cap of 1200)
    const handOmega = Math.min((handSpeed.speed_ms / 0.55) * RAD_TO_DEG, 2000);
    if (handOmega > armOmega.peak) {
      armOmega = { peak: handOmega, peakIdx: handSpeed.peakIdx };
      console.log(`[CSV→Score] arm_omega from hand speed: ${handOmega.toFixed(1)} deg/s (${(handSpeed.speed_ms * 2.23694).toFixed(1)} mph)`);
    }
  }

  // Candidate 2: IK rotation columns (elbow, hand rotation)
  for (const col of ['rhand_rot', 'lhand_rot', 'right_elbow', 'relbow_rot']) {
    const candidate = peakAngularVelocity5Frame(ikRows, col);
    if (candidate.peak > armOmega.peak) {
      armOmega = candidate;
      console.log(`[CSV→Score] arm_omega from ${col}: ${candidate.peak.toFixed(1)} deg/s (overrides hand speed)`);
    }
  }

  // Fallback: torso × 1.3 if nothing worked
  if (armOmega.peak === 0) {
    armOmega.peak = torsoOmega.peak * 1.3;
    console.log(`[CSV→Score] arm_omega from torso fallback: ${armOmega.peak.toFixed(1)} deg/s`);
  }

  // --- Bat omega from KE inversion (NEW) ---
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

  // --- Timing ---
  const pelvisIdx = pelvisOmega.peakIdx;
  const trunkIdx  = torsoOmega.peakIdx;
  const pelvis_omega_time = pelvisIdx * MS_PER_FRAME;
  const trunk_omega_time  = trunkIdx  * MS_PER_FRAME;
  const load_duration_ms   = Math.max(1, pelvisIdx * MS_PER_FRAME);
  const launch_duration_ms = Math.max(1, (ikRows.length - pelvisIdx) * MS_PER_FRAME);

  // --- Energy from ME (for transfer efficiency ideal path) ---
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
    bat_omega_from_ke,
    measured_bat_speed_mph: context.measured_bat_speed_mph ?? null,
    measured_ev_mph: context.measured_ev_mph ?? null,
    pelvis_omega_time,
    trunk_omega_time,
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
      };

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
        const { error: updateError } = await supabase
          .from('player_sessions')
          .update(sessionPayload)
          .eq('id', existingSession.id);

        if (updateError) {
          console.error('[compute-4b-from-csv] DB update error:', updateError);
        }
      } else {
        const { error: insertError } = await supabase
          .from('player_sessions')
          .insert(sessionPayload);

        if (insertError) {
          console.error('[compute-4b-from-csv] DB insert error:', insertError);
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
