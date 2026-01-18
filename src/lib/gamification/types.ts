// ============================================================================
// GAMIFICATION - TYPE DEFINITIONS
// ============================================================================

/**
 * Level titles in progression
 */
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Rookie',
  2: 'Prospect',
  3: 'Contender',
  4: 'Competitor',
  5: 'Varsity',
  6: 'All-Conference',
  7: 'All-State',
  8: 'D1 Commit',
  9: 'Pro Prospect',
  10: 'Barrel King',
};

/**
 * XP thresholds for each level
 */
export const LEVEL_THRESHOLDS: number[] = [
  0, // Level 1
  500, // Level 2
  1500, // Level 3
  3500, // Level 4
  7000, // Level 5
  12000, // Level 6
  20000, // Level 7
  35000, // Level 8
  55000, // Level 9
  80000, // Level 10
];

/**
 * XP reward amounts
 */
export const XP_REWARDS = {
  SESSION_COMPLETE: 50,
  PR_HIT: 100,
  WEEKLY_CHALLENGE_WIN: 200,
  STREAK_7: 75,
  STREAK_30: 250,
  STREAK_100: 1000,
  LEVEL_UP_BONUS: 50,
  FINGERPRINT_TIGHTENED: 25,
  BASELINE_COMPLETE: 100,
} as const;

/**
 * Challenge types
 */
export type ChallengeType =
  | 'contact_week'
  | 'tempo_week'
  | 'power_week'
  | 'consistency_week'
  | 'efficiency_week'
  | 'volume_week'
  | 'improvement_week';

/**
 * Challenge definition
 */
export interface Challenge {
  type: ChallengeType;
  name: string;
  description: string;
  targetMetric: string;
  targetType: 'above' | 'below' | 'highest' | 'lowest' | 'most';
  minSwings: number;
}

/**
 * Weekly challenge rotation
 */
export const CHALLENGE_ROTATION: Challenge[] = [
  {
    type: 'power_week',
    name: 'Power Week',
    description: 'Highest average bat speed wins',
    targetMetric: 'bat_speed_avg',
    targetType: 'highest',
    minSwings: 20,
  },
  {
    type: 'consistency_week',
    name: 'Consistency Week',
    description: 'Lowest timing variance wins',
    targetMetric: 'timing_variance_pct',
    targetType: 'lowest',
    minSwings: 25,
  },
  {
    type: 'efficiency_week',
    name: 'Efficiency Week',
    description: 'Best hand-to-bat ratio wins',
    targetMetric: 'avg_hand_to_bat_ratio',
    targetType: 'highest',
    minSwings: 20,
  },
  {
    type: 'volume_week',
    name: 'Volume Week',
    description: 'Most total swings wins',
    targetMetric: 'total_swings',
    targetType: 'most',
    minSwings: 0,
  },
  {
    type: 'tempo_week',
    name: 'Tempo Week',
    description: 'Fastest average time-to-contact wins',
    targetMetric: 'avg_time_to_contact',
    targetType: 'lowest',
    minSwings: 20,
  },
  {
    type: 'contact_week',
    name: 'Contact Week',
    description: 'Tightest attack angle variance wins',
    targetMetric: 'attack_angle_std_dev',
    targetType: 'lowest',
    minSwings: 25,
  },
  {
    type: 'improvement_week',
    name: 'Improvement Week',
    description: 'Most bat speed gained from baseline wins',
    targetMetric: 'bat_speed_improvement',
    targetType: 'highest',
    minSwings: 20,
  },
];

/**
 * Player gamification state
 */
export interface PlayerGamification {
  playerId: string;
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  level: number;
  levelTitle: string;
  xpToNextLevel: number;
  percentToNextLevel: number;
}

/**
 * XP event
 */
export interface XPEvent {
  amount: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
}

/**
 * Level up result
 */
export interface LevelUpResult {
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  newTitle?: string;
}
