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
    caption: 'Great job! Your legs connected to the ground and transferred energy cleanly.',
    trainingFocus: 'Maintain your current pattern',
    highlightJoints: [],
    causeColor: 'green',
  },

  [LeakType.EARLY_BACK_LEG_RELEASE]: {
    primaryCause: 'rear_leg',
    caption: 'You left the ground too early with your back leg.',
    trainingFocus: 'Stay connected longer with rear leg',
    highlightJoints: ['rear_hip', 'rear_knee', 'rear_ankle'],
    causeColor: 'red',
  },

  [LeakType.LATE_LEAD_LEG_ACCEPTANCE]: {
    primaryCause: 'lead_leg',
    caption: 'Your front leg didn\'t catch the force in time.',
    trainingFocus: 'Earlier front-side acceptance',
    highlightJoints: ['lead_hip', 'lead_knee', 'lead_ankle'],
    causeColor: 'yellow',
  },

  [LeakType.VERTICAL_PUSH]: {
    primaryCause: 'legs',
    caption: 'You pushed up instead of into the ground.',
    trainingFocus: 'Push into the ground, not up',
    highlightJoints: ['rear_knee', 'rear_ankle', 'lead_knee', 'lead_ankle'],
    causeColor: 'red',
  },

  [LeakType.GLIDE_WITHOUT_CAPTURE]: {
    primaryCause: 'lead_leg',
    caption: 'You moved forward but didn\'t stop and transfer.',
    trainingFocus: 'Learn to brake and transfer',
    highlightJoints: ['lead_hip', 'lead_knee'],
    causeColor: 'yellow',
  },

  [LeakType.LATE_ENGINE]: {
    primaryCause: 'timing',
    caption: 'Your legs produced power — it just showed up late.',
    trainingFocus: 'Earlier ground connection timing',
    highlightJoints: ['rear_hip', 'rear_knee', 'lead_knee'],
    causeColor: 'yellow',
  },

  [LeakType.CORE_DISCONNECT]: {
    primaryCause: 'core',
    caption: 'Your upper body fired before your legs could lead.',
    trainingFocus: 'Let the legs lead the swing',
    highlightJoints: ['rear_hip', 'lead_hip', 'core'],
    causeColor: 'red',
  },

  [LeakType.UNKNOWN]: {
    primaryCause: 'none',
    caption: 'Movement pattern unclear — more swings needed.',
    trainingFocus: 'Capture more data',
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
      message: 'Movement pattern unclear — more swings needed for accurate analysis.',
    };
  }

  if (!hasContactEvent) {
    return {
      confident: false,
      message: 'Contact point unclear — analysis may be limited.',
    };
  }

  if (leakType === LeakType.UNKNOWN) {
    return {
      confident: false,
      message: 'Movement pattern unclear — more swings needed.',
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
      return 'Back Leg';
    case 'lead_leg':
      return 'Front Leg';
    case 'legs':
      return 'Legs';
    case 'ground':
      return 'Ground Connection';
    case 'core':
      return 'Core';
    case 'timing':
      return 'Timing';
    case 'none':
      return '';
    default:
      return '';
  }
}
