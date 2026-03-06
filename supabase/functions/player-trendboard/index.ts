import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Extract playerId from body (edge functions don't have path params)
    const { playerId } = await req.json();
    if (!playerId) {
      return new Response(JSON.stringify({ error: 'playerId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch last 20 sessions with scores, ordered ascending
    const { data, error } = await supabase
      .from('reboot_swing_sessions')
      .select(`
        id,
        session_date,
        created_at,
        swing_scores (
          platform_score,
          swing_window_score,
          body_score,
          brain_score,
          bat_score,
          ball_score,
          ev_floor,
          ev_gap,
          created_at
        )
      `)
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return new Response(JSON.stringify({ error: 'Query failed', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Flatten: take first score per session, reverse to ascending order
    const trend = (data || [])
      .filter((s: any) => s.swing_scores && s.swing_scores.length > 0)
      .map((s: any) => {
        const sc = s.swing_scores[0];
        return {
          session_date: s.session_date,
          created_at: sc.created_at,
          platform_score: sc.platform_score,
          swing_window_score: sc.swing_window_score,
          body_score: sc.body_score,
          brain_score: sc.brain_score,
          bat_score: sc.bat_score,
          ball_score: sc.ball_score,
          ev_floor: sc.ev_floor,
          ev_gap: sc.ev_gap,
        };
      })
      .reverse();

    return new Response(JSON.stringify({ trend }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
