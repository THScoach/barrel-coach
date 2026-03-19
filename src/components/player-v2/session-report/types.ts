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

/** Extract pelvis KE — try legacy avgLegsKE or avgTotalKE proxy */
export function getPelvisKE(m: RawMetrics): number | null {
  return m.avgLegsKE ?? m.avgTotalKE ?? null;
}

/** Arms KE as percentage of total */
export function getArmsKEPct(m: RawMetrics): number | null {
  if (m.avgArmsKE != null && m.avgTotalKE != null && m.avgTotalKE > 0) {
    return (m.avgArmsKE / m.avgTotalKE) * 100;
  }
  if (m.avgTorsoToArmsTransfer != null) return m.avgTorsoToArmsTransfer;
  return null;
}

export function isSequenceReversed(m: RawMetrics): boolean {
  if (m.beat && typeof m.beat === 'string') {
    return m.beat.toLowerCase().includes('reversed') || m.beat.toLowerCase().includes('torso → hips');
  }
  if (m.pelvis_torso_gap_ms != null && m.pelvis_torso_gap_ms < 0) return true;
  return false;
}
