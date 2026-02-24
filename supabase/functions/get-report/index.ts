import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// Report Endpoint: Fetches real session data from reboot_uploads
// 
// REPORT ID RULE: sessionId = reboot_uploads.id (UUID)
// The frontend route /report/:sessionId expects a reboot_uploads UUID.
// ============================================================================

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

    // ========================================================================
    // DUAL-SOURCE LOOKUP: video_2d_sessions first, then reboot_uploads
    // ========================================================================

    // 1. Try video_2d_sessions first
    const { data: v2dData } = await supabase
      .from('video_2d_sessions')
      .select(`
        id, player_id, session_date, composite_score, body_score,
        brain_score, bat_score, ball_score, grade, leak_detected,
        leak_evidence, motor_profile, coach_rick_take, priority_drill,
        analysis_json, processing_status, created_at
      `)
      .eq('id', sessionId)
      .single();

    if (v2dData) {
      // Found in video_2d_sessions
      if (v2dData.processing_status !== 'complete') {
        return new Response(
          JSON.stringify({ processing: true, status: v2dData.processing_status }),
          { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Format leak title: replace underscores with spaces, title case
      const formatLeakTitle = (s: string | null) => {
        if (!s) return undefined;
        return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      };

      const currentScore = Math.round(v2dData.composite_score || 0);
      const ceiling = Math.min(100, currentScore + 15);

      // Get player info
      let playerInfo = { name: 'Player', age: null as number | null, level: null as string | null, handedness: null as string | null };
      if (v2dData.player_id) {
        const { data: pd } = await supabase.from('players').select('name, age, level, handedness').eq('id', v2dData.player_id).single();
        if (pd) {
          playerInfo = { name: pd.name || 'Player', age: pd.age, level: pd.level, handedness: pd.handedness === 'left' ? 'L' : pd.handedness === 'right' ? 'R' : null };
        }
      }

      const analysisJson = v2dData.analysis_json as Record<string, any> | null;
      const visibleMetrics = analysisJson?.visible_metrics || {};
      const bodyComponents = analysisJson?.body_components || {};
      const brainComponents = analysisJson?.brain_components || {};
      const batComponents = analysisJson?.bat_components || {};

      const reportData = {
        contract_version: '2026-01-14',
        generated_at: new Date().toISOString(),
        session: {
          id: v2dData.id,
          date: v2dData.session_date,
          player: playerInfo,
        },
        scores: {
          body: v2dData.body_score || 0,
          brain: v2dData.brain_score || 0,
          bat: v2dData.bat_score || 0,
          ball: v2dData.ball_score || 0,
          composite: currentScore,
          deltas: { body: 0, brain: 0, bat: 0, ball: 0, composite: 0 },
        },
        kinetic_potential: { present: true, ceiling, current: currentScore },

        motor_profile: analysisJson?.motor_profile ? {
          present: true,
          profile: analysisJson.motor_profile,
          evidence: analysisJson.profile_evidence,
          mlb_match: null,
        } : { present: false },

        energy_leak: v2dData.leak_detected ? {
          present: true,
          title: formatLeakTitle(v2dData.leak_detected),
          description: v2dData.leak_evidence,
          why_it_matters: analysisJson?.coach_rick_take,
          severity: 'primary',
        } : { present: false },

        primary_leak: v2dData.leak_detected ? {
          present: true,
          title: formatLeakTitle(v2dData.leak_detected),
          description: v2dData.leak_evidence,
          why_it_matters: analysisJson?.coach_rick_take,
          frame_url: undefined,
          loop_url: undefined,
        } : { present: false },

        prescription: v2dData.priority_drill ? {
          present: true,
          items: [{
            name: v2dData.priority_drill,
            focus: formatLeakTitle(v2dData.leak_detected) || 'Primary leak',
            reps: '3 sets x 10 reps',
            notes: bodyComponents.notes || batComponents.notes || null,
          }],
        } : { present: false },

        timing: brainComponents.notes ? {
          present: true,
          summary: brainComponents.notes,
          confidence: analysisJson?.confidence || 0.6,
          limitation: '2D estimate — full timing requires 3D sensor data',
        } : { present: false },

        direction: visibleMetrics.stride_direction || visibleMetrics.head_movement ? {
          present: true,
          stride_direction: visibleMetrics.stride_direction,
          head_movement: visibleMetrics.head_movement,
          finish_balance: visibleMetrics.finish_balance,
          front_leg_action: visibleMetrics.front_leg_action,
        } : { present: false },

        structure: visibleMetrics.hip_shoulder_separation_estimate ? {
          present: true,
          hip_shoulder_separation: visibleMetrics.hip_shoulder_separation_estimate,
          spine_angle: visibleMetrics.spine_angle || null,
          camera_angle: analysisJson?.camera_angle || null,
          confidence: analysisJson?.confidence || null,
          limitations: analysisJson?.limitations || [],
        } : { present: false },

        fix_order: { present: false, items: [], do_not_chase: [] },
        square_up_window: { present: false },
        weapon_panel: { present: false, metrics: [] },
        ball_panel: { present: false, is_projected: false, outcomes: [] },
        barrel_sling_panel: { present: false },
        session_history: { present: false, items: [] },
        coach_note: analysisJson?.coach_rick_take ? {
          present: true,
          text: analysisJson.coach_rick_take,
          audio_url: undefined,
        } : { present: false },
        badges: [],
        motor_profile_hint: analysisJson?.motor_profile || v2dData.motor_profile || undefined,
      };

      return new Response(JSON.stringify(reportData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fall back to reboot_uploads
    const { data: rebootData, error: rebootError } = await supabase
      .from('reboot_uploads')
      .select(`
        id, player_id, session_date, body_score, brain_score, bat_score,
        composite_score, grade, weakest_link, pelvis_velocity, torso_velocity,
        x_factor, bat_ke, transfer_efficiency, ground_flow_score,
        core_flow_score, upper_flow_score, consistency_cv, consistency_grade,
        created_at
      `)
      .eq('id', sessionId)
      .single();

    if (rebootError || !rebootData) {
      console.error('Error fetching reboot data:', rebootError);
      return new Response(
        JSON.stringify({ error: 'Report not found', details: rebootError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    // DETERMINISTIC: ceiling = min(100, round(composite_score) + 15) - NO randomness
    const currentScore = Math.round(rebootData.composite_score || 0);
    const ceiling = Math.min(100, currentScore + 15);

    // Determine if we have real session history
    const hasSessionHistory = sessionHistory.length > 0;

    // ========================================================================
    // BARREL SLING INDEX (BSI) CALCULATION
    // Uses available Reboot metrics to compute Load/Start/Deliver scores
    // ========================================================================
    const calculateBarrelSlingIndex = () => {
      const xFactor = rebootData.x_factor;
      const pelvisVelocity = rebootData.pelvis_velocity;
      const torsoVelocity = rebootData.torso_velocity;
      const transferEfficiency = rebootData.transfer_efficiency;
      const consistencyCv = rebootData.consistency_cv;
      const coreFlowScore = rebootData.core_flow_score;
      const upperFlowScore = rebootData.upper_flow_score;
      const groundFlowScore = rebootData.ground_flow_score;

      // Check if we have enough data to calculate
      const hasLoadData = xFactor !== null && xFactor !== undefined;
      const hasStartData = pelvisVelocity !== null && pelvisVelocity !== undefined;
      const hasDeliverData = transferEfficiency !== null || upperFlowScore !== null;

      if (!hasLoadData && !hasStartData && !hasDeliverData) {
        return { present: false };
      }

      // LOAD SCORE: Based on x-factor and core stability
      // Higher x-factor = better hip-shoulder separation in load
      // Typical x-factor range: 30-70 degrees
      let slingLoadScore = 50;
      if (hasLoadData) {
        // Map x-factor (30-70°) to score (40-90)
        slingLoadScore = Math.min(90, Math.max(40, 40 + ((xFactor - 30) / 40) * 50));
        // Boost if core flow is good
        if (coreFlowScore && coreFlowScore > 70) {
          slingLoadScore = Math.min(95, slingLoadScore + 5);
        }
      }

      // START SCORE: Based on pelvis velocity and sequencing
      // Higher pelvis velocity with proper timing = better start
      // Typical pelvis velocity range: 400-800 deg/s
      let slingStartScore = 50;
      if (hasStartData) {
        // Map pelvis velocity (400-800) to score (40-90)
        slingStartScore = Math.min(90, Math.max(40, 40 + ((pelvisVelocity - 400) / 400) * 50));
        // Penalize if torso fires too early (low separation ratio)
        if (torsoVelocity && pelvisVelocity) {
          const separationRatio = pelvisVelocity / torsoVelocity;
          if (separationRatio < 1.1) {
            slingStartScore = Math.max(40, slingStartScore - 10); // Penalty for early torso
          }
        }
        // Boost with ground flow
        if (groundFlowScore && groundFlowScore > 70) {
          slingStartScore = Math.min(95, slingStartScore + 5);
        }
      }

      // DELIVER SCORE: Based on transfer efficiency and upper body control
      // Higher transfer efficiency = better energy transfer to barrel
      let slingDeliverScore = 50;
      if (hasDeliverData) {
        if (transferEfficiency) {
          // Transfer efficiency is typically 0.7-0.95
          slingDeliverScore = Math.min(90, Math.max(40, 40 + ((transferEfficiency - 0.7) / 0.25) * 50));
        } else if (upperFlowScore) {
          // Use upper flow as proxy
          slingDeliverScore = upperFlowScore;
        }
        // Penalize inconsistency
        if (consistencyCv && consistencyCv > 15) {
          slingDeliverScore = Math.max(40, slingDeliverScore - 5);
        }
      }

      // Overall BSI is weighted average: Load 25%, Start 35%, Deliver 40%
      const barrelSlingScore = Math.round(
        slingLoadScore * 0.25 + slingStartScore * 0.35 + slingDeliverScore * 0.40
      );

      // Generate coaching notes based on scores
      const bestPhase = slingLoadScore >= slingStartScore && slingLoadScore >= slingDeliverScore ? 'load' :
                        slingStartScore >= slingDeliverScore ? 'start' : 'deliver';
      const worstPhase = slingLoadScore <= slingStartScore && slingLoadScore <= slingDeliverScore ? 'load' :
                         slingStartScore <= slingDeliverScore ? 'start' : 'deliver';

      const goodNotes: Record<string, string> = {
        load: "Strong hip-shoulder separation in your load creates excellent elastic stretch.",
        start: "Your pelvis initiates the swing well before your torso — textbook sequencing.",
        deliver: "Efficient energy transfer from ground through barrel at contact.",
      };

      const leakNotes: Record<string, string> = {
        load: "Load phase could use more x-factor — work on holding shoulder back longer.",
        start: "Pelvis isn't leading enough — focus on hip-first movement initiation.",
        deliver: "Energy is leaking before contact — maintain lead arm structure through the zone.",
      };

      // Determine confidence level
      const measuredCount = [hasLoadData, hasStartData, hasDeliverData].filter(Boolean).length;
      const confidence = measuredCount >= 2 ? 'measured' : 'estimate';

      return {
        present: true,
        barrel_sling_score: barrelSlingScore,
        sling_load_score: Math.round(slingLoadScore),
        sling_start_score: Math.round(slingStartScore),
        sling_deliver_score: Math.round(slingDeliverScore),
        notes: {
          good: goodNotes[bestPhase],
          leak: leakNotes[worstPhase],
        },
        confidence,
      };
    };

    const barrelSlingPanel = calculateBarrelSlingIndex();

    // ========================================================================
    // Build the report JSON
    // PRODUCTION MODE: No mock content - only real data with present:false for unavailable sections
    // 
    // CANONICAL SCHEMA: All optional sections use { present: boolean } pattern
    // List sections use { present: boolean, items: T[] }
    // ========================================================================
    const reportData = {
      // Contract metadata
      contract_version: '2026-01-14',
      generated_at: new Date().toISOString(),
      
      session: {
        // REPORT ID RULE: session.id = reboot_uploads.id (UUID)
        // The frontend route /report/:sessionId expects a reboot_uploads UUID
        id: rebootData.id,
        date: rebootData.session_date,
        player: {
          name: playerInfo.name,
          age: playerInfo.age,
          level: playerInfo.level,
          handedness: playerInfo.handedness,
        },
      },
      // Scores are always present - core data
      scores: {
        body: rebootData.body_score || 0,
        brain: rebootData.brain_score || 0,
        bat: rebootData.bat_score || 0,
        ball: 0, // No ball score from Reboot - would come from HitTrax/launch monitor
        composite: currentScore,
        deltas,
      },
      // Kinetic Potential - DETERMINISTIC: ceiling = min(100, composite + 15)
      kinetic_potential: {
        present: true,
        ceiling,
        current: currentScore,
      },
      // ========================================================================
      // UNFINISHED SECTIONS: present:false with complete structure
      // Each section follows canonical { present: boolean, ... } pattern
      // ========================================================================
      primary_leak: { present: false, title: undefined, description: undefined, why_it_matters: undefined, frame_url: undefined, loop_url: undefined },
      fix_order: { present: false, items: [], do_not_chase: [] },
      square_up_window: { present: false, grid: undefined, best_zone: undefined, avoid_zone: undefined, coach_note: undefined },
      weapon_panel: { present: false, metrics: [] },
      ball_panel: { present: false, is_projected: false, outcomes: [] },
      // Barrel Sling Index - calculated from Reboot metrics
      barrel_sling_panel: barrelSlingPanel,
      drills: { present: false, items: [] },
      // Session history - only present if we have real data
      session_history: hasSessionHistory 
        ? { present: true, items: sessionHistory }
        : { present: false, items: [] },
      coach_note: { present: false, text: undefined, audio_url: undefined },
      badges: [],
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
