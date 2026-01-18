// ============================================================================
// KWON-STYLE SENSOR ANALYSIS TYPES
// "We don't add, we unlock. Measure to understand, not enforce."
// ============================================================================

/**
 * Motor profile classification
 */
export type MotorProfile = 'Spinner' | 'Slingshotter' | 'Whipper' | 'Titan' | 'Unknown';

/**
 * Confidence levels for predictions
 */
export type ConfidenceLevel = 'measured' | 'high' | 'medium' | 'low';

/**
 * Data quality assessment
 */
export type DataQuality = 'excellent' | 'good' | 'limited';

/**
 * Leak probability
 */
export type LeakProbability = 'likely' | 'possible' | 'speculative';

/**
 * Sensor facts - MEASURED data (100% confidence)
 */
export interface SensorFacts {
  swingCount: number;
  batSpeedMax: number;
  batSpeedMean: number;
  batSpeedStdDev: number;
  handSpeedMax: number;
  handSpeedMean: number;
  handSpeedStdDev: number;
  timeToContactMean: number;
  timeToContactStdDev: number;
  timingCV: number; // Coefficient of variation
  attackAngleMean: number;
  attackAngleStdDev: number;
  attackDirectionMean: number;
  attackDirectionStdDev: number;
  handToBatRatio: number;
  rotationalAccelerationMean?: number;
  onPlaneEfficiencyMean?: number;
  connectionAngleMean?: number;
}

/**
 * Release prediction (HIGH confidence)
 */
export interface ReleasePrediction {
  handToBatRatio: number;
  quality: 'elite' | 'good' | 'developing' | 'poor';
  percentile: number;
  potentialUnlock: number; // MPH
  confidence: 'high';
  reasoning: string;
}

/**
 * Timing prediction (MEDIUM confidence)
 */
export interface TimingPrediction {
  consistencyScore: number;
  tempoCategory: 'quick' | 'moderate' | 'deliberate';
  adjustability: 'high' | 'medium' | 'low';
  predictedTimingWindow: number; // ms
  potentialUnlock: number; // MPH
  confidence: 'medium';
  reasoning: string;
}

/**
 * Upstream prediction (LOW confidence - needs video)
 */
export interface UpstreamPrediction {
  estimatedHipContribution: number; // 0-100%
  estimatedTorsoContribution: number; // 0-100%
  likelyKineticChainBreaks: string[];
  potentialUnlock: number; // MPH
  confidence: 'low';
  reasoning: string;
  needsVideoFor: string[];
}

/**
 * Kinetic potential calculation
 */
export interface KineticPotential {
  currentBatSpeed: number;
  projectedPotential: number;
  totalUnlock: number;
  releaseUnlock: { value: number; confidence: 'high'; reasoning?: string };
  timingUnlock: { value: number; confidence: 'medium'; reasoning?: string };
  upstreamUnlock: { value: number; confidence: 'low'; reasoning?: string };
  overallConfidence: ConfidenceLevel;
  validationNeeds: string[];
}

/**
 * Possible leak detection
 */
export interface PossibleLeak {
  leakType: string;
  category: 'bat' | 'body' | 'brain';
  description: string;
  probability: LeakProbability;
  evidence: string;
  potentialGain: number; // MPH
  howToConfirm: string;
}

/**
 * 4B Score component
 */
export interface FourBComponent {
  overall: number;
  confidence: ConfidenceLevel;
  reasoning?: string;
  needsVideoFor?: string[];
}

/**
 * BAT score details
 */
export interface BatScore extends FourBComponent {
  batSpeedScore: number;
  handSpeedScore: number;
  releaseScore: number;
  accelerationScore?: number;
}

/**
 * BRAIN score details
 */
export interface BrainScore extends FourBComponent {
  timingConsistency: number;
  pathConsistency: number;
  zoneAdaptability: number;
}

/**
 * BODY score details
 */
export interface BodyScore extends FourBComponent {
  estimatedSequencing: number;
  estimatedSeparation: number;
  estimatedGroundForce: number;
}

/**
 * BALL score details
 */
export interface BallScore extends FourBComponent {
  available: boolean;
  exitVelocity?: number;
  launchAngle?: number;
  hardHitRate?: number;
}

/**
 * Complete 4B scores from sensor
 */
export interface FourBScores {
  bat: BatScore;
  brain: BrainScore;
  body: BodyScore;
  ball: BallScore;
  compositeScore: number;
  confidenceNote: string;
}

/**
 * Kinetic fingerprint (visual pattern)
 */
export interface KineticFingerprint {
  intentMap: {
    horizontalMean: number;
    horizontalStdDev: number;
    verticalMean: number;
    verticalStdDev: number;
    depthIndex: number;
    depthConsistency: number;
  };
  timingSignature: {
    triggerToImpactMs: number;
    timingVariance: number;
    tempoCategory: 'quick' | 'moderate' | 'deliberate';
  };
  patternMetrics: {
    tightness: number;
    pullBias: number;
    zoneBias: 'low' | 'middle' | 'high';
    comfortZone: {
      horizontal: [number, number];
      vertical: [number, number];
    };
  };
  bodySequence?: {
    kineticChainOrder: string[];
    separationAngle: number;
    energyTransferEfficiency: number;
  };
}

/**
 * Complete Kwon analysis result
 */
export interface KwonAnalysis {
  sessionId: string;
  playerId: string;
  analysisDate: string;

  // Data quality
  swingsAnalyzed: number;
  dataQuality: DataQuality;

  // Classification
  motorProfile: MotorProfile;

  // Core analysis (by confidence level)
  sensorFacts: SensorFacts;
  releasePrediction: ReleasePrediction;
  timingPrediction: TimingPrediction;
  upstreamPrediction: UpstreamPrediction;

  // Aggregated potential
  kineticPotential: KineticPotential;

  // Issues
  possibleLeaks: PossibleLeak[];

  // Scores
  fourBScores: FourBScores;

  // Focus areas
  priorityFocus: string;
  secondaryFocus: string;

  // Visual
  fingerprint: KineticFingerprint;
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  ageGroup?: string;
  level?: string;
  includeFingerprint?: boolean;
}

/**
 * Drill recommendation
 */
export interface DrillRecommendation {
  drillId: string;
  name: string;
  category: 'bat' | 'body' | 'brain';
  targetLeak: string;
  priority: number;
  description: string;
}

/**
 * Diamond Kinetics raw swing data format (legacy)
 */
export interface DKSwingData {
  swingId?: string;
  timestamp?: string;
  batSpeed: number;
  handSpeed: number;
  timeToContact: number;
  attackAngle: number;
  attackDirection: number;
  rotationalAcceleration?: number;
  onPlaneEfficiency?: number;
  connectionAngle?: number;
  exitVelocity?: number;
  launchAngle?: number;
  distance?: number;
}

/**
 * Percentile range for baseline metrics
 */
export interface PercentileRange {
  p10: number;
  p50: number;
  p90: number;
}

/**
 * Population baseline for percentile calculations
 */
export interface PopulationBaseline {
  ageGroup: string;
  batSpeed: PercentileRange;
  handSpeed: PercentileRange;
  handToBatRatio: PercentileRange;
  timingCV: PercentileRange;
}

/**
 * Population baselines by level
 */
export const POPULATION_BASELINES: Record<string, PopulationBaseline> = {
  youth: {
    ageGroup: 'youth',
    batSpeed: { p10: 35, p50: 45, p90: 55 },
    handSpeed: { p10: 14, p50: 18, p90: 22 },
    handToBatRatio: { p10: 1.15, p50: 1.22, p90: 1.30 },
    timingCV: { p10: 0.05, p50: 0.10, p90: 0.18 },
  },
  high_school: {
    ageGroup: 'high_school',
    batSpeed: { p10: 55, p50: 65, p90: 75 },
    handSpeed: { p10: 20, p50: 25, p90: 30 },
    handToBatRatio: { p10: 1.18, p50: 1.25, p90: 1.32 },
    timingCV: { p10: 0.04, p50: 0.08, p90: 0.14 },
  },
  college: {
    ageGroup: 'college',
    batSpeed: { p10: 65, p50: 72, p90: 80 },
    handSpeed: { p10: 24, p50: 28, p90: 32 },
    handToBatRatio: { p10: 1.20, p50: 1.27, p90: 1.34 },
    timingCV: { p10: 0.03, p50: 0.06, p90: 0.11 },
  },
  pro: {
    ageGroup: 'pro',
    batSpeed: { p10: 70, p50: 76, p90: 82 },
    handSpeed: { p10: 26, p50: 30, p90: 34 },
    handToBatRatio: { p10: 1.22, p50: 1.28, p90: 1.35 },
    timingCV: { p10: 0.025, p50: 0.05, p90: 0.09 },
  },
  mlb: {
    ageGroup: 'mlb',
    batSpeed: { p10: 74, p50: 78, p90: 84 },
    handSpeed: { p10: 28, p50: 31, p90: 35 },
    handToBatRatio: { p10: 1.24, p50: 1.30, p90: 1.38 },
    timingCV: { p10: 0.02, p50: 0.04, p90: 0.07 },
  },
};

/**
 * 4B scores computed from sensor data
 */
export interface FourBFromSensor {
  bat: BatScore;
  brain: BrainScore;
  body: BodyScore;
  ball: BallScore;
  compositeScore: number;
  confidenceNote: string;
}
