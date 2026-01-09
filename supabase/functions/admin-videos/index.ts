import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const url = new URL(req.url)
    const videoId = url.searchParams.get('id')

    if (req.method === 'GET') {
      // List all videos or get single video
      if (videoId) {
        const { data, error } = await supabase
          .from('drill_videos')
          .select('*')
          .eq('id', videoId)
          .single()

        if (error) throw error
        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        const { data, error } = await supabase
          .from('drill_videos')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (req.method === 'PUT') {
      // Update video
      const updates = await req.json()
      
      // If publishing, set published_at
      if (updates.status === 'published' && !updates.published_at) {
        updates.published_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('drill_videos')
        .update(updates)
        .eq('id', videoId)
        .select()
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'DELETE') {
      // Delete video
      const { error } = await supabase
        .from('drill_videos')
        .delete()
        .eq('id', videoId)

      if (error) throw error
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Admin videos error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
