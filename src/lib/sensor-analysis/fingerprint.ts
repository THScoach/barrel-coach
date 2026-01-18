// ============================================================================
// KINETIC FINGERPRINT CALCULATION
// Aggregated swing pattern analysis over time
// ============================================================================

import type { CanonicalSwing } from '@/lib/integrations/diamond-kinetics/types';

// ============================================================================
// TYPES
// ============================================================================

export interface KineticFingerprint {
  player_id: string;
  period_days: number;
  swing_count: number;

  // Spatial dimensions
  horizontal: { mean: number; std: number }; // Attack direction
  vertical: { mean: number; std: number }; // Attack angle
  depth: { mean: number; std: number }; // Timing deviation

  // Pattern metrics
  scatter_score: number; // Lower = tighter pattern
  tightness: number; // 0-100, higher = tighter

  // Tempo metrics
  tempo: {
    avg_trigger_to_impact: number;
    variance_pct: number;
    category: 'quick' | 'moderate' | 'deliberate';
  };

  // Bias detection
  pull_bias: number; // Negative = pull-heavy, Positive = oppo-heavy
  zone_bias: 'low' | 'middle' | 'high';

  // Comfort zone (middle 80% of swings)
  comfort_zone: {
    horizontal: [number, number];
    vertical: [number, number];
  };

  // Heatmap data for visualization (10x10 grid)
  heatmap: number[][];

  // Progression tracking
  scatter_change: number; // vs previous fingerprint

  // Timestamps
  calculated_at: string;
  period_start: string;
  period_end: string;
}

export interface FingerprintComparison {
  current: KineticFingerprint;
  previous: KineticFingerprint | null;
  scatter_change: number;
  tightness_change: number;
  improved: boolean;
  summary: string;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate kinetic fingerprint from normalized swings
 */
export function calculateFingerprint(
  playerId: string,
  swings: CanonicalSwing[],
  periodDays: number = 7,
  previousFingerprint?: KineticFingerprint | null
): KineticFingerprint | null {
  // Filter to valid swings only
  const validSwings = swings.filter((s) => s.is_valid);

  if (validSwings.length < 10) {
    return null; // Not enough data
  }

  // Extract dimensions
  const horizontal = validSwings
    .map((s) => s.attack_direction_deg)
    .filter((v): v is number => v !== null);
  const vertical = validSwings
    .map((s) => s.attack_angle_deg)
    .filter((v): v is number => v !== null);
  const timings = validSwings
    .map((s) => s.trigger_to_impact_ms)
    .filter((v): v is number => v !== null);

  if (horizontal.length < 10 || vertical.length < 10 || timings.length < 10) {
    return null; // Not enough valid measurements
  }

  // Calculate timing depth (normalized deviation from mean)
  const avgTiming = mean(timings);
  const depth = timings.map((t) => ((t - avgTiming) / avgTiming) * 100);

  // Calculate scatter (lower = tighter pattern)
  const horizontalStd = stdDev(horizontal);
  const verticalStd = stdDev(vertical);
  const depthStd = stdDev(depth);
  const scatter = horizontalStd * 0.4 + verticalStd * 0.35 + depthStd * 0.25;

  // Calculate tightness (inverse of scatter, 0-100)
  const tightness = Math.max(0, Math.min(100, 100 - scatter * 2));

  // Determine tempo category
  let tempoCategory: 'quick' | 'moderate' | 'deliberate';
  if (avgTiming < 150) {
    tempoCategory = 'quick';
  } else if (avgTiming < 200) {
    tempoCategory = 'moderate';
  } else {
    tempoCategory = 'deliberate';
  }

  // Calculate biases
  const pullBias = mean(horizontal); // Negative = pull, Positive = oppo
  const verticalMean = mean(vertical);
  let zoneBias: 'low' | 'middle' | 'high';
  if (verticalMean < -5) {
    zoneBias = 'low';
  } else if (verticalMean > 15) {
    zoneBias = 'high';
  } else {
    zoneBias = 'middle';
  }

  // Calculate comfort zone (middle 80% of swings)
  const sortedHorizontal = [...horizontal].sort((a, b) => a - b);
  const sortedVertical = [...vertical].sort((a, b) => a - b);
  const p10 = Math.floor(horizontal.length * 0.1);
  const p90 = Math.floor(horizontal.length * 0.9);

  const comfortZone = {
    horizontal: [
      round(sortedHorizontal[p10] || sortedHorizontal[0], 1),
      round(sortedHorizontal[p90] || sortedHorizontal[sortedHorizontal.length - 1], 1),
    ] as [number, number],
    vertical: [
      round(sortedVertical[p10] || sortedVertical[0], 1),
      round(sortedVertical[p90] || sortedVertical[sortedVertical.length - 1], 1),
    ] as [number, number],
  };

  // Generate heatmap (10x10 grid)
  const heatmap = generateHeatmap(horizontal, vertical);

  // Calculate scatter change from previous
  const scatterChange = previousFingerprint ? scatter - previousFingerprint.scatter_score : 0;

  // Timestamps
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  return {
    player_id: playerId,
    period_days: periodDays,
    swing_count: validSwings.length,

    horizontal: { mean: round(mean(horizontal), 1), std: round(horizontalStd, 2) },
    vertical: { mean: round(mean(vertical), 1), std: round(verticalStd, 2) },
    depth: { mean: round(mean(depth), 1), std: round(depthStd, 2) },

    scatter_score: round(scatter, 2),
    tightness: round(tightness, 0),

    tempo: {
      avg_trigger_to_impact: round(avgTiming, 0),
      variance_pct: round((stdDev(timings) / avgTiming) * 100, 1),
      category: tempoCategory,
    },

    pull_bias: round(pullBias, 1),
    zone_bias: zoneBias,
    comfort_zone: comfortZone,

    heatmap,
    scatter_change: round(scatterChange, 2),

    calculated_at: now.toISOString(),
    period_start: periodStart.toISOString(),
    period_end: now.toISOString(),
  };
}

// ============================================================================
// COMPARISON FUNCTION
// ============================================================================

/**
 * Compare two fingerprints to track progression
 */
export function compareFingerprints(
  current: KineticFingerprint,
  previous: KineticFingerprint | null
): FingerprintComparison {
  if (!previous) {
    return {
      current,
      previous: null,
      scatter_change: 0,
      tightness_change: 0,
      improved: false,
      summary: 'First fingerprint recorded. Keep training to track progression.',
    };
  }

  const scatterChange = current.scatter_score - previous.scatter_score;
  const tightnessChange = current.tightness - previous.tightness;
  const improved = tightnessChange > 5 || scatterChange < -2;

  // Generate summary
  const summaryParts: string[] = [];

  if (Math.abs(tightnessChange) > 3) {
    if (tightnessChange > 0) {
      summaryParts.push(`Pattern tightened by ${tightnessChange.toFixed(0)}%`);
    } else {
      summaryParts.push(`Pattern loosened by ${Math.abs(tightnessChange).toFixed(0)}%`);
    }
  }

  if (Math.abs(scatterChange) > 1) {
    if (scatterChange < 0) {
      summaryParts.push(`Scatter reduced (more consistent)`);
    } else {
      summaryParts.push(`Scatter increased (less consistent)`);
    }
  }

  const tempoChange =
    current.tempo.variance_pct - previous.tempo.variance_pct;
  if (Math.abs(tempoChange) > 2) {
    if (tempoChange < 0) {
      summaryParts.push(`Timing tightened by ${Math.abs(tempoChange).toFixed(1)}%`);
    } else {
      summaryParts.push(`Timing loosened by ${tempoChange.toFixed(1)}%`);
    }
  }

  const summary =
    summaryParts.length > 0
      ? summaryParts.join('. ') + '.'
      : 'No significant changes detected.';

  return {
    current,
    previous,
    scatter_change: scatterChange,
    tightness_change: tightnessChange,
    improved,
    summary,
  };
}

// ============================================================================
// HEATMAP GENERATION
// ============================================================================

/**
 * Generate 10x10 heatmap from horizontal/vertical scatter
 * X-axis: attack direction (-30 to +30)
 * Y-axis: attack angle (-10 to +40)
 */
function generateHeatmap(horizontal: number[], vertical: number[]): number[][] {
  // Initialize 10x10 grid
  const grid: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));

  // Define ranges
  const hMin = -30,
    hMax = 30; // Attack direction range
  const vMin = -10,
    vMax = 40; // Attack angle range

  const hStep = (hMax - hMin) / 10;
  const vStep = (vMax - vMin) / 10;

  // Count swings in each cell
  for (let i = 0; i < horizontal.length; i++) {
    const h = horizontal[i];
    const v = vertical[i];

    // Clamp to range
    const hClamped = Math.max(hMin, Math.min(hMax - 0.01, h));
    const vClamped = Math.max(vMin, Math.min(vMax - 0.01, v));

    // Calculate grid position
    const hIndex = Math.floor((hClamped - hMin) / hStep);
    const vIndex = Math.floor((vClamped - vMin) / vStep);

    // Increment count (vIndex inverted so high angles are at top)
    const row = 9 - vIndex;
    const col = hIndex;

    if (row >= 0 && row < 10 && col >= 0 && col < 10) {
      grid[row][col]++;
    }
  }

  // Normalize to percentages
  const total = horizontal.length;
  return grid.map((row) => row.map((count) => Math.round((count / total) * 100)));
}

// ============================================================================
// MOTOR PROFILE FROM FINGERPRINT
// ============================================================================

export type MotorProfile = 'Spinner' | 'Slingshotter' | 'Whipper' | 'Titan' | 'Unknown';

/**
 * Classify motor profile from fingerprint data
 */
export function classifyMotorProfileFromFingerprint(
  fingerprint: KineticFingerprint
): MotorProfile {
  const { tempo, tightness, pull_bias, scatter_score } = fingerprint;

  // Spinner: Quick tempo, tight pattern, rotational focus
  if (tempo.category === 'quick' && tightness > 60 && scatter_score < 15) {
    return 'Spinner';
  }

  // Slingshotter: Deliberate, uses stretch-shortening cycle
  if (tempo.category === 'deliberate' && tightness > 50) {
    return 'Slingshotter';
  }

  // Whipper: Pull-heavy, explosive release
  if (pull_bias < -8 && tightness > 45) {
    return 'Whipper';
  }

  // Titan: Very consistent, all-around elite metrics
  if (tempo.variance_pct < 4 && tightness > 70 && scatter_score < 10) {
    return 'Titan';
  }

  // Unknown: Doesn't fit a clear pattern (yet)
  return 'Unknown';
}

// ============================================================================
// HELPERS
// ============================================================================

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const squareDiffs = arr.map((val) => Math.pow(val - m, 2));
  return Math.sqrt(mean(squareDiffs));
}

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
