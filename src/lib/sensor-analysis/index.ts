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
  getDrillsByCategory,
  getDrillById,
  getTopPriorityDrills,
  DRILL_LIBRARY,
} from './drills';

// Benchmarks and percentiles
export {
  getExpectedBatSpeed,
  getBenchmark,
  calculatePercentile as calculateBenchmarkPercentile,
  getBatSpeedPercentile,
  getHandSpeedPercentile,
  getRatioPercentile,
  getTimingConsistencyPercentile,
  calculateMechanicalLoss,
  getAllPercentiles,
  EXTENDED_BENCHMARKS,
} from './benchmarks';

// Kwon analysis (main orchestration)
export {
  performKwonAnalysis,
  compareAnalyses,
} from './kwon-analysis';
export type { AnalysisOptions, AnalysisComparison } from './kwon-analysis';

// Save/load analysis
export {
  saveKwonAnalysis,
  loadKwonAnalysis,
  getLatestPlayerAnalysis,
  getPlayerAnalysisHistory,
  updatePlayerScoresFromAnalysis,
} from './save-analysis';
