/**
 * Training Translation Layer
 * ===========================
 * Converts internal leak detection logic into player-facing,
 * leg-first training language.
 * 
 * RULES:
 * - Pelvis must NEVER be named as the cause in captions
 * - Language must be understandable to a 14-year-old
 * - One idea per caption
 * - This layer does NOT change detection logic — only interpretation
 */

import { LeakType } from './reboot-parser';

export interface TrainingTranslation {
  primaryCause: 'legs' | 'rear_leg' | 'lead_leg' | 'ground' | 'core' | 'timing' | 'none';
  caption: string;
  trainingFocus: string;
  highlightJoints: ('rear_hip' | 'rear_knee' | 'rear_ankle' | 'lead_hip' | 'lead_knee' | 'lead_ankle' | 'core')[];
  causeColor: 'green' | 'yellow' | 'red';
}

/**
 * Translation map from internal leak types to player-facing explanations
 * 
 * Key principles:
 * - Always frame in terms of LEGS and GROUND connection
 * - Never blame the pelvis directly
 * - Use simple, action-oriented language
 */
export const TRAINING_TRANSLATIONS: Record<LeakType, TrainingTranslation> = {
  [LeakType.CLEAN_TRANSFER]: {
    primaryCause: 'none',
    caption: "That's clean. Your legs did their job and the barrel got paid.",
    trainingFocus: "Don't mess with it — keep that same move.",
    highlightJoints: [],
    causeColor: 'green',
  },

  [LeakType.EARLY_BACK_LEG_RELEASE]: {
    primaryCause: 'rear_leg',
    caption: "Your back leg bailed early. You quit the ground before the swing was finished.",
    trainingFocus: "Stay on that back leg longer — finish the turn first.",
    highlightJoints: ['rear_hip', 'rear_knee', 'rear_ankle'],
    causeColor: 'red',
  },

  [LeakType.LATE_LEAD_LEG_ACCEPTANCE]: {
    primaryCause: 'lead_leg',
    caption: "Your front leg showed up late. It didn't catch the force in time.",
    trainingFocus: "Get the front side down sooner — catch it, then swing.",
    highlightJoints: ['lead_hip', 'lead_knee', 'lead_ankle'],
    causeColor: 'yellow',
  },

  [LeakType.VERTICAL_PUSH]: {
    primaryCause: 'legs',
    caption: "You popped up. That's up-force, not ground-force.",
    trainingFocus: "Drive into the ground — no jumping.",
    highlightJoints: ['rear_knee', 'rear_ankle', 'lead_knee', 'lead_ankle'],
    causeColor: 'red',
  },

  [LeakType.GLIDE_WITHOUT_CAPTURE]: {
    primaryCause: 'lead_leg',
    caption: "You glided forward but you never slammed the brakes.",
    trainingFocus: "Brake the move — stop forward, then rotate.",
    highlightJoints: ['lead_hip', 'lead_knee'],
    causeColor: 'yellow',
  },

  [LeakType.LATE_ENGINE]: {
    primaryCause: 'timing',
    caption: "You made power — it just showed up late. The swing already left without it.",
    trainingFocus: "Turn the ground on earlier — power first, then barrel.",
    highlightJoints: ['rear_hip', 'rear_knee', 'lead_knee'],
    causeColor: 'yellow',
  },

  [LeakType.CORE_DISCONNECT]: {
    primaryCause: 'core',
    caption: "Your top half took off before your legs started it.",
    trainingFocus: "Legs lead. Then the core. Then the hands.",
    highlightJoints: ['rear_hip', 'lead_hip', 'core'],
    causeColor: 'red',
  },

  [LeakType.UNKNOWN]: {
    primaryCause: 'none',
    caption: "I can't trust this yet. We need more clean swings.",
    trainingFocus: "Upload more swings so the pattern shows up.",
    highlightJoints: [],
    causeColor: 'yellow',
  },
};

/**
 * Get training translation for a leak type
 */
export function getTrainingTranslation(leakType: LeakType): TrainingTranslation {
  return TRAINING_TRANSLATIONS[leakType] || TRAINING_TRANSLATIONS[LeakType.UNKNOWN];
}

/**
 * Check if the analysis has sufficient confidence for visualization
 */
/**
 * Check if the analysis has sufficient confidence for visualization
 * 
 * RULES:
 * - Only gate when we KNOW the values indicate low confidence
 * - If swingCount/hasContactEvent are unknown (undefined), don't penalize
 * - UNKNOWN leakType always gates since we can't show anything useful
 */
export function hasConfidentAnalysis(
  swingCount?: number | null,
  hasContactEvent?: boolean | null,
  leakType?: LeakType | null
): { confident: boolean; message: string } {
  // Only gate on swingCount if we actually KNOW it
  if (typeof swingCount === 'number' && swingCount > 0 && swingCount < 3) {
    return {
      confident: false,
      message: "I can't see this one clean yet. Give me more swings.",
    };
  }

  // Only gate on contact if we actually KNOW it's false
  if (hasContactEvent === false) {
    return {
      confident: false,
      message: "I can't see this one clean yet.",
    };
  }

  if (leakType === LeakType.UNKNOWN) {
    return {
      confident: false,
      message: "I can't see this one clean yet.",
    };
  }

  return { confident: true, message: '' };
}

/**
 * Get a simplified body part name for display
 */
export function getBodyPartDisplayName(cause: TrainingTranslation['primaryCause']): string {
  switch (cause) {
    case 'rear_leg':
      return 'BACK LEG';
    case 'lead_leg':
      return 'FRONT LEG';
    case 'legs':
      return 'LEGS';
    case 'ground':
      return 'GROUND';
    case 'core':
      return 'SEQUENCE';
    case 'timing':
      return 'LATE LEGS';
    case 'none':
      return '';
    default:
      return '';
  }
}
