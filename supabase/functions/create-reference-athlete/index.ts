import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Valid levels for reference athletes
const VALID_LEVELS = ['MLB', 'MiLB', 'NCAA', 'Indy', 'International'] as const;

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
    const {
      display_name,
      level,
      handedness,
      archetype,
      notes,
      reboot_athlete_id
    } = body;

    // Input validation
    if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'display_name is required and must be a non-empty string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!level || !VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) {
      return new Response(
        JSON.stringify({ error: `level must be one of: ${VALID_LEVELS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role key for insert
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await adminClient
      .from('reference_athletes')
      .insert({
        display_name,
        level,
        handedness: handedness || null,
        archetype: archetype || null,
        notes: notes || null,
        reboot_athlete_id: reboot_athlete_id || null,
        visibility: 'internal_only'
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to create reference athlete' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, athlete: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in create-reference-athlete');
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
