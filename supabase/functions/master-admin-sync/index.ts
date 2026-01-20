/**
 * =============================================================================
 * MASTER ADMIN SYNC SCRIPT
 * Supabase Edge Function — Single Admin Reboot Access
 * =============================================================================
 * 
 * USE CASE: Coach Rick is the ONLY one with Reboot API access.
 * 
 * This script:
 * 1. Uses Master Admin credentials to pull ALL completed sessions from last 24h
 * 2. Matches sessions to players via org_player_id ↔ players.reboot_id
 * 3. Fetches Momentum-Energy CSV for each new session
 * 4. Runs 4B Scoring Algorithm
 * 5. INSERTs results into player_sessions
 * 6. Sets notification flag for "New Analysis Available" badge
 * 7. Auto-prescribes drills based on detected leak
 * 
 * DIFFERENCE FROM PLAYER-BY-PLAYER POLLING:
 * - This pulls ORG-WIDE sessions in one call
 * - Then matches to players (instead of querying per-player)
 * - More efficient when you're the only one with API access
 * 
 * =============================================================================
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// CONFIGURATION
// =============================================================================

const REBOOT_API_BASE = 'https://api.rebootmotion.com/v1';
const LOOKBACK_HOURS = 24; // Pull sessions from last 24 hours

// =============================================================================
// TYPES
// =============================================================================

interface RebootSession {
  id: string;
  org_player_id: string;
  player_name?: string;
  created_at: string;
  updated_at?: string;
  movement_type: string;
  status: string;
  session_date?: string;
}

interface RebootDataExport {
  download_url: string;
  file_type: string;
  expires_at: string;
}

interface Player {
  id: string;
  reboot_id: string;
  name: string;
  motor_profile_sensor: string | null;
  email: string | null;
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

interface ProcessedSession {
  reboot_session_id: string;
  player_id: string;
  player_name: string;
  scores: {
    brain: number;
    body: number;
    bat: number;
    ball: number;
    overall: number;
  };
  leak_type: string;
  status: 'success' | 'error' | 'skipped';
  error?: string;
}

// =============================================================================
// REBOOT API CLIENT — MASTER ADMIN VERSION
// =============================================================================

class RebootMasterClient {
  private apiKey: string;
  private orgId: string;

  constructor(apiKey: string, orgId: string) {
    this.apiKey = apiKey;
    this.orgId = orgId;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${REBOOT_API_BASE}${endpoint}`;
    
    console.log(`[Reboot API] ${options.method || 'GET'} ${endpoint}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Organization-ID': this.orgId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Reboot API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * MASTER ADMIN: Pull ALL completed sessions from the entire org
   * Filtered by created_at in last N hours
   */
  async listAllOrgSessions(hoursBack: number = 24): Promise<RebootSession[]> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    console.log(`[Master Sync] Fetching all org sessions since ${since}`);
    
    try {
      // Try different endpoint patterns based on Reboot API version
      // Option 1: Query with date filter
      let data = await this.request(
        `/sessions?status=completed&created_after=${since}&limit=100`
      );
      
      let sessions = Array.isArray(data) ? data : (data.sessions || data.data || []);
      
      // If no date filter works, get all and filter client-side
      if (sessions.length === 0) {
        data = await this.request(`/sessions?status=completed&limit=100`);
        sessions = Array.isArray(data) ? data : (data.sessions || data.data || []);
        
        // Filter to last N hours
        const sinceDate = new Date(since);
        sessions = sessions.filter((s: RebootSession) => {
          const sessionDate = new Date(s.created_at || s.session_date || s.updated_at || '');
          return sessionDate >= sinceDate;
        });
      }
      
      console.log(`[Master Sync] Found ${sessions.length} completed sessions in last ${hoursBack}h`);
      return sessions;
      
    } catch (error) {
      console.error('[Master Sync] Failed to list org sessions:', error);
      throw error;
    }
  }

  /**
   * Request data export (CSV download URL)
   */
  async requestDataExport(sessionId: string): Promise<RebootDataExport | null> {
    try {
      const data = await this.request('/data_export', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          file_type: 'momentum-energy',
        }),
      });
      return data;
    } catch (error) {
      console.log(`[Export] Failed for session ${sessionId}: ${error}`);
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

  private parseCSV(csvText: string): MERow[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows: MERow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
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

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}

// =============================================================================
// 4B SCORING ENGINE (Self-contained)
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
      training: 'Keep doing what you\'re doing.',
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
    const armsCV = _calcCV(armsKEValues);
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
  try {
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
      .order('priority')
      .limit(5);

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
      
    console.log(`[Drills] Assigned ${assignments.length} drills for player ${playerId}`);
  } catch (error) {
    console.log(`[Drills] Prescription failed: ${error}`);
  }
}

// =============================================================================
// NOTIFICATION FLAG
// =============================================================================

async function setNewAnalysisFlag(supabase: SupabaseClient, playerId: string, sessionId: string) {
  try {
    // Update player record with notification flag
    await supabase
      .from('players')
      .update({ 
        has_new_analysis: true,
        last_analysis_at: new Date().toISOString(),
        latest_session_id: sessionId,
      })
      .eq('id', playerId);

    // Insert into notifications table (if exists) - ignore errors
    try {
      await supabase
        .from('notifications')
        .insert({
          player_id: playerId,
          type: 'new_analysis',
          title: 'New Analysis Available',
          message: 'Your latest swing session has been scored. Check your dashboard to see your 4B results.',
          session_id: sessionId,
          is_read: false,
        });
    } catch {
      // Ignore if notifications table doesn't exist
    }

    console.log(`[Notification] Flag set for player ${playerId}`);
  } catch (error) {
    console.log(`[Notification] Failed to set flag: ${error}`);
  }
}

// =============================================================================
// MAIN SYNC FUNCTION
// =============================================================================

async function processSession(
  supabase: SupabaseClient,
  reboot: RebootMasterClient,
  session: RebootSession,
  player: Player
): Promise<ProcessedSession> {
  const result: ProcessedSession = {
    reboot_session_id: session.id,
    player_id: player.id,
    player_name: player.name,
    scores: { brain: 0, body: 0, bat: 0, ball: 0, overall: 0 },
    leak_type: 'unknown',
    status: 'error',
  };

  try {
    // 1. Request CSV export
    console.log(`[Process] Requesting CSV for session ${session.id}`);
    const exportData = await reboot.requestDataExport(session.id);
    
    if (!exportData?.download_url) {
      result.error = 'No export URL returned';
      return result;
    }

    // 2. Download and parse CSV
    console.log(`[Process] Downloading CSV...`);
    const csvRows = await reboot.downloadCSV(exportData.download_url);
    
    if (csvRows.length === 0) {
      result.error = 'Empty CSV';
      return result;
    }

    // 3. Process into swing data
    const swings = processCSVToSwings(csvRows);
    
    if (swings.length === 0) {
      result.error = 'No valid swings found';
      return result;
    }

    console.log(`[Process] Found ${swings.length} valid swings`);

    // 4. Calculate 4B scores
    const scoreResult = calculate4BScores(swings);
    result.scores = scoreResult.scores;
    result.leak_type = scoreResult.leak.type;

    // 5. INSERT into player_sessions
    console.log(`[Process] Saving to database...`);
    const { data: savedSession, error: saveError } = await supabase
      .from('player_sessions')
      .insert({
        player_id: player.id,
        reboot_session_id: session.id,
        session_date: session.created_at || session.session_date,
        session_source: 'reboot',
        
        brain_score: scoreResult.scores.brain,
        body_score: scoreResult.scores.body,
        bat_score: scoreResult.scores.bat,
        ball_score: scoreResult.scores.ball,
        overall_score: scoreResult.scores.overall,
        
        brain_grade: scoreResult.grades.brain,
        body_grade: scoreResult.grades.body,
        bat_grade: scoreResult.grades.bat,
        ball_grade: scoreResult.grades.ball,
        overall_grade: scoreResult.grades.overall,
        
        ground_flow: scoreResult.flowComponents.groundFlow,
        core_flow: scoreResult.flowComponents.coreFlow,
        upper_flow: scoreResult.flowComponents.upperFlow,
        
        leak_type: scoreResult.leak.type,
        leak_caption: scoreResult.leak.caption,
        leak_training: scoreResult.leak.training,
        
        swing_count: scoreResult.meta.swingCount,
        data_quality: scoreResult.meta.dataQuality,
      })
      .select()
      .single();

    if (saveError) {
      result.error = `Save failed: ${saveError.message}`;
      return result;
    }

    // 6. Set notification flag
    if (savedSession) {
      await setNewAnalysisFlag(supabase, player.id, savedSession.id);
      
      // 7. Auto-prescribe drills
      await prescribeDrills(
        supabase,
        player.id,
        savedSession.id,
        scoreResult.leak.type,
        player.motor_profile_sensor,
        scoreResult.scores
      );
    }

    result.status = 'success';
    console.log(`[Process] ✅ Session ${session.id} processed successfully`);
    
  } catch (error) {
    result.error = `${error}`;
    console.error(`[Process] ❌ Failed: ${error}`);
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
  const results: ProcessedSession[] = [];

  try {
    // Parse optional parameters
    const body = await req.json().catch(() => ({}));
    const hoursBack = body.hours_back || LOOKBACK_HOURS;
    const dryRun = body.dry_run || false;

    console.log(`[Master Sync] Starting sync for last ${hoursBack} hours (dry_run: ${dryRun})`);

    // Initialize clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const reboot = new RebootMasterClient(
      Deno.env.get('REBOOT_API_KEY') ?? '',
      Deno.env.get('REBOOT_ORG_ID') ?? ''
    );

    // 1. Pull ALL completed sessions from org in last N hours
    const allSessions = await reboot.listAllOrgSessions(hoursBack);

    if (allSessions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `No completed sessions found in last ${hoursBack} hours`,
          duration_ms: Date.now() - startTime,
        }),
        { headers }
      );
    }

    // 2. Get player mapping (reboot_id → player record)
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, reboot_id, name, motor_profile_sensor, email')
      .not('reboot_id', 'is', null)
      .not('reboot_id', 'eq', '');

    if (playersError || !players) {
      throw new Error(`Failed to fetch players: ${playersError?.message}`);
    }

    const playerMap = new Map<string, Player>();
    for (const p of players) {
      playerMap.set(p.reboot_id!, p as Player);
    }

    console.log(`[Master Sync] ${players.length} players mapped, ${allSessions.length} sessions to check`);

    // 3. Get existing session IDs to avoid duplicates
    const { data: existingSessions } = await supabase
      .from('player_sessions')
      .select('reboot_session_id')
      .not('reboot_session_id', 'is', null);

    const existingIds = new Set(existingSessions?.map(s => s.reboot_session_id) || []);

    // 4. Filter to new sessions only
    const newSessions = allSessions.filter(s => !existingIds.has(s.id));
    
    console.log(`[Master Sync] ${newSessions.length} new sessions to process`);

    if (newSessions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'All sessions already processed',
          sessions_found: allSessions.length,
          sessions_new: 0,
          duration_ms: Date.now() - startTime,
        }),
        { headers }
      );
    }

    // 5. Process each new session
    for (const session of newSessions) {
      // Match session to player via org_player_id
      const player = playerMap.get(session.org_player_id);
      
      if (!player) {
        results.push({
          reboot_session_id: session.id,
          player_id: 'unknown',
          player_name: `Unknown (${session.org_player_id})`,
          scores: { brain: 0, body: 0, bat: 0, ball: 0, overall: 0 },
          leak_type: 'unknown',
          status: 'skipped',
          error: `No player mapped for reboot_id: ${session.org_player_id}`,
        });
        continue;
      }

      if (dryRun) {
        results.push({
          reboot_session_id: session.id,
          player_id: player.id,
          player_name: player.name,
          scores: { brain: 0, body: 0, bat: 0, ball: 0, overall: 0 },
          leak_type: 'unknown',
          status: 'skipped',
          error: 'Dry run - would process',
        });
        continue;
      }

      // Process the session
      const result = await processSession(supabase, reboot, session, player);
      results.push(result);
    }

    // 6. Log sync completion
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    try {
      await supabase.from('sync_logs').insert({
        sync_type: 'master_admin_sync',
        players_checked: players.length,
        sessions_processed: successCount,
        errors_count: errorCount,
        duration_ms: Date.now() - startTime,
        details: {
          sessions_found: allSessions.length,
          sessions_new: newSessions.length,
          skipped: skippedCount,
          results: results.slice(0, 50),
        },
      });
    } catch {
      // Ignore if sync_logs table doesn't exist
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          sessions_found: allSessions.length,
          sessions_new: newSessions.length,
          sessions_processed: successCount,
          sessions_skipped: skippedCount,
          errors: errorCount,
          duration_ms: Date.now() - startTime,
        },
        results,
      }),
      { headers }
    );

  } catch (error) {
    console.error('[Master Sync] Fatal error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `${error}`,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers }
    );
  }
});
