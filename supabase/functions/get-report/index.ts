import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fallback mock data for sections we don't have real data for yet
const mockSections = {
  kinetic_potential: {
    ceiling: 85,
    current: 70,
  },
  primary_leak: {
    present: false,
    title: 'Analysis Pending',
    description: 'Detailed leak analysis will be available after video review.',
    why_it_matters: 'Understanding your primary leak helps prioritize training.',
  },
  fix_order: [],
  do_not_chase: [],
  square_up_window: { present: false },
  weapon_panel: { present: false },
  ball_panel: { present: false },
  drills: [],
  session_history: [],
  badges: [],
  coach_note: {
    present: false,
    text: 'Coach notes will be added after review.',
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

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query reboot_uploads for the session scores
    // Using reboot_uploads.id as the report identifier
    const { data: rebootData, error: rebootError } = await supabase
      .from('reboot_uploads')
      .select(`
        id,
        player_id,
        session_date,
        body_score,
        brain_score,
        bat_score,
        composite_score,
        grade,
        weakest_link,
        pelvis_velocity,
        torso_velocity,
        x_factor,
        bat_ke,
        transfer_efficiency,
        ground_flow_score,
        core_flow_score,
        upper_flow_score,
        consistency_cv,
        consistency_grade,
        created_at
      `)
      .eq('id', sessionId)
      .single();

    if (rebootError || !rebootData) {
      console.error('Error fetching reboot data:', rebootError);
      return new Response(
        JSON.stringify({ error: 'Report not found', details: rebootError?.message }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get player info if available
    let playerInfo: { name: string; age: number | null; level: string | null; handedness: string | null } = { 
      name: 'Player', 
      age: null, 
      level: null, 
      handedness: null 
    };
    if (rebootData.player_id) {
      const { data: playerData } = await supabase
        .from('players')
        .select('name, age, level, handedness')
        .eq('id', rebootData.player_id)
        .single();
      
      if (playerData) {
        playerInfo = {
          name: playerData.name || 'Player',
          age: playerData.age,
          level: playerData.level,
          handedness: playerData.handedness === 'left' ? 'L' : playerData.handedness === 'right' ? 'R' : null,
        };
      }
    }

    // Try to get previous session for delta calculation
    let deltas = { body: 0, brain: 0, bat: 0, ball: 0, composite: 0 };
    if (rebootData.player_id) {
      const { data: prevSession } = await supabase
        .from('reboot_uploads')
        .select('body_score, brain_score, bat_score, composite_score')
        .eq('player_id', rebootData.player_id)
        .lt('created_at', rebootData.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (prevSession) {
        deltas = {
          body: (rebootData.body_score || 0) - (prevSession.body_score || 0),
          brain: (rebootData.brain_score || 0) - (prevSession.brain_score || 0),
          bat: (rebootData.bat_score || 0) - (prevSession.bat_score || 0),
          ball: 0, // No ball score in reboot_uploads
          composite: Math.round(((rebootData.composite_score || 0) - (prevSession.composite_score || 0)) * 10) / 10,
        };
      }
    }

    // Get session history for progress board
    let sessionHistory: Array<{id: string; date: string; composite_score: number; delta?: number}> = [];
    if (rebootData.player_id) {
      const { data: historyData } = await supabase
        .from('reboot_uploads')
        .select('id, session_date, composite_score, created_at')
        .eq('player_id', rebootData.player_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (historyData && historyData.length > 0) {
        sessionHistory = historyData.map((h, idx, arr) => ({
          id: h.id,
          date: h.session_date,
          composite_score: Math.round(h.composite_score || 0),
          delta: idx < arr.length - 1 
            ? Math.round(((h.composite_score || 0) - (arr[idx + 1]?.composite_score || 0)) * 10) / 10
            : undefined,
        }));
      }
    }

    // Calculate kinetic potential based on actual scores
    const currentScore = Math.round(rebootData.composite_score || 0);
    const ceiling = Math.min(100, currentScore + 15 + Math.floor(Math.random() * 10)); // Estimate ceiling

    // Build the report JSON
    const reportData = {
      session: {
        id: rebootData.id,
        date: rebootData.session_date,
        player: {
          name: playerInfo.name,
          age: playerInfo.age,
          level: playerInfo.level,
          handedness: playerInfo.handedness,
        },
      },
      scores: {
        body: rebootData.body_score || 0,
        brain: rebootData.brain_score || 0,
        bat: rebootData.bat_score || 0,
        ball: 0, // No ball score from Reboot - would come from HitTrax/launch monitor
        composite: Math.round(rebootData.composite_score || 0),
        deltas,
      },
      kinetic_potential: {
        ceiling,
        current: currentScore,
      },
      // Sections not yet populated from real data
      primary_leak: mockSections.primary_leak,
      fix_order: mockSections.fix_order,
      do_not_chase: mockSections.do_not_chase,
      square_up_window: mockSections.square_up_window,
      weapon_panel: mockSections.weapon_panel,
      ball_panel: mockSections.ball_panel,
      drills: mockSections.drills,
      session_history: sessionHistory.length > 0 ? sessionHistory : mockSections.session_history,
      badges: mockSections.badges,
      coach_note: mockSections.coach_note,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to fetch report', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
