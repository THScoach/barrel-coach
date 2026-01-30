/**
 * =============================================================================
 * REBOOT MOTION POLLING SCRIPT
 * Supabase Edge Function — Automated Data Sync
 * =============================================================================
 * 
 * This function runs on a 12-hour schedule and:
 * 1. Iterates all players with a reboot_player_id
 * 2. Checks Reboot API for new sessions
 * 3. Compares against existing sensor_sessions
 * 4. Fetches CSVs for new sessions
 * 5. Runs 4B Scoring Algorithm
 * 6. Saves results to database
 * 
 * NO WEBHOOKS REQUIRED — Pure polling approach
 * 
 * =============================================================================
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REBOOT_API_BASE = 'https://api.rebootmotion.com';
const BATCH_SIZE = 10; // Process players in batches to avoid timeouts

// OAuth token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

// =============================================================================
// TYPES
// =============================================================================

interface Player {
  id: string;
  reboot_athlete_id: string;
  reboot_player_id?: string | null;
  name: string;
  motor_profile_sensor: string | null;
}

interface RebootSession {
  id: string;
  org_player_id: string;
  created_at: string;
  movement_type: string;
  status: string;
}

interface RebootDataExport {
  download_url: string;
  file_type: string;
  expires_at: string;
}

interface MERow {
  org_movement_id: string;
  time_from_max_hand: number;
  legs_kinetic_energy: number;
  torso_kinetic_energy: number;
  arms_kinetic_energy: number;
  bat_kinetic_energy?: number;
  total_kinetic_energy: number;
}

interface SyncResult {
  player_id: string;
  player_name: string;
  sessions_found: number;
  sessions_new: number;
  sessions_processed: number;
  errors: string[];
}

// =============================================================================
// REBOOT API CLIENT
// =============================================================================

// Get OAuth access token for data export endpoints
async function getRebootAccessToken(): Promise<string> {
  const REBOOT_USERNAME = Deno.env.get('REBOOT_USERNAME') ?? '';
  const REBOOT_PASSWORD = Deno.env.get('REBOOT_PASSWORD') ?? '';

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  console.log('[reboot-motion-polling] Fetching new Reboot access token');
  
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${error}`);
  }

  const data = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

class RebootClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * List sessions for a specific player using X-Api-Key
   */
  async listPlayerSessions(rebootPlayerId: string, limit = 50): Promise<RebootSession[]> {
    try {
      const url = new URL(`${REBOOT_API_BASE}/sessions`);
      url.searchParams.set('org_player_id', rebootPlayerId);
      url.searchParams.set('limit', limit.toString());

      const response = await fetch(url.toString(), {
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reboot API error: ${response.status} - ${error}`);
      }

      const raw = await response.json();
      // Handle different response formats
      if (Array.isArray(raw)) return raw;
      if (raw.sessions) return raw.sessions;
      if (raw.data) return raw.data;
      return [];
    } catch (error) {
      console.log(`Could not list sessions for player ${rebootPlayerId}: ${error}`);
      return [];
    }
  }

  /**
   * Get a specific session by ID using X-Api-Key
   */
  async getSession(sessionId: string): Promise<RebootSession | null> {
    try {
      const response = await fetch(`${REBOOT_API_BASE}/sessions/${sessionId}`, {
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reboot API error: ${response.status} - ${error}`);
      }

      return response.json();
    } catch (error) {
      console.log(`Could not get session ${sessionId}: ${error}`);
      return null;
    }
  }

  /**
   * Request data export (CSV download URL) using OAuth Bearer token
   */
  async requestDataExport(sessionId: string, orgPlayerId: string, fileType: 'momentum-energy' | 'inverse-kinematics'): Promise<RebootDataExport | null> {
    try {
      const accessToken = await getRebootAccessToken();
      
      const response = await fetch(`${REBOOT_API_BASE}/data_export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          org_player_id: orgPlayerId,
          data_type: fileType,
          movement_type_id: 1, // Baseball Hitting
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reboot data export error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      // Handle different response formats for download URL
      const downloadUrl = data.download_url || data.download_urls?.[0] || data.url;
      if (!downloadUrl) {
        console.log(`No download URL in response for session ${sessionId}`);
        return null;
      }
      
      return { download_url: downloadUrl, file_type: fileType, expires_at: '' };
    } catch (error) {
      console.log(`Could not export ${fileType} for session ${sessionId}: ${error}`);
      return null;
    }
  }

  /**
   * Download and parse CSV from export URL
   */
  async downloadCSV(downloadUrl: string): Promise<MERow[]> {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download CSV: ${response.status}`);
    }

    const csvText = await response.text();
    return this.parseCSV(csvText);
  }

  /**
   * Parse CSV text into rows
   */
  private parseCSV(csvText: string): MERow[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: MERow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row: any = {};

      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        if (header.includes('kinetic_energy') || header.includes('time_from')) {
          row[header] = parseFloat(value) || 0;
        } else {
          row[header] = value;
        }
      });

      if (row.org_movement_id && row.time_from_max_hand !== undefined) {
        rows.push(row as MERow);
      }
    }

    return rows;
  }
}

// =============================================================================
// 4B SCORING ENGINE
// =============================================================================

const _THRESHOLDS = {
  legsKE: { min: 100, max: 500 },
  torsoKE: { min: 50, max: 250 },
  legsToTorsoEff: { min: 30, max: 80 },
  armsKE: { min: 80, max: 250 },
  batKE: { min: 100, max: 600 },
  torsoToArmsEff: { min: 50, max: 150 },
  totalEff: { min: 25, max: 65 },
  cv: { min: 5, max: 40 },
  leak: {
    lateLegsPct: 0.5,
    torsoBypassPct: 0.5,
    noBatPct: 0.5,
    properSeqMin: 0.4,
    cleanTransferMin: 0.8,
  },
};

const _WEIGHTS = { body: 0.35, bat: 0.30, brain: 0.20, ball: 0.15 };

function _to2080(value: number, min: number, max: number, invert = false): number {
  let n = (value - min) / (max - min);
  if (invert) n = 1 - n;
  n = Math.max(0, Math.min(1, n));
  return Math.round(20 + n * 60);
}

function _calcCV(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return (Math.sqrt(variance) / Math.abs(mean)) * 100;
}

function _avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function _getGrade(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 60) return 'Plus';
  if (score >= 55) return 'Above Avg';
  if (score >= 45) return 'Average';
  if (score >= 40) return 'Below Avg';
  if (score >= 30) return 'Fringe';
  return 'Poor';
}

interface SwingData {
  movementId: string;
  legsKEPeak: number;
  torsoKEPeak: number;
  armsKEPeak: number;
  batKEPeak: number;
  totalKEPeak: number;
  legsKEPeakTime: number;
  torsoKEPeakTime: number;
  armsKEPeakTime: number;
  legsToTorso: number;
  torsoToArms: number;
  totalEfficiency: number;
  properSequence: boolean;
}

function processCSVToSwings(rows: MERow[]): SwingData[] {
  const ACTION_WINDOW = { start: -0.5, end: 0.1 };
  const groups = new Map<string, MERow[]>();

  for (const row of rows) {
    const id = row.org_movement_id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
  }

  const swings: SwingData[] = [];

  for (const [movementId, swingRows] of groups) {
    const actionRows = swingRows.filter(
      r => r.time_from_max_hand >= ACTION_WINDOW.start &&
           r.time_from_max_hand <= ACTION_WINDOW.end
    );

    if (actionRows.length < 10) continue;

    let legsKEPeak = 0, legsKEPeakTime = 0;
    let torsoKEPeak = 0, torsoKEPeakTime = 0;
    let armsKEPeak = 0, armsKEPeakTime = 0;
    let batKEPeak = 0;
    let totalKEPeak = 0;

    for (const row of actionRows) {
      if (row.legs_kinetic_energy > legsKEPeak) {
        legsKEPeak = row.legs_kinetic_energy;
        legsKEPeakTime = row.time_from_max_hand;
      }
      if (row.torso_kinetic_energy > torsoKEPeak) {
        torsoKEPeak = row.torso_kinetic_energy;
        torsoKEPeakTime = row.time_from_max_hand;
      }
      if (row.arms_kinetic_energy > armsKEPeak) {
        armsKEPeak = row.arms_kinetic_energy;
        armsKEPeakTime = row.time_from_max_hand;
      }
      if ((row.bat_kinetic_energy || 0) > batKEPeak) {
        batKEPeak = row.bat_kinetic_energy || 0;
      }
      if (row.total_kinetic_energy > totalKEPeak) {
        totalKEPeak = row.total_kinetic_energy;
      }
    }

    const legsToTorso = legsKEPeak > 0 ? torsoKEPeak / legsKEPeak : 0;
    const torsoToArms = torsoKEPeak > 0 ? armsKEPeak / torsoKEPeak : 0;
    const totalEfficiency = totalKEPeak > 0 && batKEPeak > 0 ? batKEPeak / totalKEPeak : 0;
    const properSequence = legsKEPeakTime <= torsoKEPeakTime && torsoKEPeakTime <= armsKEPeakTime;

    swings.push({
      movementId,
      legsKEPeak,
      torsoKEPeak,
      armsKEPeak,
      batKEPeak,
      totalKEPeak,
      legsKEPeakTime,
      torsoKEPeakTime,
      armsKEPeakTime,
      legsToTorso,
      torsoToArms,
      totalEfficiency,
      properSequence,
    });
  }

  return swings;
}

function detectLeak(swings: SwingData[]): { type: string; caption: string; training: string } {
  if (swings.length === 0) {
    return { type: 'unknown', caption: 'Not enough data.', training: 'Need more swings.' };
  }

  const n = swings.length;
  const { leak } = _THRESHOLDS;

  const lateLegsPct = swings.filter(s => s.legsKEPeakTime > s.armsKEPeakTime).length / n;
  const torsoBypassPct = swings.filter(s => s.armsKEPeakTime < s.torsoKEPeakTime).length / n;
  const noBatPct = swings.filter(s => s.batKEPeak < 10).length / n;
  const properSeqPct = swings.filter(s => s.properSequence).length / n;

  if (noBatPct > leak.noBatPct) {
    return {
      type: 'no_bat_delivery',
      caption: "Energy didn't make it to the barrel.",
      training: 'Focus on delivering energy through the hands.',
    };
  }

  if (lateLegsPct > leak.lateLegsPct) {
    return {
      type: 'late_legs',
      caption: 'Your legs fired late — the energy showed up after your hands.',
      training: 'Get to the ground earlier. Let the legs lead.',
    };
  }

  if (torsoBypassPct > leak.torsoBypassPct) {
    return {
      type: 'torso_bypass',
      caption: 'Energy jumped from legs to arms, skipping your core.',
      training: 'Let your core catch and redirect the energy.',
    };
  }

  if (properSeqPct < leak.properSeqMin) {
    return {
      type: 'early_arms',
      caption: 'Your arms took over before your legs finished.',
      training: 'Let the legs lead. Stay connected longer.',
    };
  }

  if (properSeqPct >= leak.cleanTransferMin) {
    return {
      type: 'clean_transfer',
      caption: 'Energy transferred cleanly through the chain.',
      training: "Keep doing what you're doing.",
    };
  }

  return { type: 'unknown', caption: 'Mixed pattern detected.', training: 'Need more analysis.' };
}

function calculate4BScores(swings: SwingData[]) {
  const n = swings.length;

  let dataQuality: string;
  if (n >= 10) dataQuality = 'excellent';
  else if (n >= 5) dataQuality = 'good';
  else if (n >= 3) dataQuality = 'limited';
  else dataQuality = 'insufficient';

  if (n < 1) {
    return {
      scores: { brain: 0, body: 0, bat: 0, ball: 0, overall: 0 },
      grades: { brain: 'N/A', body: 'N/A', bat: 'N/A', ball: 'N/A', overall: 'N/A' },
      flowComponents: { groundFlow: 0, coreFlow: 0, upperFlow: 0 },
      leak: { type: 'unknown', caption: 'No data.', training: 'Upload swing data.' },
      meta: { swingCount: 0, dataQuality: 'insufficient' },
    };
  }

  const legsKEValues = swings.map(s => s.legsKEPeak);
  const torsoKEValues = swings.map(s => s.torsoKEPeak);
  const armsKEValues = swings.map(s => s.armsKEPeak);
  const batKEValues = swings.map(s => s.batKEPeak);

  const legsKEAvg = _avg(legsKEValues);
  const torsoKEAvg = _avg(torsoKEValues);
  const armsKEAvg = _avg(armsKEValues);
  const batKEAvg = _avg(batKEValues);

  const legsToTorsoEff = _avg(swings.map(s => s.legsToTorso)) * 100;
  const torsoToArmsEff = _avg(swings.map(s => s.torsoToArms)) * 100;
  const totalEff = _avg(swings.map(s => s.totalEfficiency)) * 100;

  const legsCV = _calcCV(legsKEValues);
  const torsoCV = _calcCV(torsoKEValues);
  const armsCV = _calcCV(armsKEValues);
  const outputCV = _calcCV(batKEValues);

  const groundFlow = _to2080(legsKEAvg, _THRESHOLDS.legsKE.min, _THRESHOLDS.legsKE.max);
  const coreFlowE = _to2080(torsoKEAvg, _THRESHOLDS.torsoKE.min, _THRESHOLDS.torsoKE.max);
  const coreFlowT = _to2080(legsToTorsoEff, _THRESHOLDS.legsToTorsoEff.min, _THRESHOLDS.legsToTorsoEff.max);
  const coreFlow = Math.round((coreFlowE + coreFlowT) / 2);

  const upperFlowE = _to2080(armsKEAvg, _THRESHOLDS.armsKE.min, _THRESHOLDS.armsKE.max);
  const upperFlowT = _to2080(torsoToArmsEff, _THRESHOLDS.torsoToArmsEff.min, _THRESHOLDS.torsoToArmsEff.max);
  const upperFlow = Math.round((upperFlowE + upperFlowT) / 2);

  const bodyScore = Math.round((groundFlow + coreFlow) / 2);

  const hasBatKE = swings.some(s => s.batKEPeak > 10);
  let batScore: number;
  if (hasBatKE) {
    const batDelivery = _to2080(batKEAvg, _THRESHOLDS.batKE.min, _THRESHOLDS.batKE.max);
    const batEfficiency = _to2080(totalEff, _THRESHOLDS.totalEff.min, _THRESHOLDS.totalEff.max);
    batScore = Math.round((upperFlow + batDelivery + batEfficiency) / 3);
  } else {
    batScore = upperFlow;
  }

  const cvValid = n >= 3;
  let brainScore = 50;
  if (cvValid) {
    const legsC = _to2080(legsCV, _THRESHOLDS.cv.min, _THRESHOLDS.cv.max, true);
    const torsoC = _to2080(torsoCV, _THRESHOLDS.cv.min, _THRESHOLDS.cv.max, true);
    brainScore = Math.round((legsC + torsoC) / 2);
  }

  let ballScore = 50;
  if (cvValid && hasBatKE) {
    ballScore = _to2080(outputCV, _THRESHOLDS.cv.min, _THRESHOLDS.cv.max, true);
  } else if (cvValid) {
    ballScore = _to2080(armsCV, _THRESHOLDS.cv.min, _THRESHOLDS.cv.max, true);
  }

  const overall = Math.round(
    bodyScore * _WEIGHTS.body +
    batScore * _WEIGHTS.bat +
    brainScore * _WEIGHTS.brain +
    ballScore * _WEIGHTS.ball
  );

  const leak = detectLeak(swings);

  return {
    scores: { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore, overall },
    grades: {
      brain: _getGrade(brainScore),
      body: _getGrade(bodyScore),
      bat: _getGrade(batScore),
      ball: _getGrade(ballScore),
      overall: _getGrade(overall),
    },
    flowComponents: { groundFlow, coreFlow, upperFlow },
    leak,
    meta: { swingCount: n, dataQuality },
  };
}

// =============================================================================
// DRILL PRESCRIPTION
// =============================================================================

async function prescribeDrills(
  supabase: SupabaseClient,
  playerId: string,
  sessionId: string,
  leakType: string,
  motorProfile: string | null,
  scores: { brain: number; body: number; bat: number; ball: number }
) {
  const bScores = [
    { b: 'brain', score: scores.brain },
    { b: 'body', score: scores.body },
    { b: 'bat', score: scores.bat },
    { b: 'ball', score: scores.ball },
  ];
  const weakest = bScores.reduce((min, curr) => curr.score < min.score ? curr : min);

  const { data: prescriptions } = await supabase
    .from('drill_prescriptions')
    .select('drill_id, prescription_reason, priority')
    .eq('is_active', true)
    .or(`leak_type.eq.${leakType},motor_profile.eq.${motorProfile || 'none'},four_b_weakness.eq.${weakest.b}`)
    .order('priority');

  if (!prescriptions || prescriptions.length === 0) return;

  const assignments = prescriptions.slice(0, 3).map(p => ({
    player_id: playerId,
    drill_id: p.drill_id,
    session_id: sessionId,
    assigned_reason: p.prescription_reason,
    leak_type_at_assignment: leakType,
    score_at_assignment: weakest.score,
  }));

  await supabase
    .from('player_drill_assignments')
    .upsert(assignments, { onConflict: 'player_id,drill_id,session_id' });
}

// =============================================================================
// MAIN SYNC FUNCTION
// =============================================================================

async function syncPlayerSessions(
  supabase: SupabaseClient,
  reboot: RebootClient,
  player: Player
): Promise<SyncResult> {
  const result: SyncResult = {
    player_id: player.id,
    player_name: player.name,
    sessions_found: 0,
    sessions_new: 0,
    sessions_processed: 0,
    errors: [],
  };

  try {
    // 1. Get sessions from Reboot API (use reboot_athlete_id, fallback to reboot_player_id)
    const rebootId = player.reboot_athlete_id || player.reboot_player_id;
    if (!rebootId) {
      result.errors.push('No Reboot ID found for player');
      return result;
    }
    const rebootSessions = await reboot.listPlayerSessions(rebootId);
    result.sessions_found = rebootSessions.length;

    if (rebootSessions.length === 0) {
      return result;
    }

    // 2. Get existing session IDs from our database (using sensor_sessions)
    const { data: existingSessions } = await supabase
      .from('sensor_sessions')
      .select('reboot_session_id')
      .eq('player_id', player.id)
      .not('reboot_session_id', 'is', null);

    const existingIds = new Set(existingSessions?.map(s => s.reboot_session_id) || []);

    // 3. Find new sessions
    const newSessions = rebootSessions.filter(s => !existingIds.has(s.id));
    result.sessions_new = newSessions.length;

    if (newSessions.length === 0) {
      return result;
    }

    // 4. Process each new session
    for (const session of newSessions) {
      try {
        // Get the reboot ID for this player (needed for data export)
        const rebootId = player.reboot_athlete_id || player.reboot_player_id;
        if (!rebootId) continue;
        
        // Request momentum-energy CSV export
        const exportData = await reboot.requestDataExport(session.id, rebootId, 'momentum-energy');
        
        if (!exportData?.download_url) {
          result.errors.push(`No export URL for session ${session.id}`);
          continue;
        }

        // Download and parse CSV
        const csvRows = await reboot.downloadCSV(exportData.download_url);
        
        if (csvRows.length === 0) {
          result.errors.push(`Empty CSV for session ${session.id}`);
          continue;
        }

        // Process CSV into swing data
        const swings = processCSVToSwings(csvRows);
        
        if (swings.length === 0) {
          result.errors.push(`No valid swings in session ${session.id}`);
          continue;
        }

        // Calculate 4B scores
        const scoreResult = calculate4BScores(swings);

        // 5. Save to sensor_sessions
        const { data: savedSession, error: saveError } = await supabase
          .from('sensor_sessions')
          .insert({
            player_id: player.id,
            reboot_session_id: session.id,
            session_date: session.created_at,
            session_source: 'reboot_polling',
            swing_count: scoreResult.meta.swingCount,
            data_quality: scoreResult.meta.dataQuality,
            four_b_brain: scoreResult.scores.brain,
            four_b_body: scoreResult.scores.body,
            four_b_bat: scoreResult.scores.bat,
            four_b_ball: scoreResult.scores.ball,
            composite_score: scoreResult.scores.overall,
            ground_flow: scoreResult.flowComponents.groundFlow,
            core_flow: scoreResult.flowComponents.coreFlow,
            upper_flow: scoreResult.flowComponents.upperFlow,
            leak_type: scoreResult.leak.type,
            processing_status: 'complete',
          })
          .select()
          .single();

        if (saveError) {
          result.errors.push(`Save error for session ${session.id}: ${saveError.message}`);
          continue;
        }

        // 6. Update player's latest scores
        await supabase
          .from('players')
          .update({
            latest_brain_score: scoreResult.scores.brain,
            latest_body_score: scoreResult.scores.body,
            latest_bat_score: scoreResult.scores.bat,
            latest_ball_score: scoreResult.scores.ball,
            latest_composite_score: scoreResult.scores.overall,
            last_sensor_session_date: session.created_at,
            motor_profile_sensor: player.motor_profile_sensor, // preserve existing
          })
          .eq('id', player.id);

        // 7. Auto-prescribe drills
        if (savedSession) {
          await prescribeDrills(
            supabase,
            player.id,
            savedSession.id,
            scoreResult.leak.type,
            player.motor_profile_sensor,
            scoreResult.scores
          );
        }

        result.sessions_processed++;
        console.log(`✓ Processed session ${session.id} for ${player.name}: ${scoreResult.scores.overall} overall`);
        
      } catch (sessionError) {
        result.errors.push(`Error processing session ${session.id}: ${sessionError}`);
      }
    }

  } catch (error) {
    result.errors.push(`Player sync error: ${error}`);
  }

  return result;
}

// =============================================================================
// EDGE FUNCTION HANDLER
// =============================================================================

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  const startTime = Date.now();
  const results: SyncResult[] = [];
  let totalProcessed = 0;
  let totalErrors = 0;

  try {
    // Parse request body for optional player_ids filter
    let targetPlayerIds: string[] | null = null;
    try {
      const body = await req.json();
      if (body.player_ids && Array.isArray(body.player_ids)) {
        targetPlayerIds = body.player_ids;
        console.log(`[reboot-motion-polling] Targeting specific players: ${targetPlayerIds!.join(', ')}`);
      }
    } catch {
      // No body or invalid JSON, process all players
    }

    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const reboot = new RebootClient(
      Deno.env.get('REBOOT_API_KEY') ?? ''
    );

    // Build query for players
    let query = supabase
      .from('players')
      .select('id, reboot_athlete_id, reboot_player_id, name, motor_profile_sensor');

    if (targetPlayerIds && targetPlayerIds.length > 0) {
      // Filter to specific players
      query = query.in('id', targetPlayerIds);
    } else {
      // Get all players with reboot IDs
      query = query.or('reboot_athlete_id.not.is.null,reboot_player_id.not.is.null');
    }

    const { data: players, error: playersError } = await query;

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No players with Reboot IDs found',
          duration_ms: Date.now() - startTime,
        }),
        { headers }
      );
    }

    console.log(`Starting sync for ${players.length} players...`);

    // Process players in batches
    for (let i = 0; i < players.length; i += BATCH_SIZE) {
      const batch = players.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(player => syncPlayerSessions(supabase, reboot, player as Player))
      );

      results.push(...batchResults);
      
      for (const r of batchResults) {
        totalProcessed += r.sessions_processed;
        totalErrors += r.errors.length;
      }
    }

    // Log sync completion (ignore if table doesn't exist)
    try {
      await supabase.from('sync_logs').insert({
        sync_type: 'reboot_motion_polling',
        players_checked: players.length,
        sessions_processed: totalProcessed,
        errors_count: totalErrors,
        duration_ms: Date.now() - startTime,
        details: results,
      });
    } catch {
      // sync_logs table may not exist
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          players_checked: players.length,
          total_sessions_found: results.reduce((sum, r) => sum + r.sessions_found, 0),
          total_new_sessions: results.reduce((sum, r) => sum + r.sessions_new, 0),
          total_processed: totalProcessed,
          total_errors: totalErrors,
          duration_ms: Date.now() - startTime,
        },
        results,
      }),
      { headers }
    );

  } catch (error: unknown) {
    console.error('Sync failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers }
    );
  }
});
