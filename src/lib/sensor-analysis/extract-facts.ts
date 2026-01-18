// ============================================================================
// SENSOR FACTS EXTRACTION
// Extract MEASURED facts from DK sensor swings - 100% confidence
// ============================================================================

import type { SensorFacts, DKSwingData } from './types';
import type { CanonicalSwing } from '@/lib/integrations/diamond-kinetics/types';

/**
 * Extract measured facts from an array of NORMALIZED swings (CanonicalSwing)
 * These are FACTS - no predictions, no inferences
 * Uses the DK Normalizer's canonical field names
 */
export function extractSensorFacts(swings: CanonicalSwing[]): SensorFacts {
  if (swings.length === 0) {
    return createEmptyFacts();
  }

  // Filter to valid swings only
  const validSwings = swings.filter(s => s.is_valid);
  if (validSwings.length === 0) {
    return createEmptyFacts();
  }

  // Bat speed aggregates (using canonical field names from normalizer)
  const batSpeeds = validSwings.map(s => s.bat_speed_mph).filter((v): v is number => v !== null);
  const batSpeedMax = batSpeeds.length > 0 ? Math.max(...batSpeeds) : 0;
  const batSpeedMean = mean(batSpeeds);
  const batSpeedStdDev = stdDev(batSpeeds);

  // Hand speed aggregates
  const handSpeeds = validSwings.map(s => s.hand_speed_mph).filter((v): v is number => v !== null);
  const handSpeedMax = handSpeeds.length > 0 ? Math.max(...handSpeeds) : 0;
  const handSpeedMean = mean(handSpeeds);
  const handSpeedStdDev = stdDev(handSpeeds);

  // Timing aggregates
  const timings = validSwings.map(s => s.trigger_to_impact_ms).filter((v): v is number => v !== null);
  const timeToContactMean = mean(timings);
  const timeToContactStdDev = stdDev(timings);
  const timingCV = timeToContactMean > 0 ? timeToContactStdDev / timeToContactMean : 0;

  // Attack angle aggregates
  const attackAngles = validSwings.map(s => s.attack_angle_deg).filter((v): v is number => v !== null);
  const attackAngleMean = mean(attackAngles);
  const attackAngleStdDev = stdDev(attackAngles);

  // Attack direction aggregates
  const attackDirections = validSwings.map(s => s.attack_direction_deg).filter((v): v is number => v !== null);
  const attackDirectionMean = mean(attackDirections);
  const attackDirectionStdDev = stdDev(attackDirections);

  // Hand-to-bat ratio (key metric) - use pre-calculated or compute
  const ratios = validSwings.map(s => s.hand_to_bat_ratio).filter((v): v is number => v !== null);
  const handToBatRatio = ratios.length > 0 ? mean(ratios) : (handSpeedMean > 0 ? batSpeedMean / handSpeedMean : 0);

  // Optional metrics if sensor captures them
  const maxAccelerations = validSwings.map(s => s.max_acceleration).filter((v): v is number => v !== null);

  return {
    swingCount: validSwings.length,

    batSpeedMax: round(batSpeedMax, 1),
    batSpeedMean: round(batSpeedMean, 1),
    batSpeedStdDev: round(batSpeedStdDev, 2),

    handSpeedMax: round(handSpeedMax, 1),
    handSpeedMean: round(handSpeedMean, 1),
    handSpeedStdDev: round(handSpeedStdDev, 2),

    timeToContactMean: round(timeToContactMean, 0),
    timeToContactStdDev: round(timeToContactStdDev, 1),
    timingCV: round(timingCV, 3),

    attackAngleMean: round(attackAngleMean, 1),
    attackAngleStdDev: round(attackAngleStdDev, 2),

    attackDirectionMean: round(attackDirectionMean, 1),
    attackDirectionStdDev: round(attackDirectionStdDev, 2),

    handToBatRatio: round(handToBatRatio, 3),

    // Optional fields - max_acceleration from DK maps to rotational
    rotationalAccelerationMean: maxAccelerations.length > 0
      ? round(mean(maxAccelerations), 0)
      : undefined,
  };
}

/**
 * Legacy function for backward compatibility with DKSwingData type
 * Converts DKSwingData to extract facts (for non-normalized data)
 */
export function extractSensorFactsFromRaw(swings: DKSwingData[]): SensorFacts {
  if (swings.length === 0) {
    return createEmptyFacts();
  }

  // Bat speed aggregates
  const batSpeeds = swings.map(s => s.batSpeed);
  const batSpeedMax = Math.max(...batSpeeds);
  const batSpeedMean = mean(batSpeeds);
  const batSpeedStdDev = stdDev(batSpeeds);

  // Hand speed aggregates
  const handSpeeds = swings.map(s => s.handSpeed);
  const handSpeedMax = Math.max(...handSpeeds);
  const handSpeedMean = mean(handSpeeds);
  const handSpeedStdDev = stdDev(handSpeeds);

  // Timing aggregates
  const timings = swings.map(s => s.timeToContact);
  const timeToContactMean = mean(timings);
  const timeToContactStdDev = stdDev(timings);
  const timingCV = timeToContactMean > 0 ? timeToContactStdDev / timeToContactMean : 0;

  // Attack angle aggregates
  const attackAngles = swings.map(s => s.attackAngle);
  const attackAngleMean = mean(attackAngles);
  const attackAngleStdDev = stdDev(attackAngles);

  // Attack direction aggregates
  const attackDirections = swings.map(s => s.attackDirection);
  const attackDirectionMean = mean(attackDirections);
  const attackDirectionStdDev = stdDev(attackDirections);

  // Hand-to-bat ratio (key metric)
  const handToBatRatio = handSpeedMean > 0 ? batSpeedMean / handSpeedMean : 0;

  // Optional metrics if sensor captures them
  const rotationalAccs = swings
    .map(s => s.rotationalAcceleration)
    .filter((v): v is number => v !== undefined);
  const onPlaneEffs = swings
    .map(s => s.onPlaneEfficiency)
    .filter((v): v is number => v !== undefined);
  const connectionAngles = swings
    .map(s => s.connectionAngle)
    .filter((v): v is number => v !== undefined);

  return {
    swingCount: swings.length,

    batSpeedMax: round(batSpeedMax, 1),
    batSpeedMean: round(batSpeedMean, 1),
    batSpeedStdDev: round(batSpeedStdDev, 2),

    handSpeedMax: round(handSpeedMax, 1),
    handSpeedMean: round(handSpeedMean, 1),
    handSpeedStdDev: round(handSpeedStdDev, 2),

    timeToContactMean: round(timeToContactMean, 0),
    timeToContactStdDev: round(timeToContactStdDev, 1),
    timingCV: round(timingCV, 3),

    attackAngleMean: round(attackAngleMean, 1),
    attackAngleStdDev: round(attackAngleStdDev, 2),

    attackDirectionMean: round(attackDirectionMean, 1),
    attackDirectionStdDev: round(attackDirectionStdDev, 2),

    handToBatRatio: round(handToBatRatio, 3),

    // Optional fields
    rotationalAccelerationMean: rotationalAccs.length > 0
      ? round(mean(rotationalAccs), 0)
      : undefined,
    onPlaneEfficiencyMean: onPlaneEffs.length > 0
      ? round(mean(onPlaneEffs), 1)
      : undefined,
    connectionAngleMean: connectionAngles.length > 0
      ? round(mean(connectionAngles), 1)
      : undefined,
  };
}

/**
 * Create empty facts for edge case of no swings
 */
function createEmptyFacts(): SensorFacts {
  return {
    swingCount: 0,
    batSpeedMax: 0,
    batSpeedMean: 0,
    batSpeedStdDev: 0,
    handSpeedMax: 0,
    handSpeedMean: 0,
    handSpeedStdDev: 0,
    timeToContactMean: 0,
    timeToContactStdDev: 0,
    timingCV: 0,
    attackAngleMean: 0,
    attackAngleStdDev: 0,
    attackDirectionMean: 0,
    attackDirectionStdDev: 0,
    handToBatRatio: 0,
  };
}

// ============================================================================
// Helper functions
// ============================================================================

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const squareDiffs = arr.map(val => Math.pow(val - m, 2));
  return Math.sqrt(mean(squareDiffs));
}

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Calculate percentile within a set
 */
export function calculatePercentile(value: number, p10: number, p50: number, p90: number): number {
  if (value <= p10) {
    return Math.max(0, (value / p10) * 10);
  } else if (value <= p50) {
    return 10 + ((value - p10) / (p50 - p10)) * 40;
  } else if (value <= p90) {
    return 50 + ((value - p50) / (p90 - p50)) * 40;
  } else {
    // Above 90th percentile - extend but cap at 99
    return Math.min(99, 90 + ((value - p90) / (p90 - p50)) * 9);
  }
}

/**
 * Get data quality assessment based on swing count
 */
export function assessDataQuality(
  swingCount: number
): 'excellent' | 'good' | 'limited' {
  if (swingCount >= 30) return 'excellent';
  if (swingCount >= 15) return 'good';
  return 'limited';
}
