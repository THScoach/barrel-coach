import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 10;
const SCORING_VERSION = '4b_v2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { player_id, force_rescore } = body as { player_id?: string; force_rescore?: boolean };

    console.log(`[Backfill] Starting. player_id=${player_id || 'ALL'}, force=${force_rescore || false}`);

    // Query reboot_sessions with CSV data
    let query = supabase
      .from('reboot_sessions')
      .select('id, player_id, reboot_session_id, raw_csv_me, raw_csv_ik, session_date, session_type, drill_name, measured_bat_speed_mph')
      .not('raw_csv_me', 'is', null)
      .order('created_at', { ascending: true });

    if (player_id) {
      query = query.eq('player_id', player_id);
    }

    const { data: rebootSessions, error: fetchError } = await query;

    if (fetchError) {
      console.error('[Backfill] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reboot sessions', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rebootSessions || rebootSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No sessions to process', processed: 0, failed: 0, skipped: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Backfill] Found ${rebootSessions.length} reboot sessions with CSV data`);

    // For each session, check if player_sessions already has scores
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: { session_id: string; error: string }[] = [];

    for (let i = 0; i < rebootSessions.length; i += BATCH_SIZE) {
      const batch = rebootSessions.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (session) => {
        try {
          // Check for existing player_session
          const { data: existing } = await supabase
            .from('player_sessions')
            .select('id, body_score, scored_at, scoring_version')
            .eq('player_id', session.player_id)
            .eq('reboot_session_id', session.reboot_session_id || session.id)
            .maybeSingle();

          // Skip if already scored and not force_rescore
          if (existing && existing.body_score !== null && existing.scored_at && !force_rescore) {
            skipped++;
            return;
          }

          // Validate CSV data
          if (!session.raw_csv_me || session.raw_csv_me.trim().length < 50 || !session.raw_csv_ik || session.raw_csv_ik.trim().length < 50) {
            skipped++;
            return;
          }

          // Call compute-4b-from-csv edge function (CSV parsing + scoring)
          const computeUrl = `${supabaseUrl}/functions/v1/compute-4b-from-csv`;
          const response = await fetch(computeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              player_id: session.player_id,
              session_id: session.reboot_session_id || session.id,
              session_date: session.session_date,
              raw_csv_me: session.raw_csv_me,
              raw_csv_ik: session.raw_csv_ik,
              measured_bat_speed_mph: session.measured_bat_speed_mph,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Scoring failed (${response.status}): ${errText.substring(0, 200)}`);
          }

          const result = await response.json();

          processed++;
          console.log(`[Backfill] ✓ Session ${session.reboot_session_id || session.id} scored: Brain=${result.brain} Body=${result.body} Bat=${result.bat} Ball=${result.ball}`);

        } catch (err) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push({ session_id: session.reboot_session_id || session.id, error: errorMsg });
          console.error(`[Backfill] ✗ Session ${session.reboot_session_id || session.id}: ${errorMsg}`);
        }
      });

      await Promise.all(batchPromises);
      console.log(`[Backfill] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete. Progress: ${processed} scored, ${failed} failed, ${skipped} skipped`);
    }

    const summary = {
      success: true,
      total: rebootSessions.length,
      processed,
      failed,
      skipped,
      scoring_version: SCORING_VERSION,
      errors: errors.slice(0, 20), // Cap error list
    };

    console.log(`[Backfill] Complete. ${JSON.stringify({ processed, failed, skipped, total: rebootSessions.length })}`);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Backfill] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
