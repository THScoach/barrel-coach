/**
 * Coaching Report Utility
 * 
 * Takes player_session data (backed by ScoringResult v2) and produces:
 * 1. Prediction tiles (bat speed, entry type, exit velo)
 * 2. Actual vs predicted gap summary
 * 3. Weakest pillar coaching (explanation + drills)
 * 4. "If this improves…" projection string
 *
 * All language is 5th–8th grade reading level. No biomech jargon.
 */

import {
  getWeakestLinkInfo,
  getWeakestPillar,
  weakestLinkExplanations,
  type WeakestLinkInfo,
} from './coachingLanguage';

// ---------------------------------------------------------------------------
// Types for the report modal
// ---------------------------------------------------------------------------

export interface PredictionTile {
  label: string;
  value: string;
  subLabel: string;
  available: boolean;
}

export interface ActualVsPredicted {
  metric: string;
  actual: number;
  predicted: number;
  unit: string;
  gap: number; // positive = leaving on the table
}

export interface PillarQuestion {
  pillar: 'BODY' | 'BRAIN' | 'BAT' | 'BALL';
  question: string;
  score: number | null;
  label: string;
  explanation: string;
  color: string;
}

export interface CoachingRecommendation {
  title: string;
  explanation: string;
  drills: { name: string; prescription: string }[];
  pillar: string;
}

export interface ProjectionResult {
  text: string;
  fromScore: number;
  toScore: number;
  evGain: number;
}

export interface CoachingReportData {
  predictions: PredictionTile[];
  hasActuals: boolean;
  actuals: ActualVsPredicted[];
  gapSummary: string;
  noActualsMessage: string;
  pillarQuestions: PillarQuestion[];
  coaching: CoachingRecommendation;
  projection: ProjectionResult;
  overallScore: number;
  overallRating: string;
}

// ---------------------------------------------------------------------------
// Session data shape (from player_sessions table)
// ---------------------------------------------------------------------------

export interface SessionScoreData {
  overall_score: number | null;
  body_score: number | null;
  brain_score: number | null;
  bat_score: number | null;
  ball_score: number | null;
  rating: string | null;
  scoring_mode: string | null;
  predicted_bat_speed_mph: number | null;
  predicted_exit_velocity_mph: number | null;
  predicted_entry_bucket: string | null;
  actual_bat_speed_mph: number | null;
  actual_exit_velocity_mph: number | null;
  actual_entry_bucket: string | null;
  leak_type: string | null;
  weakest_link: string | null;
  transfer_ratio: number | null;
  timing_gap_pct: number | null;
  creation_score: number | null;
  transfer_score: number | null;
  score_4bkrs: number | null;
  bat_speed_source: string | null;
  bat_speed_confidence: string | null;
  raw_metrics?: Record<string, any> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pillarLabel(score: number | null): string {
  if (score == null) return 'No data';
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Plus';
  if (score >= 70) return 'Average';
  if (score >= 60) return 'Fringe';
  if (score >= 45) return 'Below avg';
  return 'Poor';
}

function getTierLabel(score: number): string {
  if (score >= 80) return 'Elite';
  if (score >= 65) return 'Above avg';
  if (score >= 55) return 'Fringe';
  if (score >= 45) return 'Below avg';
  return 'Poor';
}

function pillarColor(score: number | null): string {
  if (score == null) return '#64748b';
  if (score >= 80) return '#4ecdc4';
  if (score >= 60) return '#ffa500';
  return '#ff6b6b';
}

const PILLAR_EXPLANATIONS: Record<string, Record<string, string>> = {
  BRAIN: {
    Elite: 'Your timing is locked in. You get on time, every time.',
    Plus: 'Timing is sharp. Small rhythm tweaks away from elite.',
    Average: 'Timing is okay but inconsistent. Some swings are late, some early.',
    Fringe: 'Timing is costing you at-bats. You\'re often early or late.',
    'Below avg': 'Timing is off. Your body can\'t fire if you\'re not on time.',
    Poor: 'Timing needs major work. This is the priority fix.',
  },
  BODY: {
    Elite: 'Your body loads and fires like a pro. Energy is flowing.',
    Plus: 'Body is working well. Small leaks to clean up.',
    Average: 'Decent loading but you\'re losing energy along the way.',
    Fringe: 'Body isn\'t loading enough. Not enough power getting created.',
    'Below avg': 'Body is leaking energy. You\'re not coiling or braking well.',
    Poor: 'Body isn\'t generating power. This is the foundation to fix.',
  },
  BAT: {
    Elite: 'The barrel gets to the right spot every time. Clean delivery.',
    Plus: 'Good barrel delivery. Minor path issues to clean up.',
    Average: 'Barrel gets there sometimes but the path is inconsistent.',
    Fringe: 'Barrel delivery is breaking down. Energy dies before contact.',
    'Below avg': 'Your hands are doing too much. The bat isn\'t being fed by your body.',
    Poor: 'Barrel delivery needs a complete reset. Drills are critical.',
  },
  BALL: {
    Elite: 'Contact quality is elite. Hard, well-placed hits.',
    Plus: 'Good contact. You\'re squaring balls up consistently.',
    Average: 'Contact is okay. Some hard hits, some weak ones.',
    Fringe: 'Weak contact too often. Your mechanics aren\'t producing results yet.',
    'Below avg': 'Expected contact quality is poor based on how your body moves.',
    Poor: 'Contact will be weak until the other pillars improve.',
  },
};

function getGenericPillarExplanation(pillar: string, score: number | null): string {
  const label = pillarLabel(score);
  return PILLAR_EXPLANATIONS[pillar]?.[label] ?? 'No data available for this pillar.';
}

// ---------------------------------------------------------------------------
// Classification-Aware Description Logic
// ---------------------------------------------------------------------------

function getBodyDescription(bodyScore: number, rawMetrics: any): { label: string; description: string } {
  try {
    const classification = rawMetrics?.pelvis_classification?.classification ?? rawMetrics?.pelvis_classification;
    const transferRatio = rawMetrics?.transfer_ratio ?? rawMetrics?.energy_ledger?.transfer_ratio;

    switch (classification) {
      case 'DEAD_PELVIS':
        return { label: getTierLabel(bodyScore), description: "Pelvis isn't producing enough force. Train ground connection and posterior chain loading." };
      case 'LATE_PELVIS':
        return { label: getTierLabel(bodyScore), description: "Your pelvis has real velocity but it peaks AFTER your torso. The energy exists but shows up late — the fix is about WHEN it fires, not how hard. Train initiation timing." };
      case 'EARLY_PELVIS':
        return { label: getTierLabel(bodyScore), description: "Pelvis opens too early during the stride. Rotation budget is spent before foot plant — train pelvic stability." };
      case 'SPENT_PELVIS':
        return { label: getTierLabel(bodyScore), description: "Pelvis had energy but it dissipated before contact. Train containment — hold the energy longer." };
      case 'JUMP_PELVIS':
        return { label: getTierLabel(bodyScore), description: "Energy is all forward movement, zero rotation. Train rotational conversion — the body needs to turn, not jump." };
      case 'HEALTHY_PELVIS':
        if (transferRatio != null && transferRatio < 1.0) {
          return { label: getTierLabel(bodyScore), description: "Pelvis is healthy but torso is losing energy at the handoff. Transfer ratio below 1.0 — brake mechanism needs work." };
        } else if (transferRatio != null && transferRatio > 1.8) {
          return { label: getTierLabel(bodyScore), description: "Strong energy chain but torso may be over-rotating relative to pelvis. Monitor for runaway torso pattern." };
        } else {
          return { label: getTierLabel(bodyScore), description: "Energy chain is working. Pelvis loads, transfers, and the torso amplifies. Keep building consistency." };
        }
    }
  } catch (e) {
    console.error("Error generating Body description:", e);
  }
  return { label: pillarLabel(bodyScore), description: getGenericPillarExplanation('BODY', bodyScore) };
}

function getBrainDescription(brainScore: number, rawMetrics: any): { label: string; description: string } {
  try {
    const sequenceCorrect = rawMetrics?.sequence_correct ?? (rawMetrics?.beat === '1-2-3');
    const timingGapPct = rawMetrics?.timing_gap_pct ?? rawMetrics?.scores?.core_flow?.components?.timing_gap_pct;

    if (sequenceCorrect === false) {
      return { label: getTierLabel(brainScore), description: "Sequence is inverted — torso fires before pelvis. This is the priority fix before anything else." };
    } else if (timingGapPct !== undefined && timingGapPct !== null) {
      if (Math.abs(timingGapPct) < 5) {
        return { label: getTierLabel(brainScore), description: "Sequence is correct but segments fire almost simultaneously. Need more separation between pelvis and torso peaks." };
      } else if (Math.abs(timingGapPct) >= 14 && Math.abs(timingGapPct) <= 18) {
        return { label: getTierLabel(brainScore), description: "Timing separation is in the elite range. Pelvis leads torso with optimal gap — this is working." };
      } else if (Math.abs(timingGapPct) > 18 && Math.abs(timingGapPct) <= 25) {
        return { label: getTierLabel(brainScore), description: "Timing is correct but the gap between pelvis and torso is wider than ideal. Energy loses momentum in the gap." };
      } else if (Math.abs(timingGapPct) > 25) {
        return { label: getTierLabel(brainScore), description: "Timing gap is too wide — pelvis fires but torso is late to catch up. Energy dissipates in the gap." };
      }
    }
  } catch (e) {
    console.error("Error generating Brain description:", e);
  }
  return { label: pillarLabel(brainScore), description: getGenericPillarExplanation('BRAIN', brainScore) };
}

function getBatDescription(batScore: number, rawMetrics: any): { label: string; description: string } {
  try {
    // Check for energy archetype first (from future archetype classification)
    const archetype = rawMetrics?.energy_archetype ?? rawMetrics?.predicted_contact?.energy_archetype;
    if (archetype) {
      const archetypeDescriptions: Record<string, string> = {
        'SPIKE': "Max effort barrel — long path, pull-dominant. High exit velo ceiling but higher miss rate. The barrel commits early and stays committed.",
        'FLAT': "Controlled barrel — short path, all fields. Moderate exit velo but the barrel finds the sweet spot more often than anyone. Consistency over power.",
        'RAMP': "Progressive barrel — builds through the zone. High exit velo AND high consistency. The barrel accelerates smoothly instead of spiking.",
        'LATE_SPIKE': "Late-commit barrel — steep entry, flat through zone. The barrel waits until the last moment then flattens through contact. Enables elite pitch selection.",
        'HIGH_UNSTABLE': "High-ceiling barrel — elite when the platform is locked, inconsistent when it varies. The barrel path drifts with platform stability.",
        'LOW_FLAT': "Precision barrel — minimal energy, maximum placement. Contact-first approach with limited power upside.",
        'BROKEN': "The barrel is working independently from the body. Arms are compensating for a chain that isn't delivering. Fix the chain, the barrel follows.",
      };
      const desc = archetypeDescriptions[archetype];
      if (desc) return { label: getTierLabel(batScore), description: desc };
    }

    // Fallback: root cause and arms KE logic
    const rootCause = rawMetrics?.root_cause?.build;
    const armsKePct = rawMetrics?.arms_ke_pct ?? rawMetrics?.energy_ledger?.arms_ke_ratio;

    if (rootCause === 'pelvis_force' || rootCause === 'pelvis_initiation') {
      return { label: getTierLabel(batScore), description: "Bat score is limited by pelvis — fix the body first and bat delivery will improve." };
    }
    if (armsKePct !== undefined && armsKePct !== null) {
      if (armsKePct > 0.45) {
        return { label: getTierLabel(batScore), description: "Arms are doing too much of the work. The barrel needs to be fed by the body, not the hands." };
      } else if (armsKePct < 0.15) {
        return { label: getTierLabel(batScore), description: "Arms are too passive. Good body connection but the hands need to release through the zone." };
      }
    }
  } catch (e) {
    console.error("Error generating Bat description:", e);
  }
  return { label: pillarLabel(batScore), description: getGenericPillarExplanation('BAT', batScore) };
}

function getBallDescription(ballScore: number | null, rawMetrics: any): { label: string; description: string } {
  try {
    const pc = rawMetrics?.predicted_contact;
    const compensation = pc?.primary_compensation;

    if (compensation) {
      const compensationMessages: Record<string, string> = {
        'ARMS_DOMINANT': "Your body is built for opposite-field contact right now. You're producing pop-ups and ground balls instead of line drives because energy dies at the torso handoff and your arms take over. That shortens the swing plane — the barrel gets there late and leaves early. Fix the transfer and the barrel stays in the zone longer — more line drives, less pop-ups.",
        'STABILITY': "Your body is built for pull-side ground balls right now. Your lower half opens too early, leaking power before contact. The barrel dumps into the zone and sweeps across. Fix your balance and your body holds power longer — harder contact, more drives in the air.",
        'TRANSLATIONAL': "Your body is built for opposite-field contact right now. You're jumping at the ball instead of rotating into it. The barrel gets pushed instead of whipped. Learn to turn that forward energy into rotation and the barrel catches up — more line drives, more power.",
        'SEQUENCE': "Your upper body is firing before your lower half delivers. That makes the barrel drag through the zone — you're getting pull-side ground balls and opposite-field fly balls. Get the hips firing first and the barrel will be on time — harder, more consistent contact.",
        'HEALTHY': "Your body is built for hard line drives to all fields. Your energy transfers from the ground up and the barrel stays in the zone for a long time. Keep building on this — your body is delivering energy the way it should.",
      };
      const desc = compensationMessages[compensation];
      if (desc) return { label: getTierLabel(ballScore ?? 0), description: desc };
    }
  } catch (e) {
    console.error("Error generating Ball description:", e);
  }
  return { label: pillarLabel(ballScore), description: getGenericPillarExplanation('BALL', ballScore) };
}

function getPillarExplanation(pillar: string, score: number | null, rawMetrics?: any): string {
  if (rawMetrics && score != null) {
    switch (pillar) {
      case 'BODY': return getBodyDescription(score, rawMetrics).description;
      case 'BRAIN': return getBrainDescription(score, rawMetrics).description;
      case 'BAT': return getBatDescription(score, rawMetrics).description;
      case 'BALL': return getBallDescription(score, rawMetrics).description;
    }
  }
  return getGenericPillarExplanation(pillar, score);
}

// Default drills by pillar when no specific leak mapping exists
const DEFAULT_DRILLS: Record<string, { name: string; prescription: string }[]> = {
  BODY: [
    { name: 'Hip Hinge Drill', prescription: '3 sets × 8 reps' },
    { name: 'Step and Turn', prescription: '3 sets × 5 swings' },
    { name: 'Med Ball Rotations', prescription: '3 sets × 10 throws' },
  ],
  BRAIN: [
    { name: 'Tempo Tees', prescription: '3 sets × 5 swings' },
    { name: 'Rhythm Drill', prescription: '2 sets × 10 swings' },
    { name: 'Timing Chain', prescription: '3 sets × 5 reps' },
  ],
  BAT: [
    { name: 'Connection Ball', prescription: '3 sets × 5 swings' },
    { name: 'Towel Drill', prescription: '3 sets × 8 reps' },
    { name: 'Knob to Ball', prescription: '3 sets × 5 swings' },
  ],
  BALL: [
    { name: 'Tee Exit Speed', prescription: '3 sets × 5 swings' },
    { name: 'Front Toss Focus', prescription: '2 rounds × 10 pitches' },
    { name: 'Quality At-Bat Drill', prescription: '2 rounds × 8 swings' },
  ],
};

// Drill prescriptions when we know the leak type
const DRILL_PRESCRIPTIONS: Record<string, string> = {
  'Connection Ball': '3 sets × 5 swings',
  'Towel Drill': '3 sets × 8 reps',
  'Overload/Underload': '2 sets × 5 each',
  'Step and Turn': '3 sets × 5 swings',
  'Wall Drill': '3 sets × 10 seconds',
  'Front Foot Block': '3 sets × 5 reps',
  'Hip Hinge Drill': '3 sets × 8 reps',
  'Load and Hold': '3 × 10 seconds',
  'Depth Jumps': '3 sets × 5 reps',
  'Separation Drill': '3 sets × 5 swings',
  'Hip Lead Toss': '3 sets × 5 reps',
  'Quan Ropes': '3 sets × 8 reps',
  'Med Ball Rotations': '3 sets × 10 throws',
  'Overspeed Training': '2 sets × 5 swings',
  'Tempo Tees': '3 sets × 5 swings',
  'Rhythm Drill': '2 sets × 10 swings',
  'Quick Hands': '3 sets × 5 reps',
  'Hip Lead Drill': '3 sets × 5 reps',
  'Separation Holds': '3 × 10 seconds',
  'Knob to Ball': '3 sets × 5 swings',
  'Short Bat Drill': '2 sets × 8 swings',
  'Tee Exit Speed': '3 sets × 5 swings',
  'Overload Bat': '2 sets × 5 swings',
  'Extension Drill': '3 sets × 5 reps',
  'Core Flow Drill': '3 sets × 8 reps',
};

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildCoachingReport(session: SessionScoreData): CoachingReportData {
  const overall = session.score_4bkrs ?? session.overall_score ?? 0;
  const body = session.body_score ?? 0;
  const brain = session.brain_score ?? 0;
  const bat = session.bat_score ?? 0;
  const ball = session.ball_score;
  const rawMetrics = session.raw_metrics;

  // --- Predictions ---
  const isEstimation = session.bat_speed_confidence === 'low';
  const batSpeedPrefix = isEstimation ? '~' : '';
  const batSpeedNote = isEstimation
    ? 'Estimated from swing mechanics — add sensor data for precision.'
    : session.bat_speed_confidence === 'medium'
      ? 'From bat tracking data.'
      : session.bat_speed_confidence === 'high'
        ? 'Measured by sensor.'
        : 'Estimated from swing mechanics.';

  const predictions: PredictionTile[] = [
    {
      label: 'Predicted Bat Speed',
      value: session.predicted_bat_speed_mph != null
        ? `${batSpeedPrefix}${Math.round(session.predicted_bat_speed_mph)} mph`
        : 'N/A',
      subLabel: session.predicted_bat_speed_mph != null
        ? batSpeedNote
        : 'Value out of range — rescore needed.',
      available: session.predicted_bat_speed_mph != null,
    },
    {
      label: 'Predicted Swing Entry',
      value: session.predicted_entry_bucket ?? 'N/A',
      subLabel: session.predicted_entry_bucket
        ? 'The barrel path your body pattern tends to produce.'
        : 'Need more data to predict this.',
      available: session.predicted_entry_bucket != null,
    },
    {
      label: 'Predicted Exit Velo',
      value: session.predicted_exit_velocity_mph != null
        ? `${isEstimation ? '~' : ''}${Math.round(session.predicted_exit_velocity_mph)} mph`
        : 'N/A',
      subLabel: session.predicted_exit_velocity_mph != null
        ? 'How hard the ball should come off when you square it.'
        : 'Value out of range — rescore needed.',
      available: session.predicted_exit_velocity_mph != null,
    },
  ];

  // --- Actuals vs Predicted ---
  const hasActuals = session.actual_bat_speed_mph != null || session.actual_exit_velocity_mph != null;
  const actuals: ActualVsPredicted[] = [];

  if (session.actual_bat_speed_mph != null && session.predicted_bat_speed_mph != null) {
    actuals.push({
      metric: 'Bat Speed',
      actual: session.actual_bat_speed_mph,
      predicted: session.predicted_bat_speed_mph,
      unit: 'mph',
      gap: Math.round(session.predicted_bat_speed_mph - session.actual_bat_speed_mph),
    });
  }

  if (session.actual_exit_velocity_mph != null && session.predicted_exit_velocity_mph != null) {
    actuals.push({
      metric: 'Exit Velo',
      actual: session.actual_exit_velocity_mph,
      predicted: session.predicted_exit_velocity_mph,
      unit: 'mph',
      gap: Math.round(session.predicted_exit_velocity_mph - session.actual_exit_velocity_mph),
    });
  }

  // Gap summary
  let gapSummary = '';
  if (actuals.length > 0) {
    const biggestGap = actuals.reduce((max, a) => Math.abs(a.gap) > Math.abs(max.gap) ? a : max);
    if (biggestGap.gap > 0) {
      gapSummary = `Your body has about +${biggestGap.gap} ${biggestGap.unit} of ${biggestGap.metric.toLowerCase()} left on the table.`;
    } else if (biggestGap.gap < 0) {
      gapSummary = `You're actually outperforming your body's prediction by ${Math.abs(biggestGap.gap)} ${biggestGap.unit} on ${biggestGap.metric.toLowerCase()}. Nice.`;
    } else {
      gapSummary = `Your actual ${biggestGap.metric.toLowerCase()} matches your body's prediction. Clean transfer.`;
    }
  }

  const noActualsMessage =
    "No bat/ball tracking on this session. We're showing what your body is built to do — add DK, HitTrax, or Statcast data to see actual vs predicted.";

  // --- Pillar Questions ---
  const pillarQuestions: PillarQuestion[] = [
    {
      pillar: 'BRAIN',
      question: 'How is your timing?',
      score: brain,
      label: pillarLabel(brain),
      explanation: getPillarExplanation('BRAIN', brain, rawMetrics),
      color: pillarColor(brain),
    },
    {
      pillar: 'BODY',
      question: 'How is your body loading?',
      score: body,
      label: pillarLabel(body),
      explanation: getPillarExplanation('BODY', body, rawMetrics),
      color: pillarColor(body),
    },
    {
      pillar: 'BAT',
      question: 'How well do you get the barrel there?',
      score: bat,
      label: pillarLabel(bat),
      explanation: getPillarExplanation('BAT', bat, rawMetrics),
      color: pillarColor(bat),
    },
    {
      pillar: 'BALL',
      question: 'What kind of contact should we expect?',
      score: ball,
      label: pillarLabel(ball),
      explanation: getPillarExplanation('BALL', ball, rawMetrics),
      color: pillarColor(ball),
    },
  ];

  // --- Coaching Recommendation ---
  const leakType = session.leak_type ?? session.weakest_link;
  const leakInfo = getWeakestLinkInfo(leakType ?? '');
  const weakest = getWeakestPillar(body, brain, bat, ball);
  
  let coaching: CoachingRecommendation;
  if (leakInfo && leakType !== 'clean_transfer') {
    coaching = {
      title: leakInfo.title,
      explanation: leakInfo.explanation,
      drills: leakInfo.drills.slice(0, 3).map(name => ({
        name,
        prescription: DRILL_PRESCRIPTIONS[name] ?? '3 sets × 5 reps',
      })),
      pillar: leakInfo.pillar,
    };
  } else if (weakest) {
    const pillar = weakest.pillar;
    const fallbackLeaks: Record<string, string> = {
      BODY: 'low_transfer_ratio',
      BRAIN: 'timing_gap_wide',
      BAT: 'no_bat_delivery',
      BALL: 'no_bat_delivery',
    };
    const fallbackInfo = weakestLinkExplanations[fallbackLeaks[pillar] ?? 'no_bat_delivery'];
    coaching = {
      title: fallbackInfo?.title ?? 'Biggest Opportunity',
      explanation: fallbackInfo?.explanation ?? 'Focus on your weakest area to unlock the most improvement.',
      drills: (DEFAULT_DRILLS[pillar] ?? DEFAULT_DRILLS.BODY).slice(0, 3),
      pillar,
    };
  } else {
    coaching = {
      title: 'Keep Building',
      explanation: "Your swing is working. Keep training and let's push for the next level.",
      drills: DEFAULT_DRILLS.BODY.slice(0, 2),
      pillar: 'BODY',
    };
  }

  // --- Projection ---
  const projection = computeProjection(session);

  return {
    predictions,
    hasActuals,
    actuals,
    gapSummary,
    noActualsMessage,
    pillarQuestions,
    coaching,
    projection,
    overallScore: overall,
    overallRating: session.rating ?? pillarLabel(overall),
  };
}

// ---------------------------------------------------------------------------
// "If this improves…" Projection
// ---------------------------------------------------------------------------

function computeProjection(session: SessionScoreData): ProjectionResult {
  const body = session.body_score ?? 0;
  const brain = session.brain_score ?? 0;
  const bat = session.bat_score ?? 0;
  const ball = session.ball_score ?? 0;
  const overall = session.score_4bkrs ?? session.overall_score ?? 0;

  // Find weakest pillar
  const pillars = [
    { name: 'Body', score: body, weight: 0.45 },
    { name: 'Brain', score: brain, weight: 0.15 },
    { name: 'Bat', score: bat, weight: 0.25 },
    { name: 'Ball', score: ball, weight: 0.15 },
  ];
  const weakest = pillars.reduce((min, p) => p.score < min.score ? p : min);

  // Simulate a +20 point improvement in weakest pillar
  const improvement = Math.min(20, 100 - weakest.score);
  const newPillarScore = weakest.score + improvement;
  const scoreDelta = Math.round(improvement * weakest.weight);
  const newOverall = Math.min(100, overall + scoreDelta);

  // Estimate EV gain: ~0.5 mph per overall point
  const evGain = Math.round(scoreDelta * 0.5);

  const predictedEV = session.predicted_exit_velocity_mph ?? 0;
  const newEV = Math.round(predictedEV + evGain);

  const text = `If we move ${weakest.name} from ${weakest.score} → ${newPillarScore}, your predicted exit velo climbs from ${Math.round(predictedEV)} → ${newEV} and your overall score from ${overall} → ${newOverall}.`;

  return {
    text,
    fromScore: overall,
    toScore: newOverall,
    evGain,
  };
}
