import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Parse multipart form data
    const formData = await req.formData();
    const playerId = formData.get('player_id') as string;
    const sessionDate = formData.get('session_date') as string;
    const notes = formData.get('notes') as string | null;
    const meFile = formData.get('me_file') as File | null;
    const ikFile = formData.get('ik_file') as File | null;

    if (!playerId) {
      return new Response(JSON.stringify({ error: 'player_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!meFile) {
      return new Response(JSON.stringify({ error: 'ME (momentum-energy) CSV file is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[manual-reboot-upload] Player: ${playerId}, Date: ${sessionDate}, ME: ${meFile.name}, IK: ${ikFile?.name || 'none'}`);

    // Generate a unique session reference
    const sessionRef = crypto.randomUUID();
    const basePath = `${playerId}/${sessionRef}`;

    // Upload ME file to storage
    const meBytes = new Uint8Array(await meFile.arrayBuffer());
    const mePath = `${basePath}/me.csv`;
    const { error: meUploadErr } = await supabase.storage
      .from('reboot-uploads')
      .upload(mePath, meBytes, { contentType: 'text/csv', upsert: true });

    if (meUploadErr) {
      console.error('[manual-reboot-upload] ME upload error:', meUploadErr);
      return new Response(JSON.stringify({ error: 'Failed to upload ME file', details: meUploadErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload IK file if provided
    let ikPath: string | null = null;
    if (ikFile) {
      const ikBytes = new Uint8Array(await ikFile.arrayBuffer());
      ikPath = `${basePath}/ik.csv`;
      const { error: ikUploadErr } = await supabase.storage
        .from('reboot-uploads')
        .upload(ikPath, ikBytes, { contentType: 'text/csv', upsert: true });

      if (ikUploadErr) {
        console.error('[manual-reboot-upload] IK upload error:', ikUploadErr);
        // Non-fatal — IK is optional
        ikPath = null;
      }
    }

    // Create reboot_sessions record
    const { data: rebootSession, error: sessionErr } = await supabase
      .from('reboot_sessions')
      .insert({
        player_id: playerId,
        reboot_session_id: `manual-${sessionRef}`,
        session_date: sessionDate || new Date().toISOString().split('T')[0],
        status: 'processing',
        notes: notes || 'Manual CSV upload',
        me_file_path: mePath,
        ik_file_path: ikPath,
        movement_type: 'baseball-hitting',
      })
      .select()
      .single();

    if (sessionErr) {
      console.error('[manual-reboot-upload] Session insert error:', sessionErr);
      return new Response(JSON.stringify({ error: 'Failed to create session record', details: sessionErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[manual-reboot-upload] Created reboot_session: ${rebootSession.id}`);

    // Generate signed URLs for the 4B engine
    const { data: meSignedUrl } = await supabase.storage
      .from('reboot-uploads')
      .createSignedUrl(mePath, 3600);

    const downloadUrls: Record<string, string[]> = {
      'momentum-energy': [meSignedUrl?.signedUrl || ''],
      'inverse-kinematics': [],
    };

    if (ikPath) {
      const { data: ikSignedUrl } = await supabase.storage
        .from('reboot-uploads')
        .createSignedUrl(ikPath, 3600);
      downloadUrls['inverse-kinematics'] = [ikSignedUrl?.signedUrl || ''];
    }

    // Trigger calculate-4b-scores
    console.log('[manual-reboot-upload] Triggering 4B engine...');
    const analysisUrl = `${supabaseUrl}/functions/v1/calculate-4b-scores`;
    const analysisResponse = await fetch(analysisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        player_id: playerId,
        session_id: `manual-${sessionRef}`,
        download_urls: downloadUrls,
      }),
    });

    const analysisResult = await analysisResponse.json();
    console.log('[manual-reboot-upload] 4B result:', JSON.stringify(analysisResult).slice(0, 500));

    if (!analysisResponse.ok || analysisResult.error) {
      // Update session with error
      await supabase
        .from('reboot_sessions')
        .update({
          status: 'error',
          error_message: analysisResult.error || 'Processing failed',
        })
        .eq('id', rebootSession.id);

      return new Response(JSON.stringify({
        error: 'Processing failed',
        details: analysisResult.error || analysisResult.details,
        session_id: rebootSession.id,
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark session as completed
    await supabase
      .from('reboot_sessions')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', rebootSession.id);

    return new Response(JSON.stringify({
      success: true,
      session_id: rebootSession.id,
      scores: analysisResult.scores,
      swing_count: analysisResult.swing_count,
      message: `Session processed successfully with ${analysisResult.swing_count || 0} swings`,
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
