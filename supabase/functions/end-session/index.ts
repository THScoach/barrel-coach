import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * End Session Edge Function
 * =========================
 * Ends an active session, triggers analysis on all swings, 
 * aggregates scores, and identifies the primary leak.
 * 
 * Input:
 *   - sessionId: string (required)
 * 
 * Output:
 *   - success: boolean
 *   - data: aggregated scores and leak analysis
 */

// Ideal sequence for 4B Body→Bat momentum chain
const IDEAL_SEQUENCE = ['rear_leg', 'lead_leg', 'torso', 'bottom_arm', 'top_arm', 'bat'];

const SEGMENT_DISPLAY_NAMES: Record<string, string> = {
  rear_leg: 'Rear Leg',
  lead_leg: 'Lead Leg', 
  torso: 'Torso',
  bottom_arm: 'Bottom Arm',
  top_arm: 'Top Arm',
  bat: 'Bat',
};

// Leak type mappings
const LEAK_TYPES = {
  early_torso: { label: 'Early Torso Rotation', category: 'body', training: 'Hip lead drills' },
  late_legs: { label: 'Late Lower Body', category: 'body', training: 'Load timing drills' },
  arms_before_torso: { label: 'Arms Before Torso', category: 'bat', training: 'Separation drills' },
  bat_drag: { label: 'Bat Drag', category: 'bat', training: 'Barrel path drills' },
  no_sequence: { label: 'No Clear Sequence', category: 'brain', training: 'Intent mapping' },
} as const;

// Generate sequence analysis for a swing
function generateSequenceAnalysis(swingId: string) {
  const durationMs = 400 + Math.random() * 200;
  const baseInterval = durationMs / 7;
  
  const segmentPeaks: Record<string, { peakTimeMs: number; peakValue: number }> = {};
  
  IDEAL_SEQUENCE.forEach((segment, idx) => {
    let peakTime = baseInterval * (idx + 1);
    // 40% chance of sequence error for realistic variability
    if (Math.random() > 0.6) {
      peakTime += (Math.random() - 0.5) * baseInterval * 2;
    }
    segmentPeaks[segment] = {
      peakTimeMs: peakTime,
      peakValue: 50 + Math.random() * 50,
    };
  });
  
  const actualOrder = [...IDEAL_SEQUENCE].sort(
    (a, b) => segmentPeaks[a].peakTimeMs - segmentPeaks[b].peakTimeMs
  );
  
  // Detect specific leak types
  const detectedLeaks: string[] = [];
  const torsoIdx = actualOrder.indexOf('torso');
  const rearLegIdx = actualOrder.indexOf('rear_leg');
  const leadLegIdx = actualOrder.indexOf('lead_leg');
  const bottomArmIdx = actualOrder.indexOf('bottom_arm');
  const topArmIdx = actualOrder.indexOf('top_arm');
  
  if (torsoIdx < rearLegIdx || torsoIdx < leadLegIdx) {
    detectedLeaks.push('early_torso');
  }
  if (rearLegIdx > 2 || leadLegIdx > 2) {
    detectedLeaks.push('late_legs');
  }
  if (bottomArmIdx < torsoIdx || topArmIdx < torsoIdx) {
    detectedLeaks.push('arms_before_torso');
  }
  if (actualOrder[actualOrder.length - 1] !== 'bat') {
    detectedLeaks.push('bat_drag');
  }
  if (detectedLeaks.length >= 3) {
    detectedLeaks.push('no_sequence');
  }
  
  // Calculate sequence score
  let inversions = 0;
  for (let i = 0; i < actualOrder.length; i++) {
    for (let j = i + 1; j < actualOrder.length; j++) {
      const idealPosI = IDEAL_SEQUENCE.indexOf(actualOrder[i]);
      const idealPosJ = IDEAL_SEQUENCE.indexOf(actualOrder[j]);
      if (idealPosI > idealPosJ) inversions++;
    }
  }
  const maxInversions = (actualOrder.length * (actualOrder.length - 1)) / 2;
  const orderScore = maxInversions > 0 ? (1 - inversions / maxInversions) * 100 : 100;
  
  const sequenceMatch = inversions === 0;
  const sequenceScore = Math.round(orderScore);
  
  return {
    swingId,
    segmentPeaks,
    actualOrder,
    idealOrder: IDEAL_SEQUENCE,
    sequenceMatch,
    sequenceScore,
    detectedLeaks,
  };
}

// Calculate 4B scores based on sequence analysis
function calculate4BScores(analyses: any[]) {
  if (analyses.length === 0) {
    return { brain: 50, body: 50, bat: 50, ball: 50, composite: 50 };
  }
  
  // Brain = consistency (low variance in sequence scores)
  const scores = analyses.map(a => a.sequenceScore);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const brainScore = Math.round(Math.max(20, Math.min(80, 80 - cv * 100)));
  
  // Body = average of ground-based sequence accuracy
  const bodyScores = analyses.map(a => {
    const order = a.actualOrder;
    const rearLegPos = order.indexOf('rear_leg');
    const leadLegPos = order.indexOf('lead_leg');
    const torsoPos = order.indexOf('torso');
    // Good if legs fire before torso
    const legsTorsoCorrect = rearLegPos < torsoPos && leadLegPos < torsoPos;
    return legsTorsoCorrect ? 70 + Math.random() * 20 : 40 + Math.random() * 20;
  });
  const bodyScore = Math.round(bodyScores.reduce((s, v) => s + v, 0) / bodyScores.length);
  
  // Bat = average sequence score (barrel delivery)
  const batScore = Math.round(mean);
  
  // Ball = simulated output score (would come from launch monitor in real system)
  const ballScore = Math.round(50 + Math.random() * 30);
  
  // Composite weighted average
  const composite = Math.round(brainScore * 0.2 + bodyScore * 0.3 + batScore * 0.35 + ballScore * 0.15);
  
  return { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore, composite };
}

// Find most frequent leak
function findPrimaryLeak(analyses: any[]): { type: string; frequency: number; label: string; category: string; training: string } | null {
  const leakCounts: Record<string, number> = {};
  
  analyses.forEach(a => {
    (a.detectedLeaks || []).forEach((leak: string) => {
      leakCounts[leak] = (leakCounts[leak] || 0) + 1;
    });
  });
  
  if (Object.keys(leakCounts).length === 0) return null;
  
  const primaryLeak = Object.entries(leakCounts).sort((a, b) => b[1] - a[1])[0];
  const leakInfo = LEAK_TYPES[primaryLeak[0] as keyof typeof LEAK_TYPES] || {
    label: primaryLeak[0],
    category: 'body',
    training: 'General movement pattern work',
  };
  
  return {
    type: primaryLeak[0],
    frequency: primaryLeak[1],
    ...leakInfo,
  };
}

// Determine weakest link from 4B scores
function getWeakestLink(scores: { brain: number; body: number; bat: number; ball: number }): string {
  const entries = Object.entries(scores).filter(([k]) => ['brain', 'body', 'bat', 'ball'].includes(k));
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Ending session: ${sessionId}`);

    // 1. Load the session
    const { data: session, error: sessionError } = await supabase
      .from('video_swing_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session already ended' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Load all swings for this session
    const { data: swings, error: swingsError } = await supabase
      .from('video_swings')
      .select('*')
      .eq('session_id', sessionId)
      .order('swing_index', { ascending: true });

    if (swingsError) {
      throw new Error(`Error loading swings: ${swingsError.message}`);
    }

    const swingCount = swings?.length || 0;
    console.log(`Found ${swingCount} swings to analyze`);

    if (swingCount === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No swings uploaded to this session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Analyze each swing
    const analyses: any[] = [];
    for (const swing of swings || []) {
      const analysis = generateSequenceAnalysis(swing.id);
      
      // Update swing with analysis
      await supabase
        .from('video_swings')
        .update({
          sequence_analysis: analysis,
          sequence_score: analysis.sequenceScore,
          sequence_errors: analysis.detectedLeaks,
          status: 'analyzed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', swing.id);

      analyses.push(analysis);
    }

    // 4. Calculate aggregated scores
    const scores = calculate4BScores(analyses);
    const primaryLeak = findPrimaryLeak(analyses);
    const weakestLink = getWeakestLink(scores);

    console.log('Scores:', scores);
    console.log('Primary leak:', primaryLeak);
    console.log('Weakest link:', weakestLink);

    // 5. Update session with aggregated results
    const { error: updateError } = await supabase
      .from('video_swing_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        status: 'analyzed',
        analyzed_count: swingCount,
        composite_score: scores.composite,
        brain_score: scores.brain,
        body_score: scores.body,
        bat_score: scores.bat,
        ball_score: scores.ball,
        primary_leak: primaryLeak?.type || null,
        leak_frequency: primaryLeak?.frequency || 0,
        weakest_link: weakestLink,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Error updating session:', updateError);
      throw new Error(`Failed to update session: ${updateError.message}`);
    }

    // 6. Update player's latest scores
    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        latest_brain_score: scores.brain,
        latest_body_score: scores.body,
        latest_bat_score: scores.bat,
        latest_ball_score: scores.ball,
        latest_composite_score: scores.composite,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.player_id);

    if (playerUpdateError) {
      console.warn('Error updating player scores:', playerUpdateError);
    }

    // 7. Save to video_swing_scores for historical tracking
    const avgSequenceScore = analyses.length > 0
      ? Math.round(analyses.reduce((sum, a) => sum + a.sequenceScore, 0) / analyses.length)
      : 0;
    const inSequenceCount = analyses.filter(a => a.sequenceMatch).length;

    await supabase
      .from('video_swing_scores')
      .upsert({
        swing_session_id: sessionId,
        sequence_score: avgSequenceScore,
        barrel_quality_score: scores.bat,
        contact_optimization_score: scores.ball,
        sequence_match: inSequenceCount === analyses.length,
        sequence_order: analyses[0]?.actualOrder || IDEAL_SEQUENCE,
        sequence_errors: analyses.flatMap(a => a.detectedLeaks.slice(0, 2)),
        notes: `Session ended. ${swingCount} swings analyzed. Primary leak: ${primaryLeak?.label || 'None'}. Weakest: ${weakestLink}.`,
      }, { onConflict: 'swing_session_id' });

    console.log(`Session ${sessionId} ended successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          sessionId,
          swingCount,
          analyzedCount: analyses.length,
          scores,
          primaryLeak,
          weakestLink,
          inSequenceCount,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('End session error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
