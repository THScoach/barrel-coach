// ============================================================================
// XP & LEVEL SYSTEM
// Catching Barrels Gamification Engine
// ============================================================================

export const XP_REWARDS = {
  SESSION_COMPLETE: 50,      // 10+ swings
  DAILY_DRILL_COMPLETE: 25,
  PR_HIT: 100,
  WEEKLY_CHALLENGE_WIN: 200,
  MONDAY_CALL_ATTEND: 50,
  STREAK_7: 150,
  STREAK_30: 500,
  STREAK_100: 1000,
  FINGERPRINT_TIGHTENED: 75,
  LEVEL_UP_BONUS: 50,
  FIRST_SWING: 25,
  BASELINE_COMPLETE: 100,
  COMMUNITY_POST: 10,
  COMMUNITY_COMMENT: 5,
} as const;

export const LEVELS = [
  { level: 1, xp: 0, title: 'Rookie' },
  { level: 2, xp: 500, title: 'Prospect' },
  { level: 3, xp: 1500, title: 'Contender' },
  { level: 4, xp: 3500, title: 'Competitor' },
  { level: 5, xp: 7000, title: 'Varsity' },
  { level: 6, xp: 12000, title: 'All-Conference' },
  { level: 7, xp: 20000, title: 'All-State' },
  { level: 8, xp: 35000, title: 'D1 Commit' },
  { level: 9, xp: 55000, title: 'Pro Prospect' },
  { level: 10, xp: 80000, title: 'Barrel King' },
] as const;

export interface LevelInfo {
  level: number;
  title: string;
  currentXp: number;
  nextLevelXp: number | null;
  progress: number; // 0-100
}

export function calculateLevel(totalXp: number): LevelInfo {
  let currentLevel: typeof LEVELS[number] = LEVELS[0];
  let nextLevel: typeof LEVELS[number] | null = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].xp) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] ?? null;
      break;
    }
  }

  const xpIntoCurrentLevel = totalXp - currentLevel.xp;
  const xpToNextLevel = nextLevel ? nextLevel.xp - currentLevel.xp : 0;
  const progress = nextLevel ? Math.min(100, (xpIntoCurrentLevel / xpToNextLevel) * 100) : 100;

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    currentXp: totalXp,
    nextLevelXp: nextLevel?.xp || null,
    progress: Math.round(progress),
  };
}

export function getLevelTitle(level: number): string {
  const levelInfo = LEVELS.find(l => l.level === level);
  return levelInfo?.title || 'Unknown';
}

export function getXpToNextLevel(totalXp: number): number | null {
  const { nextLevelXp } = calculateLevel(totalXp);
  if (!nextLevelXp) return null;
  return nextLevelXp - totalXp;
}

// Streak milestones that award XP
export const STREAK_MILESTONES = [
  { days: 7, xp: XP_REWARDS.STREAK_7 },
  { days: 30, xp: XP_REWARDS.STREAK_30 },
  { days: 100, xp: XP_REWARDS.STREAK_100 },
] as const;

export function checkStreakMilestone(newStreak: number, oldStreak: number): number | null {
  for (const milestone of STREAK_MILESTONES) {
    if (newStreak >= milestone.days && oldStreak < milestone.days) {
      return milestone.xp;
    }
  }
  return null;
}
