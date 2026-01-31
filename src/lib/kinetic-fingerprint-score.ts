// ============================================================================
// KINETIC FINGERPRINT SCORE — Calculator
// Weighted Scoring from Reboot Motion v1 Data
// Version: 1.0 | Date: January 30, 2026
// Philosophy: "The sequence IS the ground force story."
// ============================================================================

export interface KineticFingerprintResult {
  total: number;
  components: {
    transfer_ratio: ComponentScore;
    timing_gap: ComponentScore;
    deceleration: ComponentScore;
    sequence_order: ComponentScore;
    energy_delivery: ComponentScore;
    x_factor: ComponentScore;
  };
  rating: 'Elite' | 'Good' | 'Working' | 'Priority';
  color: string;
  flags: string[];
}

export interface ComponentScore {
  score: number;
  weight: number;
  value: string;
  rating: string;
}

interface PeakResult {
  value: number;
  frame: number;
}

interface SwingDataRow {
  lowertorso_angular_momentum_z?: number | string;
  torso_angular_momentum_z?: number | string;
  arms_angular_momentum_z?: number | string;
  bat_angular_momentum_z?: number | string;
  bat_kinetic_energy?: number | string;
  total_kinetic_energy?: number | string;
  time?: number | string;
  time_from_max_hand?: number | string;
  pelvis_rot?: number | string;
  torso_rot?: number | string;
  [key: string]: unknown;
}

// ============================================================================
// COMPONENT SCORING FUNCTIONS
// ============================================================================

/**
 * Transfer Ratio Score (25% weight)
 * Measures: Did the whip amplify? Elite: 1.5–1.8
 */
export function scoreTransferRatio(pelvisPeak: number, torsoPeak: number): { score: number; value: number; rating: string } {
  if (pelvisPeak === 0) {
    return { score: 40, value: 0, rating: 'No data' };
  }
  
  const ratio = Math.abs(torsoPeak) / Math.abs(pelvisPeak);
  
  let score: number;
  let rating: string;
  
  if (ratio >= 1.50 && ratio <= 1.80) {
    score = 100;
    rating = 'Elite';
  } else if (ratio >= 1.30 && ratio < 1.50) {
    score = 85;
    rating = 'Good';
  } else if (ratio > 1.80 && ratio <= 2.00) {
    score = 80;
    rating = 'Slightly over-whipped';
  } else if (ratio >= 1.10 && ratio < 1.30) {
    score = 65;
    rating = 'Developing';
  } else if (ratio > 2.00) {
    score = 50;
    rating = 'Disconnected';
  } else {
    score = 40;
    rating = 'Poor transfer';
  }
  
  return { score, value: ratio, rating };
}

/**
 * Timing Gap Score (20% weight)
 * Measures: Did segments separate properly? Elite: 14–18%
 */
export function scoreTimingGap(pelvisPeakFrame: number, torsoPeakFrame: number, contactFrame: number): { score: number; value: number; rating: string } {
  if (contactFrame === 0) {
    return { score: 40, value: 0, rating: 'No data' };
  }
  
  const gap = ((torsoPeakFrame - pelvisPeakFrame) / contactFrame) * 100;
  
  let score: number;
  let rating: string;
  
  if (gap >= 14 && gap <= 18) {
    score = 100;
    rating = 'Elite';
  } else if (gap >= 10 && gap < 14) {
    score = 85;
    rating = 'Good';
  } else if (gap > 18 && gap <= 22) {
    score = 80;
    rating = 'Slightly late';
  } else if (gap >= 5 && gap < 10) {
    score = 65;
    rating = 'Too simultaneous';
  } else if (gap > 22) {
    score = 50;
    rating = 'Over-separated';
  } else {
    score = 40;
    rating = 'Simultaneous firing';
  }
  
  return { score, value: gap, rating };
}

/**
 * Deceleration Score (20% weight)
 * Measures: Did the body BRAKE so bat could go? Elite: 3/3 TRUE
 */
export function scoreDeceleration(
  pelvisPeakFrame: number,
  torsoPeakFrame: number,
  armsPeakFrame: number,
  contactFrame: number
): { score: number; value: string; count: number; rating: string } {
  let count = 0;
  
  if (pelvisPeakFrame < contactFrame) count++;
  if (torsoPeakFrame < contactFrame) count++;
  if (armsPeakFrame < contactFrame) count++;
  
  let score: number;
  let rating: string;
  
  switch (count) {
    case 3:
      score = 100;
      rating = 'Elite';
      break;
    case 2:
      score = 70;
      rating = 'Working';
      break;
    case 1:
      score = 40;
      rating = 'Priority';
      break;
    default:
      score = 20;
      rating = 'Critical';
  }
  
  return { score, value: `${count}/3`, count, rating };
}

/**
 * Sequence Order Score (15% weight)
 * Measures: Did it fire ground-up? Elite: P→T→A→B
 */
export function scoreSequenceOrder(
  pelvisFrame: number,
  torsoFrame: number,
  armsFrame: number,
  batFrame: number
): { score: number; value: string; outOfOrder: number; rating: string } {
  const correct = [pelvisFrame, torsoFrame, armsFrame, batFrame];
  const sorted = [...correct].sort((a, b) => a - b);
  
  let outOfOrder = 0;
  for (let i = 0; i < 4; i++) {
    if (correct[i] !== sorted[i]) outOfOrder++;
  }
  
  // Build sequence string
  const order = [
    { name: 'P', frame: pelvisFrame },
    { name: 'T', frame: torsoFrame },
    { name: 'A', frame: armsFrame },
    { name: 'B', frame: batFrame }
  ].sort((a, b) => a.frame - b.frame);
  
  const sequenceString = order.map(o => o.name).join('→');
  
  let score: number;
  let rating: string;
  
  switch (outOfOrder) {
    case 0:
      score = 100;
      rating = 'Elite';
      break;
    case 1:
      score = 70;
      rating = 'Working';
      break;
    case 2:
      score = 40;
      rating = 'Priority';
      break;
    default:
      score = 20;
      rating = 'Critical';
  }
  
  return { score, value: sequenceString, outOfOrder, rating };
}

/**
 * Energy Delivery Score (10% weight)
 * Measures: Did the bat get the energy? Elite: >45%
 */
export function scoreEnergyDelivery(batKE: number, totalKE: number): { score: number; value: number; rating: string } {
  if (totalKE === 0) {
    return { score: 40, value: 0, rating: 'No data' };
  }
  
  const delivery = (batKE / totalKE) * 100;
  
  let score: number;
  let rating: string;
  
  if (delivery > 45) {
    score = 100;
    rating = 'Elite';
  } else if (delivery >= 40) {
    score = 85;
    rating = 'Good';
  } else if (delivery >= 35) {
    score = 70;
    rating = 'Working';
  } else if (delivery >= 30) {
    score = 55;
    rating = 'Developing';
  } else {
    score = 40;
    rating = 'Body keeping energy';
  }
  
  return { score, value: delivery, rating };
}

/**
 * X-Factor Score (10% weight)
 * Measures: Did they create separation? Elite: 50–60°
 */
export function scoreXFactor(pelvisRotSeries: number[], torsoRotSeries: number[]): { score: number; value: number; rating: string } {
  if (pelvisRotSeries.length === 0 || torsoRotSeries.length === 0) {
    return { score: 50, value: 0, rating: 'No data' };
  }
  
  const minLength = Math.min(pelvisRotSeries.length, torsoRotSeries.length);
  let maxXFactor = 0;
  
  for (let i = 0; i < minLength; i++) {
    const xFactor = Math.abs(torsoRotSeries[i] - pelvisRotSeries[i]) * (180 / Math.PI);
    if (xFactor > maxXFactor) {
      maxXFactor = xFactor;
    }
  }
  
  let score: number;
  let rating: string;
  
  if (maxXFactor >= 50 && maxXFactor <= 60) {
    score = 100;
    rating = 'Elite';
  } else if (maxXFactor >= 45 && maxXFactor < 50) {
    score = 90;
    rating = 'Good';
  } else if (maxXFactor >= 40 && maxXFactor < 45) {
    score = 80;
    rating = 'Working';
  } else if (maxXFactor >= 35 && maxXFactor < 40) {
    score = 65;
    rating = 'Developing';
  } else if (maxXFactor > 65) {
    score = 60;
    rating = 'Over-rotation risk';
  } else {
    score = 50;
    rating = 'Limited separation';
  }
  
  return { score, value: maxXFactor, rating };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find peak value and frame for a given field in swing data
 */
export function findPeak(data: SwingDataRow[], field: string): PeakResult {
  let maxVal = -Infinity;
  let maxFrame = 0;
  
  data.forEach((row, i) => {
    const rawVal = row[field];
    const val = Math.abs(parseFloat(String(rawVal)) || 0);
    if (val > maxVal) {
      maxVal = val;
      maxFrame = i;
    }
  });
  
  return { value: maxVal === -Infinity ? 0 : maxVal, frame: maxFrame };
}

/**
 * Find contact frame (where time_from_max_hand ≈ 0)
 */
export function findContactFrame(data: SwingDataRow[]): number {
  for (let i = 0; i < data.length; i++) {
    const timeFromMaxHand = parseFloat(String(data[i].time_from_max_hand)) || 0;
    if (timeFromMaxHand >= 0) return i;
  }
  return data.length - 1; // fallback
}

/**
 * Get rating label from score
 */
export function getRating(score: number): 'Elite' | 'Good' | 'Working' | 'Priority' {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Working';
  return 'Priority';
}

/**
 * Get color from score (using design system colors)
 */
export function getColor(score: number): string {
  if (score >= 80) return '#4ecdc4'; // teal - Elite/Good
  if (score >= 60) return '#ffa500'; // orange - Working
  return '#ff6b6b'; // coral red - Priority
}

/**
 * Generate flags for drill prescription based on component scores
 */
export function generateFlags(components: KineticFingerprintResult['components']): string[] {
  const flags: string[] = [];
  
  if (components.transfer_ratio.score < 70) flags.push('flag_weak_transfer');
  
  if (components.timing_gap.score < 70) {
    const gapValue = parseFloat(components.timing_gap.value);
    if (gapValue < 10) {
      flags.push('flag_simultaneous');
    }
  }
  
  const gapValue = parseFloat(components.timing_gap.value);
  if (gapValue > 20) flags.push('flag_over_separated');
  
  if (components.deceleration.score < 70) flags.push('flag_no_decel');
  if (components.sequence_order.score < 70) flags.push('flag_no_sequence');
  if (components.energy_delivery.score < 70) flags.push('flag_energy_leak');
  
  const xFactorValue = parseFloat(components.x_factor.value);
  if (components.x_factor.score < 70) flags.push('flag_shallow_xfactor');
  if (xFactorValue > 60) flags.push('flag_over_rotation');
  
  return flags;
}

// ============================================================================
// MASTER CALCULATION
// ============================================================================

/**
 * Calculate the complete Kinetic Fingerprint Score from Reboot Motion data
 * 
 * @param momentumData - Array of rows from MOMENTUM-ENERGY CSV
 * @param kinematicsData - Array of rows from INVERSE-KINEMATICS CSV (optional, for X-Factor)
 * @returns Complete Kinetic Fingerprint result with all components
 */
export function calculateKineticFingerprint(
  momentumData: SwingDataRow[],
  kinematicsData?: SwingDataRow[]
): KineticFingerprintResult {
  // 1. Find peaks for each segment
  const pelvisPeak = findPeak(momentumData, 'lowertorso_angular_momentum_z');
  const torsoPeak = findPeak(momentumData, 'torso_angular_momentum_z');
  const armsPeak = findPeak(momentumData, 'arms_angular_momentum_z');
  const batPeak = findPeak(momentumData, 'bat_angular_momentum_z');
  
  // 2. Find contact frame
  const contactFrame = findContactFrame(momentumData);
  
  // 3. Get energy values at contact
  const contactRow = momentumData[contactFrame] || {};
  const batKE = parseFloat(String(contactRow.bat_kinetic_energy)) || 0;
  const totalKE = parseFloat(String(contactRow.total_kinetic_energy)) || 0;
  
  // 4. Get rotation series for X-Factor (from kinematics data if available)
  const rotationSource = kinematicsData || momentumData;
  const pelvisRot = rotationSource.map(r => parseFloat(String(r.pelvis_rot)) || 0);
  const torsoRot = rotationSource.map(r => parseFloat(String(r.torso_rot)) || 0);
  
  // 5. Calculate each component score
  const transferResult = scoreTransferRatio(pelvisPeak.value, torsoPeak.value);
  const timingResult = scoreTimingGap(pelvisPeak.frame, torsoPeak.frame, contactFrame);
  const decelResult = scoreDeceleration(pelvisPeak.frame, torsoPeak.frame, armsPeak.frame, contactFrame);
  const sequenceResult = scoreSequenceOrder(pelvisPeak.frame, torsoPeak.frame, armsPeak.frame, batPeak.frame);
  const energyResult = scoreEnergyDelivery(batKE, totalKE);
  const xFactorResult = scoreXFactor(pelvisRot, torsoRot);
  
  // 6. Build components object
  const components: KineticFingerprintResult['components'] = {
    transfer_ratio: {
      score: transferResult.score,
      weight: 0.25,
      value: transferResult.value.toFixed(2),
      rating: transferResult.rating
    },
    timing_gap: {
      score: timingResult.score,
      weight: 0.20,
      value: `${timingResult.value.toFixed(1)}%`,
      rating: timingResult.rating
    },
    deceleration: {
      score: decelResult.score,
      weight: 0.20,
      value: decelResult.value,
      rating: decelResult.rating
    },
    sequence_order: {
      score: sequenceResult.score,
      weight: 0.15,
      value: sequenceResult.value,
      rating: sequenceResult.rating
    },
    energy_delivery: {
      score: energyResult.score,
      weight: 0.10,
      value: `${energyResult.value.toFixed(1)}%`,
      rating: energyResult.rating
    },
    x_factor: {
      score: xFactorResult.score,
      weight: 0.10,
      value: `${xFactorResult.value.toFixed(1)}°`,
      rating: xFactorResult.rating
    }
  };
  
  // 7. Calculate weighted total
  const kfScore = 
    (transferResult.score * 0.25) +
    (timingResult.score * 0.20) +
    (decelResult.score * 0.20) +
    (sequenceResult.score * 0.15) +
    (energyResult.score * 0.10) +
    (xFactorResult.score * 0.10);
  
  // 8. Generate flags for drill prescription
  const flags = generateFlags(components);
  
  return {
    total: Math.round(kfScore),
    components,
    rating: getRating(kfScore),
    color: getColor(kfScore),
    flags
  };
}

// ============================================================================
// COMPONENT WEIGHT CONSTANTS (for reference/UI display)
// ============================================================================

export const COMPONENT_WEIGHTS = {
  transfer_ratio: { weight: 0.25, label: 'Transfer Ratio', elite: '1.5–1.8' },
  timing_gap: { weight: 0.20, label: 'Timing Gap', elite: '14–18%' },
  deceleration: { weight: 0.20, label: 'Deceleration', elite: '3/3 TRUE' },
  sequence_order: { weight: 0.15, label: 'Sequence Order', elite: 'P→T→A→B' },
  energy_delivery: { weight: 0.10, label: 'Energy Delivery', elite: '>45%' },
  x_factor: { weight: 0.10, label: 'X-Factor', elite: '50–60°' }
} as const;

export const RATING_THRESHOLDS = {
  elite: { min: 90, color: '#4ecdc4', label: 'Elite', meaning: 'MLB-caliber timing' },
  good: { min: 80, color: '#4ecdc4', label: 'Good', meaning: 'College/MiLB level' },
  working: { min: 60, color: '#ffa500', label: 'Working', meaning: 'Clear development path' },
  priority: { min: 0, color: '#ff6b6b', label: 'Priority', meaning: 'Fundamental timing issues' }
} as const;
