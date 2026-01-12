import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('X-API-Key')
  const expectedKey = Deno.env.get('GHL_API_KEY')
  
  // If no key configured yet, allow requests (dev mode)
  if (!expectedKey) {
    console.warn('GHL_API_KEY not configured - allowing request')
    return true
  }
  
  return apiKey === expectedKey
}

function parseRoute(url: URL): { route: string; id: string | null } {
  const pathParts = url.pathname.split('/').filter(Boolean)
  // Path: /ghl-api/player/{id} or /ghl-api/report/{id} or /ghl-api/session/status/{id}
  
  if (pathParts.length >= 3) {
    const resource = pathParts[1] // player, report, or session
    
    if (resource === 'session' && pathParts[2] === 'status' && pathParts[3]) {
      return { route: 'session-status', id: pathParts[3] }
    }
    
    if (resource === 'player' && pathParts[2]) {
      return { route: 'player', id: pathParts[2] }
    }
    
    if (resource === 'report' && pathParts[2]) {
      return { route: 'report', id: pathParts[2] }
    }
  }
  
  return { route: 'unknown', id: null }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Validate API key
  if (!validateApiKey(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Invalid API key' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const url = new URL(req.url)
    const { route, id } = parseRoute(url)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    switch (route) {
      case 'player': {
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Player ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get player info
        const { data: player, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('id', id)
          .single()

        if (playerError || !player) {
          return new Response(
            JSON.stringify({ error: 'Player not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get player's sessions via player_profiles link
        const { data: profile } = await supabase
          .from('player_profiles')
          .select('id')
          .eq('players_id', id)
          .single()

        let sessions = []
        if (profile) {
          const { data: sessionData } = await supabase
            .from('sessions')
            .select('id, status, product_type, created_at, composite_score, report_url, grade, four_b_brain, four_b_body, four_b_bat, four_b_ball')
            .eq('player_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(10)
          
          sessions = sessionData || []
        }

        return new Response(
          JSON.stringify({
            player: {
              id: player.id,
              name: player.name,
              email: player.email,
              phone: player.phone,
              level: player.level,
              age: player.age,
              team: player.team,
              latest_scores: {
                composite: player.latest_composite_score,
                brain: player.latest_brain_score,
                body: player.latest_body_score,
                bat: player.latest_bat_score,
                ball: player.latest_ball_score
              }
            },
            sessions: sessions.map(s => ({
              id: s.id,
              status: s.status,
              product_type: s.product_type,
              created_at: s.created_at,
              composite_score: s.composite_score,
              report_url: s.report_url,
              grade: s.grade
            }))
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'report': {
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', id)
          .single()

        if (sessionError || !session) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            session_id: session.id,
            status: session.status,
            report_url: session.report_url,
            scores: {
              composite: session.composite_score,
              brain: session.four_b_brain,
              body: session.four_b_body,
              bat: session.four_b_bat,
              ball: session.four_b_ball
            },
            grade: session.grade,
            weakest_category: session.weakest_category,
            problems_identified: session.problems_identified,
            created_at: session.created_at,
            analyzed_at: session.analyzed_at
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'session-status': {
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Session ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('id, status, swing_count, swings_required, report_url, updated_at')
          .eq('id', id)
          .single()

        if (sessionError || !session) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            session_id: session.id,
            status: session.status,
            swing_count: session.swing_count || 0,
            swings_required: session.swings_required,
            report_ready: session.status === 'complete' && !!session.report_url,
            updated_at: session.updated_at
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ 
            error: 'Unknown route',
            available_routes: [
              'GET /player/{player_id}',
              'GET /report/{session_id}',
              'GET /session/status/{session_id}'
            ]
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
