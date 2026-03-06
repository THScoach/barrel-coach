// ============================================================================
// Catching Barrels — Player View Generator v1.0
// Translates scoring engine output into player-friendly language.
// NO ratios, NO milliseconds, NO biomechanics jargon.
// ============================================================================

import type { SessionMetrics, ComputedScores, FullReport } from './scoring-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EnergyLabel = 'STRONG' | 'OK' | 'LOSING';

export interface PlayerView {
  storyBullets: { base: string; rhythm: string; barrel: string };
  targets: { platformScore: number; swingWindowScore: number; evFloor: number };
  beat: { label: string };
  energyFlow: {
    hipToBody: EnergyLabel;
    bodyToArms: EnergyLabel;
    armsToBarrel: EnergyLabel;
  };
  whatWereBuilding: string[];
  drills: { title: string; description: string }[];
  sections: {
    base: { insight: string; recommendation: string };
    rhythm: { insight: string; recommendation: string };
    barrel: { insight: string; recommendation: string };
    ball: { insight: string; recommendation: string };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function energyLabel(gain: number): EnergyLabel {
  if (gain >= 1.3) return 'STRONG';
  if (gain >= 1.0) return 'OK';
  return 'LOSING';
}

// ─── Story Bullets ──────────────────────────────────────────────────────────

function storyBase(m: SessionMetrics, rootIssue: string): string {
  const tiltSum = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;
  if (rootIssue === 'Glide' || m.com_drift_inches > 7)
    return 'Your body drifts forward before you rotate.';
  if (m.trunk_variability_cv > 20 || tiltSum > 12)
    return 'Your base is inconsistent, so your swing changes each rep.';
  return 'Your base is stable enough to rotate from.';
}

function storyRhythm(m: SessionMetrics): string {
  if (m.pelvis_torso_gap_ms <= 5)
    return 'Your swing fires all at once instead of building.';
  if (m.pelvis_torso_gap_ms <= 20)
    return 'Your rhythm is close, but the swing still rushes.';
  return 'Your swing builds in rhythm (good cascade).';
}

function storyBarrel(m: SessionMetrics): string {
  if (m.arm_bat_gain < 1.0)
    return 'The barrel pulls off early and loses energy.';
  if (m.arm_bat_gain < 1.3)
    return 'The barrel is okay, but it can stay through longer.';
  return 'The barrel stays through the ball (good carry).';
}

// ─── What We're Building ────────────────────────────────────────────────────

const BUILDING_MAP: Record<string, string[]> = {
  Glide: [
    'Build the anchor.',
    'Rotate around a posted front side.',
    'Let the barrel stay through the ball.',
  ],
  'Timing collapse': [
    'Build the rhythm.',
    'Let it build… then fire.',
    'Match the beat to the pitch.',
  ],
  'Barrel pulls off': [
    'Hold the barrel through contact.',
    'Stop steering — let it release.',
    'Keep the barrel in the zone longer.',
  ],
  'Unstable axis': [
    'Stabilize the base.',
    'Make the swing repeatable.',
    'Reduce the wobble so the barrel knows the plane.',
  ],
};

// ─── Drills ─────────────────────────────────────────────────────────────────

const DRILLS_MAP: Record<string, { title: string; description: string }[]> = {
  Glide: [
    {
      title: 'BUILD THE ANCHOR',
      description:
        'Front foot post drill — stride into a posted front leg, feel the stop, then rotate. 3 sets of 10 dry swings.',
    },
    {
      title: 'BUILD THE CASCADE',
      description:
        'Rope or band timing drill — attach a band to a fence, feel the sequence from ground up. 3 sets of 8.',
    },
  ],
  'Timing collapse': [
    {
      title: 'BUILD THE CASCADE',
      description:
        'Rope or band timing drill — slow the sequence down, feel each link in the chain. 3 sets of 8.',
    },
    {
      title: 'BUILD THE RHYTHM',
      description:
        'Constraint timing drill — use a verbal count (1… 2… 3) to separate the phases. 3 sets of 10.',
    },
  ],
  'Barrel pulls off': [
    {
      title: 'BUILD THE ANCHOR',
      description:
        'Front foot post drill — post the front side so the barrel has something to whip around. 3 sets of 10.',
    },
    {
      title: 'BUILD THE RELEASE',
      description:
        'Two-hand connection drill — keep both hands through the zone longer, feel the barrel stay. 3 sets of 8.',
    },
  ],
  'Unstable axis': [
    {
      title: 'BUILD THE ANCHOR',
      description:
        'No-stride stability drill — eliminate the stride, focus on rotating from a solid base. 3 sets of 10.',
    },
    {
      title: 'BUILD THE CASCADE',
      description:
        'Rope or band timing drill — build consistency in the sequence so the barrel finds the same path. 3 sets of 8.',
    },
  ],
};

// ─── Sections ───────────────────────────────────────────────────────────────

function buildSections(m: SessionMetrics, rootIssue: string) {
  const tiltSum = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;

  // BASE
  let baseInsight: string;
  let baseRec: string;
  if (m.com_drift_inches > 7) {
    baseInsight = 'Your body moves forward too much before the swing starts.';
    baseRec = 'Build a stronger post so you rotate instead of slide.';
  } else if (m.trunk_variability_cv > 20 || tiltSum > 12) {
    baseInsight = 'Your base shifts around, so the swing looks different each time.';
    baseRec = 'Build a more stable starting position to make every swing the same.';
  } else {
    baseInsight = 'Your base is solid — good foundation to build on.';
    baseRec = 'Build on this by adding power from the ground up.';
  }

  // RHYTHM
  let rhythmInsight: string;
  let rhythmRec: string;
  if (m.pelvis_torso_gap_ms <= 5) {
    rhythmInsight = 'Everything fires together — the swing doesn\'t build speed.';
    rhythmRec = 'Build separation so each piece adds speed to the next.';
  } else if (m.pelvis_torso_gap_ms <= 20) {
    rhythmInsight = 'The timing is close but still a little rushed.';
    rhythmRec = 'Build patience in the sequence — let it load before it fires.';
  } else {
    rhythmInsight = 'Great rhythm — the swing builds like a whip crack.';
    rhythmRec = 'Build consistency so this timing shows up every swing.';
  }

  // BARREL
  let barrelInsight: string;
  let barrelRec: string;
  if (m.arm_bat_gain < 1.0) {
    barrelInsight = 'The barrel leaves the zone too early, losing power at contact.';
    barrelRec = 'Build a longer barrel path so it stays through the ball.';
  } else if (m.arm_bat_gain < 1.3) {
    barrelInsight = 'The barrel is decent but could stay in the zone longer.';
    barrelRec = 'Build more carry — let the barrel ride through contact.';
  } else {
    barrelInsight = 'The barrel stays through the ball with good carry.';
    barrelRec = 'Build on this by matching it with a consistent base.';
  }

  // BALL
  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  let ballInsight: string;
  let ballRec: string;
  if (evGap > 15) {
    ballInsight = 'Big gap between your best and worst contact — inconsistent.';
    ballRec = 'Build repeatability so every ball comes off the bat hard.';
  } else if (evGap > 8) {
    ballInsight = 'Contact quality is okay but there\'s room to tighten the range.';
    ballRec = 'Build a tighter window so your floor comes up.';
  } else {
    ballInsight = 'Contact is consistent — your floor and ceiling are close.';
    ballRec = 'Build on this by raising the ceiling while keeping the floor.';
  }

  return {
    base: { insight: baseInsight, recommendation: baseRec },
    rhythm: { insight: rhythmInsight, recommendation: rhythmRec },
    barrel: { insight: barrelInsight, recommendation: barrelRec },
    ball: { insight: ballInsight, recommendation: ballRec },
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export function generatePlayerView(
  metrics: SessionMetrics,
  report: FullReport,
): PlayerView {
  const { scores, rootIssue, beat } = report;
  const issue = rootIssue;

  return {
    storyBullets: {
      base: storyBase(metrics, rootIssue),
      rhythm: storyRhythm(metrics),
      barrel: storyBarrel(metrics),
    },
    targets: {
      platformScore: scores.platformScore,
      swingWindowScore: scores.swingWindowScore,
      evFloor: scores.evFloor,
    },
    beat: { label: beat },
    energyFlow: {
      hipToBody: energyLabel(metrics.pelvis_torso_gain),
      bodyToArms: energyLabel(metrics.torso_arm_gain),
      armsToBarrel: energyLabel(metrics.arm_bat_gain),
    },
    whatWereBuilding: BUILDING_MAP[issue] ?? [
      'Keep building consistency.',
      'Stay locked in on the process.',
    ],
    drills: DRILLS_MAP[issue] ?? [
      { title: 'GENERAL WORK', description: 'Continue with your current drill plan.' },
      { title: 'TEE WORK', description: 'Focus on quality reps off the tee.' },
    ],
    sections: buildSections(metrics, rootIssue),
  };
}
