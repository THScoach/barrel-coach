import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Analyze Video Swing Session Edge Function
 * ==========================================
 * Runs Body→Bat momentum sequence analysis on a video swing session.
 * 
 * Input:
 *   - sessionId: string (required)
 *   - forceRecompute: boolean (optional, default false)
 * 
 * Output:
 *   - success: boolean
 *   - data: analysis results including scores and sequence info
 */

// Ideal sequence order for 4B Body→Bat momentum chain
const IDEAL_SEQUENCE = ['rear_leg', 'lead_leg', 'torso', 'bottom_arm', 'top_arm', 'bat'];

const SEGMENT_DISPLAY_NAMES: Record<string, string> = {
  rear_leg: 'Rear Leg',
  lead_leg: 'Lead Leg',
  torso: 'Torso',
  bottom_arm: 'Bottom Arm',
  top_arm: 'Top Arm',
  bat: 'Bat',
};

// Generate mock sequence analysis (placeholder until real pose data is available)
function generateMockSequenceAnalysis(swingId: string, options?: { hasErrors?: boolean }) {
  const durationMs = 400 + Math.random() * 200;
  const baseInterval = durationMs / 7;
  
  // Generate peak times with optional errors
  const segmentPeaks: Record<string, { peakTimeMs: number; peakValue: number }> = {};
  const orderedSegments: string[] = [];
  
  IDEAL_SEQUENCE.forEach((segment, idx) => {
    let peakTime = baseInterval * (idx + 1);
    
    // Introduce sequence errors if requested
    if (options?.hasErrors && Math.random() > 0.7) {
      peakTime += (Math.random() - 0.5) * baseInterval * 2;
    }
    
    segmentPeaks[segment] = {
      peakTimeMs: peakTime,
      peakValue: 50 + Math.random() * 50,
    };
  });
  
  // Sort segments by actual peak time to get actual order
  const actualOrder = [...IDEAL_SEQUENCE].sort(
    (a, b) => segmentPeaks[a].peakTimeMs - segmentPeaks[b].peakTimeMs
  );
  
  // Calculate sequence errors
  const sequenceErrors: Array<{ segment: string; expectedPosition: number; actualPosition: number; description: string }> = [];
  let sequenceMatch = true;
  
  IDEAL_SEQUENCE.forEach((segment, idealIdx) => {
    const actualIdx = actualOrder.indexOf(segment);
    if (actualIdx !== idealIdx) {
      sequenceMatch = false;
      const direction = actualIdx < idealIdx ? 'early' : 'late';
      sequenceErrors.push({
        segment,
        expectedPosition: idealIdx + 1,
        actualPosition: actualIdx + 1,
        description: `${SEGMENT_DISPLAY_NAMES[segment]} fired ${direction} (position ${actualIdx + 1} instead of ${idealIdx + 1})`,
      });
    }
  });
  
  // Calculate sequence score using Kendall tau distance
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
  
  // Timing tightness score
  const peakTimes = actualOrder.map(s => segmentPeaks[s].peakTimeMs);
  const intervals: number[] = [];
  for (let i = 1; i < peakTimes.length; i++) {
    intervals.push(peakTimes[i] - peakTimes[i - 1]);
  }
  
  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const variance = intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) / intervals.length;
  const cv = avgInterval > 0 ? Math.sqrt(variance) / avgInterval : 0;
  const timingScore = Math.max(0, 100 - cv * 50);
  
  const sequenceScore = Math.round(orderScore * 0.7 + timingScore * 0.3);
  
  // Generate summary
  let summary: string;
  if (sequenceMatch) {
    summary = `Body-to-Bat sequence: in sequence (${actualOrder.map(s => SEGMENT_DISPLAY_NAMES[s]).join(' → ')}).`;
  } else {
    const earlyErrors = sequenceErrors.filter(e => e.actualPosition < e.expectedPosition);
    const lateErrors = sequenceErrors.filter(e => e.actualPosition > e.expectedPosition);
    const errorParts: string[] = [];
    if (earlyErrors.length > 0) {
      errorParts.push(`${earlyErrors.map(e => SEGMENT_DISPLAY_NAMES[e.segment]).join(', ')} fired early`);
    }
    if (lateErrors.length > 0) {
      errorParts.push(`${lateErrors.map(e => SEGMENT_DISPLAY_NAMES[e.segment]).join(', ')} fired late`);
    }
    summary = `Body-to-Bat sequence: out of sequence. ${errorParts.join('. ')}.`;
  }
  
  return {
    swingId,
    segmentPeaks,
    actualOrder,
    idealOrder: IDEAL_SEQUENCE,
    sequenceMatch,
    sequenceErrors,
    sequenceScore,
    summary,
  };
}

// Score barrel quality (placeholder)
function scoreBarrelQuality(): number {
  return Math.round(60 + Math.random() * 35);
}

// Score contact optimization (placeholder)
function scoreContactOptimization(): number {
  return Math.round(55 + Math.random() * 40);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId, forceRecompute = false } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing session: ${sessionId}, forceRecompute: ${forceRecompute}`);

    // Load the session
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

    // Check if already analyzed and caching is enabled
    if (!forceRecompute) {
      const { data: existingScores } = await supabase
        .from('video_swing_scores')
        .select('*')
        .eq('swing_session_id', sessionId)
        .maybeSingle();

      if (existingScores) {
        console.log('Returning cached results');
        
        // Get existing metrics
        const { data: existingMetrics } = await supabase
          .from('video_swing_metrics')
          .select('*')
          .eq('swing_session_id', sessionId);

        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            data: {
              sessionId,
              scores: existingScores,
              metrics: existingMetrics || [],
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Load swings for this session
    const { data: swings, error: swingsError } = await supabase
      .from('video_swings')
      .select('*')
      .eq('session_id', sessionId)
      .order('swing_index', { ascending: true });

    if (swingsError) {
      throw new Error(`Error loading swings: ${swingsError.message}`);
    }

    // Analyze each swing
    const swingResults: any[] = [];
    
    for (const swing of swings || []) {
      // Generate mock analysis (replace with real pose analysis when available)
      const hasErrors = Math.random() > 0.5; // 50% chance of sequence errors for demo
      const analysis = generateMockSequenceAnalysis(swing.id, { hasErrors });
      
      // Update swing with analysis
      const { error: updateError } = await supabase
        .from('video_swings')
        .update({
          sequence_analysis: analysis,
          sequence_score: analysis.sequenceScore,
          sequence_errors: analysis.sequenceErrors,
          status: 'analyzed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', swing.id);

      if (updateError) {
        console.error(`Error updating swing ${swing.id}:`, updateError);
      }

      swingResults.push(analysis);
    }

    // Calculate session-level scores (average of all swings)
    const avgSequenceScore = swingResults.length > 0
      ? Math.round(swingResults.reduce((sum, r) => sum + r.sequenceScore, 0) / swingResults.length)
      : 0;
    
    const barrelQualityScore = scoreBarrelQuality();
    const contactOptimizationScore = scoreContactOptimization();
    
    // Count how many swings are in sequence
    const inSequenceCount = swingResults.filter(r => r.sequenceMatch).length;
    const sequenceMatchSession = inSequenceCount === swingResults.length;

    // Delete existing scores if force recompute
    if (forceRecompute) {
      await supabase.from('video_swing_scores').delete().eq('swing_session_id', sessionId);
      await supabase.from('video_swing_metrics').delete().eq('swing_session_id', sessionId);
    }

    // Save session scores
    const { data: savedScores, error: scoresError } = await supabase
      .from('video_swing_scores')
      .insert({
        swing_session_id: sessionId,
        sequence_score: avgSequenceScore,
        barrel_quality_score: barrelQualityScore,
        contact_optimization_score: contactOptimizationScore,
        sequence_match: sequenceMatchSession,
        sequence_order: swingResults[0]?.actualOrder || IDEAL_SEQUENCE,
        sequence_errors: swingResults.flatMap(r => r.sequenceErrors.slice(0, 2)),
        notes: `Analyzed ${swings?.length || 0} swings. ${inSequenceCount}/${swings?.length || 0} in sequence.`,
      })
      .select()
      .single();

    if (scoresError) {
      console.error('Error saving scores:', scoresError);
    }

    // Save key metrics
    const metricsToSave = [
      { metric_name: 'sequence_score', metric_value: avgSequenceScore, metric_units: 'percent', source: 'video' },
      { metric_name: 'barrel_quality_score', metric_value: barrelQualityScore, metric_units: 'percent', source: 'video' },
      { metric_name: 'contact_optimization_score', metric_value: contactOptimizationScore, metric_units: 'percent', source: 'video' },
      { metric_name: 'in_sequence_rate', metric_value: swingResults.length > 0 ? (inSequenceCount / swingResults.length) * 100 : 0, metric_units: 'percent', source: 'video' },
    ];

    const { error: metricsError } = await supabase
      .from('video_swing_metrics')
      .insert(metricsToSave.map(m => ({ ...m, swing_session_id: sessionId })));

    if (metricsError) {
      console.error('Error saving metrics:', metricsError);
    }

    // Update session status
    const { error: sessionUpdateError } = await supabase
      .from('video_swing_sessions')
      .update({
        status: 'analyzed',
        analyzed_count: swings?.length || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionUpdateError) {
      console.error('Error updating session status:', sessionUpdateError);
    }

    console.log(`Analysis complete for session ${sessionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        data: {
          sessionId,
          swingCount: swings?.length || 0,
          analyzedCount: swingResults.length,
          inSequenceCount,
          scores: savedScores,
          metrics: metricsToSave,
          swingResults,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
