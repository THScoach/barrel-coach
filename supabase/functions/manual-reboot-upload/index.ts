import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * manual-reboot-upload
 * 
 * Accepts a single Reboot Motion CSV (either IK or Momentum-Energy),
 * stores raw CSV text + parsed metrics in reboot_sessions,
 * and optionally triggers 4B scoring when both files are present.
 * 
 * FormData: { player_id, file_type: "ik" | "momentum", file: CSV, session_date? }
 */

// ── CSV Metric Extraction ──────────────────────────────────────────────────

interface ParsedMetrics {
  row_count: number;
  columns: string[];
  movement_ids: string[];
  duration_seconds?: number;
  peak_values: Record<string, number>;
  summary: Record<string, number>;
}

function parseCsvText(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    if (vals.length !== headers.length) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx]; });
    rows.push(row);
  }

  return { headers, rows };
}

function extractMetrics(csvText: string, fileType: string): ParsedMetrics {
  const { headers, rows } = parseCsvText(csvText);

  // Collect unique movement IDs
  const movementIds = new Set<string>();
  rows.forEach(r => {
    const mid = r['org_movement_id'] || r['movement_id'] || '';
    if (mid) movementIds.add(mid);
  });

  // Duration from time column
  let duration = 0;
  const timeCol = headers.find(h => h === 'time' || h === 'time_seconds');
  if (timeCol && rows.length > 1) {
    const first = parseFloat(rows[0][timeCol] || '0');
    const last = parseFloat(rows[rows.length - 1][timeCol] || '0');
    duration = Math.abs(last - first);
  }

  // Peak values for numeric columns
  const peakValues: Record<string, number> = {};
  const summaryValues: Record<string, number> = {};
  const numericCols = headers.filter(h => h !== 'time' && h !== 'org_movement_id' && h !== 'movement_id');

  for (const col of numericCols) {
    const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    if (values.length === 0) continue;

    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    // Only track meaningful peaks
    if (max > 0) {
      peakValues[`peak_${col}`] = Math.round(max * 1000) / 1000;
    }
    summaryValues[`avg_${col}`] = Math.round(avg * 1000) / 1000;
  }

  // For momentum files, extract key metrics + mass_total
  if (fileType === 'momentum') {
    const keyCols = ['total_kinetic_energy', 'bat_kinetic_energy', 'legs_kinetic_energy', 'torso_kinetic_energy'];
    for (const col of keyCols) {
      if (headers.includes(col)) {
        const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        if (values.length > 0) {
          peakValues[`peak_${col}`] = Math.round(Math.max(...values) * 1000) / 1000;
        }
      }
    }

    // Extract mass_total (kg) from first data row — constant per athlete
    if (headers.includes('mass_total')) {
      const massVal = parseFloat(rows[0]?.['mass_total'] || '');
      if (!isNaN(massVal) && massVal > 0) {
        summaryValues['mass_total_kg'] = Math.round(massVal * 100) / 100;
        summaryValues['mass_scale_factor'] = Math.round((massVal / 80) * 100) / 100; // relative to 80 kg baseline
      }
    }
  }

  // For IK files, extract key joint angles
  if (fileType === 'ik') {
    const keyCols = ['pelvis_rot', 'torso_rot', 'left_knee', 'right_knee', 'left_elbow', 'right_elbow'];
    for (const col of keyCols) {
      if (headers.includes(col)) {
        const values = rows.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        if (values.length > 0) {
          peakValues[`peak_${col}`] = Math.round(Math.max(...values) * 1000) / 1000;
          peakValues[`min_${col}`] = Math.round(Math.min(...values) * 1000) / 1000;
        }
      }
    }
  }

  return {
    row_count: rows.length,
    columns: headers,
    movement_ids: Array.from(movementIds),
    duration_seconds: Math.round(duration * 100) / 100,
    peak_values: peakValues,
    summary: summaryValues,
  };
}

// ── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const formData = await req.formData();
    const playerId = formData.get('player_id') as string;
    const fileType = formData.get('file_type') as string; // "ik" | "momentum"
    const file = formData.get('file') as File | null;
    const sessionDate = (formData.get('session_date') as string) || new Date().toISOString().split('T')[0];
    const sessionIdOverride = formData.get('session_id') as string | null; // attach to existing session

    if (!playerId || !fileType || !file) {
      return new Response(JSON.stringify({ error: 'player_id, file_type, and file are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['ik', 'momentum'].includes(fileType)) {
      return new Response(JSON.stringify({ error: 'file_type must be "ik" or "momentum"' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[manual-reboot-upload] Player: ${playerId}, Type: ${fileType}, File: ${file.name}, Date: ${sessionDate}`);

    // Read CSV content
    const csvText = await file.text();
    if (!csvText || csvText.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'CSV file is empty or invalid' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract metrics
    const parsedMetrics = extractMetrics(csvText, fileType);
    console.log(`[manual-reboot-upload] Parsed ${parsedMetrics.row_count} rows, ${parsedMetrics.movement_ids.length} movements`);

    // Upload raw file to storage
    const sessionRef = sessionIdOverride || crypto.randomUUID();
    const storagePath = `${playerId}/${sessionRef}/${fileType}.csv`;
    const fileBytes = new TextEncoder().encode(csvText);

    const { error: uploadErr } = await supabase.storage
      .from('reboot-uploads')
      .upload(storagePath, fileBytes, { contentType: 'text/csv', upsert: true });

    if (uploadErr) {
      console.error('[manual-reboot-upload] Storage upload error:', uploadErr);
    }

    // Check if a session record already exists for this player + date + manual source
    let existingSession = null;
    if (sessionIdOverride) {
      const { data } = await supabase
        .from('reboot_sessions')
        .select('*')
        .eq('id', sessionIdOverride)
        .single();
      existingSession = data;
    } else {
      // Look for existing manual session on same date
      const { data } = await supabase
        .from('reboot_sessions')
        .select('*')
        .eq('player_id', playerId)
        .eq('session_date', sessionDate)
        .eq('source', 'manual_upload')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingSession = data;
    }

    let sessionRecord;

    if (existingSession) {
      // Update existing session with new file
      const updateData: Record<string, unknown> = {
        status: 'uploaded',
        updated_at: new Date().toISOString(),
      };

      // Merge parsed metrics
      const existingMetrics = (existingSession as Record<string, unknown>).parsed_metrics as Record<string, unknown> || {};
      updateData.parsed_metrics = {
        ...existingMetrics,
        [fileType]: parsedMetrics,
      };

      if (fileType === 'ik') {
        updateData.raw_csv_ik = csvText;
        updateData.ik_file_path = storagePath;
      } else {
        updateData.raw_csv_me = csvText;
        updateData.me_file_path = storagePath;
      }

      // Check if both files now exist
      const hasIk = fileType === 'ik' || !!(existingSession as Record<string, unknown>).ik_file_path;
      const hasME = fileType === 'momentum' || !!(existingSession as Record<string, unknown>).me_file_path;
      if (hasIk && hasME) {
        updateData.status = 'ready_for_processing';
      }

      const { data, error } = await supabase
        .from('reboot_sessions')
        .update(updateData)
        .eq('id', existingSession.id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update session: ${error.message}`);
      sessionRecord = data;
      console.log(`[manual-reboot-upload] Updated existing session ${existingSession.id}`);
    } else {
      // Create new session record
      const insertData: Record<string, unknown> = {
        player_id: playerId,
        reboot_session_id: `manual-${crypto.randomUUID().slice(0, 8)}`,
        session_date: sessionDate,
        status: 'uploaded',
        source: 'manual_upload',
        movement_type: 'baseball-hitting',
        notes: 'Manual CSV upload',
        parsed_metrics: { [fileType]: parsedMetrics },
      };

      if (fileType === 'ik') {
        insertData.raw_csv_ik = csvText;
        insertData.ik_file_path = storagePath;
      } else {
        insertData.raw_csv_me = csvText;
        insertData.me_file_path = storagePath;
      }

      const { data, error } = await supabase
        .from('reboot_sessions')
        .insert(insertData)
        .select()
        .single();

      if (error) throw new Error(`Failed to create session: ${error.message}`);
      sessionRecord = data;
      console.log(`[manual-reboot-upload] Created new session ${sessionRecord.id}`);
    }

    // Auto-trigger 4B scoring if ME data is present
    let scoringResult = null;
    const hasIk = !!(sessionRecord as Record<string, unknown>).raw_csv_ik;
    const hasME = !!(sessionRecord as Record<string, unknown>).raw_csv_me;

    if (hasME) {
      console.log(`[manual-reboot-upload] ME data present (IK: ${hasIk}), triggering 4B scoring...`);

      // Update status to processing
      await supabase.from('reboot_sessions').update({ status: 'processing' }).eq('id', sessionRecord.id);

      // Pass raw CSV text directly — no fragile signed URL round-trip
      const scoringPayload: Record<string, unknown> = {
        player_id: playerId,
        session_id: (sessionRecord as Record<string, unknown>).reboot_session_id,
        raw_csv_me: (sessionRecord as Record<string, unknown>).raw_csv_me,
      };

      if (hasIk) {
        scoringPayload.raw_csv_ik = (sessionRecord as Record<string, unknown>).raw_csv_ik;
      }

      try {
        const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/calculate-4b-scores`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(scoringPayload),
        });

        scoringResult = await analysisResponse.json();
        console.log('[manual-reboot-upload] 4B result:', JSON.stringify(scoringResult).slice(0, 500));

        if (analysisResponse.ok && !scoringResult.error) {
          await supabase.from('reboot_sessions')
            .update({ status: 'scored', processed_at: new Date().toISOString() })
            .eq('id', sessionRecord.id);
        } else {
          console.error('[manual-reboot-upload] Scoring failed:', scoringResult.error);
          await supabase.from('reboot_sessions')
            .update({ status: 'error', error_message: scoringResult.error || 'Scoring failed' })
            .eq('id', sessionRecord.id);
        }
      } catch (scoringError) {
        console.error('[manual-reboot-upload] Scoring call error:', scoringError);
        await supabase.from('reboot_sessions')
          .update({ status: 'error', error_message: `Scoring error: ${String(scoringError)}` })
          .eq('id', sessionRecord.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: sessionRecord.id,
      file_type: fileType,
      metrics_extracted: parsedMetrics,
      both_files_present: hasIk && hasME,
      scoring: scoringResult?.scores || null,
      message: hasME
        ? `${fileType.toUpperCase()} file uploaded and processed`
        : `${fileType.toUpperCase()} file uploaded. Upload Momentum-Energy CSV to trigger 4B scoring.`,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[manual-reboot-upload] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
