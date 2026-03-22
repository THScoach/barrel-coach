import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_SESSIONS = 3; // Reduced cap — each session may trigger Reboot API downloads
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

    // Query reboot_sessions: include file paths so we know which scoring path to take
    let query = supabase
      .from('reboot_sessions')
      .select('id, player_id, reboot_session_id, session_date, session_type, drill_name, measured_bat_speed_mph, me_file_path, ik_file_path, source')
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
    let apiDownloaded = 0;
    const errors: { session_id: string; error: string }[] = [];

    for (const session of rebootSessions) {
      if (processed + failed >= MAX_SESSIONS) {
        skipped += rebootSessions.length - (processed + failed + skipped);
        break;
      }

      try {
        // Check for existing player_session with actual scores
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

        const hasLocalCsv = !!(session.me_file_path);
        const isManualSession = session.reboot_session_id?.startsWith('manual-');
        const isRebootApiSession = !isManualSession && session.source === 'sync';

        if (hasLocalCsv) {
          // PATH A: Local CSV files exist → use compute-4b-from-csv with reboot_db_session_id
          console.log(`[Backfill] Session ${session.reboot_session_id}: PATH A (local CSV)`);
          const response = await fetch(`${supabaseUrl}/functions/v1/compute-4b-from-csv`, {
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
            throw new Error(`compute-4b-from-csv failed (${response.status}): ${resultText.substring(0, 200)}`);
          }
          const result = JSON.parse(resultText);
          processed++;
          console.log(`[Backfill] ✓ Session ${session.reboot_session_id}: Brain=${result.brain} Body=${result.body} Bat=${result.bat}`);

        } else if (isRebootApiSession) {
          // PATH B: Synced session without local CSV → download from Reboot API via reboot-export-data
          console.log(`[Backfill] Session ${session.reboot_session_id}: PATH B (Reboot API download)`);
          const response = await fetch(`${supabaseUrl}/functions/v1/reboot-export-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              session_id: session.reboot_session_id,
              player_id: session.player_id,
              data_types: ['inverse-kinematics', 'momentum-energy'],
              trigger_analysis: true,
            }),
          });

          const resultText = await response.text();
          if (!response.ok) {
            throw new Error(`reboot-export-data failed (${response.status}): ${resultText.substring(0, 200)}`);
          }
          const result = JSON.parse(resultText);
          apiDownloaded++;
          processed++;
          
          const analysisResult = result.analysis_result;
          if (analysisResult?.brain != null) {
            console.log(`[Backfill] ✓ Session ${session.reboot_session_id} (API): Brain=${analysisResult.brain} Body=${analysisResult.body} Bat=${analysisResult.bat}`);
          } else {
            console.log(`[Backfill] ✓ Session ${session.reboot_session_id} (API): export complete, analysis=${analysisResult ? 'returned' : 'null'}`);
          }

        } else {
          // PATH C: Manual session without CSV files — can't score
          console.warn(`[Backfill] Session ${session.reboot_session_id}: no CSV and not a sync session — skipping`);
          skipped++;
        }

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
      api_downloaded: apiDownloaded,
      scoring_version: SCORING_VERSION,
      errors: errors.slice(0, 10),
    };

    console.log(`[Backfill] Complete. ${JSON.stringify({ processed, failed, skipped, apiDownloaded, total: rebootSessions.length })}`);

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
