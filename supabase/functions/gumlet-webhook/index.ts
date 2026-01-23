import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gumlet Webhook Handler
 * 
 * This function receives webhooks from Gumlet when video processing completes.
 * It updates the drill_videos table with the final playback URLs.
 * 
 * Gumlet webhook payload structure:
 * {
 *   "event": "video.ready" | "video.failed",
 *   "asset_id": "string",
 *   "status": "ready" | "failed",
 *   "output": {
 *     "playback_url": "string",
 *     "hls_url": "string", 
 *     "dash_url": "string",
 *     "thumbnail_url": "string",
 *     "duration": number
 *   }
 * }
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    
    console.log('Gumlet webhook received:', JSON.stringify(payload, null, 2))
    
    const { event, asset_id, status, output } = payload

    if (!asset_id) {
      console.error('No asset_id in webhook payload')
      return new Response(
        JSON.stringify({ error: 'Missing asset_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find the video by Gumlet asset ID
    const { data: video, error: findError } = await supabase
      .from('drill_videos')
      .select('id, status')
      .eq('gumlet_asset_id', asset_id)
      .single()

    if (findError || !video) {
      console.error('Video not found for asset_id:', asset_id, findError)
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update based on event type
    if (event === 'video.ready' && status === 'ready' && output) {
      console.log('Video ready, updating with Gumlet URLs:', video.id)
      
      // Extract thumbnail URL from various possible field names in Gumlet response
      const thumbnailUrl = output.thumbnail_url 
        || output.poster_url 
        || output.thumbnail 
        || output.poster
        || (output.thumbnails && output.thumbnails[0])
        || null
      
      console.log('Thumbnail URL extracted:', thumbnailUrl)
      
      const { error: updateError } = await supabase
        .from('drill_videos')
        .update({
          gumlet_playback_url: output.playback_url || null,
          gumlet_hls_url: output.hls_url || output.output_hls_url || null,
          gumlet_dash_url: output.dash_url || output.output_dash_url || null,
          thumbnail_url: thumbnailUrl,
          duration_seconds: output.duration ? Math.round(output.duration) : null,
          // Don't change status here - let transcription/tagging pipeline handle it
        })
        .eq('id', video.id)

      if (updateError) {
        console.error('Error updating video:', updateError)
        throw updateError
      }

      console.log('Video updated successfully with thumbnail:', video.id, thumbnailUrl)
    } else if (event === 'video.failed' || status === 'failed') {
      console.error('Gumlet processing failed for video:', video.id)
      
      // Mark as failed but keep original video_url as fallback
      await supabase
        .from('drill_videos')
        .update({
          status: 'processing_failed'
        })
        .eq('id', video.id)
    }

    return new Response(
      JSON.stringify({ success: true, video_id: video.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
