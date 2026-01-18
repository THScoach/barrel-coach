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
  releaseUnlock: { value: number; confidence: 'high' };
  timingUnlock: { value: number; confidence: 'medium' };
  upstreamUnlock: { value: number; confidence: 'low' };
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
