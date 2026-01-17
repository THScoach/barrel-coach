/**
 * CATCHING BARRELS - Reboot Motion Analysis Module
 * Velocity-based Kwon analysis for Lovable + Supabase
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface MomentumRow {
  index: number;
  time: number;
  norm_time: number;
  org_movement_id: string;
  lowertorso_angular_momentum_proj: number;
  torso_angular_momentum_proj: number;
  arms_angular_momentum_proj: number;
  lowertorso_angular_momentum_x: number;
  lowertorso_angular_momentum_y: number;
  lowertorso_angular_momentum_z: number;
  torso_angular_momentum_x: number;
  torso_angular_momentum_y: number;
  torso_angular_momentum_z: number;
  arms_angular_momentum_x: number;
  arms_angular_momentum_y: number;
  arms_angular_momentum_z: number;
  total_kinetic_energy: number;
  center_of_mass_x: number;
  center_of_mass_y: number;
  center_of_mass_z: number;
}

export interface IKRow {
  index: number;
  time: number;
  org_movement_id: string;
  pelvis_rot: number;
  torso_rot: number;
}

export interface SwingAnalysisResult {
  movement_id: string;
  fps: number;
  swing_duration_ms: number;
  pelvis_vel_peak_frame: number;
  torso_vel_peak_frame: number;
  arms_vel_peak_frame: number;
  contact_frame: number;
  transfer_ratio: number;
  transfer_ratio_rating: 'elite' | 'good' | 'developing' | 'priority';
  peak_timing_gap_ms: number;
  peak_timing_gap_pct: number;
  whip_timing_pct: number;
  pelvis_decel_before_contact: boolean;
  torso_decel_before_contact: boolean;
  arms_decel_before_contact: boolean;
  all_segments_decel: boolean;
  sequence: string;
  sequence_correct: boolean;
  motor_profile: 'SPINNER' | 'WHIPPER' | 'SLINGSHOTTER' | 'TITAN' | 'SEQUENCE_ISSUE' | 'DATA_QUALITY_ISSUE';
  motor_profile_confidence: number;
  spinner_score: number;
  whipper_score: number;
  slingshotter_score: number;
  titan_score: number;
  x_factor_max?: number;
  x_factor_at_contact?: number;
  data_quality_flags: string[];
}

// ============================================================================
// CSV PARSING
// ============================================================================

export function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const header = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').trim());
  const rows: T[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== header.length) continue;
    
    const row: Record<string, unknown> = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      const val = values[j].replace(/^["']|["']$/g, '').trim();
      
      if (val === '' || val === 'n/a' || val === 'NaN') {
        row[key] = 0;
      } else if (!isNaN(Number(val))) {
        row[key] = Number(val);
      } else {
        row[key] = val;
      }
    }
    rows.push(row as T);
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
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

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

function computeMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function smoothSignal(signal: number[], windowSize: number = 5): number[] {
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(signal.length - 1, i + halfWindow); j++) {
      if (!isNaN(signal[j])) {
        sum += signal[j];
        count++;
      }
    }
    result.push(count > 0 ? sum / count : 0);
  }
  return result;
}

function computeVelocity(signal: number[], fps: number): number[] {
  const velocity: number[] = [0];
  for (let i = 1; i < signal.length; i++) {
    velocity.push((signal[i] - signal[i - 1]) * fps);
  }
  return smoothSignal(velocity, 7);
}

function findPeakInWindow(signal: number[], startFrame: number, endFrame: number): number {
  const segment = signal.slice(startFrame, endFrame);
  if (segment.length < 10) return startFrame;
  
  const maxVal = Math.max(...segment.filter(v => !isNaN(v)));
  const threshold = maxVal * 0.3;
  
  const peaks: number[] = [];
  for (let i = 1; i < segment.length - 1; i++) {
    if (segment[i] > segment[i - 1] && segment[i] > segment[i + 1] && segment[i] > threshold) {
      peaks.push(i);
    }
  }
  
  if (peaks.length > 0) {
    let bestPeak = peaks[0];
    for (const p of peaks) {
      if (segment[p] > segment[bestPeak]) bestPeak = p;
    }
    return startFrame + bestPeak;
  }
  
  let maxIdx = 0;
  for (let i = 1; i < segment.length; i++) {
    if (segment[i] > segment[maxIdx]) maxIdx = i;
  }
  return startFrame + maxIdx;
}

function detectContact(momentumData: MomentumRow[]): number {
  const ke = momentumData.map(r => r.total_kinetic_energy || 0);
  const keSmooth = smoothSignal(ke, 9);
  
  let maxIdx = 0;
  for (let i = 1; i < keSmooth.length; i++) {
    if (keSmooth[i] > keSmooth[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

function detectFPS(momentumData: MomentumRow[]): number {
  const times = momentumData.map(r => r.time).filter(t => t > 0);
  if (times.length < 2) return 300;
  
  const diffs: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const diff = times[i] - times[i - 1];
    if (diff > 0) diffs.push(diff);
  }
  if (diffs.length === 0) return 300;
  
  diffs.sort((a, b) => a - b);
  const medianDt = diffs[Math.floor(diffs.length / 2)];
  return Math.round(1 / medianDt);
}

// ============================================================================
// V4 VELOCITY-BASED ANALYSIS
// ============================================================================

export function analyzeSwingV4(momentumData: MomentumRow[], ikData?: IKRow[]): SwingAnalysisResult {
  const movementId = momentumData[0]?.org_movement_id || 'unknown';
  const fps = detectFPS(momentumData);
  const contactFrame = detectContact(momentumData);
  
  const windowMs = 500;
  const startFrame = Math.max(0, contactFrame - Math.round(windowMs * fps / 1000));
  const swingDuration = contactFrame - startFrame;
  
  const dataQualityFlags: string[] = [];
  
  let pelvisMom: number[];
  let torsoMom: number[];
  let armsMom: number[];
  
  if (momentumData[0]?.lowertorso_angular_momentum_proj !== undefined) {
    pelvisMom = momentumData.map(r => Math.abs(r.lowertorso_angular_momentum_proj || 0));
    torsoMom = momentumData.map(r => Math.abs(r.torso_angular_momentum_proj || 0));
    armsMom = momentumData.map(r => Math.abs(r.arms_angular_momentum_proj || 0));
  } else {
    pelvisMom = momentumData.map(r => computeMagnitude(r.lowertorso_angular_momentum_x, r.lowertorso_angular_momentum_y, r.lowertorso_angular_momentum_z));
    torsoMom = momentumData.map(r => computeMagnitude(r.torso_angular_momentum_x, r.torso_angular_momentum_y, r.torso_angular_momentum_z));
    armsMom = momentumData.map(r => computeMagnitude(r.arms_angular_momentum_x, r.arms_angular_momentum_y, r.arms_angular_momentum_z));
  }
  
  pelvisMom = smoothSignal(pelvisMom, 11);
  torsoMom = smoothSignal(torsoMom, 11);
  armsMom = smoothSignal(armsMom, 11);
  
  const pelvisMax = Math.max(...pelvisMom.slice(startFrame, contactFrame));
  const torsoMax = Math.max(...torsoMom.slice(startFrame, contactFrame));
  
  if (torsoMax < pelvisMax * 0.1) dataQualityFlags.push('WEAK_TORSO_SIGNAL');
  
  const pelvisVel = computeVelocity(pelvisMom, fps);
  const torsoVel = computeVelocity(torsoMom, fps);
  const armsVel = computeVelocity(armsMom, fps);
  
  const pelvisVelPeak = findPeakInWindow(pelvisVel, startFrame, contactFrame);
  const torsoVelPeak = findPeakInWindow(torsoVel, startFrame, contactFrame);
  const armsVelPeak = findPeakInWindow(armsVel, startFrame, contactFrame);
  
  const pToTFrames = torsoVelPeak - pelvisVelPeak;
  const pToTMs = (pToTFrames / fps) * 1000;
  const pToTPct = swingDuration > 0 ? (pToTFrames / swingDuration) * 100 : 0;
  const whipTimingPct = swingDuration > 0 ? ((torsoVelPeak - startFrame) / swingDuration) * 100 : 50;
  
  const pelvisPeakVel = pelvisVel[pelvisVelPeak] || 0;
  const torsoPeakVel = torsoVel[torsoVelPeak] || 0;
  const transferRatio = Math.abs(pelvisPeakVel) > 0.01 ? Math.abs(torsoPeakVel / pelvisPeakVel) : 0;
  
  let transferRatioRating: 'elite' | 'good' | 'developing' | 'priority';
  if (transferRatio >= 1.5 && transferRatio <= 1.8) transferRatioRating = 'elite';
  else if (transferRatio >= 1.3 && transferRatio < 1.5) transferRatioRating = 'good';
  else if (transferRatio >= 1.0 && transferRatio < 1.3) transferRatioRating = 'developing';
  else transferRatioRating = 'priority';
  
  const pelvisVelAtContact = pelvisVel[contactFrame] || 0;
  const torsoVelAtContact = torsoVel[contactFrame] || 0;
  const armsVelAtContact = armsVel[armsVelPeak] || 0;
  
  const pelvisDecel = pelvisVelAtContact < pelvisPeakVel * 0.5;
  const torsoDecel = torsoVelAtContact < torsoPeakVel * 0.5;
  const armsDecel = armsVelAtContact < (armsVel[armsVelPeak] || 0) * 0.5;
  const allSegmentsDecel = pelvisDecel && torsoDecel;
  
  const peaks: [number, string][] = [[pelvisVelPeak, 'P'], [torsoVelPeak, 'T'], [armsVelPeak, 'A']];
  peaks.sort((a, b) => a[0] - b[0]);
  const sequence = peaks.map(p => p[1]).join('→');
  
  const toleranceFrames = Math.round(fps * 0.015);
  const sequenceCorrect = pelvisVelPeak <= torsoVelPeak + toleranceFrames && torsoVelPeak <= armsVelPeak + toleranceFrames;
  
  let motorProfile: SwingAnalysisResult['motor_profile'];
  let confidence = 0.5;
  let spinnerScore = 0, whipperScore = 0, slingshotterScore = 0, titanScore = 0;
  
  const absGap = Math.abs(pToTMs);
  
  if (dataQualityFlags.length > 0) {
    motorProfile = 'DATA_QUALITY_ISSUE';
    confidence = 0.9;
  } else if (!sequenceCorrect) {
    motorProfile = 'SEQUENCE_ISSUE';
    confidence = 0.8;
  } else {
    if (absGap < 30) { spinnerScore = 80; if (pelvisDecel) spinnerScore += 10; if (whipTimingPct < 60) spinnerScore += 10; }
    else if (absGap < 45) spinnerScore = 40;
    
    if (absGap >= 25 && absGap <= 55) { whipperScore = 80; if (allSegmentsDecel) whipperScore += 10; if (transferRatio >= 1.4 && transferRatio <= 1.9) whipperScore += 10; }
    else if (absGap >= 15 && absGap <= 65) whipperScore = 50;
    
    if (absGap >= 45 && absGap <= 80) { slingshotterScore = 80; if (whipTimingPct > 70) slingshotterScore += 10; }
    else if (absGap > 35) slingshotterScore = 40;
    
    const scores = { SPINNER: spinnerScore, WHIPPER: whipperScore, SLINGSHOTTER: slingshotterScore, TITAN: titanScore };
    const maxScore = Math.max(...Object.values(scores));
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    
    if (maxScore === spinnerScore) motorProfile = 'SPINNER';
    else if (maxScore === whipperScore) motorProfile = 'WHIPPER';
    else if (maxScore === slingshotterScore) motorProfile = 'SLINGSHOTTER';
    else motorProfile = 'TITAN';
    
    confidence = totalScore > 0 ? maxScore / totalScore : 0.5;
    if (allSegmentsDecel) confidence = Math.min(0.95, confidence + 0.1);
  }
  
  let xFactorMax: number | undefined;
  let xFactorAtContact: number | undefined;
  
  if (ikData && ikData.length > 0) {
    const xFactor = ikData.map(r => Math.abs((r.torso_rot || 0) - (r.pelvis_rot || 0)));
    xFactorMax = Math.max(...xFactor.slice(startFrame, contactFrame));
    xFactorAtContact = xFactor[contactFrame] || 0;
  }
  
  return {
    movement_id: movementId,
    fps,
    swing_duration_ms: (swingDuration / fps) * 1000,
    pelvis_vel_peak_frame: pelvisVelPeak,
    torso_vel_peak_frame: torsoVelPeak,
    arms_vel_peak_frame: armsVelPeak,
    contact_frame: contactFrame,
    transfer_ratio: Math.round(transferRatio * 100) / 100,
    transfer_ratio_rating: transferRatioRating,
    peak_timing_gap_ms: Math.round(pToTMs),
    peak_timing_gap_pct: Math.round(pToTPct * 10) / 10,
    whip_timing_pct: Math.round(whipTimingPct * 10) / 10,
    pelvis_decel_before_contact: pelvisDecel,
    torso_decel_before_contact: torsoDecel,
    arms_decel_before_contact: armsDecel,
    all_segments_decel: allSegmentsDecel,
    sequence,
    sequence_correct: sequenceCorrect,
    motor_profile: motorProfile,
    motor_profile_confidence: Math.round(confidence * 100) / 100,
    spinner_score: spinnerScore,
    whipper_score: whipperScore,
    slingshotter_score: slingshotterScore,
    titan_score: titanScore,
    x_factor_max: xFactorMax,
    x_factor_at_contact: xFactorAtContact,
    data_quality_flags: dataQualityFlags,
  };
}

// ============================================================================
// SESSION ANALYSIS
// ============================================================================

export function analyzeSession(momentumCSVText: string, ikCSVText?: string): SwingAnalysisResult[] {
  const momentumData = parseCSV<MomentumRow>(momentumCSVText);
  const ikData = ikCSVText ? parseCSV<IKRow>(ikCSVText) : undefined;
  
  const movementIds = [...new Set(momentumData.map(r => r.org_movement_id))];
  const results: SwingAnalysisResult[] = [];
  
  for (const movementId of movementIds) {
    const momSubset = momentumData.filter(r => r.org_movement_id === movementId);
    const ikSubset = ikData?.filter(r => r.org_movement_id === movementId);
    
    if (momSubset.length < 50) continue;
    
    try {
      const result = analyzeSwingV4(momSubset, ikSubset);
      results.push(result);
    } catch (e) {
      console.error(`Error analyzing ${movementId}:`, e);
    }
  }
  
  return results;
}

// ============================================================================
// SUPABASE INTEGRATION
// ============================================================================

export async function saveSwingAnalysis(playerId: string, sessionId: string, result: SwingAnalysisResult, rebootFilePath?: string): Promise<string> {
  const { data, error } = await supabase
    .from('swing_analysis')
    .insert({
      player_id: playerId,
      session_id: sessionId,
      movement_id: result.movement_id,
      frame_rate: result.fps,
      duration_seconds: result.swing_duration_ms / 1000,
      event_contact_frame: result.contact_frame,
      pelvis_vel_peak_frame: result.pelvis_vel_peak_frame,
      torso_vel_peak_frame: result.torso_vel_peak_frame,
      arms_vel_peak_frame: result.arms_vel_peak_frame,
      transfer_ratio: result.transfer_ratio,
      transfer_ratio_rating: result.transfer_ratio_rating,
      peak_timing_gap_ms: result.peak_timing_gap_ms,
      peak_timing_gap_pct: result.peak_timing_gap_pct,
      whip_timing_pct: result.whip_timing_pct,
      pelvis_decel_before_contact: result.pelvis_decel_before_contact,
      torso_decel_before_contact: result.torso_decel_before_contact,
      arms_decel_before_contact: result.arms_decel_before_contact,
      all_segments_decel: result.all_segments_decel,
      sequence: result.sequence,
      sequence_correct: result.sequence_correct,
      x_factor_max: result.x_factor_max,
      x_factor_at_contact: result.x_factor_at_contact,
      motor_profile: result.motor_profile,
      motor_profile_confidence: result.motor_profile_confidence,
      spinner_score: result.spinner_score,
      whipper_score: result.whipper_score,
      slingshotter_score: result.slingshotter_score,
      titan_score: result.titan_score,
      data_quality_flags: result.data_quality_flags,
      reboot_file_path: rebootFilePath,
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function saveSwingFlags(swingId: string, result: SwingAnalysisResult): Promise<void> {
  const flags: Array<{
    swing_id: string;
    flag_type: string;
    segment: string;
    severity: string;
    message: string;
    pillar: string;
    drill_tags: string[];
  }> = [];
  
  if (!result.sequence_correct) {
    flags.push({
      swing_id: swingId,
      flag_type: 'SEQUENCE_ISSUE',
      segment: 'kinetic_chain',
      severity: 'warning',
      message: `Sequence ${result.sequence} - expected P→T→A`,
      pillar: 'BODY',
      drill_tags: ['#Sequencing', '#Connection'],
    });
  }
  
  if (!result.pelvis_decel_before_contact) {
    flags.push({
      swing_id: swingId,
      flag_type: 'DECEL_FAILURE',
      segment: 'pelvis',
      severity: 'critical',
      message: 'Pelvis still accelerating at contact',
      pillar: 'BODY',
      drill_tags: ['#EnergyLeak', '#TransferRatio'],
    });
  }
  
  if (!result.torso_decel_before_contact) {
    flags.push({
      swing_id: swingId,
      flag_type: 'DECEL_FAILURE',
      segment: 'torso',
      severity: 'warning',
      message: 'Torso still accelerating at contact',
      pillar: 'BODY',
      drill_tags: ['#EnergyLeak', '#Tempo'],
    });
  }
  
  for (const flag of result.data_quality_flags) {
    flags.push({
      swing_id: swingId,
      flag_type: 'DATA_QUALITY',
      segment: flag.toLowerCase().includes('torso') ? 'torso' : 
               flag.toLowerCase().includes('arms') ? 'arms' : 'unknown',
      severity: 'info',
      message: `Data quality issue: ${flag}`,
      pillar: 'BODY',
      drill_tags: [],
    });
  }
  
  if (flags.length > 0) {
    const { error } = await supabase.from('swing_flags').insert(flags);
    if (error) console.error('Error saving flags:', error);
  }
}

export async function analyzeRebootSession(
  momentumCSVText: string, 
  ikCSVText: string | undefined, 
  playerId: string, 
  sessionId: string, 
  rebootFilePath?: string
): Promise<SwingAnalysisResult[]> {
  const results = analyzeSession(momentumCSVText, ikCSVText);
  
  for (const result of results) {
    try {
      const swingId = await saveSwingAnalysis(playerId, sessionId, result, rebootFilePath);
      await saveSwingFlags(swingId, result);
    } catch (e) {
      console.error(`Error saving ${result.movement_id}:`, e);
    }
  }
  
  return results;
}

// ============================================================================
// SUMMARY
// ============================================================================

export interface SessionSummary {
  totalSwings: number;
  dominantProfile: string;
  profileConsistency: number;
  avgTimingGap: number;
  sequenceRate: number;
  decelRate: number;
}

export function getSessionSummary(results: SwingAnalysisResult[]): SessionSummary {
  if (results.length === 0) {
    return { totalSwings: 0, dominantProfile: 'UNKNOWN', profileConsistency: 0, avgTimingGap: 0, sequenceRate: 0, decelRate: 0 };
  }
  
  const profileCounts: Record<string, number> = {};
  for (const r of results) {
    profileCounts[r.motor_profile] = (profileCounts[r.motor_profile] || 0) + 1;
  }
  
  const dominantProfile = Object.entries(profileCounts).sort((a, b) => b[1] - a[1])[0][0];
  const profileConsistency = profileCounts[dominantProfile] / results.length;
  const avgTimingGap = results.reduce((sum, r) => sum + r.peak_timing_gap_ms, 0) / results.length;
  const sequenceRate = results.filter(r => r.sequence_correct).length / results.length;
  const decelRate = results.filter(r => r.all_segments_decel).length / results.length;
  
  return {
    totalSwings: results.length,
    dominantProfile,
    profileConsistency: Math.round(profileConsistency * 100),
    avgTimingGap: Math.round(avgTimingGap),
    sequenceRate: Math.round(sequenceRate * 100),
    decelRate: Math.round(decelRate * 100),
  };
}
