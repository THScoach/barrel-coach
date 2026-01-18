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
  getLeakDetails,
  calculateTotalPotentialGain,
  filterLeaksByProbability,
  groupLeaksByCategory,
  LEAK_CATALOG,
} from './leaks';

// Drill recommendations
export {
  getDrillsForLeaks,
  getDrillsByCategory,
  getDrillById,
  getTopPriorityDrills,
  DRILL_LIBRARY,
} from './drills';

// Benchmarks and percentiles
export {
  getBenchmark,
  calculatePercentile as calculateBenchmarkPercentile,
  getBatSpeedPercentile,
  getHandSpeedPercentile,
  getRatioPercentile,
  getTimingConsistencyPercentile,
  getExpectedBatSpeed,
  calculateMechanicalLoss,
  getAllPercentiles,
  EXTENDED_BENCHMARKS,
} from './benchmarks';

// Kwon analysis (main orchestration)
export {
  performKwonAnalysis,
  performExtendedKwonAnalysis,
  compareAnalyses,
  getFocusAreas,
} from './kwon-analysis';
export type { ExtendedKwonAnalysis } from './kwon-analysis';

// Save/load analysis
export {
  saveKwonAnalysis,
  loadKwonAnalysis,
  getLatestPlayerAnalysis,
  getPlayerAnalysisHistory,
  updatePlayerScoresFromAnalysis,
} from './save-analysis';

// Re-export kwon-engine for backward compatibility
export * from './kwon-engine';
