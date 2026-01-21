// ============================================================================
// RECOVER GHOST SESSION
// Takes ghost session context (environment, pitch speed) and runs 4B analysis
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { ghostSessionId, environment, estimatedPitchSpeed } = await req.json();

    if (!ghostSessionId) {
      return new Response(JSON.stringify({ error: 'Missing ghostSessionId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Ghost Recovery] Processing ghost session: ${ghostSessionId}`);

    // Fetch the ghost session
    const { data: ghostSession, error: fetchError } = await supabase
      .from('ghost_sessions')
      .select('*')
      .eq('id', ghostSessionId)
      .single();

    if (fetchError || !ghostSession) {
      return new Response(JSON.stringify({ error: 'Ghost session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (ghostSession.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Ghost session already processed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const playerId = ghostSession.player_id;
    const swingsData = ghostSession.swings_data as any[];
    const pitchSpeed = estimatedPitchSpeed || 50;

    // Create a real sensor_session
    const { data: newSession, error: sessionError } = await supabase
      .from('sensor_sessions')
      .insert({
        player_id: playerId,
        status: 'complete',
        total_swings: swingsData.length,
        avg_bat_speed: ghostSession.avg_bat_speed,
        max_bat_speed: ghostSession.max_bat_speed,
        environment: environment || 'unknown',
        session_date: ghostSession.detected_at,
        synced_at: new Date().toISOString(),
        notes: `Recovered from Ghost Session ${ghostSessionId}`,
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('[Ghost Recovery] Failed to create session:', sessionError);
      throw sessionError;
    }

    const sessionId = newSession.id;
    console.log(`[Ghost Recovery] Created session: ${sessionId}`);

    // Insert swings with the new session_id
    const swingsWithSession = swingsData.map((s, i) => ({
      ...s,
      session_id: sessionId,
      swing_number: i,
    }));

    const { error: swingsError } = await supabase
      .from('sensor_swings')
      .insert(swingsWithSession);

    if (swingsError) {
      console.error('[Ghost Recovery] Failed to insert swings:', swingsError);
      throw swingsError;
    }

    // Calculate 4B scores using dk-4b-inverse logic
    const batSpeeds = swingsData.map(s => s.bat_speed_mph).filter(Boolean) as number[];
    const timings = swingsData.map(s => s.trigger_to_impact_ms).filter(Boolean) as number[];
    const ratios = swingsData.map(s => s.hand_to_bat_ratio).filter(Boolean) as number[];
    const angles = swingsData.map(s => s.attack_angle_deg).filter(Boolean) as number[];

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const stdDev = (arr: number[]) => {
      if (arr.length < 2) return 0;
      const mean = avg(arr);
      return Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length);
    };

    // Brain Score: Timing consistency (lower CV = higher score)
    const timingCV = timings.length > 1 ? (stdDev(timings) / avg(timings)) * 100 : 0;
    const brainScore = Math.round(Math.max(20, Math.min(80, 80 - timingCV * 2.5)));
    const timingLeak = timingCV > 12;

    // Body Score: Hand-to-bat ratio efficiency
    const avgRatio = avg(ratios);
    const bodyScore = Math.round(Math.max(20, Math.min(80, avgRatio * 100)));
    const powerLeak = avgRatio < 0.85;

    // Bat Score: Attack angle consistency
    const angleStd = stdDev(angles);
    const batScore = Math.round(Math.max(20, Math.min(80, 70 - angleStd)));

    // Ball Score: Projected EV using ghost formula
    const avgBatSpeed = avg(batSpeeds);
    const projectedEV = avgBatSpeed * 1.2 + pitchSpeed * 0.2;
    const ballScore = Math.round(Math.max(20, Math.min(80, projectedEV * 0.75)));

    // Composite and weakest
    const scores = { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore };
    const compositeScore = Math.round((brainScore + bodyScore + batScore + ballScore) / 4);
    const weakestLink = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];

    // Determine leaks
    const leaks: string[] = [];
    if (timingLeak) leaks.push('TIMING_LEAK');
    if (powerLeak) leaks.push('POWER_LEAK');

    // Update the session with 4B scores
    await supabase
      .from('sensor_sessions')
      .update({
        brain_score: brainScore,
        body_score: bodyScore,
        bat_score: batScore,
        ball_score: ballScore,
        overall_score: compositeScore,
        weakest_link: weakestLink,
        leak_type: leaks[0] || null,
      })
      .eq('id', sessionId);

    // Also update player_sessions if that table is used
    const { error: playerSessionError } = await supabase
      .from('player_sessions')
      .upsert({
        player_id: playerId,
        session_id: sessionId,
        brain_score: brainScore,
        body_score: bodyScore,
        bat_score: batScore,
        ball_score: ballScore,
        overall_score: compositeScore,
        leak_type: leaks[0] || null,
        session_date: ghostSession.detected_at,
      }, { onConflict: 'session_id' });

    if (playerSessionError) {
      console.log('[Ghost Recovery] player_sessions upsert note:', playerSessionError.message);
    }

    // Update player's latest scores
    await supabase
      .from('players')
      .update({
        latest_brain_score: brainScore,
        latest_body_score: bodyScore,
        latest_bat_score: batScore,
        latest_ball_score: ballScore,
        latest_composite_score: compositeScore,
        has_ghost_session: false,
        last_sensor_session_date: ghostSession.detected_at,
      })
      .eq('id', playerId);

    // Mark ghost session as recovered
    await supabase
      .from('ghost_sessions')
      .update({
        status: 'recovered',
        recovered_at: new Date().toISOString(),
        environment: environment,
        estimated_pitch_speed: pitchSpeed,
        session_id: sessionId,
      })
      .eq('id', ghostSessionId);

    console.log(`[Ghost Recovery] Successfully recovered ghost session ${ghostSessionId} -> session ${sessionId}`);

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionId,
      scores: {
        brain: brainScore,
        body: bodyScore,
        bat: batScore,
        ball: ballScore,
        composite: compositeScore,
        weakest_link: weakestLink,
      },
      projected_ev: Math.round(projectedEV),
      leaks,
      swing_count: swingsData.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Ghost Recovery] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Recovery failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
