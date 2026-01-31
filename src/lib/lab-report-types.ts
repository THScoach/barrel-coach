// ============================================================================
// Lab Report v2.0 Types - Catching Barrels Player Analysis Output
// 
// Version: 2.0
// Date: January 30, 2026
// Philosophy: "We don't add, we unlock."
// Reading Level: 5th-8th Grade (Hormozi-style, direct, actionable)
// ============================================================================

// Contract version for this schema
export type LabReportContractVersion = "2026-01-30";

// ============================================================================
// 1. STRUCTURE - Player Anthropometrics
// ============================================================================

export type BodyType = 'ROTATIONAL' | 'BALANCED' | 'LINEAR';

export interface PlayerStructure {
  present: boolean;
  height_inches?: number;
  height_display?: string; // e.g., "5'10\""
  weight_lbs?: number;
  wingspan_inches?: number;
  ape_index?: number; // (Wingspan - Height) / Height
  ape_index_display?: string; // e.g., "+1.5\""
  arm_ratio?: number; // Forearm / Upper Arm
  body_type?: BodyType;
  body_type_explanation?: string;
}

// ============================================================================
// 2. MOBILITY - ROM Data from Reboot
// ============================================================================

export interface MobilityMetric {
  value: number;
  percentage: number; // vs elite benchmark
  status: 'elite' | 'good' | 'working' | 'priority';
}

export interface PlayerMobility {
  present: boolean;
  hip_ir?: MobilityMetric; // Internal rotation >45°
  knee_flex?: MobilityMetric; // Flexion >120°
  t_spine_rotation?: MobilityMetric; // >45° each side
  balance?: MobilityMetric; // L/R symmetry >85%
  overall_score?: number; // Average of all
  overall_status?: 'elite' | 'good' | 'working' | 'priority';
}

// ============================================================================
// 3. TIMING ANALYSIS - Kinematic Sequence
// ============================================================================

export type SequenceOrder = 'P_T_A_B' | 'OUT_OF_ORDER';
export type SequenceStatus = 'elite' | 'good' | 'simultaneous' | 'over_separated' | 'out_of_order';

export interface SequenceSegment {
  name: 'pelvis' | 'torso' | 'arms' | 'bat';
  peak_frame: number;
  peak_velocity: number;
  decelerates_before_next: boolean;
}

export interface TimingAnalysis {
  present: boolean;
  sequence_order?: SequenceOrder;
  sequence_status?: SequenceStatus;
  
  // Timing gaps
  pelvis_torso_gap_pct?: number; // Elite: 14-18%
  torso_arms_gap_pct?: number; // Elite: 10-14%
  arms_bat_gap_pct?: number; // Elite: 5-10%
  
  // Deceleration checks
  pelvis_decelerates?: boolean;
  torso_decelerates?: boolean;
  arms_decelerates?: boolean;
  all_braking_elite?: boolean;
  
  segments?: SequenceSegment[];
  
  // Player-facing
  summary?: string;
  fix_explanation?: string;
}

// ============================================================================
// 4. DIRECTION ANALYSIS - Plane Chain
// ============================================================================

export interface PlaneAngle {
  segment: 'pelvis' | 'torso' | 'arms' | 'lead_arm' | 'rear_arm';
  angle: number; // Relative to lead arm (0°)
}

export interface DirectionAnalysis {
  present: boolean;
  
  pelvis_plane_angle?: number;
  torso_plane_angle?: number;
  arms_plane_angle?: number;
  
  pelvis_torso_gap?: number; // Ideal <15°
  torso_arms_gap?: number; // Ideal <20°
  
  arm_unity?: number; // |Rear - Lead| Ideal <25°, MLB avg ~25°
  arm_unity_status?: 'elite' | 'good' | 'priority';
  
  plane_deviation_score?: number; // Total spread, MLB avg 73.6°
  
  // Player-facing
  summary?: string;
  fix_explanation?: string;
}

// ============================================================================
// 5. ENTRY ANGLE - Bat Path
// ============================================================================

export type EntryAngleStatus = 'optimal_uppercut' | 'flat' | 'steep' | 'chop' | 'too_steep';

export interface EntryAngleAnalysis {
  present: boolean;
  
  z_component_direction?: 'UNDER' | 'FLAT' | 'OVER'; // Positive Z = under
  entry_angle_deg?: number; // Degrees below/above horizontal
  entry_angle_status?: EntryAngleStatus;
  
  barrel_path_tendency?: 'uppercut' | 'flat' | 'chop';
  
  // Player-facing
  summary?: string;
  fix_explanation?: string;
}

// ============================================================================
// 6. MOTOR PROFILE CLASSIFICATION
// ============================================================================

export type MotorProfileType = 'SPINNER' | 'WHIPPER' | 'SLINGSHOTTER' | 'TITAN';
export type XFactorPeakTiming = 'at_load' | 'during_downswing' | 'at_contact' | 'variable';

export interface MotorProfileMetrics {
  x_factor_peak_timing?: XFactorPeakTiming;
  transfer_ratio?: number; // Elite: 1.3-1.9 depending on profile
  timing_gap_pct?: number;
  rotation_dominance?: number;
  extension_pattern?: boolean;
  vertical_force_dominance?: number;
  body_mass_factor?: number;
}

export interface MLBComparison {
  player_name: string;
  similarity_score: number;
  gap_transfer_ratio?: number;
  gap_timing?: number;
}

export interface MotorProfileSection {
  present: boolean;
  
  profile?: MotorProfileType;
  confidence?: number; // 0-100%
  confidence_label?: 'confirmed' | 'likely' | 'hint';
  
  metrics?: MotorProfileMetrics;
  mlb_match?: MLBComparison;
  
  characteristics?: string[];
  training_focus?: string;
  
  // Player-facing
  summary?: string;
}

// ============================================================================
// 7. ENERGY LEAK REPORT
// ============================================================================

export type LeakDirection = 'UP' | 'DOWN' | 'OUT' | 'IN';

export interface EnergyLeak {
  direction: LeakDirection;
  source: string; // e.g., "Lead Arm", "Pelvis", "Torso"
  magnitude_pct?: number; // Percentage of energy leaked
  lost_bat_speed_mph?: number; // Approximate mph loss
  lost_exit_velo_mph?: number; // Approximate EV loss
  
  cause?: string;
  feel_description?: string;
}

export interface EnergyLeakReport {
  present: boolean;
  
  primary_leak?: EnergyLeak;
  secondary_leaks?: EnergyLeak[];
  
  total_leak_pct?: number;
  potential_unlocked_mph?: number; // How much speed they could gain
  
  // Force vectors at contact (for visualization)
  momentum_vectors?: {
    vertical: number;
    lateral: number;
    forward: number;
  };
  
  // Player-facing
  summary?: string;
}

// ============================================================================
// 8. COACHING PRESCRIPTION
// ============================================================================

export interface PrescribedDrill {
  id: string;
  name: string;
  why_it_works: string;
  coaching_cue: string;
  reps?: string;
  video_url?: string;
  thumbnail_url?: string;
}

export interface Contraindication {
  drill_type: string;
  reason: string;
}

export interface CoachingPrescription {
  present: boolean;
  
  primary_issue?: string;
  primary_issue_location?: 'BAT' | 'ARMS' | 'TORSO' | 'PELVIS';
  
  drills?: PrescribedDrill[];
  what_not_to_do?: Contraindication[];
  
  adaptation_note?: string; // e.g., "This adaptation happens in GAMES, not in the cage"
}

// ============================================================================
// SCORE DISPLAY & RATINGS
// ============================================================================

export type ScoreRating = 'elite' | 'good' | 'working' | 'priority';

export function getScoreRating(score: number): ScoreRating {
  if (score >= 90) return 'elite';
  if (score >= 80) return 'good';
  if (score >= 60) return 'working';
  return 'priority';
}

export function getScoreColor(rating: ScoreRating): string {
  switch (rating) {
    case 'elite': return '#4ecdc4'; // teal
    case 'good': return '#4ecdc4'; // teal
    case 'working': return '#ffa500'; // orange
    case 'priority': return '#ff6b6b'; // coral red
  }
}

export function getMotorProfileColor(profile: MotorProfileType): string {
  switch (profile) {
    case 'SPINNER': return '#4488ff'; // blue
    case 'WHIPPER': return '#44ff88'; // green
    case 'SLINGSHOTTER': return '#ff8844'; // orange
    case 'TITAN': return '#ff4488'; // magenta
  }
}

// ============================================================================
// 4B SCORES (inherited from existing system)
// ============================================================================

export interface FourBScores {
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

// ============================================================================
// MAIN LAB REPORT DATA STRUCTURE
// ============================================================================

export interface LabReportSession {
  id: string;
  date: string;
  player: {
    id?: string;
    name: string;
    age?: number | null;
    level?: string | null;
    handedness?: 'R' | 'L' | 'S' | null;
  };
}

export interface LabReportData {
  // Contract metadata
  contract_version: LabReportContractVersion;
  generated_at: string;
  
  // Core data
  session: LabReportSession;
  scores: FourBScores;
  
  // 8 Sections
  structure: PlayerStructure;
  mobility: PlayerMobility;
  timing: TimingAnalysis;
  direction: DirectionAnalysis;
  entry_angle: EntryAngleAnalysis;
  motor_profile: MotorProfileSection;
  energy_leak: EnergyLeakReport;
  prescription: CoachingPrescription;
  
  // Session history for progress tracking
  session_history?: {
    present: boolean;
    items: Array<{
      id: string;
      date: string;
      composite_score: number;
      delta?: number;
    }>;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function isPresent<T extends { present: boolean }>(section: T | undefined): section is T & { present: true } {
  return section?.present === true;
}

export function getBodyTypeFromArmRatio(armRatio: number): BodyType {
  if (armRatio < 0.85) return 'ROTATIONAL';
  if (armRatio > 0.92) return 'LINEAR';
  return 'BALANCED';
}

export function getBodyTypeExplanation(bodyType: BodyType): string {
  switch (bodyType) {
    case 'ROTATIONAL':
      return "Your arms are built to rotate around your body, not extend through the ball. You're a \"shoulder plane\" hitter — compact, quick, explosive. Think Altuve, Betts, Peña.";
    case 'LINEAR':
      return "Your arms are built to extend through the ball. You're a \"hip plane\" hitter — drive, leverage, extension. Think Freeman, Guerrero Jr.";
    case 'BALANCED':
      return "You have balanced arm proportions. You can adapt to both rotational and linear patterns. You're a \"torso plane\" hitter with flexibility.";
  }
}

export function getTimingGapStatus(gapPct: number): 'elite' | 'good' | 'simultaneous' | 'over_separated' {
  if (gapPct >= 14 && gapPct <= 18) return 'elite';
  if (gapPct >= 10 && gapPct < 14) return 'good';
  if (gapPct < 5) return 'simultaneous';
  if (gapPct > 22) return 'over_separated';
  return 'good';
}

export function getEntryAngleStatus(angleDeg: number): EntryAngleStatus {
  if (angleDeg >= 8 && angleDeg <= 15) return 'optimal_uppercut';
  if (angleDeg >= 0 && angleDeg < 8) return 'flat';
  if (angleDeg > 15 && angleDeg <= 22) return 'steep';
  if (angleDeg < 0) return 'chop';
  return 'too_steep';
}

export function getArmUnityStatus(armUnity: number): 'elite' | 'good' | 'priority' {
  if (armUnity <= 15) return 'elite';
  if (armUnity <= 30) return 'good';
  return 'priority';
}
