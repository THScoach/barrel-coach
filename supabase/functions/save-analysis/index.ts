import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function verifyAdmin(req: Request): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'Missing authorization header' }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getUser(token)
  
  if (error || !data.user) {
    return { isAdmin: false, error: 'Invalid token' }
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')
  
  if (roleError || isAdmin !== true) {
    return { isAdmin: false, error: 'Unauthorized: Admin access required' }
  }

  return { isAdmin: true, userId: data.user.id }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { isAdmin, userId, error: authError } = await verifyAdmin(req)
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: authError }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json()
    const {
      session_id,
      brain_score,
      body_score,
      bat_score,
      ball_score,
      primary_problem,
      secondary_problems,
      motor_profile,
      coach_notes,
      private_notes,
      recommended_drill_ids,
      is_draft
    } = body

    if (!session_id || !primary_problem) {
      return new Response(
        JSON.stringify({ error: 'session_id and primary_problem are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate overall score and weakest category
    const overall_score = ((brain_score + body_score + bat_score + ball_score) / 4).toFixed(1)
    const scores = { brain: brain_score, body: body_score, bat: bat_score, ball: ball_score }
    const weakest_category = Object.entries(scores).reduce(
      (min, [key, val]) => val < min.val ? { key, val } : min,
      { key: 'brain', val: 10 }
    ).key

    // Calculate grade
    const avgScore = parseFloat(overall_score)
    let grade = 'Needs Work'
    if (avgScore >= 8) grade = 'Elite'
    else if (avgScore >= 7) grade = 'Excellent'
    else if (avgScore >= 6) grade = 'Above Avg'
    else if (avgScore >= 5) grade = 'Average'
    else if (avgScore >= 4) grade = 'Below Avg'

    // Upsert swing_analyses record
    const analysisData = {
      session_id,
      brain_score,
      body_score,
      bat_score,
      ball_score,
      overall_score: parseFloat(overall_score),
      weakest_category,
      primary_problem,
      secondary_problems: secondary_problems || [],
      motor_profile: motor_profile || null,
      coach_notes: coach_notes || null,
      private_notes: private_notes || null,
      recommended_drill_ids: recommended_drill_ids || [],
      analyzed_by: userId,
      updated_at: new Date().toISOString(),
      ...(is_draft ? {} : { report_generated_at: new Date().toISOString() })
    }

    // Check if analysis exists
    const { data: existing } = await supabase
      .from('swing_analyses')
      .select('id')
      .eq('session_id', session_id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('swing_analyses')
        .update(analysisData)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('swing_analyses')
        .insert(analysisData)
    }

    // Update session with scores
    const sessionUpdate: Record<string, unknown> = {
      four_b_brain: brain_score * 10,
      four_b_body: body_score * 10,
      four_b_bat: bat_score * 10,
      four_b_ball: ball_score * 10,
      composite_score: parseFloat(overall_score) * 10,
      grade,
      weakest_category,
      problems_identified: [primary_problem, ...(secondary_problems || [])],
      updated_at: new Date().toISOString()
    }

    if (!is_draft) {
      sessionUpdate.status = 'complete'
      sessionUpdate.analyzed_at = new Date().toISOString()
    } else {
      sessionUpdate.status = 'analyzing'
    }

    await supabase
      .from('sessions')
      .update(sessionUpdate)
      .eq('id', session_id)

    return new Response(
      JSON.stringify({ success: true, overall_score, weakest_category, grade }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Save analysis error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
