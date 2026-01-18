// ============================================================================
// WEEKLY CHALLENGES SYSTEM
// Catching Barrels Gamification Engine
// ============================================================================

export interface ChallengeType {
  key: string;
  name: string;
  description: string;
  metric: string;
  target?: number;
  targetType: 'above' | 'below' | 'highest' | 'lowest';
  minSwings: number;
  duration: number; // days
}

export const CHALLENGE_TYPES: ChallengeType[] = [
  {
    key: 'contact_week',
    name: 'Contact Week',
    description: 'Hit 70%+ of your swings in the Green Zone (center impact)',
    metric: 'impact_location_accuracy',
    target: 0.70,
    targetType: 'above',
    minSwings: 20,
    duration: 7,
  },
  {
    key: 'tempo_week',
    name: 'Tempo Week',
    description: 'Keep your timing variance under 5% across 20+ swings',
    metric: 'timing_variance',
    target: 0.05,
    targetType: 'below',
    minSwings: 20,
    duration: 7,
  },
  {
    key: 'power_week',
    name: 'Power Week',
    description: 'Beat your bat speed PR 3 times this week',
    metric: 'pr_count',
    target: 3,
    targetType: 'above',
    minSwings: 20,
    duration: 7,
  },
  {
    key: 'consistency_week',
    name: 'Consistency Week',
    description: 'Achieve the tightest Kinetic Fingerprint pattern',
    metric: 'fingerprint_scatter',
    targetType: 'lowest',
    minSwings: 30,
    duration: 7,
  },
  {
    key: 'efficiency_week',
    name: 'Efficiency Week',
    description: 'Highest hand-to-bat speed multiplier wins',
    metric: 'whip_efficiency',
    targetType: 'highest',
    minSwings: 20,
    duration: 7,
  },
  {
    key: 'grind_week',
    name: 'Grind Week',
    description: 'Log the most swings this week',
    metric: 'total_swings',
    targetType: 'highest',
    minSwings: 0,
    duration: 7,
  },
  {
    key: 'attack_angle_week',
    name: 'Launch Angle Week',
    description: 'Most swings with attack angle between 10-20 degrees',
    metric: 'optimal_attack_angle_count',
    targetType: 'highest',
    minSwings: 20,
    duration: 7,
  },
];

export interface ChallengeEntry {
  playerId: string;
  playerName: string;
  currentValue: number;
  swingsCount: number;
  rank?: number;
}

export interface ActiveChallenge {
  id: string;
  type: ChallengeType;
  weekStart: Date;
  weekEnd: Date;
  entries: ChallengeEntry[];
  status: 'active' | 'complete' | 'cancelled';
}

// Get the next challenge in rotation
export function getNextChallengeType(lastChallengeKey: string | null): ChallengeType {
  if (!lastChallengeKey) {
    return CHALLENGE_TYPES[0];
  }

  const lastIndex = CHALLENGE_TYPES.findIndex(c => c.key === lastChallengeKey);
  const nextIndex = (lastIndex + 1) % CHALLENGE_TYPES.length;
  return CHALLENGE_TYPES[nextIndex];
}

// Calculate if player meets challenge criteria
export function evaluateChallenge(
  challenge: ChallengeType,
  playerValue: number,
  swingsCount: number
): { qualified: boolean; meetsTarget: boolean } {
  const qualified = swingsCount >= challenge.minSwings;

  let meetsTarget = false;
  if (challenge.target !== undefined) {
    switch (challenge.targetType) {
      case 'above':
        meetsTarget = playerValue >= challenge.target;
        break;
      case 'below':
        meetsTarget = playerValue <= challenge.target;
        break;
      default:
        meetsTarget = true; // For highest/lowest, any value qualifies
    }
  } else {
    meetsTarget = true;
  }

  return { qualified, meetsTarget: qualified && meetsTarget };
}

// Determine winner from entries
export function determineWinner(
  challenge: ChallengeType,
  entries: ChallengeEntry[]
): ChallengeEntry | null {
  const qualifiedEntries = entries.filter(e => e.swingsCount >= challenge.minSwings);

  if (qualifiedEntries.length === 0) return null;

  let sorted: ChallengeEntry[];
  switch (challenge.targetType) {
    case 'highest':
      sorted = qualifiedEntries.sort((a, b) => b.currentValue - a.currentValue);
      break;
    case 'lowest':
      sorted = qualifiedEntries.sort((a, b) => a.currentValue - b.currentValue);
      break;
    case 'above':
    case 'below':
      // For target-based challenges, winner is whoever best exceeded the target
      if (challenge.targetType === 'above') {
        sorted = qualifiedEntries
          .filter(e => e.currentValue >= (challenge.target || 0))
          .sort((a, b) => b.currentValue - a.currentValue);
      } else {
        sorted = qualifiedEntries
          .filter(e => e.currentValue <= (challenge.target || 0))
          .sort((a, b) => a.currentValue - b.currentValue);
      }
      break;
    default:
      sorted = qualifiedEntries;
  }

  return sorted[0] || null;
}

// Get Monday of current week (challenges run Mon-Sun)
export function getCurrentWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function getWeekEnd(weekStart: Date): Date {
  const sunday = new Date(weekStart);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}
