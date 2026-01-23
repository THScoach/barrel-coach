/**
 * Swing Metrics Processor
 * ============================================================================
 * Processes raw Diamond Kinetics data into Catching Barrels proprietary metrics
 * including motor profiles, tempo scores, efficiency ratings, and age-group percentiles
 */

import type { DKSwing } from './DiamondKineticsAPI';

// ============================================================================
// TYPES
// ============================================================================

export type MotorProfile = 'SPINNER' | 'WHIPPER' | 'SLINGSHOTTER' | 'TITAN' | 'UNKNOWN';

export type AgeGroup = '8U' | '10U' | '12U' | '14U' | 'HS' | 'College' | 'Pro';

export interface CBSwingAnalysis {
  // Direct from DK
  batSpeed: number | null;
  handSpeed: number | null;
  attackAngle: number | null;
  timeToContact: number | null; // in seconds
  
  // Raw DK metrics
  speedEfficiency: number | null;
  handCastDistance: number | null;
  distanceInZone: number | null;
  impactMomentum: number | null;
  appliedPower: number | null;

  // Calculated by Catching Barrels
  tempoScore: number;           // 0-100
  efficiencyRating: number;     // 0-100
  motorProfile: MotorProfile;
  motorProfileConfidence: number; // 0-100

  // Age-group percentiles
  batSpeedPercentile: number;
  attackAngleOptimal: boolean;
  attackAngleZone: 'flat' | 'optimal' | 'steep';

  // Development insights
  strengths: string[];
  improvements: string[];
  drillRecommendations: string[];
}

export interface SessionSummary {
  totalSwings: number;
  validSwings: number;
  avgBatSpeed: number;
  maxBatSpeed: number;
  avgHandSpeed: number;
  avgAttackAngle: number;
  avgTempoScore: number;
  avgEfficiency: number;
  dominantMotorProfile: MotorProfile;
  motorProfileBreakdown: Record<MotorProfile, number>;
  batSpeedPercentile: number;
  consistencyScore: number; // Based on CV of bat speed
  strengths: string[];
  improvements: string[];
}

// ============================================================================
// AGE-GROUP BENCHMARKS
// ============================================================================

/**
 * Bat speed benchmarks by age group (in mph)
 * Based on Diamond Kinetics population data and industry standards
 */
export const AGE_BENCHMARKS: Record<AgeGroup, { 
  p10: number; 
  p25: number; 
  p50: number; 
  p75: number; 
  p90: number; 
  p99: number;
}> = {
  '8U':     { p10: 28, p25: 32, p50: 38, p75: 44, p90: 50, p99: 56 },
  '10U':    { p10: 34, p25: 38, p50: 45, p75: 52, p90: 58, p99: 64 },
  '12U':    { p10: 40, p25: 45, p50: 52, p75: 60, p90: 66, p99: 72 },
  '14U':    { p10: 48, p25: 52, p50: 60, p75: 68, p90: 74, p99: 80 },
  'HS':     { p10: 54, p25: 58, p50: 66, p75: 74, p90: 80, p99: 88 },
  'College':{ p10: 62, p25: 65, p50: 72, p75: 78, p90: 85, p99: 92 },
  'Pro':    { p10: 68, p25: 72, p50: 78, p75: 84, p90: 90, p99: 98 },
};

/**
 * Optimal timing windows by age group (trigger-to-impact in ms)
 */
export const TIMING_BENCHMARKS: Record<AgeGroup, { ideal: number; min: number; max: number }> = {
  '8U':     { ideal: 160, min: 140, max: 200 },
  '10U':    { ideal: 155, min: 135, max: 190 },
  '12U':    { ideal: 150, min: 130, max: 180 },
  '14U':    { ideal: 145, min: 125, max: 175 },
  'HS':     { ideal: 140, min: 120, max: 170 },
  'College':{ ideal: 135, min: 115, max: 165 },
  'Pro':    { ideal: 130, min: 110, max: 160 },
};

// ============================================================================
// MOTOR PROFILE CLASSIFICATION
// ============================================================================

/**
 * Motor Profile Classification based on DK metrics
 * 
 * - SPINNER: High hand cast, rotational dominance, barrel stays close
 * - WHIPPER: High speed efficiency, quick hands, late release
 * - SLINGSHOTTER: Long swing path, power-focused, large zone coverage
 * - TITAN: Elite across multiple categories
 */
export function classifyMotorProfile(swing: {
  speedEfficiency?: number | null;
  handCastDistance?: number | null;
  distanceInZone?: number | null;
  maxBarrelSpeed?: number | null;
  triggerToImpact?: number | null;
}): { profile: MotorProfile; confidence: number } {
  const speedEff = swing.speedEfficiency ?? 0;
  const handCast = swing.handCastDistance ?? 0;
  const distInZone = swing.distanceInZone ?? 0;
  const batSpeed = swing.maxBarrelSpeed ?? 0;
  const triggerTime = swing.triggerToImpact ?? 0;

  // Track scores for each profile
  const scores: Record<MotorProfile, number> = {
    SPINNER: 0,
    WHIPPER: 0,
    SLINGSHOTTER: 0,
    TITAN: 0,
    UNKNOWN: 0,
  };

  // SPINNER indicators: High hand cast, rotational dominance
  if (handCast > 8) scores.SPINNER += 30;
  else if (handCast > 6) scores.SPINNER += 15;
  
  if (distInZone > 12 && distInZone < 16) scores.SPINNER += 20;
  if (speedEff > 75 && speedEff < 85) scores.SPINNER += 10;

  // WHIPPER indicators: High efficiency, quick trigger
  if (speedEff > 85) scores.WHIPPER += 35;
  else if (speedEff > 80) scores.WHIPPER += 20;
  
  if (triggerTime < 150) scores.WHIPPER += 25;
  else if (triggerTime < 160) scores.WHIPPER += 15;
  
  if (handCast < 6) scores.WHIPPER += 10; // Compact path

  // SLINGSHOTTER indicators: Long zone, high bat speed
  if (distInZone > 15) scores.SLINGSHOTTER += 30;
  else if (distInZone > 13) scores.SLINGSHOTTER += 15;
  
  if (batSpeed > 65) scores.SLINGSHOTTER += 25;
  else if (batSpeed > 58) scores.SLINGSHOTTER += 15;
  
  if (triggerTime > 160) scores.SLINGSHOTTER += 10; // Longer load

  // TITAN indicators: Elite across all metrics
  if (batSpeed > 70 && speedEff > 80 && distInZone > 14) {
    scores.TITAN += 50;
  }
  if (batSpeed > 75) scores.TITAN += 15;
  if (speedEff > 85 && batSpeed > 65) scores.TITAN += 20;

  // Find highest scoring profile
  let maxScore = 0;
  let bestProfile: MotorProfile = 'UNKNOWN';
  
  for (const [profile, score] of Object.entries(scores) as [MotorProfile, number][]) {
    if (score > maxScore) {
      maxScore = score;
      bestProfile = profile;
    }
  }

  // Calculate confidence (0-100)
  const totalPossible = 100;
  const confidence = Math.min(100, Math.round((maxScore / totalPossible) * 100));

  // Require minimum confidence
  if (confidence < 25 || maxScore < 20) {
    return { profile: 'UNKNOWN', confidence: 0 };
  }

  return { profile: bestProfile, confidence };
}

// ============================================================================
// TEMPO SCORE CALCULATION
// ============================================================================

/**
 * Calculate Tempo Score (0-100)
 * Based on trigger-to-impact timing relative to ideal for age group
 */
export function calculateTempoScore(
  triggerToImpactMs: number | null,
  ageGroup: AgeGroup = '12U'
): number {
  if (triggerToImpactMs === null || triggerToImpactMs <= 0) {
    return 50; // Default neutral
  }

  const benchmark = TIMING_BENCHMARKS[ageGroup];
  const ideal = benchmark.ideal;
  const variance = Math.abs(triggerToImpactMs - ideal);

  // Perfect timing = 100 points
  // Each ms off ideal = -1.5 points
  // Within optimal window = bonus points
  let score: number;

  if (variance <= 5) {
    // Perfect timing zone
    score = 95 + (5 - variance);
  } else if (variance <= 15) {
    // Good timing
    score = 80 + (15 - variance);
  } else if (variance <= 30) {
    // Average timing
    score = 60 + (30 - variance) * 0.67;
  } else {
    // Poor timing
    score = Math.max(20, 60 - (variance - 30) * 0.8);
  }

  // Penalty for being outside optimal window
  if (triggerToImpactMs < benchmark.min) {
    score -= 10; // Too quick = rushing
  } else if (triggerToImpactMs > benchmark.max) {
    score -= 10; // Too slow = dragging
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// EFFICIENCY RATING CALCULATION
// ============================================================================

/**
 * Calculate Efficiency Rating (0-100)
 * Based on energy transfer through the swing
 */
export function calculateEfficiencyRating(swing: {
  speedEfficiency?: number | null;
  approachAngle?: number | null;
  distanceInZone?: number | null;
  handCastDistance?: number | null;
}): number {
  let score = 0;
  let factors = 0;

  // Speed efficiency is the primary factor (0-100)
  if (swing.speedEfficiency !== null && swing.speedEfficiency !== undefined) {
    score += swing.speedEfficiency;
    factors += 1;
  }

  // Optimal attack angle bonus (8-15 degrees)
  if (swing.approachAngle !== null && swing.approachAngle !== undefined) {
    const angle = swing.approachAngle;
    if (angle >= 8 && angle <= 15) {
      score += 90; // Optimal
    } else if (angle >= 5 && angle <= 18) {
      score += 70; // Good
    } else if (angle >= 0 && angle <= 25) {
      score += 50; // Acceptable
    } else {
      score += 30; // Poor
    }
    factors += 1;
  }

  // Zone coverage bonus
  if (swing.distanceInZone !== null && swing.distanceInZone !== undefined) {
    const zoneScore = Math.min(100, (swing.distanceInZone / 18) * 100);
    score += zoneScore;
    factors += 1;
  }

  // Hand cast penalty (lower is generally better for efficiency)
  if (swing.handCastDistance !== null && swing.handCastDistance !== undefined) {
    const castScore = Math.max(0, 100 - (swing.handCastDistance - 4) * 8);
    score += castScore;
    factors += 1;
  }

  if (factors === 0) return 50; // Default neutral
  
  return Math.round(score / factors);
}

// ============================================================================
// BAT SPEED PERCENTILE
// ============================================================================

/**
 * Calculate bat speed percentile for age group
 */
export function getBatSpeedPercentile(
  batSpeed: number | null,
  ageGroup: AgeGroup = '12U'
): number {
  if (batSpeed === null || batSpeed <= 0) return 0;

  const benchmark = AGE_BENCHMARKS[ageGroup];

  // Interpolate between percentile breakpoints
  if (batSpeed >= benchmark.p99) {
    return 99 + Math.min(1, (batSpeed - benchmark.p99) / 10);
  }
  if (batSpeed >= benchmark.p90) {
    return 90 + ((batSpeed - benchmark.p90) / (benchmark.p99 - benchmark.p90)) * 9;
  }
  if (batSpeed >= benchmark.p75) {
    return 75 + ((batSpeed - benchmark.p75) / (benchmark.p90 - benchmark.p75)) * 15;
  }
  if (batSpeed >= benchmark.p50) {
    return 50 + ((batSpeed - benchmark.p50) / (benchmark.p75 - benchmark.p50)) * 25;
  }
  if (batSpeed >= benchmark.p25) {
    return 25 + ((batSpeed - benchmark.p25) / (benchmark.p50 - benchmark.p25)) * 25;
  }
  if (batSpeed >= benchmark.p10) {
    return 10 + ((batSpeed - benchmark.p10) / (benchmark.p25 - benchmark.p10)) * 15;
  }
  
  return Math.max(1, (batSpeed / benchmark.p10) * 10);
}

// ============================================================================
// ATTACK ANGLE ANALYSIS
// ============================================================================

/**
 * Analyze attack angle and provide zone classification
 */
export function analyzeAttackAngle(attackAngle: number | null): {
  optimal: boolean;
  zone: 'flat' | 'optimal' | 'steep';
  feedback: string;
} {
  if (attackAngle === null) {
    return { optimal: false, zone: 'optimal', feedback: 'Attack angle data not available' };
  }

  if (attackAngle >= 8 && attackAngle <= 15) {
    return { 
      optimal: true, 
      zone: 'optimal',
      feedback: 'Optimal attack angle for line drives and backspin'
    };
  }
  
  if (attackAngle < 8) {
    return { 
      optimal: false, 
      zone: 'flat',
      feedback: 'Attack angle too flat - increase launch angle for better carry'
    };
  }
  
  return { 
    optimal: false, 
    zone: 'steep',
    feedback: 'Attack angle too steep - flatten swing path to reduce pop-ups'
  };
}

// ============================================================================
// INSIGHTS GENERATION
// ============================================================================

/**
 * Generate development insights based on swing analysis
 */
export function generateInsights(
  analysis: CBSwingAnalysis,
  ageGroup: AgeGroup = '12U'
): { strengths: string[]; improvements: string[]; drillRecommendations: string[] } {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const drillRecommendations: string[] = [];

  // Bat speed assessment
  if (analysis.batSpeedPercentile >= 90) {
    strengths.push('Elite bat speed for age group');
  } else if (analysis.batSpeedPercentile >= 75) {
    strengths.push('Above average bat speed');
  } else if (analysis.batSpeedPercentile < 40) {
    improvements.push('Focus on bat speed development');
    drillRecommendations.push('Overload/Underload Training');
  }

  // Attack angle assessment
  if (analysis.attackAngleOptimal) {
    strengths.push('Optimal attack angle for line drives');
  } else if (analysis.attackAngleZone === 'flat') {
    improvements.push('Increase attack angle - swing is too flat');
    drillRecommendations.push('High Tee Drill');
    drillRecommendations.push('Uphill Swing Drill');
  } else if (analysis.attackAngleZone === 'steep') {
    improvements.push('Decrease attack angle - swing is too steep');
    drillRecommendations.push('Low Tee Drill');
    drillRecommendations.push('Bat Path Drill');
  }

  // Efficiency assessment
  if (analysis.efficiencyRating > 85) {
    strengths.push('Excellent energy transfer');
  } else if (analysis.efficiencyRating < 60) {
    improvements.push('Work on hand-to-barrel energy transfer');
    drillRecommendations.push('Connection Drill');
    drillRecommendations.push('Wrist Snap Drill');
  }

  // Tempo assessment
  if (analysis.tempoScore > 80) {
    strengths.push('Consistent swing tempo');
  } else if (analysis.tempoScore < 50) {
    improvements.push('Develop more consistent timing');
    drillRecommendations.push('Rhythm Drill');
    drillRecommendations.push('Tempo Tee Work');
  }

  // Motor profile specific recommendations
  switch (analysis.motorProfile) {
    case 'SPINNER':
      if (analysis.batSpeed && analysis.batSpeed < AGE_BENCHMARKS[ageGroup].p50) {
        improvements.push('Leverage rotation for more power');
        drillRecommendations.push('Hip Lead Drill');
      }
      break;
    case 'WHIPPER':
      strengths.push('Quick hands and efficient transfer');
      break;
    case 'SLINGSHOTTER':
      if (analysis.tempoScore < 60) {
        improvements.push('Shorten load for better timing');
        drillRecommendations.push('Short Toss Timing');
      }
      break;
    case 'TITAN':
      strengths.push('Elite swing profile across all metrics');
      break;
  }

  return { strengths, improvements, drillRecommendations };
}

// ============================================================================
// MAIN PROCESSOR FUNCTION
// ============================================================================

/**
 * Process a single DK swing into Catching Barrels analysis
 */
export function processSwing(
  swing: DKSwing,
  ageGroup: AgeGroup = '12U'
): CBSwingAnalysis {
  // Calculate motor profile
  const { profile, confidence } = classifyMotorProfile({
    speedEfficiency: swing.speedEfficiency,
    handCastDistance: swing.handCastDistance,
    distanceInZone: swing.distanceInZone,
    maxBarrelSpeed: swing.maxBarrelSpeed,
    triggerToImpact: swing.triggerToImpact,
  });

  // Calculate tempo score
  const tempoScore = calculateTempoScore(swing.triggerToImpact, ageGroup);

  // Calculate efficiency rating
  const efficiencyRating = calculateEfficiencyRating({
    speedEfficiency: swing.speedEfficiency,
    approachAngle: swing.approachAngle,
    distanceInZone: swing.distanceInZone,
    handCastDistance: swing.handCastDistance,
  });

  // Calculate percentile
  const batSpeedPercentile = getBatSpeedPercentile(swing.maxBarrelSpeed, ageGroup);

  // Analyze attack angle
  const angleAnalysis = analyzeAttackAngle(swing.approachAngle);

  // Build analysis object
  const analysis: CBSwingAnalysis = {
    batSpeed: swing.maxBarrelSpeed,
    handSpeed: swing.maxHandSpeed,
    attackAngle: swing.approachAngle,
    timeToContact: swing.triggerToImpact ? swing.triggerToImpact / 1000 : null,
    
    speedEfficiency: swing.speedEfficiency,
    handCastDistance: swing.handCastDistance,
    distanceInZone: swing.distanceInZone,
    impactMomentum: swing.impactMomentum,
    appliedPower: swing.appliedPower,

    tempoScore,
    efficiencyRating,
    motorProfile: profile,
    motorProfileConfidence: confidence,

    batSpeedPercentile,
    attackAngleOptimal: angleAnalysis.optimal,
    attackAngleZone: angleAnalysis.zone,

    strengths: [],
    improvements: [],
    drillRecommendations: [],
  };

  // Generate insights
  const insights = generateInsights(analysis, ageGroup);
  analysis.strengths = insights.strengths;
  analysis.improvements = insights.improvements;
  analysis.drillRecommendations = insights.drillRecommendations;

  return analysis;
}

/**
 * Process a batch of swings and generate session summary
 */
export function processSession(
  swings: DKSwing[],
  ageGroup: AgeGroup = '12U'
): { analyses: CBSwingAnalysis[]; summary: SessionSummary } {
  // Filter valid swings
  const validSwings = swings.filter(s => 
    s.maxBarrelSpeed !== null && 
    s.maxBarrelSpeed >= 25 // Filter waggles
  );

  // Process each swing
  const analyses = validSwings.map(swing => processSwing(swing, ageGroup));

  // Calculate session aggregates
  const batSpeeds = analyses.map(a => a.batSpeed).filter((v): v is number => v !== null);
  const handSpeeds = analyses.map(a => a.handSpeed).filter((v): v is number => v !== null);
  const attackAngles = analyses.map(a => a.attackAngle).filter((v): v is number => v !== null);
  const tempoScores = analyses.map(a => a.tempoScore);
  const efficiencies = analyses.map(a => a.efficiencyRating);

  // Calculate motor profile breakdown
  const profileCounts: Record<MotorProfile, number> = {
    SPINNER: 0,
    WHIPPER: 0,
    SLINGSHOTTER: 0,
    TITAN: 0,
    UNKNOWN: 0,
  };
  analyses.forEach(a => profileCounts[a.motorProfile]++);

  // Find dominant profile
  let dominantProfile: MotorProfile = 'UNKNOWN';
  let maxCount = 0;
  for (const [profile, count] of Object.entries(profileCounts) as [MotorProfile, number][]) {
    if (count > maxCount) {
      maxCount = count;
      dominantProfile = profile;
    }
  }

  // Calculate consistency (CV of bat speed)
  const avgBatSpeed = average(batSpeeds);
  const batSpeedStdDev = stdDev(batSpeeds);
  const consistencyCV = avgBatSpeed > 0 ? batSpeedStdDev / avgBatSpeed : 0;
  const consistencyScore = Math.round(Math.max(0, 100 - consistencyCV * 200));

  // Aggregate insights
  const allStrengths = new Set<string>();
  const allImprovements = new Set<string>();
  analyses.forEach(a => {
    a.strengths.forEach(s => allStrengths.add(s));
    a.improvements.forEach(i => allImprovements.add(i));
  });

  const summary: SessionSummary = {
    totalSwings: swings.length,
    validSwings: validSwings.length,
    avgBatSpeed: round(avgBatSpeed, 1),
    maxBatSpeed: batSpeeds.length > 0 ? Math.max(...batSpeeds) : 0,
    avgHandSpeed: round(average(handSpeeds), 1),
    avgAttackAngle: round(average(attackAngles), 1),
    avgTempoScore: round(average(tempoScores), 0),
    avgEfficiency: round(average(efficiencies), 0),
    dominantMotorProfile: dominantProfile,
    motorProfileBreakdown: profileCounts,
    batSpeedPercentile: getBatSpeedPercentile(avgBatSpeed, ageGroup),
    consistencyScore,
    strengths: Array.from(allStrengths),
    improvements: Array.from(allImprovements),
  };

  return { analyses, summary };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = average(values);
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(average(squaredDiffs));
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
