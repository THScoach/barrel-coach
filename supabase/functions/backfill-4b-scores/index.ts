import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 1; // Process one at a time to avoid memory limits with large CSVs
const SCORING_VERSION = '4b_v2';

// ── Reboot API helpers ──────────────────────────────────────────────────

const REBOOT_API_BASE = 'https://api.rebootmotion.com';

let cachedRebootToken: { token: string; expiresAt: number } | null = null;

async function getRebootAccessToken(): Promise<string> {
  if (cachedRebootToken && Date.now() < cachedRebootToken.expiresAt) {
    return cachedRebootToken.token;
  }
  const username = Deno.env.get('REBOOT_USERNAME');
  const password = Deno.env.get('REBOOT_PASSWORD');
  if (!username || !password) {
    throw new Error('REBOOT_USERNAME/REBOOT_PASSWORD not configured');
  }
  console.log('[Backfill] Fetching Reboot access token');
  const resp = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Reboot OAuth error (${resp.status}): ${err}`);
  }
  const data = await resp.json();
  cachedRebootToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };
  return data.access_token;
}

/**
 * Download ME and IK CSV from Reboot data_export for a given session + player.
 * Tries movement_type_id 2 (hitting) first, then 1 (pitching) as fallback.
 */
async function downloadRebootCSV(
  rebootSessionId: string,
  orgPlayerId: string,
  accessToken: string,
): Promise<{ csvMe?: string; csvIk?: string }> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  for (const mtId of [2, 1, 3]) {
    try {
      // Try ME
      const meResp = await fetch(`${REBOOT_API_BASE}/data_export`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: rebootSessionId,
          org_player_id: orgPlayerId,
          data_type: 'momentum-energy',
          movement_type_id: mtId,
        }),
      });

      if (!meResp.ok) {
        await meResp.text();
        continue;
      }

      const meData = await meResp.json();
      const meUrl = meData.download_urls?.[0] || meData.download_url;
      if (!meUrl) continue;

      // Download ME CSV
      const meCsvResp = await fetch(meUrl);
      if (!meCsvResp.ok) { await meCsvResp.text(); continue; }
      const csvMe = await meCsvResp.text();
      if (csvMe.length < 50) continue;

      console.log(`[Backfill] Downloaded ME CSV (${csvMe.length} chars) for session ${rebootSessionId} mt=${mtId}`);

      // Try IK
      let csvIk: string | undefined;
      try {
        const ikResp = await fetch(`${REBOOT_API_BASE}/data_export`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            session_id: rebootSessionId,
            org_player_id: orgPlayerId,
            data_type: 'inverse-kinematics',
            movement_type_id: mtId,
          }),
        });
        if (ikResp.ok) {
          const ikData = await ikResp.json();
          const ikUrl = ikData.download_urls?.[0] || ikData.download_url;
          if (ikUrl) {
            const ikCsvResp = await fetch(ikUrl);
            if (ikCsvResp.ok) {
              csvIk = await ikCsvResp.text();
              if (csvIk.length < 50) csvIk = undefined;
              else console.log(`[Backfill] Downloaded IK CSV (${csvIk.length} chars)`);
            } else {
              await ikCsvResp.text();
            }
          }
        } else {
          await ikResp.text();
        }
      } catch (e) {
        console.warn(`[Backfill] IK download failed:`, e);
      }

      return { csvMe, csvIk };
    } catch (e) {
      // Try next movement type
    }
  }

  return {};
}

// ── Main handler ────────────────────────────────────────────────────────

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

    // Query reboot_sessions: metadata only (DO NOT load raw_csv_me/ik — too large for memory)
    let query = supabase
      .from('reboot_sessions')
      .select('id, player_id, reboot_session_id, reboot_player_id, session_date, session_type, drill_name, measured_bat_speed_mph')
      .not('reboot_session_id', 'is', null)
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

    console.log(`[Backfill] Found ${rebootSessions.length} reboot sessions to check`);

    // Cache player reboot_athlete_ids for CSV download
    const playerRebootIds = new Map<string, string>();
    let rebootToken: string | null = null;

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    let csvDownloaded = 0;
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

          // Fetch CSV data on-demand (not preloaded — too large for memory)
          const { data: csvData } = await supabase
            .from('reboot_sessions')
            .select('raw_csv_me, raw_csv_ik')
            .eq('id', session.id)
            .single();

          let csvMe = csvData?.raw_csv_me || '';
          let csvIk = csvData?.raw_csv_ik || '';

          if (!csvMe || csvMe.trim().length < 50) {
            if (!session.reboot_session_id) {
              skipped++;
              return;
            }

            // Get the player's reboot_athlete_id (org_player_id)
            let orgPlayerId = session.reboot_player_id;
            if (!orgPlayerId) {
              if (!playerRebootIds.has(session.player_id)) {
                const { data: playerData } = await supabase
                  .from('players')
                  .select('reboot_athlete_id')
                  .eq('id', session.player_id)
                  .maybeSingle();
                playerRebootIds.set(session.player_id, playerData?.reboot_athlete_id || '');
              }
              orgPlayerId = playerRebootIds.get(session.player_id) || '';
            }

            if (!orgPlayerId) {
              console.warn(`[Backfill] No reboot_athlete_id for player ${session.player_id}, skipping`);
              skipped++;
              return;
            }

            // Download CSV from Reboot API
            if (!rebootToken) {
              rebootToken = await getRebootAccessToken();
            }

            const downloadedCsv = await downloadRebootCSV(session.reboot_session_id, orgPlayerId, rebootToken);
            if (!downloadedCsv.csvMe || downloadedCsv.csvMe.trim().length < 50) {
              console.warn(`[Backfill] No ME CSV available from Reboot for session ${session.reboot_session_id}`);
              skipped++;
              return;
            }

            // Store downloaded CSV in reboot_sessions
            const updatePayload: Record<string, string> = { raw_csv_me: downloadedCsv.csvMe };
            if (downloadedCsv.csvIk) updatePayload.raw_csv_ik = downloadedCsv.csvIk;
            
            const { error: csvUpdateErr } = await supabase
              .from('reboot_sessions')
              .update(updatePayload)
              .eq('id', session.id);

            if (csvUpdateErr) {
              console.warn(`[Backfill] Failed to store CSV for session ${session.id}:`, csvUpdateErr.message);
            } else {
              csvDownloaded++;
              console.log(`[Backfill] Stored CSV for session ${session.reboot_session_id}`);
            }

            csvMe = downloadedCsv.csvMe;
            csvIk = downloadedCsv.csvIk || csvIk;
          }

          // Validate CSV data
          if (!csvMe || csvMe.trim().length < 50 || !csvIk || csvIk.trim().length < 50) {
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
              raw_csv_me: csvMe,
              raw_csv_ik: csvIk,
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
      console.log(`[Backfill] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete. Progress: ${processed} scored, ${failed} failed, ${skipped} skipped, ${csvDownloaded} CSVs downloaded`);
    }

    const summary = {
      success: true,
      total: rebootSessions.length,
      processed,
      failed,
      skipped,
      csv_downloaded: csvDownloaded,
      scoring_version: SCORING_VERSION,
      errors: errors.slice(0, 20),
    };

    console.log(`[Backfill] Complete. ${JSON.stringify({ processed, failed, skipped, csvDownloaded, total: rebootSessions.length })}`);

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
