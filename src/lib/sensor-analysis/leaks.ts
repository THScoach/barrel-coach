// ============================================================================
// LEAK DETECTION MODULE
// Re-exports from kwon-engine for modular architecture
// ============================================================================

import type { SensorFacts, PossibleLeak, ReleasePrediction, TimingPrediction, UpstreamPrediction } from './types';

/**
 * Leak catalog with detection rules and recommendations
 */
export const LEAK_CATALOG = {
  early_release: {
    name: 'Early Release',
    category: 'bat' as const,
    description: 'Barrel releases before optimal whip point, losing energy transfer',
    howToConfirm: 'Side view video at contact - check hand deceleration timing',
    drills: ['connection-bat-path', 'bat-whip-feel', 'heavy-bat-holds'],
  },
  late_release: {
    name: 'Late Release',
    category: 'bat' as const,
    description: 'Hands continue accelerating past optimal release point',
    howToConfirm: 'Video analysis of barrel path through zone',
    drills: ['early-extension', 'let-it-go-drill'],
  },
  timing_variance: {
    name: 'Timing Variance',
    category: 'brain' as const,
    description: 'Inconsistent swing timing across swings',
    howToConfirm: 'Track timing consistency across multiple sessions',
    drills: ['tempo-rhythm', 'counting-drill', 'metronome-swings'],
  },
  posture_inconsistency: {
    name: 'Posture Inconsistency',
    category: 'body' as const,
    description: 'Attack angle variance suggests posture changes during swing',
    howToConfirm: 'Video analysis of spine angle at contact',
    drills: ['posture-holds', 'mirror-work', 'balance-beam-swings'],
  },
  early_torso_rotation: {
    name: 'Early Torso Rotation',
    category: 'body' as const,
    description: 'Torso opens before hips complete rotation',
    howToConfirm: 'Video analysis of hip-shoulder separation',
    drills: ['separation-sequence', 'x-factor-holds', 'hip-lead-drill'],
  },
  variable_hip_direction: {
    name: 'Variable Hip Direction',
    category: 'body' as const,
    description: 'Inconsistent hip rotation direction across swings',
    howToConfirm: 'Video analysis of hip rotation direction',
    drills: ['hip-turn-drill', 'alignment-sticks', 'mirror-work'],
  },
  inconsistent_load: {
    name: 'Inconsistent Load',
    category: 'brain' as const,
    description: 'Load timing varies significantly between swings',
    howToConfirm: 'Side view video showing load timing patterns',
    drills: ['load-rhythm', 'breath-sync', 'trigger-drill'],
  },
  casting: {
    name: 'Casting',
    category: 'bat' as const,
    description: 'Hands move away from body during swing path',
    howToConfirm: 'Overhead or front view video of hand path',
    drills: ['inside-the-ball', 'elbow-slot', 'wall-drill'],
  },
} as const;

export type LeakType = keyof typeof LEAK_CATALOG;

/**
 * Identify possible leaks with probability levels
 */
export function identifyPossibleLeaks(
  facts: SensorFacts,
  release: ReleasePrediction,
  timing: TimingPrediction,
  upstream: UpstreamPrediction
): PossibleLeak[] {
  const leaks: PossibleLeak[] = [];

  // BAT leaks (from sensor data)
  if (release.quality === 'poor' || release.quality === 'developing') {
    leaks.push({
      leakType: 'early_release',
      category: 'bat',
      description: LEAK_CATALOG.early_release.description,
      probability: release.quality === 'poor' ? 'likely' : 'possible',
      evidence: `Hand-to-bat ratio: ${facts.handToBatRatio}`,
      potentialGain: release.potentialUnlock,
      howToConfirm: LEAK_CATALOG.early_release.howToConfirm,
    });
  }

  // BRAIN leaks (timing patterns)
  if (timing.consistencyScore < 70) {
    leaks.push({
      leakType: 'timing_variance',
      category: 'brain',
      description: LEAK_CATALOG.timing_variance.description,
      probability: timing.consistencyScore < 50 ? 'likely' : 'possible',
      evidence: `Timing CV: ${(facts.timingCV * 100).toFixed(1)}%`,
      potentialGain: timing.potentialUnlock,
      howToConfirm: LEAK_CATALOG.timing_variance.howToConfirm,
    });
  }

  // BODY leaks (inferred from patterns)
  if (facts.attackAngleStdDev > 8) {
    leaks.push({
      leakType: 'posture_inconsistency',
      category: 'body',
      description: LEAK_CATALOG.posture_inconsistency.description,
      probability: 'possible',
      evidence: `Attack angle std dev: ${facts.attackAngleStdDev}°`,
      potentialGain: Math.round(facts.attackAngleStdDev * 0.2 * 10) / 10,
      howToConfirm: LEAK_CATALOG.posture_inconsistency.howToConfirm,
    });
  }

  // Add upstream-identified leaks
  upstream.likelyKineticChainBreaks.forEach((breakType) => {
    const leakKey = breakType.replace(/\s+/g, '_').toLowerCase() as LeakType;
    const catalogEntry = LEAK_CATALOG[leakKey];
    
    leaks.push({
      leakType: leakKey,
      category: 'body',
      description: catalogEntry?.description || breakType,
      probability: 'speculative',
      evidence: 'Inferred from sensor patterns',
      potentialGain: Math.round((upstream.potentialUnlock / upstream.likelyKineticChainBreaks.length) * 10) / 10,
      howToConfirm: catalogEntry?.howToConfirm || upstream.needsVideoFor.join(', '),
    });
  });

  return leaks;
}

/**
 * Get primary leak (highest priority)
 */
export function getPrimaryLeak(leaks: PossibleLeak[]): PossibleLeak | null {
  // Priority: likely > possible > speculative, then by potential gain
  const likelyLeaks = leaks.filter(l => l.probability === 'likely');
  if (likelyLeaks.length > 0) {
    return likelyLeaks.reduce((a, b) => a.potentialGain > b.potentialGain ? a : b);
  }

  const possibleLeaks = leaks.filter(l => l.probability === 'possible');
  if (possibleLeaks.length > 0) {
    return possibleLeaks.reduce((a, b) => a.potentialGain > b.potentialGain ? a : b);
  }

  const speculativeLeaks = leaks.filter(l => l.probability === 'speculative');
  if (speculativeLeaks.length > 0) {
    return speculativeLeaks.reduce((a, b) => a.potentialGain > b.potentialGain ? a : b);
  }

  return null;
}

/**
 * Get total potential gain from all leaks (with diminishing returns)
 */
export function getTotalPotentialGain(leaks: PossibleLeak[]): number {
  if (leaks.length === 0) return 0;

  const sortedGains = leaks.map(l => l.potentialGain).sort((a, b) => b - a);

  let total = 0;
  sortedGains.forEach((gain, index) => {
    if (index === 0) total += gain;
    else if (index === 1) total += gain * 0.5;
    else total += gain * 0.25;
  });

  return Math.round(total * 10) / 10;
}

/**
 * Get leak details from catalog
 */
export function getLeakDetails(leakType: string) {
  return LEAK_CATALOG[leakType as LeakType] || null;
}

/**
 * Calculate total potential gain from all leaks
 */
export function calculateTotalPotentialGain(leaks: PossibleLeak[]): number {
  return leaks.reduce((sum, leak) => sum + leak.potentialGain, 0);
}

/**
 * Filter leaks by probability level
 */
export function filterLeaksByProbability(
  leaks: PossibleLeak[],
  minProbability: 'likely' | 'possible' | 'speculative'
): PossibleLeak[] {
  const probabilityOrder = { likely: 0, possible: 1, speculative: 2 };
  const minOrder = probabilityOrder[minProbability];
  
  return leaks.filter(leak => probabilityOrder[leak.probability] <= minOrder);
}

/**
 * Group leaks by category
 */
export function groupLeaksByCategory(leaks: PossibleLeak[]): Record<'bat' | 'body' | 'brain', PossibleLeak[]> {
  return {
    bat: leaks.filter(l => l.category === 'bat'),
    body: leaks.filter(l => l.category === 'body'),
    brain: leaks.filter(l => l.category === 'brain'),
  };
}
