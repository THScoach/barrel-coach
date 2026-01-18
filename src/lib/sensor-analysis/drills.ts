// ============================================================================
// DRILL RECOMMENDATIONS MODULE
// Maps leaks to corrective drills
// ============================================================================

import type { PossibleLeak, DrillRecommendation } from './types';
import { LEAK_CATALOG } from './leaks';

/**
 * Comprehensive drill library
 */
export const DRILL_LIBRARY: Record<string, Omit<DrillRecommendation, 'targetLeak' | 'priority'>> = {
  // BAT drills
  'connection-bat-path': {
    drillId: 'connection-bat-path',
    name: 'Connection Bat Path',
    category: 'bat',
    description: 'Focus on maintaining connection through the zone with controlled swing path',
  },
  'bat-whip-feel': {
    drillId: 'bat-whip-feel',
    name: 'Bat Whip Feel',
    category: 'bat',
    description: 'Develop barrel whip sensation through deliberate hand deceleration',
  },
  'heavy-bat-holds': {
    drillId: 'heavy-bat-holds',
    name: 'Heavy Bat Holds',
    category: 'bat',
    description: 'Build strength and feel for barrel control with weighted bat isometrics',
  },
  'early-extension': {
    drillId: 'early-extension',
    name: 'Early Extension',
    category: 'bat',
    description: 'Train hands to release the barrel earlier in the swing path',
  },
  'let-it-go-drill': {
    drillId: 'let-it-go-drill',
    name: 'Let It Go Drill',
    category: 'bat',
    description: 'Practice releasing tension in hands to allow natural barrel whip',
  },
  'inside-the-ball': {
    drillId: 'inside-the-ball',
    name: 'Inside the Ball',
    category: 'bat',
    description: 'Keep hands inside the ball path to prevent casting',
  },
  'elbow-slot': {
    drillId: 'elbow-slot',
    name: 'Elbow Slot',
    category: 'bat',
    description: 'Train proper back elbow position through the swing',
  },
  'wall-drill': {
    drillId: 'wall-drill',
    name: 'Wall Drill',
    category: 'bat',
    description: 'Swing with wall behind to prevent hand path from extending out',
  },
  
  // BRAIN drills
  'tempo-rhythm': {
    drillId: 'tempo-rhythm',
    name: 'Tempo & Rhythm',
    category: 'brain',
    description: 'Develop consistent load-to-launch timing through rhythmic practice',
  },
  'counting-drill': {
    drillId: 'counting-drill',
    name: 'Counting Drill',
    category: 'brain',
    description: 'Count out loud during swing phases to build timing awareness',
  },
  'metronome-swings': {
    drillId: 'metronome-swings',
    name: 'Metronome Swings',
    category: 'brain',
    description: 'Sync swing phases to metronome beats for consistent tempo',
  },
  'load-rhythm': {
    drillId: 'load-rhythm',
    name: 'Load Rhythm',
    category: 'brain',
    description: 'Practice consistent load timing with pitcher simulation',
  },
  'breath-sync': {
    drillId: 'breath-sync',
    name: 'Breath Sync',
    category: 'brain',
    description: 'Coordinate breathing with swing phases for relaxation and timing',
  },
  'trigger-drill': {
    drillId: 'trigger-drill',
    name: 'Trigger Drill',
    category: 'brain',
    description: 'Practice consistent swing trigger timing off various cues',
  },
  
  // BODY drills
  'posture-holds': {
    drillId: 'posture-holds',
    name: 'Posture Holds',
    category: 'body',
    description: 'Build awareness of spine angle through contact with held positions',
  },
  'mirror-work': {
    drillId: 'mirror-work',
    name: 'Mirror Work',
    category: 'body',
    description: 'Visual feedback for body positions throughout the swing',
  },
  'balance-beam-swings': {
    drillId: 'balance-beam-swings',
    name: 'Balance Beam Swings',
    category: 'body',
    description: 'Swing on narrow base to develop balance and body control',
  },
  'separation-sequence': {
    drillId: 'separation-sequence',
    name: 'Separation Sequence',
    category: 'body',
    description: 'Train hip-to-shoulder separation timing with pause drills',
  },
  'x-factor-holds': {
    drillId: 'x-factor-holds',
    name: 'X-Factor Holds',
    category: 'body',
    description: 'Isometric holds at maximum hip-shoulder separation',
  },
  'hip-lead-drill': {
    drillId: 'hip-lead-drill',
    name: 'Hip Lead Drill',
    category: 'body',
    description: 'Emphasize hip rotation leading the swing sequence',
  },
  'hip-turn-drill': {
    drillId: 'hip-turn-drill',
    name: 'Hip Turn Drill',
    category: 'body',
    description: 'Practice consistent hip rotation direction and angle',
  },
  'alignment-sticks': {
    drillId: 'alignment-sticks',
    name: 'Alignment Sticks',
    category: 'body',
    description: 'Use alignment sticks to verify body angles and rotation paths',
  },
  'ground-force-timing': {
    drillId: 'ground-force-timing',
    name: 'Ground Force Timing',
    category: 'body',
    description: 'Develop proper timing of lower body force production',
  },
};

/**
 * Get drill recommendations based on identified leaks
 */
export function getDrillsForLeaks(leaks: PossibleLeak[]): DrillRecommendation[] {
  const drills: DrillRecommendation[] = [];
  const addedDrillIds = new Set<string>();

  leaks.forEach((leak, index) => {
    // Get drills from leak catalog if available
    const catalogEntry = LEAK_CATALOG[leak.leakType as keyof typeof LEAK_CATALOG];
    const drillIds = catalogEntry?.drills || [];

    drillIds.forEach((drillId) => {
      if (!addedDrillIds.has(drillId)) {
        const drill = DRILL_LIBRARY[drillId];
        if (drill) {
          drills.push({
            ...drill,
            targetLeak: leak.leakType,
            priority: index + 1,
          });
          addedDrillIds.add(drillId);
        }
      }
    });

    // Fallback: Use generic drill mapping
    if (drillIds.length === 0) {
      const genericDrill = getGenericDrillForLeak(leak);
      if (genericDrill && !addedDrillIds.has(genericDrill.drillId)) {
        drills.push({
          ...genericDrill,
          targetLeak: leak.leakType,
          priority: index + 1,
        });
        addedDrillIds.add(genericDrill.drillId);
      }
    }
  });

  return drills;
}

/**
 * Get a generic drill for a leak category
 */
function getGenericDrillForLeak(leak: PossibleLeak): Omit<DrillRecommendation, 'targetLeak' | 'priority'> | null {
  switch (leak.category) {
    case 'bat':
      return DRILL_LIBRARY['connection-bat-path'];
    case 'brain':
      return DRILL_LIBRARY['tempo-rhythm'];
    case 'body':
      return DRILL_LIBRARY['separation-sequence'];
    default:
      return null;
  }
}

/**
 * Get all drills for a specific category
 */
export function getDrillsByCategory(category: 'bat' | 'body' | 'brain'): typeof DRILL_LIBRARY[string][] {
  return Object.values(DRILL_LIBRARY).filter(d => d.category === category);
}

/**
 * Get drill by ID
 */
export function getDrillById(drillId: string): typeof DRILL_LIBRARY[string] | null {
  return DRILL_LIBRARY[drillId] || null;
}

/**
 * Get top priority drills (max 3)
 */
export function getTopPriorityDrills(leaks: PossibleLeak[], maxDrills = 3): DrillRecommendation[] {
  const allDrills = getDrillsForLeaks(leaks);
  return allDrills.slice(0, maxDrills);
}
