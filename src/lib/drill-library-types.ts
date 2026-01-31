/**
 * Drill Library Types — Catching Barrels
 * 
 * Version: 1.0
 * Date: January 30, 2026
 * Philosophy: "We don't change, we unlock."
 */

// ============================================================================
// DRILL FLAGS — What triggers drill prescription
// ============================================================================

export type DrillFlag =
  // Deceleration flags
  | 'flag_weak_brace'
  | 'flag_over_spinning'
  | 'flag_late_timing'
  | 'flag_no_decel'
  
  // Loading flags
  | 'flag_weak_load'
  | 'flag_early_fire'
  | 'flag_no_coil'
  | 'flag_slide'
  | 'flag_shallow_xfactor'
  
  // Transfer flags
  | 'flag_weak_transfer'
  | 'flag_low_torso_velo'
  | 'flag_poor_transfer'
  
  // Timing/Release flags
  | 'flag_late_whip'
  | 'flag_hands_late'
  | 'flag_arm_dominant'
  
  // Drift flags
  | 'flag_drift'
  | 'flag_head_movement'
  
  // Sequence flags
  | 'flag_simultaneous'
  | 'flag_no_sequence'
  
  // Connection flags
  | 'flag_casting'
  | 'flag_arm_bar'
  | 'flag_disconnected'
  
  // Foundation flags
  | 'flag_balance_asymmetry';

// ============================================================================
// MOTOR PROFILE TYPES (re-export for convenience)
// ============================================================================

export type MotorProfile = 'SPINNER' | 'WHIPPER' | 'SLINGSHOTTER' | 'TITAN';

// ============================================================================
// DRILL CATEGORY
// ============================================================================

export type DrillCategory = 
  | 'deceleration'
  | 'loading'
  | 'transfer'
  | 'release'
  | 'brace'
  | 'sequencing'
  | 'foundation'
  | 'connection';

// ============================================================================
// PROFILE FIT STATUS
// ============================================================================

export type ProfileFitStatus = 'yes' | 'critical' | 'maybe' | 'careful' | 'no';

export interface ProfileFit {
  profile: MotorProfile;
  status: ProfileFitStatus;
  notes?: string;
}

// ============================================================================
// COACHING CUE
// ============================================================================

export interface CoachingCue {
  issue: string;
  cue: string;
}

// ============================================================================
// DRILL DEFINITION
// ============================================================================

export interface DrillDefinition {
  id: string;
  name: string;
  slug: string;
  category: DrillCategory;
  
  // What flags trigger this drill
  triggeredByFlags: DrillFlag[];
  
  // Setup and execution
  setup: string[];
  theMove: string[];
  coachingCues: CoachingCue[];
  
  // Why it works
  whyItWorks: string;
  
  // Profile compatibility
  profileFits: ProfileFit[];
  
  // Contraindications
  contraindications: string[];
  
  // Progression (optional)
  progression?: string[];
}

// ============================================================================
// PROFILE CONTRAINDICATIONS
// ============================================================================

export interface ProfileContraindication {
  profile: MotorProfile;
  avoid: string[];
  reason: string;
}

export const PROFILE_CONTRAINDICATIONS: ProfileContraindication[] = [
  {
    profile: 'SPINNER',
    avoid: ['Extension drills', 'Long swing cues', 'Hip slide emphasis', '"Get through the ball" cues'],
    reason: 'Spinners generate power through rotation, not linear extension. Forcing extension breaks their natural path.'
  },
  {
    profile: 'WHIPPER',
    avoid: ['Compact cues', '"Keep hands close"', 'Quick hands drills', 'Tight rotation work'],
    reason: 'Whippers need extension and leverage. Compacting their swing kills their power source.'
  },
  {
    profile: 'SLINGSHOTTER',
    avoid: ['Rotation-only drills', '"Spin and hit" cues', '"Stay back" cues', 'Over-constraining linear movement'],
    reason: 'Slingshotters use linear ground force. Pure rotation takes away their foundation.'
  },
  {
    profile: 'TITAN',
    avoid: ['Speed-first cues', 'Quick twitch drills only', 'Light bat work exclusively', '"Be faster" messaging'],
    reason: 'Titans need to manage their mass. Speed-first approaches cause sequencing breakdown.'
  }
];

// ============================================================================
// FLAG → DRILL MAPPING
// ============================================================================

export const FLAG_TO_DRILLS: Record<DrillFlag, string[]> = {
  // Deceleration flags
  flag_weak_brace: ['box-step-down-front', 'violent-brake', 'wall-drill'],
  flag_over_spinning: ['box-step-down-front', 'violent-brake'],
  flag_late_timing: ['box-step-down-front', 'violent-brake', 'freeman-pendulum'],
  flag_no_decel: ['violent-brake'],
  
  // Loading flags
  flag_weak_load: ['box-step-down-back', 'back-hip-load'],
  flag_early_fire: ['box-step-down-back', 'back-hip-load'],
  flag_no_coil: ['box-step-down-back', 'back-hip-load'],
  flag_slide: ['box-step-down-back', 'wall-drill'],
  flag_shallow_xfactor: ['back-hip-load'],
  
  // Transfer flags
  flag_weak_transfer: ['resistance-band-rotations', 'violent-brake'],
  flag_low_torso_velo: ['resistance-band-rotations'],
  flag_poor_transfer: ['step-and-turn-sop', 'resistance-band-rotations'],
  
  // Timing/Release flags
  flag_late_whip: ['freeman-pendulum'],
  flag_hands_late: ['freeman-pendulum'],
  flag_arm_dominant: ['freeman-pendulum'],
  
  // Drift flags
  flag_drift: ['wall-drill', 'box-step-down-front'],
  flag_head_movement: ['wall-drill'],
  
  // Sequence flags
  flag_simultaneous: ['step-and-turn-sop'],
  flag_no_sequence: ['step-and-turn-sop'],
  
  // Connection flags
  flag_casting: ['constraint-rope-drill'],
  flag_arm_bar: ['constraint-rope-drill'],
  flag_disconnected: ['constraint-rope-drill'],
  
  // Foundation flags
  flag_balance_asymmetry: ['single-leg-stability']
};

// ============================================================================
// PROFILE RESTRICTIONS
// ============================================================================

export const PROFILE_DRILL_RESTRICTIONS: Record<MotorProfile, string[]> = {
  SPINNER: [], // No drills blocked, just careful with some
  WHIPPER: ['constraint-rope-drill'], // Don't over-constrain
  SLINGSHOTTER: ['box-step-down-front'], // May disrupt linear pattern
  TITAN: [] // No drills blocked
};

export const PROFILE_DRILL_CAUTIONS: Record<MotorProfile, string[]> = {
  SPINNER: ['box-step-down-back', 'step-and-turn-sop', 'back-hip-load'],
  WHIPPER: [],
  SLINGSHOTTER: ['wall-drill', 'resistance-band-rotations'],
  TITAN: []
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getDrillsForFlags(flags: DrillFlag[]): string[] {
  const drillSlugs = new Set<string>();
  
  for (const flag of flags) {
    const drills = FLAG_TO_DRILLS[flag] || [];
    drills.forEach(d => drillSlugs.add(d));
  }
  
  return Array.from(drillSlugs);
}

export function filterDrillsByProfile(drillSlugs: string[], profile: MotorProfile): string[] {
  const restricted = PROFILE_DRILL_RESTRICTIONS[profile] || [];
  return drillSlugs.filter(slug => !restricted.includes(slug));
}

export function getProfileContraindications(profile: MotorProfile): ProfileContraindication | undefined {
  return PROFILE_CONTRAINDICATIONS.find(c => c.profile === profile);
}

export function isDrillCautionedForProfile(drillSlug: string, profile: MotorProfile): boolean {
  const cautions = PROFILE_DRILL_CAUTIONS[profile] || [];
  return cautions.includes(drillSlug);
}
