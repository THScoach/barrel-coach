// ============================================================================
// DIAMOND KINETICS SYNC EDGE FUNCTION
// POST - Receive and normalize swing data from DK sensor
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-player-id',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const playerId = req.headers.get('x-player-id');
  const ingestId = `ingest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (!playerId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { sessionId, swings: dkSwings, dk_sdk_version } = body;

    console.log(`[DK Sync] ${ingestId} - Received ${dkSwings?.length || 0} swings for session ${sessionId}`);

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from('sensor_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('player_id', playerId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize swings inline (simplified for edge function)
    const valid: any[] = [];
    const invalid: any[] = [];

    (dkSwings || []).forEach((raw: any, index: number) => {
      const batSpeed = raw.speedBarrelMax ?? raw.metrics?.speedBarrelMax ?? raw.batSpeed ?? null;
      
      if (batSpeed === null || batSpeed < 25) {
        invalid.push({ swing_number: index, reason: batSpeed === null ? 'missing_bat_speed' : 'below_threshold' });
        return;
      }

      const handSpeed = raw.speedHandsMax ?? raw.handSpeed ?? null;
      const ratio = batSpeed && handSpeed ? Math.round((handSpeed / batSpeed) * 100) / 100 : null;

      valid.push({
        player_id: playerId,
        session_id: sessionId,
        dk_swing_id: raw.swingId ?? raw.uuid ?? null,
        occurred_at: raw.timestamp ? new Date(typeof raw.timestamp === 'number' && raw.timestamp < 1e12 ? raw.timestamp * 1000 : raw.timestamp).toISOString() : new Date().toISOString(),
        swing_number: index,
        bat_speed_mph: Math.round(batSpeed * 10) / 10,
        hand_speed_mph: handSpeed ? Math.round(handSpeed * 10) / 10 : null,
        trigger_to_impact_ms: raw.quicknessTriggerImpact ?? raw.timeToContact ?? null,
        attack_angle_deg: raw.swingPlaneSteepnessAngle ?? raw.attackAngle ?? null,
        attack_direction_deg: raw.swingPlaneHeadingAngle ?? raw.attackDirection ?? null,
        hand_to_bat_ratio: ratio,
        is_valid: true,
        raw_dk_data: { data: raw, meta: { sdk_version: dk_sdk_version, normalized_at: new Date().toISOString() } },
      });
    });

    // Insert valid swings
    let inserted = 0;
    let duplicates = 0;

    if (valid.length > 0) {
      const { data: insertResult, error: insertError } = await supabase
        .from('sensor_swings')
        .insert(valid)
        .select('id');

      if (insertError) {
        if (insertError.code === '23505') {
          duplicates = valid.length;
        } else {
          throw insertError;
        }
      } else {
        inserted = insertResult?.length || 0;
      }
    }

    // Update session aggregates
    const { data: swings } = await supabase
      .from('sensor_swings')
      .select('bat_speed_mph, trigger_to_impact_ms, hand_to_bat_ratio')
      .eq('session_id', sessionId)
      .eq('is_valid', true);

    if (swings && swings.length > 0) {
      const batSpeeds = swings.map(s => s.bat_speed_mph).filter(Boolean) as number[];
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

      await supabase
        .from('sensor_sessions')
        .update({
          total_swings: swings.length,
          avg_bat_speed: Math.round(avg(batSpeeds) * 10) / 10,
          max_bat_speed: Math.max(...batSpeeds),
          status: 'complete',
          synced_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }

    console.log(`[DK Sync] ${ingestId} - Complete: ${inserted} inserted, ${duplicates} duplicates, ${invalid.length} rejected`);

    return new Response(JSON.stringify({
      success: true,
      ingest_id: ingestId,
      processed: inserted,
      duplicates,
      rejected: invalid.length,
      total_received: dkSwings?.length || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[DK Sync] ${ingestId} - Error:`, error);
    return new Response(JSON.stringify({ error: 'Failed to sync swing data', ingest_id: ingestId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
