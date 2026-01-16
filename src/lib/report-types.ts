// ============================================================================
// Swing Report Types - Player-facing coaching report data structure
// Uses snake_case to match backend API contract
// 
// CANONICAL SCHEMA: All optional sections use { present: boolean } pattern
// List sections use { present: boolean, items: T[] }
// ============================================================================

// Contract version - update when schema changes
export type ContractVersion = "2026-01-14";

// ============================================================================
// DATA SOURCE TYPES - Unified 2D/3D Analysis Support
// ============================================================================

/** Data source identifier for analysis origin */
export type DataSource = '2d_video' | '3d_reboot';

/** Confidence level for measurements based on data source */
export type MeasurementConfidence = 'measured' | 'estimate' | 'inferred';

/** Metadata about analysis data provenance */
export interface AnalysisSourceMeta {
  source: DataSource;
  confidence: MeasurementConfidence;
  /** Original session/upload ID from source system */
  source_id?: string;
  /** Timestamp of source data capture */
  captured_at?: string;
}

/** 2D video-specific analysis metadata */
export interface VideoAnalysisMeta {
  source: '2d_video';
  frame_rate?: number;
  resolution?: { width: number; height: number };
  camera_angle?: 'side' | 'back' | 'front' | 'high_home' | 'unknown';
  video_url?: string;
  thumbnail_url?: string;
}

/** 3D Reboot motion capture metadata */
export interface RebootAnalysisMeta {
  source: '3d_reboot';
  /** Reboot session ID */
  reboot_session_id?: string;
  /** Reboot player ID */
  reboot_player_id?: string;
  /** Number of markers tracked */
  marker_count?: number;
  /** CSV file reference */
  csp_file_url?: string;
}

// ============================================================================
// UNIFIED METRICS - Source-agnostic measurement types
// ============================================================================

/** A single metric with source-aware confidence */
export interface UnifiedMetric<T = number> {
  value: T;
  confidence: MeasurementConfidence;
  source: DataSource;
  /** Unit of measurement (e.g., 'mph', 'deg', 'ms') */
  unit?: string;
  /** Raw value before normalization (if applicable) */
  raw_value?: number;
}

/** Timing metric in milliseconds relative to contact */
export interface TimingMetric extends UnifiedMetric<number> {
  unit: 'ms';
  /** Frame number if from video */
  frame?: number;
  /** Phase name (e.g., 'load', 'stride', 'contact') */
  phase?: string;
}

/** Angular metric in degrees */
export interface AngularMetric extends UnifiedMetric<number> {
  unit: 'deg';
  /** Peak value during swing */
  peak?: number;
  /** Frame/time at peak */
  peak_at?: number;
}

/** Velocity metric */
export interface VelocityMetric extends UnifiedMetric<number> {
  unit: 'mph' | 'deg/s' | 'rad/s';
  /** Peak value during swing */
  peak?: number;
}

/** Kinetic energy metric */
export interface EnergyMetric extends UnifiedMetric<number> {
  unit: 'J' | 'normalized';
  /** Segment this energy belongs to */
  segment?: 'pelvis' | 'torso' | 'arms' | 'bat' | 'total';
}

/** Unified biomechanics data structure (works for both 2D and 3D) */
export interface UnifiedBiomechanics {
  /** Pelvis rotation metrics */
  pelvis_rotation?: AngularMetric;
  pelvis_velocity?: VelocityMetric;
  
  /** Torso/trunk metrics */
  torso_rotation?: AngularMetric;
  torso_velocity?: VelocityMetric;
  
  /** X-factor (hip-shoulder separation) */
  x_factor?: AngularMetric;
  x_factor_stretch?: AngularMetric;
  
  /** Bat metrics */
  bat_speed?: VelocityMetric;
  bat_angle?: AngularMetric;
  
  /** Timing relative to contact (negative = before) */
  pelvis_peak_timing?: TimingMetric;
  torso_peak_timing?: TimingMetric;
  hands_peak_timing?: TimingMetric;
  
  /** Kinetic chain energy flow */
  pelvis_ke?: EnergyMetric;
  torso_ke?: EnergyMetric;
  arms_ke?: EnergyMetric;
  bat_ke?: EnergyMetric;
  
  /** Contact frame detection method */
  contact_detection_method?: 'explicit' | 'hand_decel' | 'bat_ke_peak' | 'torso_peak' | 'frame_ratio';
}

/** Source-aware 4B scores with confidence */
export interface Unified4BScores {
  brain: UnifiedMetric;
  body: UnifiedMetric;
  bat: UnifiedMetric;
  ball: UnifiedMetric;
  composite: UnifiedMetric;
  
  /** Expected vs actual bat speed (for mechanical loss) */
  bat_speed_actual?: VelocityMetric;
  bat_speed_expected?: VelocityMetric;
  mechanical_loss_mph?: UnifiedMetric;
}

/** Metric comparison against benchmark (player vs population/pro) */
export interface MetricComparison {
  /** Player's numeric value */
  player_value: number;
  /** Player's display string (e.g., "85 mph", "42°") */
  player_raw: string;
  /** Benchmark numeric value */
  benchmark_value: number;
  /** Benchmark display string */
  benchmark_raw: string;
  /** Comparison status */
  status: 'above' | 'at' | 'below' | 'elite' | 'needs_work';
}

/** Extended comparison with additional context */
export interface MetricComparisonExtended extends MetricComparison {
  /** Metric identifier */
  metric_id: string;
  /** Human-readable metric name */
  metric_name: string;
  /** Percentile within comparison population */
  percentile?: number;
  /** Delta from benchmark */
  delta?: number;
  /** Unit of measurement */
  unit?: string;
  /** Data source for this metric */
  source?: DataSource;
  /** Confidence level */
  confidence?: MeasurementConfidence;
}

export interface ReportPlayer {
  name: string;
  age?: number | null;
  level?: string | null;
  handedness?: 'R' | 'L' | 'S' | null;
}

export interface ReportSession {
  id: string;
  date: string;
  player: ReportPlayer;
}

export interface ScoreDeltas {
  body?: number;
  brain?: number;
  bat?: number;
  ball?: number;
  composite?: number;
}

export interface FourBScoreData {
  body: number;
  brain: number;
  bat: number;
  ball: number;
  composite: number;
  deltas?: ScoreDeltas;
}

// ============================================================================
// SECTION TYPES: All use { present: boolean } pattern for API responses
// Component props use the "Props" suffix versions without present flag
// ============================================================================

/** API response type - includes present flag */
export interface KineticPotential {
  present: boolean;
  ceiling?: number;
  current?: number;
}

/** Component prop type - data only */
export interface KineticPotentialProps {
  ceiling: number;
  current: number;
}

/** API response type - includes present flag */
export interface PrimaryLeak {
  present: boolean;
  title?: string;
  description?: string;
  why_it_matters?: string;
  frame_url?: string;
  loop_url?: string;
}

/** Component prop type - data only */
export interface PrimaryLeakProps {
  title: string;
  description: string;
  why_it_matters: string;
  frame_url?: string;
  loop_url?: string;
}

export interface FixOrderItem {
  label: string;
  feel_cue: string;
  completed?: boolean;
}

export interface FixOrderSection {
  present: boolean;
  items: FixOrderItem[];
  do_not_chase?: string[];
}

export interface SquareUpWindow {
  present: boolean;
  grid?: number[][];
  best_zone?: string;
  avoid_zone?: string;
  coach_note?: string;
}

export interface WeaponMetric {
  name: string;
  value: number | string;
  meaning: string;
}

export interface WeaponPanel {
  present: boolean;
  metrics: WeaponMetric[];
}

export interface BallOutcome {
  name: string;
  value: number | string;
  unit?: string;
}

export interface BallPanel {
  present: boolean;
  is_projected: boolean;
  outcomes: BallOutcome[];
}

export interface Drill {
  id: string;
  name: string;
  coaching_cue: string;
  reps: string;
  loop_url?: string;
  demo_url?: string;
}

export interface DrillsSection {
  present: boolean;
  items: Drill[];
}

export interface SessionHistoryItem {
  id: string;
  date: string;
  composite_score: number;
  delta?: number;
}

export interface SessionHistorySection {
  present: boolean;
  items: SessionHistoryItem[];
}

export interface Badge {
  id: string;
  name: string;
  earned: boolean;
  earned_date?: string;
}

/** API response type - includes present flag */
export interface CoachNote {
  present: boolean;
  text?: string;
  audio_url?: string;
}

/** Component prop type - data only */
export interface CoachNoteProps {
  text: string;
  audio_url?: string;
}

// ============================================================================
// BARREL SLING INDEX TYPES
// ============================================================================

export interface BarrelSlingNotes {
  good: string;
  leak: string;
}

/** API response type - includes present flag */
export interface BarrelSlingPanel {
  present: boolean;
  barrel_sling_score?: number;
  sling_load_score?: number;
  sling_start_score?: number;
  sling_deliver_score?: number;
  notes?: BarrelSlingNotes;
  confidence?: 'measured' | 'estimate';
}

// ============================================================================
// MAIN REPORT DATA STRUCTURE - CANONICAL SCHEMA
// All sections MUST be present in API response (even if present:false)
// ============================================================================

export interface SwingReportData {
  // Contract metadata
  contract_version: ContractVersion;
  generated_at: string;
  
  // Source metadata - indicates 2D or 3D origin
  source_meta?: AnalysisSourceMeta;
  video_meta?: VideoAnalysisMeta;
  reboot_meta?: RebootAnalysisMeta;
  
  // Core data (always present)
  session: ReportSession;
  scores: FourBScoreData;
  
  // Optional sections - all MUST exist in response with { present: boolean }
  kinetic_potential: KineticPotential;
  primary_leak: PrimaryLeak;
  fix_order: FixOrderSection;
  square_up_window: SquareUpWindow;
  weapon_panel: WeaponPanel;
  ball_panel: BallPanel;
  barrel_sling_panel: BarrelSlingPanel;
  drills: DrillsSection;
  session_history: SessionHistorySection;
  coach_note: CoachNote;
  
  // Badges are always an array (can be empty)
  badges: Badge[];
}

// ============================================================================
// HELPER FUNCTIONS for component rendering
// ============================================================================

/** Check if a section with present flag is actually present */
export function isPresent<T extends { present: boolean }>(section: T | undefined): section is T & { present: true } {
  return section?.present === true;
}

/** Get items from a section with items array */
export function getItems<T>(section: { present: boolean; items: T[] } | undefined): T[] {
  return section?.items ?? [];
}

/** Safe accessor for optional section data - returns undefined if not present */
export function getSectionData<T extends { present: boolean }>(
  section: T | undefined
): Omit<T, 'present'> | undefined {
  if (!section?.present) return undefined;
  const { present, ...data } = section;
  return data as Omit<T, 'present'>;
}
