// ============================================================================
// DIAMOND KINETICS SWING NORMALIZER
// Production-ready with field mapping, validation, and deduplication support
// ============================================================================

import type {
  RawDKSwing,
  CanonicalSwing,
  NormalizeBatchResult,
  NormalizeOptions,
} from './types';
import { VALIDATION_THRESHOLDS } from './types';

// ============================================================================
// FIELD EXTRACTORS
// ============================================================================

/**
 * Extract bat speed from various DK field names
 */
function extractBatSpeed(raw: RawDKSwing): number | null {
  // Priority: speedBarrelMax > metrics.speedBarrelMax > batSpeed > metrics.batSpeed
  const value =
    raw.speedBarrelMax ??
    raw.metrics?.speedBarrelMax ??
    raw.batSpeed ??
    raw.metrics?.batSpeed ??
    null;

  return typeof value === 'number' ? round(value, 1) : null;
}

/**
 * Extract hand speed from various DK field names
 */
function extractHandSpeed(raw: RawDKSwing): number | null {
  const value = raw.speedHandsMax ?? raw.handSpeed ?? null;
  return typeof value === 'number' ? round(value, 1) : null;
}

/**
 * Extract time to contact (trigger to impact)
 */
function extractTimeToContact(raw: RawDKSwing): number | null {
  const value =
    raw.quicknessTriggerImpact ?? raw.timeToContact ?? raw.triggerToImpact ?? null;
  return typeof value === 'number' ? Math.round(value) : null;
}

/**
 * Extract attack angle (swing plane steepness)
 */
function extractAttackAngle(raw: RawDKSwing): number | null {
  const value = raw.swingPlaneSteepnessAngle ?? raw.attackAngle ?? null;
  return typeof value === 'number' ? round(value, 1) : null;
}

/**
 * Extract attack direction (swing plane heading)
 */
function extractAttackDirection(raw: RawDKSwing): number | null {
  const value = raw.swingPlaneHeadingAngle ?? raw.attackDirection ?? null;
  return typeof value === 'number' ? round(value, 1) : null;
}

/**
 * Extract swing plane tilt
 */
function extractPlaneTilt(raw: RawDKSwing): number | null {
  const value = raw.swingPlaneTiltAngle ?? raw.planeTilt ?? null;
  return typeof value === 'number' ? round(value, 1) : null;
}

/**
 * Extract impact location
 */
function extractImpactLocation(raw: RawDKSwing): {
  x: number | null;
  y: number | null;
  z: number | null;
} {
  const x = raw.impactLocationX ?? raw.impactLocation?.x ?? null;
  const y = raw.impactLocationY ?? raw.impactLocation?.y ?? null;
  const z = raw.impactLocationZ ?? raw.impactLocation?.z ?? null;

  return {
    x: typeof x === 'number' ? round(x, 3) : null,
    y: typeof y === 'number' ? round(y, 3) : null,
    z: typeof z === 'number' ? round(z, 3) : null,
  };
}

/**
 * Extract applied power
 */
function extractAppliedPower(raw: RawDKSwing): number | null {
  const value = raw.appliedPower ?? raw.power ?? null;
  return typeof value === 'number' ? round(value, 1) : null;
}

/**
 * Extract max acceleration
 */
function extractMaxAcceleration(raw: RawDKSwing): number | null {
  const value = raw.maxAcceleration ?? raw.acceleration ?? null;
  return typeof value === 'number' ? round(value, 1) : null;
}

/**
 * Extract swing ID
 */
function extractSwingId(raw: RawDKSwing): string | null {
  return raw.swingId ?? raw.uuid ?? raw.id ?? null;
}

/**
 * Extract swing number/index
 */
function extractSwingNumber(raw: RawDKSwing, fallback: number | null): number | null {
  const value = raw.swingIndex ?? raw.swingNumber ?? raw.index ?? fallback;
  return typeof value === 'number' ? value : null;
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(raw: RawDKSwing): { parsed: string; raw: string | number | null } {
  const rawValue = raw.timestamp ?? raw.occurredAt ?? raw.swingTimestamp ?? null;

  if (rawValue === null || rawValue === undefined) {
    return { parsed: new Date().toISOString(), raw: null };
  }

  // ISO string
  if (typeof rawValue === 'string') {
    const date = new Date(rawValue);
    if (!isNaN(date.getTime())) {
      return { parsed: date.toISOString(), raw: rawValue };
    }
  }

  // Epoch timestamp
  if (typeof rawValue === 'number') {
    // Detect milliseconds vs seconds (threshold: year 2001 in ms)
    const ts = rawValue > 1_000_000_000_000 ? rawValue : rawValue * 1000;
    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return { parsed: date.toISOString(), raw: rawValue };
    }
  }

  // Fallback
  return { parsed: new Date().toISOString(), raw: rawValue };
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  reason: string | null;
  warnings: string[];
}

/**
 * Validate a normalized swing
 */
function validateSwing(swing: Partial<CanonicalSwing>): ValidationResult {
  const warnings: string[] = [];

  // Must have bat speed
  if (swing.bat_speed_mph === null || swing.bat_speed_mph === undefined) {
    return { isValid: false, reason: 'missing_bat_speed', warnings };
  }

  // Check minimum speed (waggle filter)
  if (swing.bat_speed_mph < VALIDATION_THRESHOLDS.MIN_BAT_SPEED_MPH) {
    return { isValid: false, reason: 'below_speed_threshold', warnings };
  }

  // Check maximum speed (sensor error)
  if (swing.bat_speed_mph > VALIDATION_THRESHOLDS.MAX_BAT_SPEED_MPH) {
    return { isValid: false, reason: 'above_speed_threshold', warnings };
  }

  // Check timing bounds
  if (swing.trigger_to_impact_ms !== null) {
    if (swing.trigger_to_impact_ms < VALIDATION_THRESHOLDS.MIN_TIME_TO_CONTACT_MS) {
      return { isValid: false, reason: 'timing_too_fast', warnings };
    }
    if (swing.trigger_to_impact_ms > VALIDATION_THRESHOLDS.MAX_TIME_TO_CONTACT_MS) {
      return { isValid: false, reason: 'timing_too_slow', warnings };
    }
  }

  // Warning: low hand speed ratio
  if (
    swing.hand_speed_mph !== null &&
    swing.bat_speed_mph !== null &&
    swing.hand_speed_mph / swing.bat_speed_mph < VALIDATION_THRESHOLDS.LOW_HAND_SPEED_RATIO
  ) {
    warnings.push('hand_speed_low');
  }

  return { isValid: true, reason: null, warnings };
}

// ============================================================================
// MAIN NORMALIZER
// ============================================================================

/**
 * Normalize a single DK swing to canonical format
 */
export function normalizeDKSwing(
  raw: RawDKSwing,
  options: NormalizeOptions,
  index?: number
): CanonicalSwing {
  const { session_id, sdk_version, swing_number_offset = 0 } = options;

  // Extract all fields
  const batSpeed = extractBatSpeed(raw);
  const handSpeed = extractHandSpeed(raw);
  const timeToContact = extractTimeToContact(raw);
  const attackAngle = extractAttackAngle(raw);
  const attackDirection = extractAttackDirection(raw);
  const planeTilt = extractPlaneTilt(raw);
  const impactLocation = extractImpactLocation(raw);
  const appliedPower = extractAppliedPower(raw);
  const maxAcceleration = extractMaxAcceleration(raw);
  const swingId = extractSwingId(raw);
  const swingNumber = extractSwingNumber(
    raw,
    index !== undefined ? index + swing_number_offset : null
  );
  const timestamp = parseTimestamp(raw);

  // Calculate derived metrics
  const handToBatRatio =
    batSpeed !== null && handSpeed !== null && batSpeed > 0
      ? round(handSpeed / batSpeed, 2)
      : null;

  // Build partial swing for validation
  const partialSwing: Partial<CanonicalSwing> = {
    bat_speed_mph: batSpeed,
    hand_speed_mph: handSpeed,
    trigger_to_impact_ms: timeToContact,
    hand_to_bat_ratio: handToBatRatio,
  };

  // Validate
  const validation = validateSwing(partialSwing);

  // Build canonical swing
  const canonical: CanonicalSwing = {
    session_id,
    dk_swing_id: swingId,
    occurred_at: timestamp.parsed,
    swing_number: swingNumber,

    bat_speed_mph: batSpeed,
    hand_speed_mph: handSpeed,
    trigger_to_impact_ms: timeToContact,
    attack_angle_deg: attackAngle,
    attack_direction_deg: attackDirection,
    swing_plane_tilt_deg: planeTilt,

    impact_location_x: impactLocation.x,
    impact_location_y: impactLocation.y,
    impact_location_z: impactLocation.z,

    applied_power: appliedPower,
    max_acceleration: maxAcceleration,

    hand_to_bat_ratio: handToBatRatio,

    is_valid: validation.isValid,
    invalid_reason: validation.reason,
    warnings: validation.warnings,

    raw,
    raw_meta: {
      sdk_version,
      occurred_at_raw: timestamp.raw ?? undefined,
      normalized_at: new Date().toISOString(),
    },
  };

  return canonical;
}

/**
 * Normalize a batch of DK swings
 */
export function normalizeDKSwingBatch(
  rawSwings: RawDKSwing[],
  sessionId: string,
  sdkVersion?: string
): NormalizeBatchResult {
  const options: NormalizeOptions = {
    session_id: sessionId,
    sdk_version: sdkVersion,
  };

  const valid: CanonicalSwing[] = [];
  const invalid: CanonicalSwing[] = [];
  const warnings: CanonicalSwing[] = [];

  rawSwings.forEach((raw, index) => {
    const normalized = normalizeDKSwing(raw, options, index);

    if (normalized.is_valid) {
      valid.push(normalized);
      if (normalized.warnings.length > 0) {
        warnings.push(normalized);
      }
    } else {
      invalid.push(normalized);
    }
  });

  return { valid, invalid, warnings };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Round to specified decimal places
 */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
