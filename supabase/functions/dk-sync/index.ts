// ============================================================================
// DIAMOND KINETICS SYNC EDGE FUNCTION
// POST - Receive and normalize swing data from DK sensor
// Now supports Ghost Session detection for orphaned data
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

    console.log(`[DK Sync] ${ingestId} - Received ${dkSwings?.length || 0} swings for session ${sessionId || 'NO_SESSION'}`);

    // Normalize swings inline (simplified for edge function)
    const normalizedSwings: any[] = [];
    const invalid: any[] = [];

    (dkSwings || []).forEach((raw: any, index: number) => {
      const batSpeed = raw.speedBarrelMax ?? raw.metrics?.speedBarrelMax ?? raw.batSpeed ?? null;
      
      if (batSpeed === null || batSpeed < 25) {
        invalid.push({ swing_number: index, reason: batSpeed === null ? 'missing_bat_speed' : 'below_threshold' });
        return;
      }

      const handSpeed = raw.speedHandsMax ?? raw.handSpeed ?? null;
      const ratio = batSpeed && handSpeed ? Math.round((handSpeed / batSpeed) * 100) / 100 : null;

      normalizedSwings.push({
        player_id: playerId,
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

    // If no valid swings, return early
    if (normalizedSwings.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No valid swings to process',
        rejected: invalid.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // GHOST SESSION DETECTION: If no sessionId or invalid session, create ghost
    // ========================================================================
    let isGhostSession = false;
    let ghostSessionId: string | null = null;

    if (!sessionId) {
      isGhostSession = true;
      console.log(`[DK Sync] ${ingestId} - No sessionId provided, creating Ghost Session`);
    } else {
      // Validate session exists
      const { data: session, error: sessionError } = await supabase
        .from('sensor_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('player_id', playerId)
        .single();

      if (sessionError || !session) {
        isGhostSession = true;
        console.log(`[DK Sync] ${ingestId} - Invalid sessionId ${sessionId}, creating Ghost Session`);
      }
    }

    if (isGhostSession) {
      // Calculate aggregates for ghost session
      const batSpeeds = normalizedSwings.map(s => s.bat_speed_mph).filter(Boolean) as number[];
      const avgBatSpeed = batSpeeds.length > 0 ? batSpeeds.reduce((a, b) => a + b, 0) / batSpeeds.length : null;
      const maxBatSpeed = batSpeeds.length > 0 ? Math.max(...batSpeeds) : null;

      // Create Ghost Session record
      const { data: ghostSession, error: ghostError } = await supabase
        .from('ghost_sessions')
        .insert({
          player_id: playerId,
          swings_data: normalizedSwings,
          swing_count: normalizedSwings.length,
          avg_bat_speed: avgBatSpeed ? Math.round(avgBatSpeed * 10) / 10 : null,
          max_bat_speed: maxBatSpeed ? Math.round(maxBatSpeed * 10) / 10 : null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (ghostError) {
        console.error(`[DK Sync] ${ingestId} - Failed to create ghost session:`, ghostError);
        throw ghostError;
      }

      ghostSessionId = ghostSession.id;
      console.log(`[DK Sync] ${ingestId} - Created Ghost Session: ${ghostSessionId}`);

      // Send notification via SMS if player has phone
      const { data: player } = await supabase
        .from('players')
        .select('phone, sms_opt_in, name')
        .eq('id', playerId)
        .single();

      if (player?.phone && player?.sms_opt_in) {
        try {
          const firstName = player.name?.split(' ')[0] || 'Hey';
          await supabase.functions.invoke('send-sms', {
            body: {
              to: player.phone,
              body: `${firstName}! 👻 I caught ${normalizedSwings.length} swings but I need 5 seconds of info to finish your 4B Report. Tap here to complete it: ${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}.lovableproject.com/player/ghost-recovery?id=${ghostSessionId}`,
            }
          });
          
          // Mark notification as sent
          await supabase
            .from('ghost_sessions')
            .update({ notification_sent: true })
            .eq('id', ghostSessionId);

          console.log(`[DK Sync] ${ingestId} - Ghost notification sent to ${player.phone}`);
        } catch (smsError) {
          console.error(`[DK Sync] ${ingestId} - Failed to send ghost notification:`, smsError);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        ghost_session: true,
        ghost_session_id: ghostSessionId,
        ingest_id: ingestId,
        swing_count: normalizedSwings.length,
        message: 'Swings captured as Ghost Session - awaiting context',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========================================================================
    // NORMAL FLOW: Valid session exists
    // ========================================================================
    
    // Add session_id to all swings
    const swingsWithSession = normalizedSwings.map(s => ({ ...s, session_id: sessionId }));

    // Insert valid swings
    let inserted = 0;
    let duplicates = 0;

    const { data: insertResult, error: insertError } = await supabase
      .from('sensor_swings')
      .insert(swingsWithSession)
      .select('id');

    if (insertError) {
      if (insertError.code === '23505') {
        duplicates = swingsWithSession.length;
      } else {
        throw insertError;
      }
    } else {
      inserted = insertResult?.length || 0;
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
