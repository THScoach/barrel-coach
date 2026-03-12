/**
 * Coaching Language Utility
 * Maps technical leak types to player-friendly explanations and drill recommendations.
 * Reading level: 5th-8th grade.
 */

export interface WeakestLinkInfo {
  title: string;
  explanation: string;
  drills: string[];
  pillar: 'BODY' | 'BRAIN' | 'BAT' | 'BALL';
}

export const weakestLinkExplanations: Record<string, WeakestLinkInfo> = {
  'no_bat_delivery': {
    title: 'Energy Not Reaching the Barrel',
    explanation: "Your body is making energy, but it's not getting to the bat. Think of it like revving an engine in neutral — lots of power, but the wheels aren't spinning.",
    drills: ['Connection Ball', 'Towel Drill', 'Overload/Underload'],
    pillar: 'BAT',
  },
  'decel_failure': {
    title: 'Brake System Not Firing',
    explanation: "Elite hitters slam the brakes with their lower body right before contact — that's what whips the bat through. Your brake isn't engaging, so energy leaks out instead of transferring up.",
    drills: ['Step and Turn', 'Wall Drill', 'Front Foot Block'],
    pillar: 'BODY',
  },
  'shallow_load': {
    title: 'Not Enough Coil',
    explanation: "You're not loading deep enough into your back hip. Less load = less energy to transfer. It's like trying to throw a punch without pulling your fist back first.",
    drills: ['Hip Hinge Drill', 'Load and Hold', 'Depth Jumps'],
    pillar: 'BODY',
  },
  'simultaneous_firing': {
    title: 'Everything Firing at Once',
    explanation: 'Your hips and shoulders are turning at the same time. Elite swings fire hips FIRST, then shoulders chase. When they fire together, you lose the whip effect.',
    drills: ['Separation Drill', 'Hip Lead Toss', 'Quan Ropes'],
    pillar: 'BODY',
  },
  'low_transfer_ratio': {
    title: 'Energy Not Amplifying',
    explanation: "Your lower body creates energy, but your torso isn't multiplying it. Elite hitters amplify — their torso moves 1.5-1.8x faster than their hips. Yours isn't getting that boost.",
    drills: ['Med Ball Rotations', 'Separation Drill', 'Overspeed Training'],
    pillar: 'BODY',
  },
  'timing_gap_wide': {
    title: 'Disconnected Sequence',
    explanation: "There's too much delay between your hip turn and your shoulder turn. It's like throwing a one-two punch but waiting too long between punches — you lose the momentum.",
    drills: ['Tempo Tees', 'Rhythm Drill', 'Quick Hands'],
    pillar: 'BRAIN',
  },
  'timing_gap_narrow': {
    title: 'No Separation',
    explanation: "Your hips and torso are firing almost at the same time. You need your hips to lead by 14-18% of your swing duration to create the whip. Right now you're spinning as one block.",
    drills: ['Hip Lead Drill', 'Quan Ropes', 'Separation Holds'],
    pillar: 'BRAIN',
  },
  'no_lag': {
    title: 'Casting the Barrel',
    explanation: "Your hands and the bat are moving together instead of the hands leading and the bat whipping through late. You're pushing the bat instead of letting it release.",
    drills: ['Connection Ball', 'Knob to Ball', 'Short Bat Drill'],
    pillar: 'BAT',
  },
  'late_release': {
    title: 'Bat Drag',
    explanation: "The bat is trailing too far behind your hands. By the time it gets to the zone, you've already spent the energy. The barrel needs to release earlier in the zone.",
    drills: ['Tee Exit Speed', 'Overload Bat', 'Extension Drill'],
    pillar: 'BAT',
  },
  // Engine leak types
  'clean_transfer': {
    title: 'Clean Energy Transfer',
    explanation: "Your body is moving energy through the chain efficiently. Energy flows from your legs, through your core, and out to the barrel — that's how it's supposed to work.",
    drills: [],
    pillar: 'BODY',
  },
  'late_legs': {
    title: 'Late Leg Drive',
    explanation: "Your legs are firing too late — the energy shows up after your hands have already started. Your legs need to lead the charge, not follow.",
    drills: ['Step and Turn', 'Wall Drill', 'Hip Lead Toss'],
    pillar: 'BODY',
  },
  'early_arms': {
    title: 'Arms Taking Over',
    explanation: "Your arms are taking over before your legs finish generating power. Let the energy build from the ground up before your hands fire.",
    drills: ['Separation Drill', 'Load and Hold', 'Quan Ropes'],
    pillar: 'BODY',
  },
  'torso_bypass': {
    title: 'Core Energy Leak',
    explanation: "Energy jumped from your legs straight to your arms, skipping your core. Your torso needs to catch and redirect that energy to amplify it.",
    drills: ['Med Ball Rotations', 'Core Flow Drill', 'Separation Holds'],
    pillar: 'BODY',
  },
};

export function getWeakestLinkInfo(leakType: string | null): WeakestLinkInfo | null {
  if (!leakType) return null;
  return weakestLinkExplanations[leakType] || null;
}

export function getTrendLanguage(
  metric: string,
  current: number,
  previous: number,
  sessions: number
): string {
  const delta = current - previous;
  const direction = delta > 2 ? 'improved' : delta < -2 ? 'declined' : 'stayed flat';

  if (direction === 'improved') {
    return `Your ${metric} has improved over your last ${sessions} sessions. Keep doing what you're doing.`;
  } else if (direction === 'declined') {
    return `Your ${metric} has slipped over your last ${sessions} sessions. This is your priority fix.`;
  } else {
    return `Your ${metric} has been consistent. Time to push for the next level.`;
  }
}

export function getScoreColor(score: number): string {
  if (score >= 90) return '#4ecdc4';
  if (score >= 80) return '#4ecdc4';
  if (score >= 60) return '#ffa500';
  return '#ff6b6b';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Working';
  return 'Priority';
}

export function getWeakestPillar(
  body: number | null,
  brain: number | null,
  bat: number | null,
  ball: number | null
): { pillar: string; score: number } | null {
  const pillars = [
    { pillar: 'BODY', score: body },
    { pillar: 'BRAIN', score: brain },
    { pillar: 'BAT', score: bat },
    { pillar: 'BALL', score: ball },
  ].filter(p => p.score !== null) as { pillar: string; score: number }[];

  if (!pillars.length) return null;
  return pillars.reduce((min, p) => p.score < min.score ? p : min);
}

// Pillar brand colors
export const PILLAR_COLORS = {
  BODY: '#E63946',
  BRAIN: '#4488ff',
  BAT: '#ffa500',
  BALL: '#4ecdc4',
  COMPOSITE: '#ffffff',
} as const;
