// ============================================================================
// SENSOR ANALYSIS MODULE - KWON STYLE
// "We don't add, we unlock. Measure to understand, not enforce."
// ============================================================================

// Core types
export * from './types';

// Fact extraction (supports both CanonicalSwing and legacy DKSwingData)
export {
  extractSensorFacts,
  extractSensorFactsFromRaw,
  calculatePercentile,
  assessDataQuality,
} from './extract-facts';

// Predictions with confidence
export {
  predictRelease,
  predictTiming,
  predictUpstream,
  calculateKineticPotential,
} from './predictions';

// 4B scoring
export {
  calculateBatScore,
  calculateBrainScore,
  calculateBodyScore,
  calculateBallScore,
  calculateFourBFromSensor,
} from './four-b-scoring';

// Kinetic Fingerprint
export {
  calculateFingerprint,
  compareFingerprints,
  classifyMotorProfileFromFingerprint,
} from './fingerprint';
export type { KineticFingerprint, FingerprintComparison } from './fingerprint';

// Re-export kwon-engine for backward compatibility
export * from './kwon-engine';
