import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock report data - snake_case to match frontend contract
const mockReportData = {
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
  kinetic_potential: {
    ceiling: 85,
    current: 70,
  },
  primary_leak: {
    title: 'Early Torso Fire',
    description: 'Your upper body is rotating before your hips finish loading.',
    why_it_matters: 'This robs power from your swing and makes timing harder.',
    frame_url: '/placeholder.svg',
  },
  fix_order: [
    {
      label: 'Ground Connection',
      feel_cue: 'Feel your back foot "grab" the ground before you rotate.',
      completed: true,
    },
    {
      label: 'Hip Lead',
      feel_cue: 'Let your belt buckle turn before your chest.',
      completed: false,
    },
    {
      label: 'Torso Separation',
      feel_cue: 'Feel the stretch across your core like a rubber band.',
      completed: false,
    },
  ],
  do_not_chase: ['hands', 'bat path', 'swing harder'],
  square_up_window: {
    present: true,
    grid: [
      [20, 45, 30],
      [55, 85, 60],
      [25, 40, 20],
    ],
    best_zone: 'Middle-Middle',
    avoid_zone: 'Low-Away',
    coach_note: 'You square up best on pitches middle-in. Avoid chasing low and away.',
  },
  weapon_panel: {
    present: true,
    metrics: [
      { name: 'WIP Index', value: 78, meaning: 'Higher = better whip' },
      { name: 'Plane Integrity', value: 82, meaning: 'Bat stays on plane' },
      { name: 'Square-Up', value: 71, meaning: 'Contact consistency' },
      { name: 'Impact Momentum', value: 68, meaning: 'Power at contact' },
    ],
  },
  ball_panel: {
    present: true,
    projected: {
      present: false,
    },
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
      coaching_cue: 'Load into your back hip, not your back leg.',
      reps: '3 sets of 8',
      loop_url: '/placeholder.svg',
    },
    {
      id: 'drill-2',
      name: 'Separation Holds',
      coaching_cue: 'Pause at max separation for 2 seconds before swinging.',
      reps: '2 sets of 6',
      loop_url: '/placeholder.svg',
    },
    {
      id: 'drill-3',
      name: 'Ground Punch',
      coaching_cue: 'Push your back foot into the ground as you start.',
      reps: '3 sets of 10',
      loop_url: '/placeholder.svg',
    },
  ],
  session_history: [
    { id: 's-1', date: '2026-01-14', composite_score: 70, delta: 3 },
    { id: 's-2', date: '2026-01-07', composite_score: 67, delta: 2 },
    { id: 's-3', date: '2025-12-28', composite_score: 65, delta: -1 },
    { id: 's-4', date: '2025-12-20', composite_score: 66 },
  ],
  badges: [
    { id: 'b-1', name: 'Foundation Fixed', earned: true, earned_date: '2026-01-07' },
    { id: 'b-2', name: 'Engine Online', earned: false },
    { id: 'b-3', name: 'Weapon Unlocked', earned: false },
  ],
  coach_note: {
    text: "Marcus, you're making real progress. Your ground connection is locking in, and I'm starting to see that separation show up naturally. This week, focus on the hip lead drill — that's the unlock. Don't chase bat path or hand position. Trust the process.",
    audio_url: null,
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept sessionId from EITHER query param OR JSON body
    let sessionId: string | null = null;
    
    // Try query param first
    const url = new URL(req.url);
    sessionId = url.searchParams.get('sessionId');
    
    // If not in query, try JSON body
    if (!sessionId && req.method === 'POST') {
      try {
        const body = await req.json();
        sessionId = body.sessionId || null;
      } catch {
        // Body parsing failed, continue with null sessionId
      }
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'sessionId is required (query param or JSON body)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For now, return mock data regardless of sessionId
    // TODO: Fetch real data from database based on sessionId
    const reportData = {
      ...mockReportData,
      session: {
        ...mockReportData.session,
        id: sessionId,
      },
    };

    return new Response(
      JSON.stringify(reportData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error fetching report:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch report' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
