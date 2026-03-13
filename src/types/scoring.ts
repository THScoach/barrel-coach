/**
 * src/types/scoring.ts
 *
 * SINGLE SOURCE OF TRUTH — 4B scoring types.
 *
 * Rules (enforced via Step 2 migration):
 *   1. No other file may declare FourBScores, ScoringResult, or ScoringMode.
 *   2. All files import from here only.
 *   3. calculate-4b-scores edge function returns ScoringResult exactly.
 *   4. All clients consume ScoringResult (or FourBScores subset) — no local calculators.
 *
 * Version: v2.2 (three-tier bat speed + Nathan collision model)
 * Updated: March 2026
 */

// ---------------------------------------------------------------------------
// ENUMS / UNIONS
// ---------------------------------------------------------------------------

export type ScoringMode    = 'full' | 'training';
export type ScoringVersion = 'v1_legacy' | 'v2';
export type FourBRating    = 'Elite' | 'Good' | 'Working' | 'Priority';
export type ScoreSource    = 'reboot_csv' | 'sensor' | 'manual';

export type PlayerLevel    = 'youth' | 'high_school' | 'college' | 'pro';
export type MotorProfile   =
  | 'Spinner'
  | 'Whipper_Load'
  | 'Whipper_Tilt'
  | 'Slingshotter'
  | 'Titan';

/** Three-tier bat speed prediction path */
export type BatSpeedSource = 'measured' | 'ke_direct' | 'estimation';

/** Confidence tier for bat speed prediction */
export type BatSpeedConfidence = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// CORE SCORE SHAPE  (canonical — matches DB columns and API response)
// ---------------------------------------------------------------------------

export interface FourBScores {
  // Composite
  score_4bkrs: number;
  mode: ScoringMode;
  version: ScoringVersion;

  // Pillars
  body: number;
  brain: number;
  bat: number;
  ball: number | null;         // null when no outcome data (training mode)

  // Display meta
  rating: FourBRating;
  color: string;               // hex: #4ecdc4 | #ffa500 | #ff6b6b

  // Body sub-components (flattened for edge serialization + DB storage)
  creation: number;
  transfer: number;

  // Key engine metrics
  transfer_ratio: number;
  timing_gap_pct: number;      // 0–100 (% of swing duration)
  bat_speed_mph: number | null;
  exit_velocity_mph: number | null;
}

// ---------------------------------------------------------------------------
// EDGE FUNCTION INPUT CONTRACT
// ---------------------------------------------------------------------------

export interface ScoreCalculationInput {
  source: ScoreSource;

  // Kinematic inputs (normalized Reboot Motion or sensor equivalent)
  pelvis_omega_peak: number;        // deg/s
  trunk_omega_peak: number;         // deg/s
  arm_omega_peak: number;           // deg/s — most distal IK segment (5-frame centred FD)

  // Three-tier bat speed inputs (use highest available)
  /** Hawk-Eye or DK sensor bat speed — TIER 1 (highest priority) */
  measured_bat_speed_mph?: number | null;
  /** From bat_rot_energy KE inversion: √(2×KE/0.048)×(180/π), capped 2800 — TIER 2 */
  bat_omega_from_ke?: number | null;
  /** @deprecated Use bat_omega_from_ke. Kept for backward compatibility. */
  bat_omega_peak?: number;

  pelvis_omega_time: number;        // ms from front foot contact (FFC)
  trunk_omega_time: number;         // ms from FFC

  hip_shoulder_sep_max_deg: number;
  stride_length_rel_hip: number;
  front_foot_angle_deg: number;
  load_duration_ms: number;         // gather → plant
  launch_duration_ms: number;       // plant → contact
  transfer_ratio: number;           // trunk_omega_peak / pelvis_omega_peak

  // Optional outcome data (Ball pillar — enables 'full' mode)
  exit_velocity_mph?: number;
  /** Measured EV from Hawk-Eye or launch monitor (alias for exit_velocity_mph) */
  measured_ev_mph?: number | null;
  launch_angle_deg?: number;
  spray_angle_deg?: number;
  hard_hit_rate?: number;

  // Context
  player_level: PlayerLevel;
  motor_profile?: string;

  // ME-derived fields
  mass_total_kg?: number;           // total body mass from ME
  bat_energy_j?: number;            // KE at barrel from ME
  total_body_energy_j?: number;     // sum of all segment KE from ME
}

// ---------------------------------------------------------------------------
// EDGE FUNCTION OUTPUT CONTRACT  (what calculate-4b-scores returns)
// ---------------------------------------------------------------------------

export interface ScoringResult extends FourBScores {
  // Predicted vs actual separation for BAT / BALL diagnostics
  predicted_bat_speed_mph?: number | null;
  predicted_exit_velocity_mph?: number | null;
  /** e.g. 'Shallow-Steep' | 'Deep-Steep' | 'Shallow-Flat' | 'Deep-Flat' */
  predicted_entry_bucket?: string | null;

  actual_bat_speed_mph?: number | null;
  actual_exit_velocity_mph?: number | null;
  actual_entry_bucket?: string | null;

  // Transfer efficiency diagnostic (0–1)
  transfer_efficiency?: number | null;

  // Bat speed confidence tier
  bat_speed_path?: BatSpeedSource | null;
  bat_speed_confidence?: BatSpeedConfidence | null;

  scoring_timestamp: string;        // ISO 8601
}

// ---------------------------------------------------------------------------
// DISPLAY EXTENSION  (UI layer only — never stored in DB)
// ---------------------------------------------------------------------------

/**
 * ScorecardDisplay — use in getPlayerScorecard.ts and display components.
 * Extends ScoringResult with UI-only fields. Not persisted.
 */
export interface ScorecardDisplay extends ScoringResult {
  /** 20–80 scouting scale derived from score_4bkrs */
  scouting_grade: number;
  /** Human-readable tier label */
  summary_label: string;
  /** Profile-conditional coaching note (Motor Profile aware) */
  coaching_note?: string;
}

// ---------------------------------------------------------------------------
// SESSION AGGREGATE  (multi-swing summary)
// ---------------------------------------------------------------------------

export interface SessionScoringResult {
  session_id: string;
  player_id: string;
  swing_count: number;
  average: ScoringResult;
  peak: ScoringResult;
  floor: ScoringResult;
  /** Std deviation of score_4bkrs across all swings in session */
  consistency_sd: number;
  scored_at: string;
  scoring_version: ScoringVersion;
}

// ---------------------------------------------------------------------------
// LEGACY SHIM  — import ONLY in files being actively migrated; delete after
// ---------------------------------------------------------------------------

/** @deprecated Map old field names to FourBScores. Remove once migration is done. */
export function normalizeLegacyScores(raw: Record<string, unknown>): FourBScores {
  const body   = Number(raw['body_score']   ?? raw['body']   ?? 0);
  const brain  = Number(raw['brain_score']  ?? raw['brain']  ?? 0);
  const bat    = Number(raw['bat_score']    ?? raw['bat']    ?? 0);
  const ball   = raw['ball_score'] != null  ? Number(raw['ball_score'])
               : raw['ball']       != null  ? Number(raw['ball']) : null;

  const score_4bkrs = Number(
    raw['score_4bkrs'] ?? raw['krs'] ?? raw['total'] ?? raw['composite'] ?? 0
  );

  const rating: FourBRating =
    score_4bkrs >= 90 ? 'Elite'
    : score_4bkrs >= 80 ? 'Good'
    : score_4bkrs >= 60 ? 'Working'
    : 'Priority';

  const color =
    score_4bkrs >= 80 ? '#4ecdc4'
    : score_4bkrs >= 60 ? '#ffa500'
    : '#ff6b6b';

  return {
    score_4bkrs,
    mode:             ball !== null ? 'full' : 'training',
    version:          'v1_legacy',
    body, brain, bat, ball,
    rating, color,
    creation:         Number(raw['creation_score'] ?? raw['creation'] ?? 0),
    transfer:         Number(raw['transfer_score']  ?? raw['transfer'] ?? 0),
    transfer_ratio:   Number(raw['transfer_ratio']  ?? 0),
    timing_gap_pct:   Number(raw['timing_gap_pct']  ?? raw['timing_gap_percent'] ?? 0),
    bat_speed_mph:     raw['bat_speed_mph']     != null ? Number(raw['bat_speed_mph'])     : null,
    exit_velocity_mph: raw['exit_velocity_mph'] != null ? Number(raw['exit_velocity_mph']) : null,
  };
}
