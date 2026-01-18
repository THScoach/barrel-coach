// ============================================================================
// KINETIC FINGERPRINT
// Composite visualization of swing intent and body movement
// Replaces "Swinging Fingerprint" terminology
// ============================================================================

export interface KineticFingerprintData {
  // Intent Map (from DK sensor)
  intentMap: {
    horizontalMean: number;      // Pull (-) to Oppo (+), degrees
    horizontalStdDev: number;
    verticalMean: number;        // Attack angle mean
    verticalStdDev: number;
    depthIndex: number;          // Timing: early (0) to late (100)
    depthConsistency: number;
  };

  // Timing Signature
  timingSignature: {
    triggerToImpactMs: number;   // Average time from trigger to impact
    timingVariance: number;      // CV of timing (lower = more consistent)
    tempoCategory: 'quick' | 'moderate' | 'deliberate';
  };

  // Pattern Metrics
  patternMetrics: {
    tightness: number;           // 0-100, higher = tighter pattern
    pullBias: number;            // Negative = pull-heavy, Positive = oppo-heavy
    zoneBias: 'low' | 'middle' | 'high';
    comfortZone: {
      horizontal: [number, number];  // Min/max attack direction
      vertical: [number, number];    // Min/max attack angle
    };
  };

  // Body Sequence (from video/3D when available)
  bodySequence?: {
    kineticChainOrder: ('hips' | 'torso' | 'arms' | 'bat')[];
    separationAngle: number;     // X-factor at stride
    energyTransferEfficiency: number;  // 0-1
  };

  // Computed from swings
  swingCount: number;
  lastUpdated: Date;
}

export interface FingerprintSwingData {
  attackAngle: number;
  attackDirection: number;
  timeToContact: number;
  impactLocX?: number;
  impactLocY?: number;
}

// Calculate Kinetic Fingerprint from array of swings
export function calculateKineticFingerprint(
  swings: FingerprintSwingData[]
): KineticFingerprintData {
  if (swings.length === 0) {
    return createEmptyFingerprint();
  }

  // Calculate attack direction (horizontal) stats
  const directions = swings.map(s => s.attackDirection);
  const horizontalMean = mean(directions);
  const horizontalStdDev = stdDev(directions);

  // Calculate attack angle (vertical) stats
  const angles = swings.map(s => s.attackAngle);
  const verticalMean = mean(angles);
  const verticalStdDev = stdDev(angles);

  // Calculate timing stats
  const timings = swings.map(s => s.timeToContact);
  const timingMean = mean(timings);
  const timingVariance = cv(timings);

  // Determine tempo category
  let tempoCategory: 'quick' | 'moderate' | 'deliberate';
  if (timingMean < 350) tempoCategory = 'quick';
  else if (timingMean < 450) tempoCategory = 'moderate';
  else tempoCategory = 'deliberate';

  // Calculate depth index (normalized timing, 0-100)
  const depthIndex = Math.min(100, Math.max(0, ((timingMean - 250) / 300) * 100));

  // Calculate pattern tightness (inverse of scatter)
  const scatter = horizontalStdDev + verticalStdDev;
  const tightness = Math.max(0, Math.min(100, 100 - scatter * 2));

  // Calculate pull bias
  const pullBias = horizontalMean; // Negative = pull, Positive = oppo

  // Determine zone bias
  let zoneBias: 'low' | 'middle' | 'high';
  if (verticalMean < -5) zoneBias = 'low';
  else if (verticalMean > 15) zoneBias = 'high';
  else zoneBias = 'middle';

  // Calculate comfort zone (middle 80% of swings)
  const sortedHorizontal = [...directions].sort((a, b) => a - b);
  const sortedVertical = [...angles].sort((a, b) => a - b);
  const p10 = Math.floor(swings.length * 0.1);
  const p90 = Math.floor(swings.length * 0.9);

  return {
    intentMap: {
      horizontalMean: round(horizontalMean, 1),
      horizontalStdDev: round(horizontalStdDev, 1),
      verticalMean: round(verticalMean, 1),
      verticalStdDev: round(verticalStdDev, 1),
      depthIndex: round(depthIndex, 0),
      depthConsistency: round(100 - timingVariance * 100, 0),
    },
    timingSignature: {
      triggerToImpactMs: round(timingMean, 0),
      timingVariance: round(timingVariance, 3),
      tempoCategory,
    },
    patternMetrics: {
      tightness: round(tightness, 0),
      pullBias: round(pullBias, 1),
      zoneBias,
      comfortZone: {
        horizontal: [
          round(sortedHorizontal[p10] || sortedHorizontal[0], 1),
          round(sortedHorizontal[p90] || sortedHorizontal[sortedHorizontal.length - 1], 1),
        ],
        vertical: [
          round(sortedVertical[p10] || sortedVertical[0], 1),
          round(sortedVertical[p90] || sortedVertical[sortedVertical.length - 1], 1),
        ],
      },
    },
    swingCount: swings.length,
    lastUpdated: new Date(),
  };
}

function createEmptyFingerprint(): KineticFingerprintData {
  return {
    intentMap: {
      horizontalMean: 0,
      horizontalStdDev: 0,
      verticalMean: 0,
      verticalStdDev: 0,
      depthIndex: 50,
      depthConsistency: 0,
    },
    timingSignature: {
      triggerToImpactMs: 0,
      timingVariance: 0,
      tempoCategory: 'moderate',
    },
    patternMetrics: {
      tightness: 0,
      pullBias: 0,
      zoneBias: 'middle',
      comfortZone: {
        horizontal: [0, 0],
        vertical: [0, 0],
      },
    },
    swingCount: 0,
    lastUpdated: new Date(),
  };
}

// Helper functions
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

function cv(arr: number[]): number {
  const m = mean(arr);
  if (m === 0) return 0;
  return stdDev(arr) / m;
}

function round(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// Compare two fingerprints to see if pattern is tightening
export function compareFingerprints(
  older: KineticFingerprintData,
  newer: KineticFingerprintData
): {
  tightnessChange: number;
  consistencyChange: number;
  improved: boolean;
} {
  const tightnessChange = newer.patternMetrics.tightness - older.patternMetrics.tightness;
  const consistencyChange = newer.intentMap.depthConsistency - older.intentMap.depthConsistency;

  return {
    tightnessChange,
    consistencyChange,
    improved: tightnessChange > 5 || consistencyChange > 5,
  };
}

// Motor Profile classification based on fingerprint
export type MotorProfile = 'Spinner' | 'Slingshotter' | 'Whipper' | 'Titan' | 'Unknown';

export function classifyMotorProfile(fingerprint: KineticFingerprintData): MotorProfile {
  const { timingSignature, patternMetrics } = fingerprint;

  // This is a simplified classification - real implementation would use ML model
  if (timingSignature.tempoCategory === 'quick' && patternMetrics.tightness > 60) {
    return 'Spinner';
  }

  if (timingSignature.tempoCategory === 'deliberate' && patternMetrics.zoneBias === 'low') {
    return 'Slingshotter';
  }

  if (patternMetrics.pullBias < -10 && patternMetrics.tightness > 50) {
    return 'Whipper';
  }

  if (timingSignature.timingVariance < 0.05 && patternMetrics.tightness > 70) {
    return 'Titan';
  }

  return 'Unknown';
}
