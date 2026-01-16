/**
 * Unified Metrics Types for 2D/3D Swing Analysis
 */

export type DataSource = '2d_video' | '3d_reboot';

export type ConfidenceLevel = 'estimated' | 'measured';

export type ViewerTier = 'free' | 'krs' | 'membership' | 'assessment';

export interface MetricValue {
  raw: string;
  value: number;
  score_20_80: number;
  grade: '20' | '30' | '40' | '45' | '50' | '55' | '60' | '65' | '70' | '80';
  grade_label: 'Well Below' | 'Below Average' | 'Fringe' | 'Average' | 'Above Average' | 'Plus' | 'Plus Plus' | 'Elite';
}

export interface UnifiedMetrics {
  present: boolean;
  load_sequence: MetricValue;
  tempo: MetricValue;
  separation: MetricValue;
  sync_score: MetricValue;
  brain_score?: MetricValue;
  composite: MetricValue;
}

export interface LeadLegBraking {
  present: boolean;
  brace_timing_ms: number;
  brace_timing_status: 'early_brace' | 'on_time' | 'late_brace';
  knee_angle_at_ffs?: number;
  knee_angle_at_contact?: number;
  knee_extension_range?: number;
  lead_hip_rise_inches?: number;
  confidence: 'estimated' | 'measured';
  interpretation?: string;
}

export interface FreemanComparison {
  present: boolean;
  load_sequence: { 
    player_value: number; 
    player_raw: string; 
    benchmark_value: number; 
    benchmark_raw: string; 
    status: 'similar' | 'above' | 'below' | 'room_to_grow'; 
  };
  tempo: { 
    player_value: number; 
    player_raw: string; 
    benchmark_value: number; 
    benchmark_raw: string; 
    status: 'similar' | 'above' | 'below' | 'room_to_grow'; 
  };
  separation: { 
    player_value: number; 
    player_raw: string; 
    benchmark_value: number; 
    benchmark_raw: string; 
    status: 'similar' | 'above' | 'below' | 'room_to_grow'; 
  };
  note?: string;
}

export type MotorProfileType = 'spinner' | 'slingshotter' | 'whipper' | 'titan';

export interface MotorProfile {
  present: boolean;
  suggested: MotorProfileType;
  confidence: 'hint' | 'likely' | 'confirmed';
  reasoning?: string;
  characteristics?: string[];
}

export const FREEMAN_BENCHMARKS = {
  load_sequence: { value: 75, raw: '+75ms' },
  tempo: { value: 2.1, raw: '2.1:1' },
  separation: { value: 26, raw: '26°' }
} as const;

export function getGradeLabel(score: number): MetricValue['grade_label'] {
  if (score >= 80) return 'Elite';
  if (score >= 70) return 'Plus Plus';
  if (score >= 65) return 'Plus';
  if (score >= 60) return 'Above Average';
  if (score >= 55) return 'Average';
  if (score >= 50) return 'Fringe';
  if (score >= 45) return 'Below Average';
  return 'Well Below';
}

export function getGrade(score: number): MetricValue['grade'] {
  if (score >= 80) return '80';
  if (score >= 70) return '70';
  if (score >= 65) return '65';
  if (score >= 60) return '60';
  if (score >= 55) return '55';
  if (score >= 50) return '50';
  if (score >= 45) return '45';
  if (score >= 40) return '40';
  if (score >= 30) return '30';
  return '20';
}

export function to2080Scale(value: number, min: number, max: number, inverted: boolean = false): number {
  if (max === min) return 50;
  const normalized = (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, normalized));
  const score = inverted 
    ? Math.round(80 - clamped * 60)
    : Math.round(20 + clamped * 60);
  return Math.max(20, Math.min(80, score));
}

export function createMetricValue(
  rawDisplay: string,
  numericValue: number,
  min: number,
  max: number,
  inverted: boolean = false
): MetricValue {
  const score = to2080Scale(numericValue, min, max, inverted);
  return {
    raw: rawDisplay,
    value: numericValue,
    score_20_80: score,
    grade: getGrade(score),
    grade_label: getGradeLabel(score),
  };
}

export function getBraceStatus(timingMs: number): LeadLegBraking['brace_timing_status'] {
  if (timingMs < -30) return 'early_brace';
  if (timingMs <= 30) return 'on_time';
  return 'late_brace';
}

// Legacy type aliases for backward compatibility
export type GradeLabel = MetricValue['grade_label'];
export type Grade = MetricValue['grade'];
export type BraceStatus = LeadLegBraking['brace_timing_status'];
export type MeasurementConfidence = ConfidenceLevel;

// Legacy interface aliases
export type BrainMetrics = UnifiedMetrics;
export type LeadLegBrakingMetrics = LeadLegBraking;
