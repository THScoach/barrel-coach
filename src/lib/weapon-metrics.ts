/**
 * Weapon Metrics - Advanced Diamond Kinetics derived metrics
 * These are calculated from raw sensor data to provide deeper swing analysis
 */

export interface WeaponMetrics {
  wipIndex: number | null;          // Wrist-to-Impact Power (whip efficiency)
  planeIntegrity: number | null;    // How well bat stays on swing plane
  squareUpConsistency: number | null; // Contact point repeatability
  impactMomentum: number | null;    // Power delivered at contact
}

export interface WeaponMetricDisplay {
  name: string;
  shortName: string;
  value: number | null;
  description: string;
  interpretation: string;
  isGood: boolean;
}

/**
 * Calculate WIP (Wrist-to-Impact Power) Index
 * Measures how efficiently energy transfers from hands to barrel
 * Higher ratio = better "whip" action
 */
export function calculateWIPIndex(
  batSpeed: number | null,
  handSpeed: number | null
): number | null {
  if (batSpeed === null || handSpeed === null || handSpeed === 0) return null;
  
  const ratio = batSpeed / handSpeed;
  // Ideal ratio is 2.0-2.5 (bat moves 2-2.5x faster than hands)
  // Convert to 20-80 scale: 1.5 ratio = 30, 2.0 = 50, 2.5 = 70, 3.0 = 80
  const score = 20 + (ratio - 1.0) * 40;
  return Math.max(20, Math.min(80, Math.round(score)));
}

/**
 * Calculate Plane Integrity
 * Measures how consistently the bat stays on the swing plane
 * Based on attack angle and swing plane tilt variance
 */
export function calculatePlaneIntegrity(
  attackAngleStdDev: number | null,
  swingPlaneTiltStdDev: number | null
): number | null {
  if (attackAngleStdDev === null && swingPlaneTiltStdDev === null) return null;
  
  const aaStd = attackAngleStdDev ?? 5;
  const ptStd = swingPlaneTiltStdDev ?? 3;
  
  // Lower variance = higher integrity
  // 0 std = 80, 3 std = 65, 5 std = 55, 8+ std = 35
  const combinedVariance = (aaStd * 0.6) + (ptStd * 0.4);
  const score = 80 - (combinedVariance * 5);
  return Math.max(20, Math.min(80, Math.round(score)));
}

/**
 * Calculate Square-Up Consistency
 * Measures how repeatably the hitter contacts the ball at the same spot
 * Based on impact location variance
 */
export function calculateSquareUpConsistency(
  impactLocationXStdDev: number | null,
  impactLocationYStdDev: number | null
): number | null {
  if (impactLocationXStdDev === null && impactLocationYStdDev === null) return null;
  
  const xStd = impactLocationXStdDev ?? 0.1;
  const yStd = impactLocationYStdDev ?? 0.1;
  
  // Combine X and Y variance (lower = better)
  // 0.0 combined = 80, 0.1 = 65, 0.2 = 50, 0.3+ = 35
  const combinedVariance = Math.sqrt(xStd * xStd + yStd * yStd);
  const score = 80 - (combinedVariance * 200);
  return Math.max(20, Math.min(80, Math.round(score)));
}

/**
 * Calculate Impact Momentum
 * Measures the power delivered at the moment of contact
 * Combines bat speed with transfer efficiency
 */
export function calculateImpactMomentum(
  batSpeed: number | null,
  handToBatRatio: number | null,
  appliedPower: number | null
): number | null {
  if (batSpeed === null) return null;
  
  // Base score from bat speed (60-90 mph maps to 30-70 range)
  let baseScore = 20 + ((batSpeed - 40) / 50) * 50;
  
  // Bonus for good transfer ratio (2.0+ is good)
  if (handToBatRatio !== null && handToBatRatio >= 2.0) {
    baseScore += (handToBatRatio - 2.0) * 5;
  }
  
  // Factor in applied power if available
  if (appliedPower !== null) {
    // Typical range: 500-2000
    const powerBonus = (appliedPower - 500) / 300;
    baseScore += Math.min(10, powerBonus);
  }
  
  return Math.max(20, Math.min(80, Math.round(baseScore)));
}

/**
 * Calculate all weapon metrics from sensor swing data
 */
export function calculateWeaponMetrics(swings: {
  bat_speed_mph: number | null;
  hand_speed_mph: number | null;
  attack_angle_deg: number | null;
  swing_plane_tilt_deg: number | null;
  impact_location_x: number | null;
  impact_location_y: number | null;
  applied_power: number | null;
  hand_to_bat_ratio: number | null;
}[]): WeaponMetrics {
  if (swings.length === 0) {
    return {
      wipIndex: null,
      planeIntegrity: null,
      squareUpConsistency: null,
      impactMomentum: null,
    };
  }
  
  // Calculate means and standard deviations
  const validBatSpeeds = swings.map(s => s.bat_speed_mph).filter(v => v !== null) as number[];
  const validHandSpeeds = swings.map(s => s.hand_speed_mph).filter(v => v !== null) as number[];
  const validAttackAngles = swings.map(s => s.attack_angle_deg).filter(v => v !== null) as number[];
  const validPlaneTilts = swings.map(s => s.swing_plane_tilt_deg).filter(v => v !== null) as number[];
  const validImpactX = swings.map(s => s.impact_location_x).filter(v => v !== null) as number[];
  const validImpactY = swings.map(s => s.impact_location_y).filter(v => v !== null) as number[];
  const validPower = swings.map(s => s.applied_power).filter(v => v !== null) as number[];
  const validRatios = swings.map(s => s.hand_to_bat_ratio).filter(v => v !== null) as number[];
  
  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const stdDev = (arr: number[]) => {
    if (arr.length < 2) return null;
    const m = mean(arr)!;
    return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length);
  };
  
  const avgBatSpeed = mean(validBatSpeeds);
  const avgHandSpeed = mean(validHandSpeeds);
  const avgRatio = mean(validRatios);
  const avgPower = mean(validPower);
  
  return {
    wipIndex: calculateWIPIndex(avgBatSpeed, avgHandSpeed),
    planeIntegrity: calculatePlaneIntegrity(stdDev(validAttackAngles), stdDev(validPlaneTilts)),
    squareUpConsistency: calculateSquareUpConsistency(stdDev(validImpactX), stdDev(validImpactY)),
    impactMomentum: calculateImpactMomentum(avgBatSpeed, avgRatio, avgPower),
  };
}

/**
 * Get display-ready weapon metrics with interpretations
 */
export function getWeaponMetricDisplays(metrics: WeaponMetrics): WeaponMetricDisplay[] {
  const getInterpretation = (value: number | null): { text: string; isGood: boolean } => {
    if (value === null) return { text: 'No data', isGood: false };
    if (value >= 65) return { text: 'Plus', isGood: true };
    if (value >= 55) return { text: 'Above Avg', isGood: true };
    if (value >= 50) return { text: 'Average', isGood: false };
    if (value >= 45) return { text: 'Below Avg', isGood: false };
    return { text: 'Needs Work', isGood: false };
  };
  
  return [
    {
      name: 'WIP Index',
      shortName: 'WIP',
      value: metrics.wipIndex,
      description: 'Wrist-to-Impact Power — measures bat whip efficiency',
      interpretation: getInterpretation(metrics.wipIndex).text,
      isGood: getInterpretation(metrics.wipIndex).isGood,
    },
    {
      name: 'Plane Integrity',
      shortName: 'Plane',
      value: metrics.planeIntegrity,
      description: 'How consistently the bat stays on the swing plane',
      interpretation: getInterpretation(metrics.planeIntegrity).text,
      isGood: getInterpretation(metrics.planeIntegrity).isGood,
    },
    {
      name: 'Square-Up',
      shortName: 'SQ-Up',
      value: metrics.squareUpConsistency,
      description: 'Contact point repeatability on the barrel',
      interpretation: getInterpretation(metrics.squareUpConsistency).text,
      isGood: getInterpretation(metrics.squareUpConsistency).isGood,
    },
    {
      name: 'Impact Momentum',
      shortName: 'Impact',
      value: metrics.impactMomentum,
      description: 'Power delivered at the moment of contact',
      interpretation: getInterpretation(metrics.impactMomentum).text,
      isGood: getInterpretation(metrics.impactMomentum).isGood,
    },
  ];
}

/**
 * Get grade label for 20-80 scale
 */
export function getWeaponGrade(score: number): string {
  if (score >= 70) return 'Plus-Plus';
  if (score >= 65) return 'Plus';
  if (score >= 60) return 'Above Avg';
  if (score >= 55) return 'Avg+';
  if (score >= 50) return 'Average';
  if (score >= 45) return 'Below Avg';
  if (score >= 40) return 'Fringe';
  return 'Well Below';
}
