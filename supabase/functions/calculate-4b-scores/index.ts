import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Calculate4BRequest {
  player_id: string;
  session_data?: {
    brain_score?: number;
    body_score?: number;
    bat_score?: number;
    ball_score?: number;
    ground_flow?: number;
    core_flow?: number;
    upper_flow?: number;
    swing_count?: number;
  };
}

interface LeakResult {
  leak_type: string;
  leak_caption: string;
  leak_training: string;
}

// Grade calculation based on 20-80 scouting scale
function getGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 50) return "Average";
  if (score >= 45) return "Below Avg";
  if (score >= 40) return "Fringe Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

// Calculate overall composite score (weighted average)
function calculateOverallScore(brain: number, body: number, bat: number, ball: number): number {
  // Weights: Brain 20%, Body 35%, Bat 30%, Ball 15%
  return Math.round(brain * 0.20 + body * 0.35 + bat * 0.30 + ball * 0.15);
}

// Detect energy leaks based on flow components
function detectLeak(groundFlow: number, coreFlow: number, upperFlow: number): LeakResult {
  // Clean transfer - all flows are balanced and strong
  if (groundFlow >= 60 && coreFlow >= 60 && upperFlow >= 60) {
    return {
      leak_type: 'clean_transfer',
      leak_caption: 'Energy is transferring efficiently through the chain.',
      leak_training: 'Maintain current mechanics. Focus on consistency.'
    };
  }
  
  // Late legs - ground flow is weak
  if (groundFlow < 45 && coreFlow >= 50) {
    return {
      leak_type: 'late_legs',
      leak_caption: 'Lower half is firing late, losing ground-up energy.',
      leak_training: 'Work on leg drive timing drills. Focus on early hip rotation.'
    };
  }
  
  // Torso bypass - core flow is weak relative to others
  if (coreFlow < 45 && groundFlow >= 50 && upperFlow >= 50) {
    return {
      leak_type: 'torso_bypass',
      leak_caption: 'Energy is bypassing the core, reducing power transfer.',
      leak_training: 'Core connection drills. Focus on hip-shoulder separation.'
    };
  }
  
  // Early arms - upper flow dominates
  if (upperFlow > groundFlow + 15 && upperFlow > coreFlow + 15) {
    return {
      leak_type: 'early_arms',
      leak_caption: 'Arms are firing before the body, creating an arm-dominant swing.',
      leak_training: 'Sequence timing drills. Let the body lead the hands.'
    };
  }
  
  // No bat delivery - upper flow is very weak
  if (upperFlow < 40) {
    return {
      leak_type: 'no_bat_delivery',
      leak_caption: 'Energy is not reaching the bat effectively.',
      leak_training: 'Bat path drills. Focus on connection through the zone.'
    };
  }
  
  // Unknown / general inefficiency
  return {
    leak_type: 'unknown',
    leak_caption: 'Energy transfer pattern needs further analysis.',
    leak_training: 'Schedule a detailed swing review for personalized recommendations.'
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { player_id, session_data } = await req.json() as Calculate4BRequest;

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: 'player_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[calculate-4b-scores] Processing for player: ${player_id}`);

    // Use provided scores or defaults for demo
    const brainScore = session_data?.brain_score ?? 50;
    const bodyScore = session_data?.body_score ?? 50;
    const batScore = session_data?.bat_score ?? 50;
    const ballScore = session_data?.ball_score ?? 50;
    const groundFlow = session_data?.ground_flow ?? 55;
    const coreFlow = session_data?.core_flow ?? 55;
    const upperFlow = session_data?.upper_flow ?? 55;
    const swingCount = session_data?.swing_count ?? 1;

    // Calculate overall score and grades
    const overallScore = calculateOverallScore(brainScore, bodyScore, batScore, ballScore);
    const leak = detectLeak(groundFlow, coreFlow, upperFlow);

    // Build session record
    const sessionRecord = {
      player_id,
      session_date: new Date().toISOString(),
      brain_score: brainScore,
      body_score: bodyScore,
      bat_score: batScore,
      ball_score: ballScore,
      overall_score: overallScore,
      brain_grade: getGrade(brainScore),
      body_grade: getGrade(bodyScore),
      bat_grade: getGrade(batScore),
      ball_grade: getGrade(ballScore),
      overall_grade: getGrade(overallScore),
      ground_flow: groundFlow,
      core_flow: coreFlow,
      upper_flow: upperFlow,
      leak_type: leak.leak_type,
      leak_caption: leak.leak_caption,
      leak_training: leak.leak_training,
      swing_count: swingCount,
      data_quality: swingCount >= 5 ? 'good' : swingCount >= 3 ? 'fair' : 'limited',
    };

    // Insert into player_sessions
    const { data: insertedSession, error: insertError } = await supabase
      .from('player_sessions')
      .insert(sessionRecord)
      .select()
      .single();

    if (insertError) {
      console.error('[calculate-4b-scores] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save session', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[calculate-4b-scores] Session saved: ${insertedSession.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        session_id: insertedSession.id,
        scores: {
          brain: brainScore,
          body: bodyScore,
          bat: batScore,
          ball: ballScore,
          overall: overallScore,
        },
        grades: {
          brain: getGrade(brainScore),
          body: getGrade(bodyScore),
          bat: getGrade(batScore),
          ball: getGrade(ballScore),
          overall: getGrade(overallScore),
        },
        leak,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[calculate-4b-scores] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
