// ============================================================================
// Swing Report Types - Player-facing coaching report data structure
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
  whyItMatters: string;
  frameUrl?: string;
  loopUrl?: string;
}

export interface FixOrderItem {
  label: string;
  feelCue: string;
  completed?: boolean;
}

export interface SquareUpWindow {
  present: boolean;
  grid?: number[][]; // 3x3 or 5x5 heatmap values
  bestZone?: string;
  avoidZone?: string;
  coachNote?: string;
}

export interface DKMetric {
  name: string;
  value: number | string;
  meaning: string;
}

export interface DiamondKineticsData {
  present: boolean;
  metrics?: DKMetric[];
}

export interface BallOutcome {
  name: string;
  value: number | string;
  unit?: string;
}

export interface BallData {
  present: boolean;
  isProjected?: boolean;
  outcomes?: BallOutcome[];
}

export interface Drill {
  id: string;
  name: string;
  coachingCue: string;
  reps: string;
  loopUrl?: string;
  demoUrl?: string;
}

export interface SessionHistoryItem {
  id: string;
  date: string;
  compositeScore: number;
  delta?: number;
}

export interface Badge {
  id: string;
  name: string;
  earned: boolean;
  earnedDate?: string;
}

export interface CoachNote {
  text: string;
  audioUrl?: string;
}

export interface SwingReportData {
  session: ReportSession;
  scores: FourBScoreData;
  kineticPotential: KineticPotential;
  primaryLeak: PrimaryLeak;
  fixOrder: FixOrderItem[];
  doNotChase: string[];
  squareUpWindow?: SquareUpWindow;
  diamondKinetics?: DiamondKineticsData;
  ballData?: BallData;
  drills: Drill[];
  sessionHistory: SessionHistoryItem[];
  badges?: Badge[];
  coachNote: CoachNote;
}
