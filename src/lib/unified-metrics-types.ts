/**
 * Unified Metrics Types for 2D/3D Swing Analysis
 * Standalone file - can be imported alongside report-types.ts
 */

// ============================================================================
// Core Type Definitions
// ============================================================================

/** Data source for metrics */
export type DataSource = '2d_video' | '3d_reboot';

/** Product tier for access control */
export type ProductTier = 'free' | 'krs' | 'membership' | 'assessment';

/** Grade values on 20-80 scouting scale (with half grades) */
export type Grade = '20' | '30' | '40' | '45' | '50' | '55' | '60' | '65' | '70' | '80';

/** Grade labels for 20-80 scouting scale */
export type GradeLabel = 
  | 'Well Below' 
  | 'Below Average' 
  | 'Fringe' 
  | 'Average' 
  | 'Above Average' 
  | 'Plus' 
  | 'Plus Plus' 
  | 'Elite';

/** Comparison status against benchmarks */
export type ComparisonStatus = 'similar' | 'above' | 'below' | 'room_to_grow';

/** Motor profile swing types */
export type MotorType = 'spinner' | 'slingshotter' | 'whipper' | 'titan';

/** Confidence level for motor profile classification */
export type ProfileConfidence = 'hint' | 'likely' | 'confirmed';

/** Bracing timing status for lead leg */
export type BraceStatus = 'early_brace' | 'on_time' | 'late_brace';

/** Measurement confidence based on data source */
export type MeasurementConfidence = 'estimated' | 'measured';

// ============================================================================
// Core Metric Interfaces
// ============================================================================

/**
 * Base interface for all scored metrics
 * Provides raw display value, numeric value, and 20-80 scale scoring
 */
export interface MetricValue {
  /** Display string: "+75ms", "2.1:1", "26°" */
  raw: string;
  /** Numeric value: 75, 2.1, 26 */
  value: number;
  /** 20-80 scale score */
  score_20_80: number;
  /** Grade on 20-80 scale: '20' through '80' */
  grade: Grade;
  /** Human-readable grade label */
  grade_label: GradeLabel;
}

/**
 * Benchmark comparison for comparing player metrics against population/pro norms
 */
export interface BenchmarkComparison {
  /** Player's metric value */
  player: MetricValue;
  /** Benchmark/population metric value */
  benchmark: MetricValue;
  /** Comparison status */
  status: ComparisonStatus;
  /** Numeric difference between player and benchmark */
  delta?: number;
  /** Player's percentile rank */
  percentile?: number;
}

// ============================================================================
// Brain Metrics (B1) - Timing and Sequencing
// ============================================================================

/**
 * Brain metrics - timing, sequencing, and synchronization data
 */
export interface BrainMetrics {
  /** Whether brain metrics are available */
  present: boolean;
  /** Load sequence timing, e.g., +75ms */
  load_sequence: MetricValue;
  /** Tempo ratio, e.g., 2.1:1 */
  tempo: MetricValue;
  /** Hip-shoulder separation angle, e.g., 26° */
  separation: MetricValue;
  /** Overall synchronization score */
  sync_score: MetricValue;
  /** Optional brain score as MetricValue */
  brain_score?: MetricValue;
  /** Composite brain score combining all brain metrics */
  composite: MetricValue;
  
  /** Benchmark comparisons for each metric */
  benchmarks: {
    load_sequence: BenchmarkComparison;
    tempo: BenchmarkComparison;
    separation: BenchmarkComparison;
  };
}

// ============================================================================
// Motor Profile - Swing Type Classification
// ============================================================================

/**
 * Motor profile classification for swing type
 */
export interface MotorProfile {
  /** Suggested motor type classification */
  suggested: MotorType;
  /** Confidence level in the classification */
  confidence: ProfileConfidence;
  /** Reasoning for the classification */
  reasoning: string;
  /** Key characteristics that led to this classification */
  characteristics: string[];
}

// ============================================================================
// Lead Leg Braking Metrics
// ============================================================================

/**
 * Lead leg braking mechanics - front leg data
 * Negative brace_timing_ms = early brace (good, before hip peak)
 * Positive brace_timing_ms = late brace (needs work, after hip peak)
 */
export interface LeadLegBrakingMetrics {
  /** Whether lead leg metrics are available */
  present: boolean;
  /** Brace timing in ms - negative = early (good), positive = late (bad) */
  brace_timing_ms: number;
  /** Brace timing classification */
  brace_timing_status: BraceStatus;
  /** Knee angle at front foot strike (degrees) */
  knee_angle_at_ffs?: number;
  /** Knee angle at contact (degrees) */
  knee_angle_at_contact?: number;
  /** Knee extension range through swing (degrees) */
  knee_extension_range?: number;
  /** Lead hip rise in inches */
  lead_hip_rise_inches?: number;
  /** Measurement confidence level */
  confidence: MeasurementConfidence;
  /** Human-readable interpretation */
  interpretation?: string;
}

// ============================================================================
// Body Metrics (B2) - Energy Transfer and Ground Force
// ============================================================================

/**
 * Body metrics - energy transfer and ground force data
 */
export interface BodyMetrics {
  /** Whether body metrics are available */
  present: boolean;
  /** Energy transfer ratio */
  transfer_ratio: MetricValue;
  /** Mechanical loss in MPH (MPH left on the table) */
  mechanical_loss_mph: MetricValue;
  /** Peak ground reaction force */
  peak_grf?: MetricValue;
  
  /** Segment velocities through kinetic chain */
  velocities: {
    pelvis_peak?: number;
    torso_peak?: number;
    arm_peak?: number;
    hand_peak?: number;
  };
  
  /** Lead leg braking data */
  lead_leg: LeadLegBrakingMetrics;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a raw value to 20-80 scouting scale
 * @param value - Raw numeric value
 * @param min - Minimum value (maps to 20, or 80 if inverted)
 * @param max - Maximum value (maps to 80, or 20 if inverted)
 * @param inverted - If true, lower values score higher (e.g., mechanical loss)
 * @returns Score on 20-80 scale
 */
export function to2080Scale(value: number, min: number, max: number, inverted: boolean = false): number {
  if (max === min) return 50; // Avoid division by zero
  const normalized = (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, normalized));
  const score = inverted 
    ? Math.round(80 - clamped * 60)  // Inverted: high value = low score
    : Math.round(20 + clamped * 60); // Normal: high value = high score
  return Math.max(20, Math.min(80, score));
}

/**
 * Get grade from 20-80 score (with half grades)
 * @param score - Score on 20-80 scale
 * @returns Grade string
 */
export function getGrade(score: number): Grade {
  if (score < 25) return '20';
  if (score < 35) return '30';
  if (score < 42) return '40';
  if (score < 48) return '45';
  if (score < 52) return '50';
  if (score < 58) return '55';
  if (score < 62) return '60';
  if (score < 68) return '65';
  if (score < 75) return '70';
  return '80';
}

/**
 * Get human-readable label from 20-80 score
 * @param score - Score on 20-80 scale
 * @returns Human-readable grade label
 */
export function getGradeLabel(score: number): GradeLabel {
  if (score < 25) return 'Well Below';
  if (score < 35) return 'Below Average';
  if (score < 42) return 'Fringe';
  if (score < 52) return 'Average';
  if (score < 58) return 'Above Average';
  if (score < 65) return 'Plus';
  if (score < 75) return 'Plus Plus';
  return 'Elite';
}

/**
 * Create a complete MetricValue from raw inputs
 * @param rawDisplay - Display string (e.g., "+75ms", "2.1:1", "26°")
 * @param numericValue - Numeric value
 * @param min - Minimum value for scaling
 * @param max - Maximum value for scaling
 * @param inverted - If true, lower values score higher
 * @returns Complete MetricValue object
 */
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

/**
 * Get brace status from timing in milliseconds
 * Negative = early brace (good), Positive = late brace (bad)
 * @param timingMs - Brace timing relative to hip peak
 * @returns BraceStatus classification
 */
export function getBraceStatus(timingMs: number): BraceStatus {
  if (timingMs < -30) return 'early_brace';
  if (timingMs <= 30) return 'on_time';
  return 'late_brace';
}
