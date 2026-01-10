import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

  const { isAdmin, error: authError } = await verifyAdmin(req)
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
    const { session_id } = await req.json()

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get session and analysis
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      throw new Error('Session not found')
    }

    if (session.status !== 'complete') {
      throw new Error('Analysis must be completed before sending results')
    }

    if (!session.player_phone) {
      throw new Error('No phone number for this player')
    }

    // Get analysis for results_sent tracking
    const { data: analysis } = await supabase
      .from('swing_analyses')
      .select('*')
      .eq('session_id', session_id)
      .single()

    // Build results URL
    const baseUrl = Deno.env.get('SITE_URL') || 'https://preview--catching-barrels.lovable.app'
    const resultsUrl = `${baseUrl}/results/${session_id}`

    // Build message
    const firstName = session.player_name.split(' ')[0]
    const message = `Hey ${firstName}! 🔥 Your Swing DNA results are ready.\n\nOverall Score: ${(session.composite_score / 10).toFixed(1)}/10\nGrade: ${session.grade}\n\nCheck out your full report: ${resultsUrl}\n\n- Coach Rick`

    // Send via Twilio
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
    await supabase.from('sms_logs').insert({
      session_id,
      phone_number: session.player_phone,
      trigger_name: 'results_sent',
      message_sent: message,
      twilio_sid: twilioData.sid,
      status: 'sent'
    })

    // Log to messages table
    await supabase.from('messages').insert({
      session_id,
      phone_number: session.player_phone,
      direction: 'outbound',
      body: message,
      twilio_sid: twilioData.sid,
      status: 'sent'
    })

    // Update analysis with results_sent timestamp
    if (analysis) {
      await supabase
        .from('swing_analyses')
        .update({ results_sent_at: new Date().toISOString() })
        .eq('id', analysis.id)
    }

    // Schedule follow-up SMS (3 days)
    await supabase.from('sms_scheduled').insert({
      session_id,
      trigger_name: 'follow_up',
      scheduled_for: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending'
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Results sent!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Send results error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
