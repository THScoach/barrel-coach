import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verify the caller is an admin user
async function verifyAdmin(req: Request): Promise<{ isAdmin: boolean; error?: string }> {
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

  // Check admin role using the is_admin function
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')
  
  if (roleError || isAdmin !== true) {
    return { isAdmin: false, error: 'Unauthorized: Admin access required' }
  }

  return { isAdmin: true }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify admin access for all requests
  const { isAdmin, error: authError } = await verifyAdmin(req)
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: authError }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Use service role for database operations after admin verification
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { action, sessionId, scores, notes } = await req.json()

    if (action === 'analyze') {
      // Update session with analysis scores
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .update({
          four_b_brain: scores.four_b_brain,
          four_b_body: scores.four_b_body,
          four_b_bat: scores.four_b_bat,
          four_b_ball: scores.four_b_ball,
          composite_score: scores.composite_score,
          grade: scores.grade,
          weakest_category: scores.weakest_category,
          problems_identified: scores.problems_identified,
          status: 'complete',
          analyzed_at: new Date().toISOString(),
          analysis_json: { notes, analyzed_by: 'admin', analyzed_at: new Date().toISOString() }
        })
        .eq('id', sessionId)
        .select()
        .single()

      if (sessionError) throw sessionError

      // Also update the swings with the same scores for consistency
      const { error: swingsError } = await supabase
        .from('swings')
        .update({
          four_b_brain: scores.four_b_brain,
          four_b_body: scores.four_b_body,
          four_b_bat: scores.four_b_bat,
          four_b_ball: scores.four_b_ball,
          composite_score: scores.composite_score,
          grade: scores.grade,
          status: 'complete',
          analyzed_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)

      if (swingsError) {
        console.error('Error updating swings:', swingsError)
      }

      return new Response(
        JSON.stringify({ success: true, session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'sendResults') {
      // Get session details
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (sessionError || !session) {
        throw new Error('Session not found')
      }

      if (!session.player_phone) {
        throw new Error('No phone number for this player')
      }

      // Get the SMS template for analysis complete
      const { data: template } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('trigger_name', 'analysis_complete')
        .eq('is_active', true)
        .single()

      if (!template) {
        throw new Error('No active SMS template for analysis_complete')
      }

      // Replace placeholders in message
      const resultsUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/results/${sessionId}`
      let message = template.message_body
        .replace('{player_name}', session.player_name.split(' ')[0])
        .replace('{results_url}', resultsUrl)
        .replace('{score}', session.composite_score?.toFixed(0) || '—')
        .replace('{grade}', session.grade || '—')

      // Send SMS via Twilio
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        throw new Error('Twilio not configured')
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
      const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`)

      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: session.player_phone,
          From: twilioPhoneNumber,
          Body: message
        })
      })

      if (!twilioRes.ok) {
        const twilioError = await twilioRes.text()
        throw new Error(`Twilio error: ${twilioError}`)
      }

      const twilioData = await twilioRes.json()

      // Log the SMS
      await supabase
        .from('sms_logs')
        .insert({
          session_id: sessionId,
          phone_number: session.player_phone,
          trigger_name: 'analysis_complete_manual',
          message_sent: message,
          twilio_sid: twilioData.sid,
          status: 'sent'
        })

      // Also log to messages table
      await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          phone_number: session.player_phone,
          direction: 'outbound',
          body: message,
          twilio_sid: twilioData.sid,
          status: 'sent'
        })

      return new Response(
        JSON.stringify({ success: true, message: 'Results sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Admin analyzer error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
