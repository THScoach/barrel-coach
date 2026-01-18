// ============================================================================
// GAMIFICATION ENGINE
// XP, levels, streaks, and challenges
// ============================================================================

import {
  LEVEL_TITLES,
  LEVEL_THRESHOLDS,
  XP_REWARDS,
  CHALLENGE_ROTATION,
  type PlayerGamification,
  type XPEvent,
  type LevelUpResult,
  type Challenge,
} from './types';

// ============================================================================
// LEVEL CALCULATIONS
// ============================================================================

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Get level title
 */
export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] || LEVEL_TITLES[1];
}

/**
 * Get XP required for next level
 */
export function getXpToNextLevel(currentXp: number, currentLevel: number): number {
  if (currentLevel >= 10) return 0;
  return LEVEL_THRESHOLDS[currentLevel] - currentXp;
}

/**
 * Get percentage progress to next level
 */
export function getPercentToNextLevel(currentXp: number, currentLevel: number): number {
  if (currentLevel >= 10) return 100;

  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1];
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel];
  const range = nextThreshold - currentThreshold;
  const progress = currentXp - currentThreshold;

  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}

/**
 * Build player gamification state
 */
export function buildPlayerGamification(
  playerId: string,
  currentStreak: number,
  longestStreak: number,
  totalXp: number
): PlayerGamification {
  const level = calculateLevel(totalXp);

  return {
    playerId,
    currentStreak,
    longestStreak,
    totalXp,
    level,
    levelTitle: getLevelTitle(level),
    xpToNextLevel: getXpToNextLevel(totalXp, level),
    percentToNextLevel: getPercentToNextLevel(totalXp, level),
  };
}

// ============================================================================
// XP REWARDS
// ============================================================================

/**
 * Create session complete XP event
 */
export function createSessionCompleteXP(sessionId: string): XPEvent {
  return {
    amount: XP_REWARDS.SESSION_COMPLETE,
    reason: 'session_complete',
    referenceType: 'sensor_session',
    referenceId: sessionId,
  };
}

/**
 * Create PR hit XP event
 */
export function createPRXP(metricName: string, sessionId: string): XPEvent {
  return {
    amount: XP_REWARDS.PR_HIT,
    reason: `pr_${metricName}`,
    referenceType: 'sensor_session',
    referenceId: sessionId,
  };
}

/**
 * Create streak XP event
 */
export function createStreakXP(streakDays: number): XPEvent | null {
  if (streakDays === 7) {
    return { amount: XP_REWARDS.STREAK_7, reason: 'streak_7' };
  }
  if (streakDays === 30) {
    return { amount: XP_REWARDS.STREAK_30, reason: 'streak_30' };
  }
  if (streakDays === 100) {
    return { amount: XP_REWARDS.STREAK_100, reason: 'streak_100' };
  }
  return null;
}

/**
 * Create challenge win XP event
 */
export function createChallengeWinXP(challengeId: string): XPEvent {
  return {
    amount: XP_REWARDS.WEEKLY_CHALLENGE_WIN,
    reason: 'weekly_challenge_win',
    referenceType: 'weekly_challenge',
    referenceId: challengeId,
  };
}

/**
 * Create baseline complete XP event
 */
export function createBaselineCompleteXP(sessionId: string): XPEvent {
  return {
    amount: XP_REWARDS.BASELINE_COMPLETE,
    reason: 'baseline_complete',
    referenceType: 'sensor_session',
    referenceId: sessionId,
  };
}

// ============================================================================
// STREAK MANAGEMENT
// ============================================================================

/**
 * Check if streak continues (session within 24 hours of last session)
 */
export function shouldContinueStreak(lastSessionDate: Date | null, newSessionDate: Date): boolean {
  if (!lastSessionDate) return true; // First session starts a streak

  const daysDiff = Math.floor(
    (newSessionDate.getTime() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysDiff <= 1;
}

/**
 * Calculate new streak value
 */
export function calculateNewStreak(
  currentStreak: number,
  lastSessionDate: Date | null,
  newSessionDate: Date
): number {
  if (shouldContinueStreak(lastSessionDate, newSessionDate)) {
    return currentStreak + 1;
  }
  return 1; // Reset to 1
}

// ============================================================================
// CHALLENGES
// ============================================================================

/**
 * Get challenge for a given week
 */
export function getChallengeForWeek(weekStart: Date): Challenge {
  // Use week number to rotate through challenges
  const weekOfYear = getWeekNumber(weekStart);
  const challengeIndex = weekOfYear % CHALLENGE_ROTATION.length;
  return CHALLENGE_ROTATION[challengeIndex];
}

/**
 * Get week number of the year
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Get current week start (Monday)
 */
export function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get current week end (Sunday)
 */
export function getCurrentWeekEnd(): Date {
  const monday = getCurrentWeekStart();
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// ============================================================================
// LEVEL UP SIMULATION
// ============================================================================

/**
 * Simulate XP award and check for level up
 */
export function simulateXPAward(currentXp: number, xpAmount: number): LevelUpResult {
  const oldLevel = calculateLevel(currentXp);
  const newXp = currentXp + xpAmount;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > oldLevel;

  return {
    newXp,
    newLevel,
    leveledUp,
    newTitle: leveledUp ? getLevelTitle(newLevel) : undefined,
  };
}

/**
 * Get all XP events for a session
 */
export function getSessionXPEvents(
  sessionId: string,
  newStreak: number,
  isPR: boolean,
  isBaselineComplete: boolean,
  prMetrics: string[] = []
): XPEvent[] {
  const events: XPEvent[] = [];

  // Session completion
  events.push(createSessionCompleteXP(sessionId));

  // Streak milestones
  const streakXP = createStreakXP(newStreak);
  if (streakXP) {
    events.push(streakXP);
  }

  // PRs
  if (isPR) {
    prMetrics.forEach((metric) => {
      events.push(createPRXP(metric, sessionId));
    });
  }

  // Baseline completion
  if (isBaselineComplete) {
    events.push(createBaselineCompleteXP(sessionId));
  }

  return events;
}

/**
 * Calculate total XP from events
 */
export function sumXPEvents(events: XPEvent[]): number {
  return events.reduce((sum, event) => sum + event.amount, 0);
}
