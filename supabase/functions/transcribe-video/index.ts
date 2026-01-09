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

  try {
    const { video_id } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('drill_videos')
      .select('video_url')
      .eq('id', video_id)
      .single()

    if (videoError || !video) {
      throw new Error('Video not found')
    }

    // Update status to processing
    await supabase
      .from('drill_videos')
      .update({ status: 'processing' })
      .eq('id', video_id)

    console.log('Downloading video from:', video.video_url)

    // Download video file
    const videoResponse = await fetch(video.video_url)
    if (!videoResponse.ok) {
      throw new Error('Failed to download video')
    }
    
    const videoBlob = await videoResponse.blob()
    console.log('Video downloaded, size:', videoBlob.size)

    // Send to OpenAI Whisper
    const formData = new FormData()
    formData.append('file', videoBlob, 'video.mp4')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'segment')

    console.log('Sending to Whisper API...')

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text()
      console.error('Whisper API error:', errorText)
      throw new Error(`Whisper API error: ${whisperResponse.status}`)
    }

    const whisperData = await whisperResponse.json()
    console.log('Transcription complete, duration:', whisperData.duration)

    // Extract transcript and segments
    const transcript = whisperData.text
    const segments = whisperData.segments?.map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    })) || []

    // Update database with transcript
    const { error: updateError } = await supabase
      .from('drill_videos')
      .update({ 
        transcript,
        transcript_segments: segments,
        duration_seconds: Math.round(whisperData.duration || 0),
        status: 'draft'
      })
      .eq('id', video_id)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcript, 
        segments,
        duration: whisperData.duration 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Transcription error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
