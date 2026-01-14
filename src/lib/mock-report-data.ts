// ============================================================================
// Mock Report Data - Placeholder data for UI development
// ============================================================================

import { SwingReportData } from './report-types';

export const mockReportData: SwingReportData = {
  session: {
    id: 'session-001',
    date: '2026-01-14',
    player: {
      name: 'Marcus Johnson',
      age: 14,
      level: '14U',
      handedness: 'R',
    },
  },
  scores: {
    body: 72,
    brain: 68,
    bat: 75,
    ball: 64,
    composite: 70,
    deltas: {
      body: 4,
      brain: 2,
      bat: -1,
      ball: 6,
      composite: 3,
    },
  },
  kineticPotential: {
    ceiling: 85,
    current: 70,
  },
  primaryLeak: {
    title: 'Early Torso Fire',
    description: 'Your upper body is rotating before your hips finish loading.',
    whyItMatters: 'This robs power from your swing and makes timing harder.',
    frameUrl: '/placeholder.svg',
  },
  fixOrder: [
    {
      label: 'Ground Connection',
      feelCue: 'Feel your back foot "grab" the ground before you rotate.',
      completed: true,
    },
    {
      label: 'Hip Lead',
      feelCue: 'Let your belt buckle turn before your chest.',
      completed: false,
    },
    {
      label: 'Torso Separation',
      feelCue: 'Feel the stretch across your core like a rubber band.',
      completed: false,
    },
  ],
  doNotChase: ['hands', 'bat path', 'swing harder'],
  squareUpWindow: {
    present: true,
    grid: [
      [20, 45, 30],
      [55, 85, 60],
      [25, 40, 20],
    ],
    bestZone: 'Middle-Middle',
    avoidZone: 'Low-Away',
    coachNote: 'You square up best on pitches middle-in. Avoid chasing low and away.',
  },
  diamondKinetics: {
    present: true,
    metrics: [
      { name: 'WIP Index', value: 78, meaning: 'Higher = better whip' },
      { name: 'Plane Integrity', value: 82, meaning: 'Bat stays on plane' },
      { name: 'Square-Up', value: 71, meaning: 'Contact consistency' },
      { name: 'Impact Momentum', value: 68, meaning: 'Power at contact' },
    ],
  },
  ballData: {
    present: true,
    isProjected: false,
    outcomes: [
      { name: 'Exit Velo', value: 78, unit: 'mph' },
      { name: 'Launch Angle', value: 12, unit: '°' },
      { name: 'Barrel Rate', value: 18, unit: '%' },
    ],
  },
  drills: [
    {
      id: 'drill-1',
      name: 'Hip Hinge Load',
      coachingCue: 'Load into your back hip, not your back leg.',
      reps: '3 sets of 8',
      loopUrl: '/placeholder.svg',
    },
    {
      id: 'drill-2',
      name: 'Separation Holds',
      coachingCue: 'Pause at max separation for 2 seconds before swinging.',
      reps: '2 sets of 6',
      loopUrl: '/placeholder.svg',
    },
    {
      id: 'drill-3',
      name: 'Ground Punch',
      coachingCue: 'Push your back foot into the ground as you start.',
      reps: '3 sets of 10',
      loopUrl: '/placeholder.svg',
    },
  ],
  sessionHistory: [
    { id: 's-1', date: '2026-01-14', compositeScore: 70, delta: 3 },
    { id: 's-2', date: '2026-01-07', compositeScore: 67, delta: 2 },
    { id: 's-3', date: '2025-12-28', compositeScore: 65, delta: -1 },
    { id: 's-4', date: '2025-12-20', compositeScore: 66 },
  ],
  badges: [
    { id: 'b-1', name: 'Foundation Fixed', earned: true, earnedDate: '2026-01-07' },
    { id: 'b-2', name: 'Engine Online', earned: false },
    { id: 'b-3', name: 'Weapon Unlocked', earned: false },
  ],
  coachNote: {
    text: "Marcus, you're making real progress. Your ground connection is locking in, and I'm starting to see that separation show up naturally. This week, focus on the hip lead drill — that's the unlock. Don't chase bat path or hand position. Trust the process.",
    audioUrl: undefined,
  },
};
