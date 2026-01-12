import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GumletUploadResponse {
  asset_id: string;
  status: string;
  playback_url?: string;
  output_hls_url?: string;
  output_dash_url?: string;
  thumbnail_url?: string;
  duration?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storage_path, original_title, auto_publish = false } = await req.json()

    if (!storage_path) {
      throw new Error('No storage_path provided')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const GUMLET_API_KEY = Deno.env.get('GUMLET_API_KEY')
    const GUMLET_COLLECTION_ID = Deno.env.get('GUMLET_COLLECTION_ID')

    if (!GUMLET_API_KEY || !GUMLET_COLLECTION_ID) {
      console.error('Gumlet credentials not configured')
      throw new Error('Video processing service not configured')
    }

    console.log('Processing video for Gumlet:', storage_path)

    // Step 1: Get signed URL from Supabase Storage (valid for 1 hour for Gumlet to fetch)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('videos')
      .createSignedUrl(storage_path, 60 * 60)

    if (urlError || !urlData?.signedUrl) {
      console.error('URL generation error:', urlError)
      throw new Error('Failed to generate video URL')
    }

    // Step 2: Create asset in Gumlet by providing the source URL
    const gumletResponse = await fetch('https://api.gumlet.com/v1/video/assets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GUMLET_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection_id: GUMLET_COLLECTION_ID,
        input: urlData.signedUrl,
        title: original_title || 'Untitled Video',
        format: 'hls', // Use HLS for adaptive streaming
        per_title_encoding: true, // Optimize quality per video
        mp4_access: true, // Also generate MP4 fallback
      }),
    })

    if (!gumletResponse.ok) {
      const errorText = await gumletResponse.text()
      console.error('Gumlet API error:', gumletResponse.status, errorText)
      throw new Error(`Gumlet API error: ${gumletResponse.status}`)
    }

    const gumletData: GumletUploadResponse = await gumletResponse.json()
    console.log('Gumlet asset created:', gumletData.asset_id)

    // Step 3: Create long-term signed URL for fallback playback
    const { data: longUrlData } = await supabase.storage
      .from('videos')
      .createSignedUrl(storage_path, 60 * 60 * 24 * 365) // 1 year

    // Step 4: Create database record with Gumlet info
    const { data: video, error: dbError } = await supabase
      .from('drill_videos')
      .insert({
        title: original_title || 'Processing...',
        video_url: longUrlData?.signedUrl || urlData.signedUrl,
        gumlet_asset_id: gumletData.asset_id,
        gumlet_playback_url: gumletData.playback_url || null,
        gumlet_hls_url: gumletData.output_hls_url || null,
        status: 'processing'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log('Video record created:', video.id, '- Gumlet processing started')

    // Step 5: Trigger transcription in parallel (fire and forget)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    fetch(`${supabaseUrl}/functions/v1/transcribe-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ 
        video_id: video.id,
        auto_publish: auto_publish
      })
    }).catch(err => console.error('Failed to trigger transcription:', err))

    return new Response(
      JSON.stringify({ 
        success: true, 
        video_id: video.id,
        video_url: longUrlData?.signedUrl || urlData.signedUrl,
        gumlet_asset_id: gumletData.asset_id,
        gumlet_url: gumletData.playback_url,
        hls_url: gumletData.output_hls_url,
        message: 'Upload complete. Gumlet processing and transcription started.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
