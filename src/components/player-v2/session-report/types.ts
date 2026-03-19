export type EnergyStatus = 'IMPROVING' | 'ON_TARGET' | 'WORKING' | 'PRIORITY';

export interface RawMetrics {
  // From compute-4b-from-csv (new format)
  pelvis_torso_gap_ms?: number;
  pelvis_torso_gain?: number;
  torso_arm_gain?: number;
  arm_bat_gain?: number;
  transfer_ratio?: number;
  transfer_efficiency?: number;
  brake_efficiency?: number;
  torso_velocity?: number;
  arm_velocity?: number;
  bat_speed_mph?: number;
  exit_velocity_mph?: number;
  x_factor_deg?: number;
  timing_gap_pct?: number;
  ke_brake_ms?: number;
  ke_cascade_ms?: number;
  swing_duration_ms?: number;
  swing_classification?: string;
  beat?: string;
  energy_flow?: Record<string, string>;
  root_cause?: { issue?: string; what?: string; build?: string };
  story?: { base?: string; rhythm?: string; barrel?: string };
  // NEW: Energy Delivery Report fields
  pelvis_ke?: number;
  arms_ke?: number;
  total_ke?: number;
  arms_ke_pct?: number;
  trunk_tilt_contact?: number;
  tke_shape?: string;
  swing_count?: number;
  correct_sequence_count?: number;
  pelvis_angular_velocity?: number;
  // Legacy format
  avgPelvisVelocity?: number;
  avgTorsoVelocity?: number;
  avgTorsoKE?: number;
  avgArmsKE?: number;
  avgBatKE?: number;
  avgLegsKE?: number;
  avgTotalKE?: number;
  avgXFactor?: number;
  avgTorsoToArmsTransfer?: number;
  avgBatEfficiency?: number;
  swingCount?: number;
}

export interface KRSData {
  coach_barrels_voice_sample?: string | null;
  summary_player_text?: string | null;
  summary_coach_text?: string | null;
  main_constraint?: string | null;
  weakest_b?: string | null;
  focus_next_bp?: string | null;
  recommended_drills?: any;
  coach_barrels_prescription?: any;
}

export interface BaselineMetrics {
  pelvisKE: number | null;
  armsKEPct: number | null;
  totalKE: number | null;
}

export const STATUS_COLORS: Record<EnergyStatus, string> = {
  IMPROVING: '#4ecdc4',
  ON_TARGET: '#14B8A6',
  WORKING: '#F97316',
  PRIORITY: '#E63946',
};

export function statusLabel(s: EnergyStatus): string {
  return s.replace('_', ' ');
}

/** Extract pelvis KE or velocity with unit — prefer pelvis_ke (J), fallback to angular velocity (°/s) */
export function getPelvisKE(m: RawMetrics): { value: number | null; unit: string } {
  // Priority 1: new KE field (Joules)
  if (m.pelvis_ke != null && m.pelvis_ke > 0) {
    return { value: Math.round(m.pelvis_ke), unit: 'J' };
  }
  // Priority 2: angular velocity (°/s)
  const velocity = m.pelvis_angular_velocity ?? m.avgPelvisVelocity;
  if (velocity != null && velocity > 0) {
    return { value: Math.round(velocity), unit: '°/s' };
  }
  return { value: null, unit: '' };
}

/** Arms KE as percentage of total — prefer arms_ke_pct, fallback to energy_flow, then torso_arm_gain */
export function getArmsKEPct(m: RawMetrics): { value: number | null; estimated: boolean } {
  // Priority 1: new arms_ke_pct field
  if (m.arms_ke_pct != null) {
    return { value: Math.round(m.arms_ke_pct * 10) / 10, estimated: false };
  }
  // Priority 2: derive from energy_flow qualitative labels
  const armsToBarrel = m.energy_flow?.arms_to_barrel;
  if (armsToBarrel === 'STRONG') return { value: 65, estimated: true };
  if (armsToBarrel === 'OK') return { value: 45, estimated: true };
  if (armsToBarrel === 'WEAK') return { value: 30, estimated: true };
  // Priority 3: derive from torso_arm_gain
  if (m.torso_arm_gain != null) {
    const gain = m.torso_arm_gain;
    if (gain > 1.5) return { value: 40, estimated: true };
    if (gain >= 1.0) return { value: 55, estimated: true };
    return { value: 70, estimated: true };
  }
  return { value: null, estimated: false };
}

export function isSequenceReversed(m: RawMetrics): boolean {
  if (m.beat && typeof m.beat === 'string') {
    return m.beat.toLowerCase().includes('reversed') || m.beat.toLowerCase().includes('torso → hips');
  }
  if (m.pelvis_torso_gap_ms != null && m.pelvis_torso_gap_ms < 0) return true;
  return false;
}

/** Get coach take with contradiction override */
export function getCoachTake(m: RawMetrics): { issue: string; what: string } {
  const beat = m.beat ?? '';
  const rootCause = m.root_cause ?? {};
  let issue = rootCause.issue ?? '';
  let what = rootCause.what ?? '';

  const isInverted = beat.toLowerCase().includes('reversed');
  const isFalsePositive = what.toLowerCase().includes('functioning well') &&
    issue.toLowerCase().includes('none detected');

  // Override contradictory text for inverted sequences
  if (isInverted && isFalsePositive) {
    const velocity = m.pelvis_angular_velocity ?? m.avgPelvisVelocity;
    if (velocity != null && velocity > 600) {
      issue = 'Late pelvis — timing problem, not force problem';
      what = 'Pelvis has velocity but fires after the torso. Energy sequence is inverted.';
    } else {
      issue = 'Dead pelvis — force production deficit';
      what = 'Pelvis is not generating enough force and sequence is inverted.';
    }
  }

  // Also flag brake failure if present
  const brakeEfficiency = m.brake_efficiency;
  if (brakeEfficiency === 0 && !issue.includes('Brake')) {
    issue += issue ? ' + Brake failure (0% efficiency)' : 'Brake failure (0% efficiency)';
  }

  return { issue, what };
}

/** Get next step text with fallback logic */
export function getNextStep(m: RawMetrics): string {
  const rootCause = m.root_cause ?? {};
  const beat = m.beat ?? '';
  const build = rootCause.build ?? '';
  const isInverted = beat.toLowerCase().includes('reversed');

  if (build && build.length > 0) {
    if (build === 'pelvis_initiation') {
      return 'Focus: pelvis initiation timing — constraint drills that force the hips to lead.';
    }
    if (build === 'pelvis_force') {
      return 'Focus: pelvis force production — ground force drills, posterior chain activation.';
    }
    if (build === 'brake_mechanism') {
      return 'Focus: brake mechanism — deceleration drills to transfer energy from body to bat.';
    }
    return `Focus: ${build}`;
  }

  if (isInverted) {
    return 'Focus: pelvis initiation timing';
  }

  if (m.brake_efficiency === 0) {
    return 'Focus: brake mechanism and energy transfer';
  }

  const what = rootCause.what ?? '';
  if (what.toLowerCase().includes('functioning well')) {
    return 'Swing is functioning well — maintain current patterns.';
  }

  return 'No specific recommendation available.';
}
