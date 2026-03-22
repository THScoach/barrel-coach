import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SESSIONS = 5; // Hard cap per invocation to stay within memory limits
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

    // Query reboot_sessions: metadata ONLY (no CSV columns)
    let query = supabase
      .from('reboot_sessions')
      .select('id, player_id, reboot_session_id, session_date, session_type, drill_name, measured_bat_speed_mph')
      .not('reboot_session_id', 'is', null)
      .order('created_at', { ascending: true });

    if (player_id) {
      query = query.eq('player_id', player_id);
    }

    const { data: rebootSessions, error: fetchError } = await query;

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reboot sessions', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rebootSessions || rebootSessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No sessions to process', processed: 0, failed: 0, skipped: 0, total: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Backfill] Found ${rebootSessions.length} reboot sessions to check`);

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: { session_id: string; error: string }[] = [];

    // Process sessions sequentially, one at a time, capped at MAX_SESSIONS
    for (const session of rebootSessions) {
      if (processed + failed >= MAX_SESSIONS) {
        // Stop processing to avoid memory exhaustion; remaining are "skipped"
        skipped += rebootSessions.length - (processed + failed + skipped);
        break;
      }

      try {
        // Check for existing player_session
        const { data: existing } = await supabase
          .from('player_sessions')
          .select('id, body_score, scored_at')
          .eq('player_id', session.player_id)
          .eq('reboot_session_id', session.reboot_session_id || session.id)
          .maybeSingle();

        if (existing && existing.body_score !== null && existing.scored_at && !force_rescore) {
          skipped++;
          continue;
        }

        // Delegate everything to compute-4b-from-csv via reboot_db_session_id
        // It will fetch CSVs from DB or Reboot API as needed
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
            reboot_db_session_id: session.id,
            measured_bat_speed_mph: session.measured_bat_speed_mph,
          }),
        });

        const resultText = await response.text();

        if (!response.ok) {
          throw new Error(`Scoring failed (${response.status}): ${resultText.substring(0, 200)}`);
        }

        const result = JSON.parse(resultText);
        processed++;
        console.log(`[Backfill] ✓ Session ${session.reboot_session_id || session.id} scored: Brain=${result.brain} Body=${result.body} Bat=${result.bat} Ball=${result.ball}`);

      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ session_id: session.reboot_session_id || session.id, error: errorMsg });
        console.error(`[Backfill] ✗ Session ${session.reboot_session_id || session.id}: ${errorMsg}`);
      }
    }

    const summary = {
      success: true,
      total: rebootSessions.length,
      processed,
      failed,
      skipped,
      scoring_version: SCORING_VERSION,
      errors: errors.slice(0, 10),
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
