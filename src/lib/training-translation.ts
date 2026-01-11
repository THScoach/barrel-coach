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
    caption: "That's it. You stayed connected and got it out on time.",
    trainingFocus: 'Keep doing that.',
    highlightJoints: [],
    causeColor: 'green',
  },

  [LeakType.EARLY_BACK_LEG_RELEASE]: {
    primaryCause: 'rear_leg',
    caption: 'You left the ground too early with your back leg.',
    trainingFocus: 'Stay in the ground longer.',
    highlightJoints: ['rear_hip', 'rear_knee', 'rear_ankle'],
    causeColor: 'red',
  },

  [LeakType.LATE_LEAD_LEG_ACCEPTANCE]: {
    primaryCause: 'lead_leg',
    caption: "Your front leg didn't catch it in time.",
    trainingFocus: 'Catch it earlier on the front side.',
    highlightJoints: ['lead_hip', 'lead_knee', 'lead_ankle'],
    causeColor: 'yellow',
  },

  [LeakType.VERTICAL_PUSH]: {
    primaryCause: 'ground',
    caption: 'You pushed up instead of into the ground.',
    trainingFocus: 'Push into the ground, not straight up.',
    highlightJoints: ['rear_knee', 'rear_ankle', 'lead_knee', 'lead_ankle'],
    causeColor: 'red',
  },

  [LeakType.GLIDE_WITHOUT_CAPTURE]: {
    primaryCause: 'lead_leg',
    caption: "You moved forward but never stopped it.",
    trainingFocus: 'Brake it, then fire.',
    highlightJoints: ['lead_hip', 'lead_knee'],
    causeColor: 'yellow',
  },

  [LeakType.LATE_ENGINE]: {
    primaryCause: 'ground',
    caption: 'Your legs made power — it just showed up late.',
    trainingFocus: 'Get to the ground earlier.',
    highlightJoints: ['rear_hip', 'rear_knee', 'lead_knee'],
    causeColor: 'yellow',
  },

  [LeakType.CORE_DISCONNECT]: {
    primaryCause: 'core',
    caption: 'Your upper half went before your legs.',
    trainingFocus: 'Let the legs start the swing.',
    highlightJoints: ['rear_hip', 'lead_hip', 'core'],
    causeColor: 'red',
  },

  [LeakType.UNKNOWN]: {
    primaryCause: 'none',
    caption: "I can't see this one clean yet.",
    trainingFocus: 'Give me more swings.',
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
export function hasConfidentAnalysis(
  swingCount: number,
  hasContactEvent: boolean,
  leakType: LeakType
): { confident: boolean; message: string } {
  if (swingCount < 3) {
    return {
      confident: false,
      message: "I can't see this one clean yet. Give me more swings.",
    };
  }

  if (!hasContactEvent) {
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

  return {
    confident: true,
    message: '',
  };
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
      return 'GROUND';
    case 'ground':
      return 'GROUND';
    case 'core':
      return 'SEQUENCE';
    case 'timing':
      return 'GROUND';
    case 'none':
      return '';
    default:
      return '';
  }
}
