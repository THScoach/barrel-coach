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

// Leak detection
export {
  identifyPossibleLeaks,
  getPrimaryLeak,
  getTotalPotentialGain,
  getLeakDetails,
  calculateTotalPotentialGain,
  filterLeaksByProbability,
  groupLeaksByCategory,
  LEAK_CATALOG,
} from './leaks';

// Drill recommendations
export {
  getDrillsForLeaks,
  getBestDrillForLeak,
  getDrillsByCategory,
  getDrillById,
  getAllDrills,
} from './drills';
export type { DrillRecommendation } from './drills';

// Benchmarks and percentiles
export {
  getExpectedBatSpeed,
  getExpectedBatSpeedRange,
  getExpectedRatio,
  getTargetBatSpeed,
  calculatePotentialRealization,
  EXPECTED_BAT_SPEED,
  EXPECTED_RATIO,
} from './benchmarks';
export type { PlayerProfile, BatSpeedRange } from './benchmarks';

// Kwon analysis (main orchestration)
export {
  performKwonAnalysis,
  compareAnalyses,
} from './kwon-analysis';
export type { AnalysisOptions, AnalysisComparison } from './kwon-analysis';

// Save/load analysis
export {
  saveKwonAnalysis,
  saveKineticFingerprint,
  getLatestAnalysis,
  getLatestFingerprint,
  compareAnalysisOverTime,
} from './save-analysis';
export type { SaveAnalysisResult, SaveFingerprintResult } from './save-analysis';
