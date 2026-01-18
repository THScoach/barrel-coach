// ============================================================================
// DIAMOND KINETICS - TYPE DEFINITIONS
// ============================================================================

/**
 * Raw swing data from DK sensor (varies by SDK version)
 */
export interface RawDKSwing {
  // Primary bat speed fields (aliases)
  speedBarrelMax?: number;
  batSpeed?: number;
  metrics?: {
    speedBarrelMax?: number;
    batSpeed?: number;
    [key: string]: unknown;
  };

  // Hand speed
  speedHandsMax?: number;
  handSpeed?: number;

  // Timing
  quicknessTriggerImpact?: number;
  timeToContact?: number;
  triggerToImpact?: number;

  // Plane angles
  swingPlaneSteepnessAngle?: number;
  attackAngle?: number;
  swingPlaneHeadingAngle?: number;
  attackDirection?: number;
  swingPlaneTiltAngle?: number;
  planeTilt?: number;

  // Impact location
  impactLocationX?: number;
  impactLocationY?: number;
  impactLocationZ?: number;
  impactLocation?: {
    x?: number;
    y?: number;
    z?: number;
  };

  // Power metrics
  appliedPower?: number;
  power?: number;
  maxAcceleration?: number;
  acceleration?: number;

  // Identifiers
  swingId?: string;
  uuid?: string;
  id?: string;
  swingIndex?: number;
  swingNumber?: number;
  index?: number;

  // Timestamp
  timestamp?: string | number;
  occurredAt?: string | number;
  swingTimestamp?: string | number;

  // Catch-all for unknown fields
  [key: string]: unknown;
}

/**
 * Normalized swing data (canonical format)
 */
export interface CanonicalSwing {
  // Session reference
  session_id: string;

  // DK identifiers
  dk_swing_id: string | null;
  occurred_at: string;
  swing_number: number | null;

  // Measured metrics (rounded for dedupe)
  bat_speed_mph: number | null;
  hand_speed_mph: number | null;
  trigger_to_impact_ms: number | null;
  attack_angle_deg: number | null;
  attack_direction_deg: number | null;
  swing_plane_tilt_deg: number | null;

  // Impact location
  impact_location_x: number | null;
  impact_location_y: number | null;
  impact_location_z: number | null;

  // Power metrics
  applied_power: number | null;
  max_acceleration: number | null;

  // Derived
  hand_to_bat_ratio: number | null;

  // Quality
  is_valid: boolean;
  invalid_reason: string | null;
  warnings: string[];

  // Raw data for debugging
  raw: RawDKSwing;
  raw_meta: {
    sdk_version?: string;
    occurred_at_raw?: string | number;
    normalized_at: string;
  };
}

/**
 * Batch normalization result
 */
export interface NormalizeBatchResult {
  valid: CanonicalSwing[];
  invalid: CanonicalSwing[];
  warnings: CanonicalSwing[];
}

/**
 * Normalization options
 */
export interface NormalizeOptions {
  session_id: string;
  sdk_version?: string;
  swing_number_offset?: number;
}

/**
 * Sync endpoint response
 */
export interface SyncResponse {
  success: boolean;
  ingest_id: string;
  processed: number;
  duplicates: number;
  rejected: number;
  warnings: number;
  total_received: number;
}

/**
 * Validation thresholds
 */
export const VALIDATION_THRESHOLDS = {
  // Minimum bat speed to be considered a real swing (not waggle)
  MIN_BAT_SPEED_MPH: 25,

  // Maximum bat speed (beyond this is likely sensor error)
  MAX_BAT_SPEED_MPH: 120,

  // Timing bounds (ms)
  MIN_TIME_TO_CONTACT_MS: 80,
  MAX_TIME_TO_CONTACT_MS: 500,

  // Low hand speed warning threshold
  LOW_HAND_SPEED_RATIO: 0.5,
} as const;
