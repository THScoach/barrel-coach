import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Calculate4BRequest {
  player_id: string;
  session_id?: string;
  download_urls?: Record<string, string[]>;
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
  return Math.round(brain * 0.20 + body * 0.35 + bat * 0.30 + ball * 0.15);
}

// Detect energy leaks based on flow components
function detectLeak(groundFlow: number, coreFlow: number, upperFlow: number): LeakResult {
  if (groundFlow >= 60 && coreFlow >= 60 && upperFlow >= 60) {
    return {
      leak_type: 'clean_transfer',
      leak_caption: 'Energy is transferring efficiently through the chain.',
      leak_training: 'Maintain current mechanics. Focus on consistency.'
    };
  }
  if (groundFlow < 45 && coreFlow >= 50) {
    return {
      leak_type: 'late_legs',
      leak_caption: 'Lower half is firing late, losing ground-up energy.',
      leak_training: 'Work on leg drive timing drills. Focus on early hip rotation.'
    };
  }
  if (coreFlow < 45 && groundFlow >= 50 && upperFlow >= 50) {
    return {
      leak_type: 'torso_bypass',
      leak_caption: 'Energy is bypassing the core, reducing power transfer.',
      leak_training: 'Core connection drills. Focus on hip-shoulder separation.'
    };
  }
  if (upperFlow > groundFlow + 15 && upperFlow > coreFlow + 15) {
    return {
      leak_type: 'early_arms',
      leak_caption: 'Arms are firing before the body, creating an arm-dominant swing.',
      leak_training: 'Sequence timing drills. Let the body lead the hands.'
    };
  }
  if (upperFlow < 40) {
    return {
      leak_type: 'no_bat_delivery',
      leak_caption: 'Energy is not reaching the bat effectively.',
      leak_training: 'Bat path drills. Focus on connection through the zone.'
    };
  }
  return {
    leak_type: 'unknown',
    leak_caption: 'Energy transfer pattern needs further analysis.',
    leak_training: 'Schedule a detailed swing review for personalized recommendations.'
  };
}

/**
 * Stream a CSV from a URL with a size cap to stay within memory limits.
 * Returns the sampled CSV text.
 */
async function streamCsvFromUrl(url: string, maxChars: number = 2_000_000): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CSV download failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body to stream");

  const decoder = new TextDecoder();
  let text = "";

  try {
    while (text.length < maxChars) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel();
  }

  // Trim to last complete line to avoid partial row
  const lastNewline = text.lastIndexOf("\n");
  if (lastNewline > 0 && text.length >= maxChars) {
    text = text.substring(0, lastNewline);
  }

  return text;
}

/**
 * Parse momentum-energy CSV to extract basic metrics for scoring.
 * Returns swing count and average energy values.
 */
function parseMomentumCsv(csvText: string): {
  swingCount: number;
  avgGroundFlow: number;
  avgCoreFlow: number;
  avgUpperFlow: number;
} {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) {
    return { swingCount: 0, avgGroundFlow: 55, avgCoreFlow: 55, avgUpperFlow: 55 };
  }

  const header = lines[0].toLowerCase();
  const cols = header.split(",");

  // Try to find relevant column indices
  const findCol = (patterns: string[]) =>
    cols.findIndex(c => patterns.some(p => c.includes(p)));

  const peakLinearMomentumIdx = findCol(["peak_linear_momentum", "linear_momentum"]);
  const peakAngularMomentumIdx = findCol(["peak_angular_momentum", "angular_momentum"]);
  const kineticEnergyIdx = findCol(["kinetic_energy", "total_energy"]);

  // Count data rows (each represents a swing/rep)
  const dataRows = lines.slice(1);
  const swingCount = dataRows.length;

  // Extract numeric values for flow estimation
  let totalLinear = 0, totalAngular = 0, totalEnergy = 0;
  let validCount = 0;

  for (const row of dataRows) {
    const vals = row.split(",");
    const linear = peakLinearMomentumIdx >= 0 ? parseFloat(vals[peakLinearMomentumIdx]) : NaN;
    const angular = peakAngularMomentumIdx >= 0 ? parseFloat(vals[peakAngularMomentumIdx]) : NaN;
    const energy = kineticEnergyIdx >= 0 ? parseFloat(vals[kineticEnergyIdx]) : NaN;

    if (!isNaN(linear) || !isNaN(angular) || !isNaN(energy)) {
      totalLinear += isNaN(linear) ? 0 : linear;
      totalAngular += isNaN(angular) ? 0 : angular;
      totalEnergy += isNaN(energy) ? 0 : energy;
      validCount++;
    }
  }

  if (validCount === 0) {
    return { swingCount, avgGroundFlow: 55, avgCoreFlow: 55, avgUpperFlow: 55 };
  }

  // Normalize to 20-80 scale (these are rough mappings, will be refined)
  const avgLinear = totalLinear / validCount;
  const avgAngular = totalAngular / validCount;
  const avgEnergy = totalEnergy / validCount;

  // Map to flow scores (ground=linear momentum, core=angular, upper=energy delivery)
  const normalize = (val: number, min: number, max: number) =>
    Math.max(20, Math.min(80, Math.round(20 + ((val - min) / (max - min)) * 60)));

  return {
    swingCount,
    avgGroundFlow: normalize(avgLinear, 0, 300),
    avgCoreFlow: normalize(avgAngular, 0, 500),
    avgUpperFlow: normalize(avgEnergy, 0, 1000),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as Calculate4BRequest;

    if (!body.player_id) {
      return new Response(
        JSON.stringify({ error: 'player_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[calculate-4b-scores] Processing for player: ${body.player_id}`);

    let brainScore: number;
    let bodyScore: number;
    let batScore: number;
    let ballScore: number;
    let groundFlow: number;
    let coreFlow: number;
    let upperFlow: number;
    let swingCount: number;

    // If download_urls provided, stream and parse CSVs here
    if (body.download_urls && Object.keys(body.download_urls).length > 0) {
      console.log("[calculate-4b-scores] Streaming CSV data from download URLs...");

      let momentumData = { swingCount: 0, avgGroundFlow: 55, avgCoreFlow: 55, avgUpperFlow: 55 };

      // Stream momentum-energy CSV (primary data source)
      if (body.download_urls["momentum-energy"]?.length) {
        const url = body.download_urls["momentum-energy"][0];
        console.log(`[calculate-4b-scores] Streaming momentum-energy CSV (capped at 2MB)...`);
        const csvText = await streamCsvFromUrl(url);
        console.log(`[calculate-4b-scores] Got ${csvText.length} chars of momentum-energy data`);
        momentumData = parseMomentumCsv(csvText);
        console.log(`[calculate-4b-scores] Parsed ${momentumData.swingCount} swings from momentum CSV`);
      }

      // Stream inverse-kinematics CSV (secondary, for bat/brain metrics)
      let ikSwingCount = 0;
      if (body.download_urls["inverse-kinematics"]?.length) {
        const url = body.download_urls["inverse-kinematics"][0];
        console.log(`[calculate-4b-scores] Streaming inverse-kinematics CSV (capped at 2MB)...`);
        try {
          const ikCsv = await streamCsvFromUrl(url);
          console.log(`[calculate-4b-scores] Got ${ikCsv.length} chars of IK data`);
          const ikLines = ikCsv.split("\n").filter(l => l.trim());
          ikSwingCount = Math.max(0, ikLines.length - 1);
        } catch (err) {
          console.warn("[calculate-4b-scores] IK streaming failed, continuing without:", err);
        }
      }

      swingCount = momentumData.swingCount || ikSwingCount || 1;
      groundFlow = momentumData.avgGroundFlow;
      coreFlow = momentumData.avgCoreFlow;
      upperFlow = momentumData.avgUpperFlow;

      // Derive 4B scores from flow data
      bodyScore = Math.round((groundFlow + coreFlow) / 2);
      batScore = Math.round((coreFlow + upperFlow) / 2);
      brainScore = swingCount >= 5
        ? Math.min(80, Math.round(50 + (swingCount * 0.5)))
        : Math.round(45 + (swingCount * 2));
      ballScore = Math.round(upperFlow * 0.8 + groundFlow * 0.2);

    } else {
      // Fallback: use provided session_data or defaults
      brainScore = body.session_data?.brain_score ?? 50;
      bodyScore = body.session_data?.body_score ?? 50;
      batScore = body.session_data?.bat_score ?? 50;
      ballScore = body.session_data?.ball_score ?? 50;
      groundFlow = body.session_data?.ground_flow ?? 55;
      coreFlow = body.session_data?.core_flow ?? 55;
      upperFlow = body.session_data?.upper_flow ?? 55;
      swingCount = body.session_data?.swing_count ?? 1;
    }

    // Calculate overall score and grades
    const overallScore = calculateOverallScore(brainScore, bodyScore, batScore, ballScore);
    const leak = detectLeak(groundFlow, coreFlow, upperFlow);

    console.log(`[calculate-4b-scores] Scores: Brain=${brainScore} Body=${bodyScore} Bat=${batScore} Ball=${ballScore} Overall=${overallScore}`);
    console.log(`[calculate-4b-scores] Flows: Ground=${groundFlow} Core=${coreFlow} Upper=${upperFlow} | Leak: ${leak.leak_type}`);

    // Build session record
    const sessionRecord = {
      player_id: body.player_id,
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
        swing_count: swingCount,
        data_quality: swingCount >= 5 ? 'good' : swingCount >= 3 ? 'fair' : 'limited',
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
