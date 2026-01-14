import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// SECURITY SELF-TEST CHECKLIST
// =============================================================================
// ✅ 1. Admin check via is_admin() RPC happens BEFORE any database mutations
// ✅ 2. Returns 403 { error: "Admin access required" } if is_admin() = false
// ✅ 3. Request body fields 'is_admin', 'role', 'user_id' are explicitly IGNORED
// ✅ 4. Uses service_role only AFTER admin verification passes
// ✅ 5. No inserts/updates occur before admin check completes
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate score is a number or null
function isValidScore(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'number' && !isNaN(value));
}

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

    // Parse request body - SECURITY: explicitly ignore any role/admin fields
    const body = await req.json();
    const { 
      reference_athlete_id, 
      // SECURITY: Destructure and IGNORE these fields - never trust client-provided auth claims
      is_admin: _ignoredIsAdmin,
      role: _ignoredRole,
      user_id: _ignoredUserId,
      ...sessionData 
    } = body;
    // Log if client attempted to pass privileged fields (for security audit)
    if (_ignoredIsAdmin !== undefined || _ignoredRole !== undefined || _ignoredUserId !== undefined) {
      console.warn('SECURITY: Client attempted to pass privileged fields - ignored');
    }

    // Validate reference_athlete_id is a valid UUID
    if (!reference_athlete_id || typeof reference_athlete_id !== 'string' || !UUID_REGEX.test(reference_athlete_id)) {
      return new Response(
        JSON.stringify({ error: 'reference_athlete_id must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate score fields are numbers or null
    const scoreFields = ['composite_score', 'body_score', 'brain_score', 'bat_score', 'ball_score', 
                         'pelvis_velocity', 'torso_velocity', 'x_factor', 'transfer_efficiency', 
                         'bat_ke', 'ground_flow_score', 'core_flow_score', 'upper_flow_score', 'consistency_cv'];
    
    for (const field of scoreFields) {
      if (sessionData[field] !== undefined && !isValidScore(sessionData[field])) {
        return new Response(
          JSON.stringify({ error: `${field} must be a number or null` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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

    // Check for duplicate reboot_session_id if provided
    if (sessionData.reboot_session_id) {
      const { data: existingSession } = await adminClient
        .from('reference_sessions')
        .select('id, reference_athlete_id')
        .eq('reboot_session_id', sessionData.reboot_session_id)
        .maybeSingle();

      if (existingSession) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            already_imported: true,
            message: 'Already imported',
            existing_session_id: existingSession.id 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
      // Handle unique constraint violation at DB level as fallback
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            already_imported: true,
            message: 'Already imported' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Insert error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to create reference session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, session: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in create-reference-session');
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
