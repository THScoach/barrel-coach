// ============================================================================
// Swing Report Types - Player-facing coaching report data structure
// Uses snake_case to match backend API contract
// ============================================================================

export interface ReportPlayer {
  name: string;
  age?: number;
  level?: string;
  handedness?: 'R' | 'L' | 'S';
}

export interface ReportSession {
  id: string;
  date: string;
  player: ReportPlayer;
}

export interface FourBScoreData {
  body: number;
  brain: number;
  bat: number;
  ball: number;
  composite: number;
  deltas?: {
    body?: number;
    brain?: number;
    bat?: number;
    ball?: number;
    composite?: number;
  };
}

export interface KineticPotential {
  ceiling: number;
  current: number;
}

export interface PrimaryLeak {
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

export interface SquareUpWindow {
  present: boolean;
  grid?: number[][]; // 3x3 or 5x5 heatmap values
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

export interface SessionHistoryItem {
  id: string;
  date: string;
  composite_score: number;
  delta?: number;
}

export interface Badge {
  id: string;
  name: string;
  earned: boolean;
  earned_date?: string;
}

export interface CoachNote {
  text: string;
  audio_url?: string;
}

export interface SwingReportData {
  session: ReportSession;
  scores: FourBScoreData;
  kinetic_potential: KineticPotential;
  primary_leak: PrimaryLeak;
  fix_order: FixOrderItem[];
  do_not_chase: string[];
  square_up_window?: SquareUpWindow;
  weapon_panel?: WeaponPanel;
  ball_panel?: BallPanel;
  drills: Drill[];
  session_history: SessionHistoryItem[];
  badges?: Badge[];
  coach_note: CoachNote;
}
