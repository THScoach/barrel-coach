import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ─── Scoring Engine (inlined — edge functions can't import from src/) ───────

function clamp(val: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, val));
}

function normalize(val: number, floor: number, ceiling: number): number {
  if (ceiling === floor) return 50;
  return clamp(((val - floor) / (ceiling - floor)) * 100);
}

function normalizeInverse(val: number, best: number, worst: number): number {
  if (worst === best) return 50;
  return clamp(((worst - val) / (worst - best)) * 100);
}

interface SessionMetrics {
  com_drift_inches: number;
  com_velocity_mps: number;
  drift_variability_inches?: number;
  pelvis_peak_deg_s: number;
  pelvis_angular_momentum?: number;
  trunk_peak_deg_s?: number;
  trunk_variability_cv: number;
  trunk_frontal_change_deg: number;
  trunk_lateral_change_deg: number;
  pelvis_torso_gap_ms: number;
  pelvis_torso_gain: number;
  torso_arm_gain: number;
  arm_bat_gain: number;
  arm_variability_cv: number;
  exit_velocity_max: number;
  exit_velocity_min: number;
  height_inches?: number | null;
  weight_lbs?: number | null;
}

function calcPlatformScore(m: SessionMetrics): number {
  const drift = clamp(100 - m.com_drift_inches * 6);
  const velocity = clamp(100 - m.com_velocity_mps * 20);
  const trunkStab = clamp(100 - m.trunk_variability_cv * 2);
  const tiltChange = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;
  const tilt = clamp(100 - tiltChange * 3);
  return Math.round(drift * 0.35 + velocity * 0.25 + trunkStab * 0.25 + tilt * 0.15);
}

function calcBodyScore(m: SessionMetrics): number {
  const driftScore = clamp(100 - m.com_drift_inches * 6);
  const pelvisScore = normalize(m.pelvis_peak_deg_s, 300, 600);
  const trunkCvScore = normalizeInverse(m.trunk_variability_cv, 5, 30);
  const tiltChange = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;
  const tiltScore = normalizeInverse(tiltChange, 2, 15);
  return Math.round((driftScore + pelvisScore + trunkCvScore + tiltScore) / 4);
}

function calcBrainScore(m: SessionMetrics): number {
  const gap = m.pelvis_torso_gap_ms;
  let gapScore: number;
  if (gap >= 25 && gap <= 45) gapScore = 100;
  else if ((gap >= 10 && gap < 25) || (gap > 45 && gap <= 60)) gapScore = 70;
  else if (gap >= 0 && gap < 10) gapScore = 40;
  else gapScore = 25;
  const armConsistency = normalizeInverse(m.arm_variability_cv, 5, 20);
  return Math.round(gapScore * 0.7 + armConsistency * 0.3);
}

function calcBatScore(m: SessionMetrics): number {
  const armBat = normalize(m.arm_bat_gain, 0.8, 1.8);
  const torsoArm = normalize(m.torso_arm_gain, 0.9, 1.6);
  return Math.round(armBat * 0.6 + torsoArm * 0.4);
}

function calcBallScore(m: SessionMetrics): number {
  const evMax = normalize(m.exit_velocity_max, 70, 105);
  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  const gapScore = normalizeInverse(evGap, 5, 20);
  return Math.round(evMax * 0.6 + gapScore * 0.4);
}

function calcWindowTimingScore(m: SessionMetrics, platformScore: number): number {
  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  let score = 100;
  if (m.pelvis_torso_gap_ms <= 5) score -= 25;
  if (platformScore < 60) score -= (60 - platformScore) * 0.7;
  if (m.trunk_variability_cv > 22) score -= (m.trunk_variability_cv - 22) * 1.5;
  if (evGap > 12) score -= (evGap - 12) * 2;
  return clamp(Math.round(score));
}

function calcWindowSpaceScore(m: SessionMetrics, platformScore: number): number {
  const tiltSum = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;
  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  let score = 100;
  if (m.arm_bat_gain < 1.0) score -= Math.min(40, (1.0 - m.arm_bat_gain) * 120);
  if (tiltSum > 10) score -= Math.min(25, (tiltSum - 10) * 2);
  if (platformScore < 60) score -= (60 - platformScore) * 0.5;
  if (evGap > 15) score -= Math.min(20, (evGap - 15) * 3);
  if (m.com_drift_inches > 8) score -= Math.min(15, (m.com_drift_inches - 8) * 3);
  return clamp(Math.round(score));
}

function classifyArchetype(m: SessionMetrics): string {
  let tags: string[] = [];
  if (m.com_drift_inches > 7) tags.push('Glider');
  if (m.pelvis_torso_gap_ms < 10) tags.push('Spinner');
  if (m.arm_bat_gain > 1.6) tags.push('Whipper');
  if (m.pelvis_peak_deg_s > 650) tags.push('Slingshotter');
  if ((m.height_inches ?? 0) >= 74 && tags.includes('Spinner')) {
    tags = ['Trapped Tilt Whipper'];
  }
  if (tags.length === 0) tags.push('Balanced');
  return tags.join('-');
}

function detectRootIssue(m: SessionMetrics): string {
  if (m.com_drift_inches > 7) return 'Glide';
  if (m.pelvis_torso_gap_ms < 10) return 'Timing collapse';
  if (m.trunk_variability_cv > 20) return 'Unstable axis';
  if (m.arm_bat_gain < 1.0) return 'Barrel pulls off';
  return 'No critical issues';
}

function classifyBeat(m: SessionMetrics): string {
  const gap = m.pelvis_torso_gap_ms;
  if (gap <= 5) return 'boom-boom-boom';
  if (gap <= 20) return 'boom…boom…boom';
  return 'boom… boom… boom';
}

// ─── Player View Generator (inlined) ───────────────────────────────────────

type EnergyLabel = 'STRONG' | 'OK' | 'LOSING';

function energyLabel(gain: number): EnergyLabel {
  if (gain >= 1.3) return 'STRONG';
  if (gain >= 1.0) return 'OK';
  return 'LOSING';
}

const BUILDING_MAP: Record<string, string[]> = {
  Glide: ['Build the anchor.', 'Rotate around a posted front side.', 'Let the barrel stay through the ball.'],
  'Timing collapse': ['Build the rhythm.', 'Let it build… then fire.', 'Match the beat to the pitch.'],
  'Barrel pulls off': ['Hold the barrel through contact.', 'Stop steering — let it release.', 'Keep the barrel in the zone longer.'],
  'Unstable axis': ['Stabilize the base.', 'Make the swing repeatable.', 'Reduce the wobble so the barrel knows the plane.'],
};

const DRILLS_MAP: Record<string, { title: string; description: string }[]> = {
  Glide: [
    { title: 'BUILD THE ANCHOR', description: 'Front foot post drill — stride into a posted front leg, feel the stop, then rotate. 3 sets of 10 dry swings.' },
    { title: 'BUILD THE CASCADE', description: 'Rope or band timing drill — attach a band to a fence, feel the sequence from ground up. 3 sets of 8.' },
  ],
  'Timing collapse': [
    { title: 'BUILD THE CASCADE', description: 'Rope or band timing drill — slow the sequence down, feel each link in the chain. 3 sets of 8.' },
    { title: 'BUILD THE RHYTHM', description: 'Constraint timing drill — use a verbal count (1… 2… 3) to separate the phases. 3 sets of 10.' },
  ],
  'Barrel pulls off': [
    { title: 'BUILD THE ANCHOR', description: 'Front foot post drill — post the front side so the barrel has something to whip around. 3 sets of 10.' },
    { title: 'BUILD THE RELEASE', description: 'Two-hand connection drill — keep both hands through the zone longer, feel the barrel stay. 3 sets of 8.' },
  ],
  'Unstable axis': [
    { title: 'BUILD THE ANCHOR', description: 'No-stride stability drill — eliminate the stride, focus on rotating from a solid base. 3 sets of 10.' },
    { title: 'BUILD THE CASCADE', description: 'Rope or band timing drill — build consistency in the sequence so the barrel finds the same path. 3 sets of 8.' },
  ],
};

function generatePlayerView(m: SessionMetrics, rootIssue: string, scores: any, beat: string) {
  const tiltSum = m.trunk_frontal_change_deg + m.trunk_lateral_change_deg;

  // Story bullets
  let base: string;
  if (rootIssue === 'Glide' || m.com_drift_inches > 7) base = 'Your body drifts forward before you rotate.';
  else if (m.trunk_variability_cv > 20 || tiltSum > 12) base = 'Your base is inconsistent, so your swing changes each rep.';
  else base = 'Your base is stable enough to rotate from.';

  let rhythm: string;
  if (m.pelvis_torso_gap_ms <= 5) rhythm = 'Your swing fires all at once instead of building.';
  else if (m.pelvis_torso_gap_ms <= 20) rhythm = 'Your rhythm is close, but the swing still rushes.';
  else rhythm = 'Your swing builds in rhythm (good cascade).';

  let barrel: string;
  if (m.arm_bat_gain < 1.0) barrel = 'The barrel pulls off early and loses energy.';
  else if (m.arm_bat_gain < 1.3) barrel = 'The barrel is okay, but it can stay through longer.';
  else barrel = 'The barrel stays through the ball (good carry).';

  // Sections
  let baseInsight: string, baseRec: string;
  if (m.com_drift_inches > 7) { baseInsight = 'Your body moves forward too much before the swing starts.'; baseRec = 'Build a stronger post so you rotate instead of slide.'; }
  else if (m.trunk_variability_cv > 20 || tiltSum > 12) { baseInsight = 'Your base shifts around, so the swing looks different each time.'; baseRec = 'Build a more stable starting position to make every swing the same.'; }
  else { baseInsight = 'Your base is solid — good foundation to build on.'; baseRec = 'Build on this by adding power from the ground up.'; }

  let rhythmInsight: string, rhythmRec: string;
  if (m.pelvis_torso_gap_ms <= 5) { rhythmInsight = "Everything fires together — the swing doesn't build speed."; rhythmRec = 'Build separation so each piece adds speed to the next.'; }
  else if (m.pelvis_torso_gap_ms <= 20) { rhythmInsight = 'The timing is close but still a little rushed.'; rhythmRec = 'Build patience in the sequence — let it load before it fires.'; }
  else { rhythmInsight = 'Great rhythm — the swing builds like a whip crack.'; rhythmRec = 'Build consistency so this timing shows up every swing.'; }

  let barrelInsight: string, barrelRec: string;
  if (m.arm_bat_gain < 1.0) { barrelInsight = 'The barrel leaves the zone too early, losing power at contact.'; barrelRec = 'Build a longer barrel path so it stays through the ball.'; }
  else if (m.arm_bat_gain < 1.3) { barrelInsight = 'The barrel is decent but could stay in the zone longer.'; barrelRec = 'Build more carry — let the barrel ride through contact.'; }
  else { barrelInsight = 'The barrel stays through the ball with good carry.'; barrelRec = 'Build on this by matching it with a consistent base.'; }

  const evGap = m.exit_velocity_max - m.exit_velocity_min;
  let ballInsight: string, ballRec: string;
  if (evGap > 15) { ballInsight = 'Big gap between your best and worst contact — inconsistent.'; ballRec = 'Build repeatability so every ball comes off the bat hard.'; }
  else if (evGap > 8) { ballInsight = "Contact quality is okay but there's room to tighten the range."; ballRec = 'Build a tighter window so your floor comes up.'; }
  else { ballInsight = 'Contact is consistent — your floor and ceiling are close.'; ballRec = 'Build on this by raising the ceiling while keeping the floor.'; }

  return {
    storyBullets: { base, rhythm, barrel },
    targets: { platformScore: scores.platformScore, swingWindowScore: scores.swingWindowScore, evFloor: scores.evFloor },
    beat: { label: beat },
    energyFlow: { hipToBody: energyLabel(m.pelvis_torso_gain), bodyToArms: energyLabel(m.torso_arm_gain), armsToBarrel: energyLabel(m.arm_bat_gain) },
    whatWereBuilding: BUILDING_MAP[rootIssue] ?? ['Keep building consistency.', 'Stay locked in on the process.'],
    drills: DRILLS_MAP[rootIssue] ?? [{ title: 'GENERAL WORK', description: 'Continue with your current drill plan.' }, { title: 'TEE WORK', description: 'Focus on quality reps off the tee.' }],
    sections: {
      base: { insight: baseInsight, recommendation: baseRec },
      rhythm: { insight: rhythmInsight, recommendation: rhythmRec },
      barrel: { insight: barrelInsight, recommendation: barrelRec },
      ball: { insight: ballInsight, recommendation: ballRec },
    },
  };
}

// ─── Edge Function Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch session
    const { data: session, error: fetchErr } = await supabase
      .from('reboot_swing_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (fetchErr || !session) {
      return new Response(JSON.stringify({ error: 'Session not found', details: fetchErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Build metrics object
    const metrics: SessionMetrics = {
      com_drift_inches: session.com_drift_inches ?? 0,
      com_velocity_mps: session.com_velocity_mps ?? 0,
      drift_variability_inches: session.drift_variability_inches,
      pelvis_peak_deg_s: session.pelvis_peak_deg_s ?? 0,
      pelvis_angular_momentum: session.pelvis_angular_momentum,
      trunk_peak_deg_s: session.trunk_peak_deg_s,
      trunk_variability_cv: session.trunk_variability_cv ?? 0,
      trunk_frontal_change_deg: session.trunk_frontal_change_deg ?? 0,
      trunk_lateral_change_deg: session.trunk_lateral_change_deg ?? 0,
      pelvis_torso_gap_ms: session.pelvis_torso_gap_ms ?? 0,
      pelvis_torso_gain: session.pelvis_torso_gain ?? 1,
      torso_arm_gain: session.torso_arm_gain ?? 1,
      arm_bat_gain: session.arm_bat_gain ?? 1,
      arm_variability_cv: session.arm_variability_cv ?? 0,
      exit_velocity_max: session.exit_velocity_max ?? 0,
      exit_velocity_min: session.exit_velocity_min ?? 0,
      height_inches: session.height_inches,
      weight_lbs: session.weight_lbs,
    };

    // 3. Generate scores
    const platformScore = calcPlatformScore(metrics);
    const bodyScore = calcBodyScore(metrics);
    const brainScore = calcBrainScore(metrics);
    const batScore = calcBatScore(metrics);
    const ballScore = calcBallScore(metrics);
    const windowTimingScore = calcWindowTimingScore(metrics, platformScore);
    const windowSpaceScore = calcWindowSpaceScore(metrics, platformScore);
    const swingWindowScore = Math.round((windowTimingScore + windowSpaceScore) / 2);
    const evGap = metrics.exit_velocity_max - metrics.exit_velocity_min;
    const evFloor = metrics.exit_velocity_min;
    const archetype = classifyArchetype(metrics);
    const rootIssue = detectRootIssue(metrics);
    const beat = classifyBeat(metrics);

    const scores = { platformScore, bodyScore, brainScore, batScore, ballScore, windowTimingScore, windowSpaceScore, swingWindowScore, evFloor, evGap };

    // 4. Generate player view
    const playerView = generatePlayerView(metrics, rootIssue, scores, beat);

    // 5. Coach view (raw metrics + scores)
    const coachView = { scores, archetype, rootIssue, beat, metrics };

    const reportJson = { playerView, coachView };

    // 6. Upsert into swing_scores
    const { data: scoreRow, error: upsertErr } = await supabase
      .from('swing_scores')
      .upsert({
        session_id,
        platform_score: platformScore,
        swing_window_score: swingWindowScore,
        window_timing_score: windowTimingScore,
        window_space_score: windowSpaceScore,
        body_score: bodyScore,
        brain_score: brainScore,
        bat_score: batScore,
        ball_score: ballScore,
        swing_archetype: archetype,
        root_issue: rootIssue,
        ev_floor: evFloor,
        ev_gap: evGap,
        report_json: reportJson,
      }, { onConflict: 'session_id' })
      .select()
      .single();

    if (upsertErr) {
      // If upsert fails (no unique constraint on session_id), try insert
      const { data: insertRow, error: insertErr } = await supabase
        .from('swing_scores')
        .insert({
          session_id,
          platform_score: platformScore,
          swing_window_score: swingWindowScore,
          window_timing_score: windowTimingScore,
          window_space_score: windowSpaceScore,
          body_score: bodyScore,
          brain_score: brainScore,
          bat_score: batScore,
          ball_score: ballScore,
          swing_archetype: archetype,
          root_issue: rootIssue,
          ev_floor: evFloor,
          ev_gap: evGap,
          report_json: reportJson,
        })
        .select()
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: 'Failed to save scores', details: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, report: reportJson, scoreId: insertRow.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, report: reportJson, scoreId: scoreRow.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
