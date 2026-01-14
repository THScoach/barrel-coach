// ============================================================================
// Swing Report Types - Player-facing coaching report data structure
// Uses snake_case to match backend API contract
// 
// CANONICAL SCHEMA: All optional sections use { present: boolean } pattern
// List sections use { present: boolean, items: T[] }
// ============================================================================

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
  metrics?: WeaponMetric[];
}

export interface BallOutcome {
  name: string;
  value: number | string;
  unit?: string;
}

export interface BallPanelProjected {
  present: boolean;
  outcomes?: BallOutcome[];
}

export interface BallPanel {
  present: boolean;
  projected?: BallPanelProjected;
  outcomes?: BallOutcome[];
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
// MAIN REPORT DATA STRUCTURE
// ============================================================================

export interface SwingReportData {
  session: ReportSession;
  scores: FourBScoreData;
  kinetic_potential: KineticPotential;
  primary_leak: PrimaryLeak;
  fix_order: FixOrderSection;
  square_up_window: SquareUpWindow;
  weapon_panel: WeaponPanel;
  ball_panel: BallPanel;
  drills: DrillsSection;
  session_history: SessionHistorySection;
  badges?: Badge[];
  coach_note: CoachNote;
  barrel_sling_panel: BarrelSlingPanel;
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
