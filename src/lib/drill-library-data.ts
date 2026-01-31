/**
 * Drill Library Data — The 10 Core Drills
 * 
 * Version: 1.0
 * Date: January 30, 2026
 */

import type { DrillDefinition } from './drill-library-types';

export const DRILL_LIBRARY: DrillDefinition[] = [
  // ============================================================================
  // 1. BOX STEP-DOWN (FRONT LEG)
  // ============================================================================
  {
    id: 'box-step-down-front',
    name: 'Box Step-Down (Front Leg)',
    slug: 'box-step-down-front',
    category: 'deceleration',
    triggeredByFlags: ['flag_weak_brace', 'flag_over_spinning', 'flag_drift', 'flag_late_timing'],
    setup: [
      'Both feet on box (6-12" height)',
      'Tee or front toss',
      'Normal stance on box'
    ],
    theMove: [
      'Stride DOWN off the box (front foot lands on ground)',
      'Back foot stays on box',
      'Front leg CATCHES your weight and POSTS',
      'Swing'
    ],
    coachingCues: [
      { issue: 'Weak Brace', cue: '"Post up — be a wall, not a door"' },
      { issue: 'Over-Spinner', cue: '"Stomp and STOP — feel the brake catch your hips"' },
      { issue: 'Drift', cue: '"Down, not out. Land and rotate."' },
      { issue: 'Late Timing', cue: '"The step triggers the swing. Don\'t wait."' }
    ],
    whyItWorks: 'Gravity forces the front leg to absorb load. Can\'t drift — you\'d fall. Automatic brace training. Teaches deceleration through constraint.',
    profileFits: [
      { profile: 'SPINNER', status: 'yes', notes: 'Teaches them to brake — they spin too much' },
      { profile: 'WHIPPER', status: 'yes', notes: 'Reinforces the violent front-side stop' },
      { profile: 'SLINGSHOTTER', status: 'careful', notes: 'May disrupt their linear pattern' },
      { profile: 'TITAN', status: 'yes', notes: 'Helps manage mass through front side' }
    ],
    contraindications: [
      'Don\'t use with guys who are already TOO stiff on front leg',
      'Don\'t use with lower body injuries (knee, ankle)',
      'Don\'t use if they over-extend already'
    ],
    progression: [
      'Box + Tee (feel the extension, no timing pressure)',
      'Box + Front Toss (add timing, maintain extension)',
      'Box + Velo (force adaptation under pressure)'
    ]
  },

  // ============================================================================
  // 2. BOX STEP-DOWN (BACK LEG)
  // ============================================================================
  {
    id: 'box-step-down-back',
    name: 'Box Step-Down (Back Leg)',
    slug: 'box-step-down-back',
    category: 'loading',
    triggeredByFlags: ['flag_weak_load', 'flag_early_fire', 'flag_no_coil', 'flag_slide'],
    setup: [
      'Both feet on box (6-12" height)',
      'Tee or front toss',
      'Normal stance on box'
    ],
    theMove: [
      'Step DOWN with BACK foot first',
      'Back foot lands on ground, loads into back hip',
      'Front foot stays on box (or follows)',
      'Swing from that loaded position'
    ],
    coachingCues: [
      { issue: 'Weak Load', cue: '"Drop into your back pocket. Feel it. Now turn."' },
      { issue: 'Early Fire', cue: '"Step down, sit in it, THEN go."' },
      { issue: 'No Coil', cue: '"Load the spring before you release it."' },
      { issue: 'Slide', cue: '"Down, not sideways. Feel the back hip catch."' }
    ],
    whyItWorks: 'Gravity forces you INTO the back hip. Eccentric loading builds strength in position. Creates depth — gets you INTO the ground. Delays the fire — can\'t early-fire while loading downward.',
    profileFits: [
      { profile: 'SPINNER', status: 'maybe', notes: 'Could help deepen load before quick turn' },
      { profile: 'WHIPPER', status: 'yes', notes: 'They need deep load for leverage' },
      { profile: 'SLINGSHOTTER', status: 'critical', notes: 'Back leg is their engine' },
      { profile: 'TITAN', status: 'yes', notes: 'Builds foundation for mass management' }
    ],
    contraindications: [
      'Don\'t use with guys who already over-load (get stuck back)',
      'Don\'t use with back hip or knee issues',
      'Don\'t use if they have timing issues from being too slow'
    ],
    progression: [
      'Box + Pause + Tee (feel the load, hold, then swing)',
      'Box + Tee (continuous motion)',
      'Box + Front Toss (add timing)'
    ]
  },

  // ============================================================================
  // 3. VIOLENT BRAKE DRILL
  // ============================================================================
  {
    id: 'violent-brake',
    name: 'Violent Brake Drill',
    slug: 'violent-brake',
    category: 'transfer',
    triggeredByFlags: ['flag_late_timing', 'flag_no_decel', 'flag_poor_transfer'],
    setup: [
      'Normal stance',
      'Resistance band around waist, anchored behind',
      'Tee or soft toss'
    ],
    theMove: [
      'Load normally',
      'Fire hips — band pulls back',
      'STOP the hips against the band resistance',
      'Feel torso whip past'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Hips GO, hips STOP, hands GO."' },
      { issue: 'General', cue: '"The brake is what makes the whip."' },
      { issue: 'General', cue: '"Fire and freeze the hips — let the barrel take over."' }
    ],
    whyItWorks: 'Band creates resistance that must be overcome. Forces active deceleration. Athlete FEELS the transfer when hips stop.',
    profileFits: [
      { profile: 'SPINNER', status: 'yes', notes: 'Teaches brake after quick rotation' },
      { profile: 'WHIPPER', status: 'critical', notes: 'This IS their power source' },
      { profile: 'SLINGSHOTTER', status: 'yes', notes: 'Helps convert linear to rotational' },
      { profile: 'TITAN', status: 'yes', notes: 'Manages the big engine' }
    ],
    contraindications: [
      'Don\'t use if they\'re already too "stoppy" (no flow)',
      'Don\'t use heavy resistance — just enough to feel'
    ]
  },

  // ============================================================================
  // 4. FREEMAN PENDULUM
  // ============================================================================
  {
    id: 'freeman-pendulum',
    name: 'Freeman Pendulum',
    slug: 'freeman-pendulum',
    category: 'release',
    triggeredByFlags: ['flag_late_whip', 'flag_hands_late', 'flag_arm_dominant'],
    setup: [
      'Normal stance',
      'Focus on hands at back hip',
      'Tee or soft toss'
    ],
    theMove: [
      'Load normally',
      'As hands reach back hip, RELEASE the bat',
      'Bat should swing like a pendulum toward the ground',
      'Don\'t muscle it — let it fall'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Hands pass back hip — let it go."' },
      { issue: 'General', cue: '"The bat falls. You don\'t throw it."' },
      { issue: 'General', cue: '"Pendulum, not push."' }
    ],
    whyItWorks: 'Creates feel for early release point. Takes arms out of the equation. Teaches gravity-assisted bat path.',
    profileFits: [
      { profile: 'SPINNER', status: 'yes', notes: 'Gets them releasing sooner' },
      { profile: 'WHIPPER', status: 'critical', notes: 'This IS the Freeman feel' },
      { profile: 'SLINGSHOTTER', status: 'careful', notes: 'May feel disconnected from ground' },
      { profile: 'TITAN', status: 'yes', notes: 'Simplifies the release' }
    ],
    contraindications: [
      'Don\'t use with guys who are ALREADY early (whip <50%)',
      'Don\'t use if they cast — they\'ll cast more'
    ]
  },

  // ============================================================================
  // 5. WALL DRILL
  // ============================================================================
  {
    id: 'wall-drill',
    name: 'Wall Drill',
    slug: 'wall-drill',
    category: 'brace',
    triggeredByFlags: ['flag_drift', 'flag_weak_brace', 'flag_head_movement'],
    setup: [
      'Stand with front hip ~6 inches from wall',
      'Tee set up inside',
      'Normal stance parallel to wall'
    ],
    theMove: [
      'Load normally',
      'Stride and rotate',
      'Front hip should NOT touch wall',
      'If you drift, you hit the wall'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Rotate, don\'t slide."' },
      { issue: 'General', cue: '"The wall is your front-side limit."' },
      { issue: 'General', cue: '"If you touch, you drifted."' }
    ],
    whyItWorks: 'Instant feedback on drift. Physical constraint prevents the mistake. Teaches rotation around axis, not slide through it.',
    profileFits: [
      { profile: 'SPINNER', status: 'yes', notes: 'Keeps rotation tight' },
      { profile: 'WHIPPER', status: 'yes', notes: 'Prevents drift before brake' },
      { profile: 'SLINGSHOTTER', status: 'careful', notes: 'They need SOME linear — don\'t over-constrain' },
      { profile: 'TITAN', status: 'yes', notes: 'Keeps mass centered' }
    ],
    contraindications: [
      'Don\'t use with guys who are already too rotational with no linear',
      'Don\'t put wall too close — some forward movement is natural'
    ]
  },

  // ============================================================================
  // 6. BACK HIP LOAD DRILL
  // ============================================================================
  {
    id: 'back-hip-load',
    name: 'Back Hip Load Drill',
    slug: 'back-hip-load',
    category: 'loading',
    triggeredByFlags: ['flag_shallow_xfactor', 'flag_no_coil', 'flag_weak_load'],
    setup: [
      'Hands on bat, bat behind back (in elbows)',
      'Normal stance',
      'No swing — just load pattern'
    ],
    theMove: [
      'Sit into back hip',
      'Feel the coil in the back glute',
      'Front shoulder stays closed',
      'Hold for 2 seconds',
      'Return'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Sit into the back pocket."' },
      { issue: 'General', cue: '"Feel the glute load."' },
      { issue: 'General', cue: '"Shoulders stay closed — hips do the work."' }
    ],
    whyItWorks: 'Isolates the load pattern. Builds awareness of back hip engagement. Creates separation feel without the swing.',
    profileFits: [
      { profile: 'SPINNER', status: 'careful', notes: 'They don\'t need deep load — quick turn is their style' },
      { profile: 'WHIPPER', status: 'critical', notes: 'Deep load is their power source' },
      { profile: 'SLINGSHOTTER', status: 'yes', notes: 'Builds the foundation for push' },
      { profile: 'TITAN', status: 'yes', notes: 'Teaches them to use the mass' }
    ],
    contraindications: [
      'Don\'t over-cue for Spinners — they\'ll get stuck',
      'Don\'t use if they have hip mobility restrictions'
    ]
  },

  // ============================================================================
  // 7. STEP AND TURN SOP
  // ============================================================================
  {
    id: 'step-and-turn-sop',
    name: 'Step and Turn SOP',
    slug: 'step-and-turn-sop',
    category: 'sequencing',
    triggeredByFlags: ['flag_simultaneous', 'flag_no_sequence', 'flag_poor_transfer'],
    setup: [
      'Normal stance',
      'Hands at chest (no bat first, then add)',
      'Focus on lower/upper body separation'
    ],
    theMove: [
      'STEP — front foot lands',
      'Pause (feel the separation)',
      'TURN — hips fire, torso follows',
      'Hands go last'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Step... pause... TURN."' },
      { issue: 'General', cue: '"Feel the hips go before the hands."' },
      { issue: 'General', cue: '"Two beats, not one."' }
    ],
    whyItWorks: 'Breaks the simultaneous pattern. Creates feel for sequence. Teaches patience.',
    profileFits: [
      { profile: 'SPINNER', status: 'careful', notes: 'Don\'t slow them down too much' },
      { profile: 'WHIPPER', status: 'yes', notes: 'Reinforces hip lead' },
      { profile: 'SLINGSHOTTER', status: 'yes', notes: 'Builds ground-up pattern' },
      { profile: 'TITAN', status: 'critical', notes: 'They need the sequence most' }
    ],
    contraindications: [
      'Don\'t over-cue the pause — it should be felt, not forced',
      'Don\'t use with guys who are already too slow/deliberate'
    ]
  },

  // ============================================================================
  // 8. RESISTANCE BAND ROTATIONS
  // ============================================================================
  {
    id: 'resistance-band-rotations',
    name: 'Resistance Band Rotations',
    slug: 'resistance-band-rotations',
    category: 'transfer',
    triggeredByFlags: ['flag_weak_transfer', 'flag_low_torso_velo'],
    setup: [
      'Band anchored at hip height',
      'Handle at chest or shoulders',
      'Athletic stance'
    ],
    theMove: [
      'Rotate against band resistance',
      'Focus on torso accelerating',
      'Hips stable, torso moves',
      'Control the return'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Torso does the work."' },
      { issue: 'General', cue: '"Hips stay quiet, shoulders rip."' },
      { issue: 'General', cue: '"Control the way back."' }
    ],
    whyItWorks: 'Builds rotational strength. Isolates torso acceleration. Creates feel for transfer.',
    profileFits: [
      { profile: 'SPINNER', status: 'yes', notes: 'Builds quick rotation strength' },
      { profile: 'WHIPPER', status: 'yes', notes: 'Builds leverage strength' },
      { profile: 'SLINGSHOTTER', status: 'careful', notes: 'Don\'t over-rotate them' },
      { profile: 'TITAN', status: 'yes', notes: 'Builds the engine' }
    ],
    contraindications: [
      'Don\'t use heavy resistance — quality over load',
      'Don\'t let them cheat with hips'
    ]
  },

  // ============================================================================
  // 9. SINGLE-LEG STABILITY HOLDS
  // ============================================================================
  {
    id: 'single-leg-stability',
    name: 'Single-Leg Stability Holds',
    slug: 'single-leg-stability',
    category: 'foundation',
    triggeredByFlags: ['flag_balance_asymmetry'],
    setup: [
      'Stand on one leg',
      'Opposite knee at 90°',
      'Hold position'
    ],
    theMove: [
      'Hold for 30-60 seconds',
      'Don\'t let knee cave',
      'Keep hips level',
      'Switch sides'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Knee over toe — don\'t cave."' },
      { issue: 'General', cue: '"Hips level, eyes forward."' },
      { issue: 'General', cue: '"Own the position."' }
    ],
    whyItWorks: 'Builds single-leg stability. Exposes asymmetry. Foundation for all dynamic movement.',
    profileFits: [
      { profile: 'SPINNER', status: 'yes', notes: 'Foundation work for everyone' },
      { profile: 'WHIPPER', status: 'yes', notes: 'Foundation work for everyone' },
      { profile: 'SLINGSHOTTER', status: 'yes', notes: 'Foundation work for everyone' },
      { profile: 'TITAN', status: 'yes', notes: 'Foundation work for everyone' }
    ],
    contraindications: [
      'Regress to wall support if they can\'t hold 15 seconds',
      'Address pain immediately'
    ]
  },

  // ============================================================================
  // 10. CONSTRAINT ROPE DRILL (QUAN ROPES)
  // ============================================================================
  {
    id: 'constraint-rope-drill',
    name: 'Constraint Rope Drill',
    slug: 'constraint-rope-drill',
    category: 'connection',
    triggeredByFlags: ['flag_casting', 'flag_arm_bar', 'flag_disconnected'],
    setup: [
      'Rope/band connects back elbow to front hip',
      'Normal stance',
      'Tee or soft toss'
    ],
    theMove: [
      'Swing with constraint',
      'If you cast, rope pulls tight',
      'Stay connected through rotation'
    ],
    coachingCues: [
      { issue: 'General', cue: '"Hands in, barrel out."' },
      { issue: 'General', cue: '"Turn together."' },
      { issue: 'General', cue: '"Feel the connection."' }
    ],
    whyItWorks: 'Physical constraint prevents casting. Teaches hands-inside-ball path. Creates body-arm connection feel.',
    profileFits: [
      { profile: 'SPINNER', status: 'yes', notes: 'Keeps them compact' },
      { profile: 'WHIPPER', status: 'careful', notes: 'They need some extension — don\'t over-constrain' },
      { profile: 'SLINGSHOTTER', status: 'yes', notes: 'Keeps them connected to ground' },
      { profile: 'TITAN', status: 'yes', notes: 'Prevents arm-dominant patterns' }
    ],
    contraindications: [
      'Don\'t use with Whippers who need extension',
      'Don\'t use if they\'re already too tight/restricted'
    ]
  }
];

// ============================================================================
// HELPER: Get drill by slug
// ============================================================================

export function getDrillBySlug(slug: string): DrillDefinition | undefined {
  return DRILL_LIBRARY.find(d => d.slug === slug);
}

export function getDrillById(id: string): DrillDefinition | undefined {
  return DRILL_LIBRARY.find(d => d.id === id);
}
