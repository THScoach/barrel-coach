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

function getPillarExplanation(pillar: string, score: number | null): string {
  const label = pillarLabel(score);
  return PILLAR_EXPLANATIONS[pillar]?.[label] ?? 'No data available for this pillar.';
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

  // --- Predictions ---
  const predictions: PredictionTile[] = [
    {
      label: 'Predicted Bat Speed',
      value: session.predicted_bat_speed_mph != null
        ? `${Math.round(session.predicted_bat_speed_mph)} mph`
        : 'N/A',
      subLabel: session.predicted_bat_speed_mph != null
        ? 'What your body is built to create when things click.'
        : 'Need more data to predict this.',
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
        ? `${Math.round(session.predicted_exit_velocity_mph)} mph`
        : 'N/A',
      subLabel: session.predicted_exit_velocity_mph != null
        ? 'How hard the ball should come off when you square it.'
        : 'Need more data to predict this.',
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
      explanation: getPillarExplanation('BRAIN', brain),
      color: pillarColor(brain),
    },
    {
      pillar: 'BODY',
      question: 'How is your body loading?',
      score: body,
      label: pillarLabel(body),
      explanation: getPillarExplanation('BODY', body),
      color: pillarColor(body),
    },
    {
      pillar: 'BAT',
      question: 'How well do you get the barrel there?',
      score: bat,
      label: pillarLabel(bat),
      explanation: getPillarExplanation('BAT', bat),
      color: pillarColor(bat),
    },
    {
      pillar: 'BALL',
      question: 'What kind of contact should we expect?',
      score: ball,
      label: pillarLabel(ball),
      explanation: getPillarExplanation('BALL', ball),
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
