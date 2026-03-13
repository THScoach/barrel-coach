/**
 * supabase/functions/compute-4b-from-csv/index.ts
 *
 * CSV PARSER ONLY — no scoring math lives here.
 *
 * Responsibility: parse Reboot Motion IK + ME CSV data,
 * normalize to ScoreCalculationInput, then call the deployed
 * calculate-4b-scores edge function via HTTP.
 *
 * Formula lives in ONE place: calculate-4b-scores/index.ts
 * This function calls it over HTTP (edge functions are bundled independently).
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  bat_omega_peak?: number;
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
// HALLAHAN TIMEPOINT DETECTION
// ---------------------------------------------------------------------------

function detectFootPlantFrame(ikRows: Record<string, number>[]): number | undefined {
  const ANKLE_VELOCITY_THRESHOLD = 0.005;

  for (let i = 1; i < ikRows.length - 2; i++) {
    const dzAbs = Math.abs((ikRows[i + 1]?.['lead_ankle_z'] ?? 0) - (ikRows[i]?.['lead_ankle_z'] ?? 0));
    const dyAbs = Math.abs((ikRows[i + 1]?.['lead_ankle_y'] ?? 0) - (ikRows[i]?.['lead_ankle_y'] ?? 0));
    const dzNext = Math.abs((ikRows[i + 2]?.['lead_ankle_z'] ?? 0) - (ikRows[i + 1]?.['lead_ankle_z'] ?? 0));
    const dyNext = Math.abs((ikRows[i + 2]?.['lead_ankle_y'] ?? 0) - (ikRows[i + 1]?.['lead_ankle_y'] ?? 0));
    if (dzAbs < ANKLE_VELOCITY_THRESHOLD && dyAbs < ANKLE_VELOCITY_THRESHOLD &&
        dzNext < ANKLE_VELOCITY_THRESHOLD && dyNext < ANKLE_VELOCITY_THRESHOLD) {
      return i;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// CSV PARSING + NORMALIZATION
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
// ANGULAR MOMENTUM → ANGULAR VELOCITY CONVERSION
// ---------------------------------------------------------------------------

/**
 * Estimated moments of inertia (kg·m²) for Reboot Motion body segments.
 * Used to convert angular momentum (kg·m²/s) to angular velocity (rad/s).
 * These are population averages; real MOI would need anthropometry.
 */
const SEGMENT_MOI: Record<string, number> = {
  pelvis: 0.12,    // Lower torso / pelvis
  torso:  0.30,    // Upper torso
  arms:   0.08,    // Combined arms
  rarm:   0.04,    // Single arm
  bat:    0.035,   // ~33" 30oz bat
};

/**
 * Convert angular momentum magnitude (kg·m²/s) to angular velocity (deg/s).
 * ω (deg/s) = (L / I) × (180/π)
 */
function angMomToOmegaDegS(angMomMag: number, moi: number): number {
  if (moi <= 0) return 0;
  return (angMomMag / moi) * (180 / Math.PI);
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
  }
): ScoreCalculationInput {
  // --- Extract peak angular momentum magnitudes from ME data ---
  const pelvisAngMomPeak = Math.max(...meRows.map(r => Math.abs(r['lowertorso_angular_momentum_mag'] ?? 0)));
  const torsoAngMomPeak  = Math.max(...meRows.map(r => Math.abs(r['torso_angular_momentum_mag'] ?? 0)));
  const batAngMomPeak    = Math.max(...meRows.map(r => Math.abs(r['bat_angular_momentum_mag'] ?? 0)));
  const armsAngMomPeak   = Math.max(...meRows.map(r => Math.abs(
    r['arms_angular_momentum_mag'] ?? r['rarm_angular_momentum_mag'] ?? 0
  )));

  // --- Convert to angular velocity (deg/s) via estimated MOI ---
  const pelvis_omega_peak = angMomToOmegaDegS(pelvisAngMomPeak, SEGMENT_MOI.pelvis);
  const trunk_omega_peak  = angMomToOmegaDegS(torsoAngMomPeak, SEGMENT_MOI.torso);

  // Arms: use combined arms column, fall back to single arm, fall back to trunk * 1.3
  const arm_omega_peak = armsAngMomPeak > 0
    ? angMomToOmegaDegS(armsAngMomPeak, armsAngMomPeak === (Math.max(...meRows.map(r => Math.abs(r['arms_angular_momentum_mag'] ?? 0)))) ? SEGMENT_MOI.arms : SEGMENT_MOI.rarm)
    : trunk_omega_peak * 1.3;

  // Bat: use bat column, fall back to arm * 1.15
  const bat_omega_peak = batAngMomPeak > 0
    ? angMomToOmegaDegS(batAngMomPeak, SEGMENT_MOI.bat)
    : arm_omega_peak * 1.15;

  console.log(`[CSV→Score] Angular momentum peaks: pelvis=${pelvisAngMomPeak.toFixed(3)}, torso=${torsoAngMomPeak.toFixed(3)}, arms=${armsAngMomPeak.toFixed(3)}, bat=${batAngMomPeak.toFixed(3)}`);
  console.log(`[CSV→Score] Converted ω (deg/s): pelvis=${pelvis_omega_peak.toFixed(1)}, trunk=${trunk_omega_peak.toFixed(1)}, arm=${arm_omega_peak.toFixed(1)}, bat=${bat_omega_peak.toFixed(1)}`);

  // --- Peak frame indices for timing ---
  const pelvisIdx = meRows.findIndex(r => Math.abs(r['lowertorso_angular_momentum_mag'] ?? 0) === pelvisAngMomPeak);
  const trunkIdx  = meRows.findIndex(r => Math.abs(r['torso_angular_momentum_mag'] ?? 0) === torsoAngMomPeak);

  // --- Hip-shoulder separation from IK data ---
  const xFactorPeaks = ikRows.map(r => {
    const torsoRot  = r['torso_rot']  ?? 0;
    const pelvisRot = r['pelvis_rot'] ?? 0;
    return Math.abs((torsoRot - pelvisRot) * (180 / Math.PI));
  });
  const hip_shoulder_sep_max_deg = Math.max(...xFactorPeaks);

  // --- Transfer ratio ---
  const transfer_ratio = pelvis_omega_peak > 0 ? trunk_omega_peak / pelvis_omega_peak : 1;

  // --- Timing ---
  const FPS = 240;
  const MS_PER_FRAME = 1000 / FPS;
  const pelvis_omega_time = pelvisIdx * MS_PER_FRAME;
  const trunk_omega_time  = trunkIdx  * MS_PER_FRAME;

  const load_duration_ms   = pelvisIdx * MS_PER_FRAME;
  const launch_duration_ms = (meRows.length - pelvisIdx) * MS_PER_FRAME;

  // --- Optional: extract mass from ME if masstotal column exists ---
  const massTotal = meRows[0]?.['masstotal'] ?? undefined;

  return {
    source: 'reboot_csv',
    pelvis_omega_peak,
    trunk_omega_peak,
    arm_omega_peak,
    bat_omega_peak,
    pelvis_omega_time,
    trunk_omega_time,
    hip_shoulder_sep_max_deg,
    stride_length_rel_hip: 0.85,
    front_foot_angle_deg:  20,
    load_duration_ms,
    launch_duration_ms,
    transfer_ratio,
    exit_velocity_mph:   context.exit_velocity_mph,
    launch_angle_deg:    context.launch_angle_deg,
    spray_angle_deg:     context.spray_angle_deg,
    hard_hit_rate:       context.hard_hit_rate,
    player_level:        context.player_level,
    motor_profile:       context.motor_profile,
    mass_total_kg:       massTotal,
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
      }
    );

    // 2. Score — HTTP call to shared engine (NO formula here)
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
