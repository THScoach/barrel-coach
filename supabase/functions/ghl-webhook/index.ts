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

const VALID_EVENTS = ['session_created', 'payment_confirmed', 'video_uploaded', 'report_ready']

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
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
    const payload = await req.json()
    
    // Validate required fields
    if (!payload.event) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: event' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!VALID_EVENTS.includes(payload.event)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid event type: ${payload.event}`,
          valid_events: VALID_EVENTS 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Log the webhook to database
    const { data: logEntry, error: logError } = await supabase
      .from('ghl_webhook_logs')
      .insert({
        event_type: payload.event,
        session_id: payload.session_id || null,
        player_id: payload.player_id || null,
        payload: payload,
        status: 'received'
      })
      .select()
      .single()

    if (logError) {
      console.error('Failed to log webhook:', logError)
      // Continue processing even if logging fails
    }

    // Process event based on type
    let processResult = { success: true }
    
    switch (payload.event) {
      case 'session_created':
        console.log('Processing session_created event:', payload.session_id)
        break
        
      case 'payment_confirmed':
        console.log('Processing payment_confirmed event:', payload.session_id)
        break
        
      case 'video_uploaded':
        console.log('Processing video_uploaded event:', payload.session_id)
        break
        
      case 'report_ready':
        console.log('Processing report_ready event:', payload.session_id)
        break
    }

    // Update log status to processed
    if (logEntry?.id) {
      await supabase
        .from('ghl_webhook_logs')
        .update({ status: 'processed' })
        .eq('id', logEntry.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Event ${payload.event} received and processed`,
        log_id: logEntry?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
