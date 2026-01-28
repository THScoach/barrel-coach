import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: simple in-memory store (resets on cold start)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

interface StatcastData {
  exit_velocity?: number;
  max_ev?: number;
  barrel_pct?: number;
  hard_hit_pct?: number;
  launch_angle?: number;
  sweet_spot_pct?: number;
  k_pct?: number;
  bb_pct?: number;
  gb_pct?: number;
  pull_pct?: number;
  fb_pct?: number;
  ld_pct?: number;
  sprint_speed?: number;
  whiff_pct?: number;
  chase_pct?: number;
  contact_pct?: number;
}

interface AnalyzeRequest {
  player_name: string;
  statcast_data: StatcastData;
}

// ============================================================================
// 4B SCORING LOGIC FOR STATCAST DATA
// ============================================================================

function calculateBrainScore(data: StatcastData): { score: number; components: Record<string, number> } {
  // Brain = Pitch Selection + Plate Discipline + Situational Awareness
  const kPct = data.k_pct ?? 22;
  const bbPct = data.bb_pct ?? 8;
  const chasePct = data.chase_pct ?? 28;
  const contactPct = data.contact_pct ?? 78;
  
  // K% scoring (lower is better) - MLB avg ~22%
  const kScore = kPct <= 15 ? 90 : kPct <= 18 ? 80 : kPct <= 22 ? 65 : kPct <= 26 ? 50 : 35;
  
  // BB% scoring (higher is better) - MLB avg ~8%
  const bbScore = bbPct >= 12 ? 90 : bbPct >= 10 ? 80 : bbPct >= 8 ? 65 : bbPct >= 6 ? 50 : 35;
  
  // Chase% scoring (lower is better) - MLB avg ~28%
  const chaseScore = chasePct <= 22 ? 90 : chasePct <= 25 ? 80 : chasePct <= 28 ? 65 : chasePct <= 32 ? 50 : 35;
  
  // Contact% scoring (higher is better) - MLB avg ~78%
  const contactScore = contactPct >= 85 ? 90 : contactPct >= 80 ? 80 : contactPct >= 78 ? 65 : contactPct >= 72 ? 50 : 35;
  
  // Plate discipline ratio
  const disciplineRatio = bbPct > 0 ? (bbPct / Math.max(kPct, 1)) : 0;
  const disciplineScore = disciplineRatio >= 0.6 ? 90 : disciplineRatio >= 0.45 ? 75 : disciplineRatio >= 0.35 ? 60 : 45;
  
  const score = Math.round(
    kScore * 0.25 + 
    bbScore * 0.20 + 
    chaseScore * 0.20 + 
    contactScore * 0.15 +
    disciplineScore * 0.20
  );
  
  return {
    score,
    components: {
      k_rate: kScore,
      walk_rate: bbScore,
      chase_discipline: chaseScore,
      contact_ability: contactScore,
      plate_discipline: disciplineScore
    }
  };
}

function calculateBodyScore(data: StatcastData): { score: number; components: Record<string, number> } {
  // Body = Physical Tools + Swing Mechanics indicators
  const exitVelo = data.exit_velocity ?? 87;
  const maxEV = data.max_ev ?? 105;
  const sprintSpeed = data.sprint_speed ?? 27;
  const gbPct = data.gb_pct ?? 43;
  
  // Exit velocity scoring - MLB avg ~88 mph
  const evScore = exitVelo >= 93 ? 95 : exitVelo >= 91 ? 85 : exitVelo >= 89 ? 75 : exitVelo >= 87 ? 60 : 45;
  
  // Max EV scoring - elite is 115+
  const maxEvScore = maxEV >= 115 ? 95 : maxEV >= 112 ? 85 : maxEV >= 108 ? 75 : maxEV >= 105 ? 60 : 45;
  
  // Sprint speed scoring (if available) - MLB avg ~27 ft/s
  const sprintScore = sprintSpeed >= 30 ? 95 : sprintSpeed >= 28 ? 80 : sprintSpeed >= 27 ? 65 : sprintSpeed >= 25 ? 50 : 40;
  
  // Ground ball tendency (moderate is optimal for power) - MLB avg ~43%
  const gbScore = gbPct >= 35 && gbPct <= 45 ? 80 : gbPct < 35 ? 70 : gbPct <= 50 ? 60 : 45;
  
  // Power differential (max - avg EV)
  const powerDiff = maxEV - exitVelo;
  const powerConsistency = powerDiff <= 15 ? 85 : powerDiff <= 20 ? 70 : powerDiff <= 25 ? 55 : 40;
  
  const score = Math.round(
    evScore * 0.35 + 
    maxEvScore * 0.25 + 
    sprintScore * 0.15 +
    gbScore * 0.10 +
    powerConsistency * 0.15
  );
  
  return {
    score,
    components: {
      avg_exit_velo: evScore,
      max_exit_velo: maxEvScore,
      athleticism: sprintScore,
      launch_profile: gbScore,
      power_consistency: powerConsistency
    }
  };
}

function calculateBatScore(data: StatcastData): { score: number; components: Record<string, number> } {
  // Bat = Bat-to-Ball Skills + Barrel Ability
  const barrelPct = data.barrel_pct ?? 6;
  const hardHitPct = data.hard_hit_pct ?? 35;
  const sweetSpotPct = data.sweet_spot_pct ?? 33;
  const launchAngle = data.launch_angle ?? 12;
  const whiffPct = data.whiff_pct ?? 25;
  
  // Barrel% scoring - MLB avg ~6%
  const barrelScore = barrelPct >= 12 ? 95 : barrelPct >= 9 ? 85 : barrelPct >= 7 ? 70 : barrelPct >= 5 ? 55 : 40;
  
  // Hard hit% scoring - MLB avg ~35%
  const hardHitScore = hardHitPct >= 50 ? 95 : hardHitPct >= 45 ? 85 : hardHitPct >= 40 ? 75 : hardHitPct >= 35 ? 60 : 45;
  
  // Sweet spot% scoring - MLB avg ~33%
  const sweetSpotScore = sweetSpotPct >= 40 ? 90 : sweetSpotPct >= 36 ? 80 : sweetSpotPct >= 33 ? 65 : sweetSpotPct >= 28 ? 50 : 35;
  
  // Launch angle scoring - optimal is 10-25°
  const laScore = launchAngle >= 10 && launchAngle <= 20 ? 90 : 
                  launchAngle >= 8 && launchAngle <= 25 ? 75 : 
                  launchAngle >= 5 && launchAngle <= 30 ? 60 : 45;
  
  // Whiff% scoring (lower is better) - MLB avg ~25%
  const whiffScore = whiffPct <= 18 ? 90 : whiffPct <= 22 ? 80 : whiffPct <= 25 ? 65 : whiffPct <= 30 ? 50 : 35;
  
  const score = Math.round(
    barrelScore * 0.30 + 
    hardHitScore * 0.25 + 
    sweetSpotScore * 0.20 +
    laScore * 0.10 +
    whiffScore * 0.15
  );
  
  return {
    score,
    components: {
      barrel_ability: barrelScore,
      hard_contact: hardHitScore,
      sweet_spot: sweetSpotScore,
      launch_angle: laScore,
      bat_control: whiffScore
    }
  };
}

function calculateBallScore(data: StatcastData): { score: number; components: Record<string, number> } {
  // Ball = Batted Ball Results + Spray Chart
  const exitVelo = data.exit_velocity ?? 87;
  const barrelPct = data.barrel_pct ?? 6;
  const launchAngle = data.launch_angle ?? 12;
  const pullPct = data.pull_pct ?? 40;
  const gbPct = data.gb_pct ?? 43;
  const fbPct = data.fb_pct ?? 35;
  const ldPct = data.ld_pct ?? 22;
  
  // Expected production based on quality of contact
  const qualityScore = Math.min(95, (exitVelo - 80) * 2 + barrelPct * 3);
  
  // Spray chart balance (40/40/20 is ideal pull/center/oppo)
  const sprayBalance = pullPct >= 35 && pullPct <= 45 ? 85 : pullPct >= 30 && pullPct <= 50 ? 70 : 50;
  
  // Line drive rate (higher is better) - MLB avg ~22%
  const ldScore = ldPct >= 26 ? 90 : ldPct >= 24 ? 80 : ldPct >= 22 ? 65 : ldPct >= 18 ? 50 : 35;
  
  // Fly ball rate for power potential - MLB avg ~35%
  const fbScore = fbPct >= 38 && fbPct <= 48 ? 85 : fbPct >= 32 && fbPct <= 52 ? 70 : 55;
  
  // Launch angle optimization
  const laOptimal = launchAngle >= 12 && launchAngle <= 18 ? 90 : 
                    launchAngle >= 8 && launchAngle <= 22 ? 75 : 55;
  
  const score = Math.round(
    qualityScore * 0.35 + 
    sprayBalance * 0.15 + 
    ldScore * 0.20 +
    fbScore * 0.15 +
    laOptimal * 0.15
  );
  
  return {
    score: Math.min(95, score),
    components: {
      contact_quality: Math.round(qualityScore),
      spray_balance: sprayBalance,
      line_drive_rate: ldScore,
      fly_ball_profile: fbScore,
      launch_optimization: laOptimal
    }
  };
}

// ============================================================================
// MOTOR PROFILE CLASSIFICATION
// ============================================================================

function classifyMotorProfile(data: StatcastData, scores: { brain: number; body: number; bat: number; ball: number }): {
  profile: string;
  confidence: string;
  characteristics: string[];
  reasoning: string;
} {
  const exitVelo = data.exit_velocity ?? 87;
  const maxEV = data.max_ev ?? 105;
  const barrelPct = data.barrel_pct ?? 6;
  const pullPct = data.pull_pct ?? 40;
  const gbPct = data.gb_pct ?? 43;
  const kPct = data.k_pct ?? 22;
  const bbPct = data.bb_pct ?? 8;
  
  let profileScores = { SPINNER: 0, WHIPPER: 0, SLINGSHOTTER: 0, TITAN: 0 };
  
  // SPINNER: Rotational power, pull-heavy, high exit velo variance
  if (pullPct >= 45) profileScores.SPINNER += 30;
  if (maxEV - exitVelo >= 20) profileScores.SPINNER += 25;
  if (gbPct <= 40) profileScores.SPINNER += 15;
  if (scores.body > scores.bat) profileScores.SPINNER += 10;
  
  // WHIPPER: Elite transfer efficiency, consistent hard contact
  if (barrelPct >= 10) profileScores.WHIPPER += 35;
  if (maxEV - exitVelo <= 18) profileScores.WHIPPER += 25;
  if (scores.bat >= 75) profileScores.WHIPPER += 20;
  
  // SLINGSHOTTER: Late load, oppo power, high launch
  if (pullPct <= 38) profileScores.SLINGSHOTTER += 30;
  if (data.launch_angle && data.launch_angle >= 15) profileScores.SLINGSHOTTER += 25;
  if (scores.brain > scores.body) profileScores.SLINGSHOTTER += 15;
  
  // TITAN: Raw power, high K%, elite exit velo
  if (exitVelo >= 92) profileScores.TITAN += 35;
  if (maxEV >= 112) profileScores.TITAN += 25;
  if (kPct >= 25 && barrelPct >= 8) profileScores.TITAN += 20;
  
  const entries = Object.entries(profileScores) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [topProfile, topScore] = entries[0];
  const [secondProfile, secondScore] = entries[1];
  
  const confidence = topScore >= 50 ? 'high' : topScore >= 30 ? 'medium' : 'low';
  
  const profileInfo: Record<string, { characteristics: string[]; description: string }> = {
    SPINNER: {
      characteristics: ['Rotational power source', 'Pull-side dominant', 'High torque generation', 'Quick hip rotation'],
      description: 'generates power through explosive hip rotation and rotational mechanics'
    },
    WHIPPER: {
      characteristics: ['Elite energy transfer', 'Consistent barrel contact', 'Efficient kinetic chain', 'Smooth swing path'],
      description: 'excels at transferring energy through the kinetic chain for consistent hard contact'
    },
    SLINGSHOTTER: {
      characteristics: ['Late load timing', 'Deep hip hinge', 'All-fields power', 'Patient approach'],
      description: 'uses a deep load and late release to generate power to all fields'
    },
    TITAN: {
      characteristics: ['Elite raw power', 'High bat speed', 'Physical strength', 'Power-over-contact approach'],
      description: 'relies on exceptional physical tools and bat speed for elite exit velocities'
    }
  };
  
  return {
    profile: topProfile,
    confidence,
    characteristics: profileInfo[topProfile].characteristics,
    reasoning: `Classified as ${topProfile} (${confidence} confidence) - ${profileInfo[topProfile].description}. Secondary profile tendencies: ${secondProfile}.`
  };
}

// ============================================================================
// KRS SCORE CALCULATION
// ============================================================================

function calculateKRS(scores: { brain: number; body: number; bat: number; ball: number }): number {
  // KRS = Kinetic Release Score - weighted composite
  // Weights: Brain 20%, Body 35%, Bat 30%, Ball 15%
  return Math.round(
    scores.brain * 0.20 +
    scores.body * 0.35 +
    scores.bat * 0.30 +
    scores.ball * 0.15
  );
}

// ============================================================================
// GRADE HELPERS
// ============================================================================

function getGrade(score: number): string {
  if (score >= 80) return 'Plus-Plus';
  if (score >= 70) return 'Plus';
  if (score >= 60) return 'Above Average';
  if (score >= 50) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Needs Development';
}

function getWeakestCategory(scores: { brain: number; body: number; bat: number; ball: number }): string {
  const min = Math.min(scores.brain, scores.body, scores.bat, scores.ball);
  if (min === scores.brain) return 'brain';
  if (min === scores.body) return 'body';
  if (min === scores.bat) return 'bat';
  return 'ball';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const coachApiKey = Deno.env.get('COACH_API_KEY');

  // Auth check
  const authHeader = req.headers.get('Authorization');
  const providedKey = authHeader?.replace('Bearer ', '');
  
  if (!providedKey || providedKey !== coachApiKey) {
    console.log('[coach-analyze-external] Unauthorized request');
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Invalid API key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting
  const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const rateData = rateLimitStore.get(clientIP);
  
  if (rateData) {
    if (now < rateData.resetAt) {
      if (rateData.count >= RATE_LIMIT) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', retry_after_seconds: Math.ceil((rateData.resetAt - now) / 1000) }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      rateData.count++;
    } else {
      rateLimitStore.set(clientIP, { count: 1, resetAt: now + RATE_WINDOW_MS });
    }
  } else {
    rateLimitStore.set(clientIP, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AnalyzeRequest = await req.json();
    const { player_name, statcast_data } = body;

    if (!player_name || !statcast_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: player_name and statcast_data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[coach-analyze-external] Analyzing: ${player_name}`);

    // Calculate 4B scores
    const brainResult = calculateBrainScore(statcast_data);
    const bodyResult = calculateBodyScore(statcast_data);
    const batResult = calculateBatScore(statcast_data);
    const ballResult = calculateBallScore(statcast_data);

    const scores = {
      brain: brainResult.score,
      body: bodyResult.score,
      bat: batResult.score,
      ball: ballResult.score
    };

    const krs = calculateKRS(scores);
    const motorProfile = classifyMotorProfile(statcast_data, scores);
    const weakestCategory = getWeakestCategory(scores);

    // Check for existing Reboot/internal data
    let comparison = { has_reboot_data: false, reboot_insights: null as any };
    
    // Search by name in players table, then check kwon_analyses
    const { data: playerMatch } = await supabase
      .from('players')
      .select('id, name, motor_profile_sensor')
      .ilike('name', `%${player_name}%`)
      .limit(1)
      .maybeSingle();

    if (playerMatch) {
      const { data: kwonData } = await supabase
        .from('kwon_analyses')
        .select('motor_profile, four_b_scores, kinetic_potential, possible_leaks, priority_focus')
        .eq('player_id', playerMatch.id)
        .order('analysis_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (kwonData) {
        comparison = {
          has_reboot_data: true,
          reboot_insights: {
            internal_motor_profile: kwonData.motor_profile,
            internal_4b_scores: kwonData.four_b_scores,
            kinetic_potential: kwonData.kinetic_potential,
            identified_leaks: kwonData.possible_leaks,
            priority_focus: kwonData.priority_focus,
            profile_match: kwonData.motor_profile === motorProfile.profile
          }
        };
      }
    }

    // Get drill recommendations based on weakest category
    const { data: drills } = await supabase
      .from('drills')
      .select('id, name, slug, description, four_b_category, focus_area, video_url')
      .eq('is_active', true)
      .eq('four_b_category', weakestCategory)
      .limit(3);

    const recommendations = (drills || []).map(d => ({
      drill: d.name,
      slug: d.slug,
      reason: `Targets ${d.four_b_category} improvement - ${d.focus_area || d.description?.slice(0, 100)}`,
      video_url: d.video_url
    }));

    // Also get motor-profile specific drills
    const { data: profileDrills } = await supabase
      .from('drill_prescriptions')
      .select('drill_id, prescription_reason, drills(name, slug, video_url)')
      .eq('motor_profile', motorProfile.profile)
      .eq('is_active', true)
      .limit(2);

    if (profileDrills) {
      for (const pd of profileDrills) {
        if (pd.drills) {
          recommendations.push({
            drill: (pd.drills as any).name,
            slug: (pd.drills as any).slug,
            reason: pd.prescription_reason || `Optimized for ${motorProfile.profile} motor profile`,
            video_url: (pd.drills as any).video_url
          });
        }
      }
    }

    // Generate summary
    const summary = `${player_name} is a ${motorProfile.profile} profile hitter with a KRS of ${krs} (${getGrade(krs)}). ` +
      `Strongest area: ${Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0].toUpperCase()} (${Math.max(...Object.values(scores))}). ` +
      `Development focus: ${weakestCategory.toUpperCase()} (${scores[weakestCategory as keyof typeof scores]}). ` +
      `${motorProfile.reasoning}`;

    // Log the API call
    await supabase.from('coach_api_audit_log').insert({
      action: 'analyze_external',
      phone: null,
      player_id: playerMatch?.id || null,
      request_body: { player_name, statcast_data_keys: Object.keys(statcast_data) },
      response_status: 200,
      ip_address: clientIP
    });

    const response = {
      player_name,
      motor_profile: motorProfile.profile,
      motor_profile_confidence: motorProfile.confidence,
      motor_profile_characteristics: motorProfile.characteristics,
      scores: {
        brain: scores.brain,
        body: scores.body,
        bat: scores.bat,
        ball: scores.ball,
        krs
      },
      grades: {
        brain: getGrade(scores.brain),
        body: getGrade(scores.body),
        bat: getGrade(scores.bat),
        ball: getGrade(scores.ball),
        overall: getGrade(krs)
      },
      components: {
        brain: brainResult.components,
        body: bodyResult.components,
        bat: batResult.components,
        ball: ballResult.components
      },
      weakest_category: weakestCategory,
      comparison,
      recommendations: recommendations.slice(0, 5),
      summary
    };

    console.log(`[coach-analyze-external] Analysis complete for ${player_name}: KRS=${krs}, Profile=${motorProfile.profile}`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[coach-analyze-external] Error:', error);
    
    // Log error (ignore failures)
    try {
      await supabase.from('coach_api_audit_log').insert({
        action: 'analyze_external_error',
        request_body: { error: String(error) },
        response_status: 500,
        ip_address: clientIP
      });
    } catch {
      // Ignore logging errors
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
