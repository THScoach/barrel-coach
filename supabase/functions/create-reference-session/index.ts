import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user token to verify admin status
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role using RPC
    const { data: isAdmin, error: roleError } = await userClient.rpc('is_admin');
    if (roleError || !isAdmin) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { reference_athlete_id, ...sessionData } = body;

    if (!reference_athlete_id) {
      return new Response(
        JSON.stringify({ error: 'reference_athlete_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key for insert
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify reference athlete exists
    const { data: athlete, error: athleteError } = await adminClient
      .from('reference_athletes')
      .select('id')
      .eq('id', reference_athlete_id)
      .single();

    if (athleteError || !athlete) {
      return new Response(
        JSON.stringify({ error: 'Reference athlete not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await adminClient
      .from('reference_sessions')
      .insert({
        reference_athlete_id,
        reboot_session_id: sessionData.reboot_session_id || null,
        session_date: sessionData.session_date || null,
        body_score: sessionData.body_score || null,
        brain_score: sessionData.brain_score || null,
        bat_score: sessionData.bat_score || null,
        ball_score: sessionData.ball_score || null,
        composite_score: sessionData.composite_score || null,
        pelvis_velocity: sessionData.pelvis_velocity || null,
        torso_velocity: sessionData.torso_velocity || null,
        x_factor: sessionData.x_factor || null,
        transfer_efficiency: sessionData.transfer_efficiency || null,
        bat_ke: sessionData.bat_ke || null,
        ground_flow_score: sessionData.ground_flow_score || null,
        core_flow_score: sessionData.core_flow_score || null,
        upper_flow_score: sessionData.upper_flow_score || null,
        consistency_cv: sessionData.consistency_cv || null,
        consistency_grade: sessionData.consistency_grade || null,
        weakest_link: sessionData.weakest_link || null,
        grade: sessionData.grade || null,
        source: 'reboot'
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, session: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
