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
    const { video_id, auto_publish = false } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const kommodoApiKey = Deno.env.get('KOMMODO_API_KEY')
    if (!kommodoApiKey) {
      throw new Error('KOMMODO_API_KEY not configured')
    }

    // Get video details
    const { data: video, error: videoError } = await supabase
      .from('drill_videos')
      .select('video_url')
      .eq('id', video_id)
      .single()

    if (videoError || !video) {
      throw new Error('Video not found')
    }

    // Update status to transcribing
    await supabase
      .from('drill_videos')
      .update({ status: 'transcribing' })
      .eq('id', video_id)

    console.log('Starting Kommodo transcription for video:', video_id)
    console.log('Video URL:', video.video_url)

    // Step 1: Create transcription job with Kommodo
    const createJobResponse = await fetch('https://api.komododecks.com/v1/transcribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kommodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: video.video_url,
        language: 'en',
        response_format: 'verbose_json'
      })
    })

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text()
      console.error('Kommodo create job error:', errorText)
      
      await supabase
        .from('drill_videos')
        .update({ status: 'failed' })
        .eq('id', video_id)
        
      throw new Error(`Kommodo API error: ${createJobResponse.status} - ${errorText}`)
    }

    const jobData = await createJobResponse.json()
    console.log('Kommodo job created:', jobData)

    // Check if we got immediate results or need to poll
    let transcriptData = jobData

    // If job_id returned, poll for completion
    if (jobData.job_id && !jobData.text) {
      console.log('Polling for job completion:', jobData.job_id)
      
      const maxAttempts = 60 // 5 minutes max (5 sec intervals)
      let attempts = 0
      let completed = false

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
        attempts++

        const statusResponse = await fetch(`https://api.komododecks.com/v1/transcribe/${jobData.job_id}`, {
          headers: {
            'Authorization': `Bearer ${kommodoApiKey}`,
          }
        })

        if (!statusResponse.ok) {
          console.error('Status check failed:', await statusResponse.text())
          continue
        }

        const statusData = await statusResponse.json()
        console.log(`Poll attempt ${attempts}:`, statusData.status)

        if (statusData.status === 'completed' || statusData.text) {
          transcriptData = statusData
          completed = true
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          await supabase
            .from('drill_videos')
            .update({ status: 'failed' })
            .eq('id', video_id)
          throw new Error('Kommodo transcription failed')
        }
      }

      if (!completed) {
        await supabase
          .from('drill_videos')
          .update({ status: 'failed' })
          .eq('id', video_id)
        throw new Error('Transcription timeout')
      }
    }

    console.log('Transcription complete!')

    // Extract transcript and segments from Kommodo response
    const transcript = transcriptData.text || transcriptData.transcript || ''
    const segments = (transcriptData.segments || transcriptData.words || []).map((seg: any) => ({
      start: seg.start || seg.startTime || 0,
      end: seg.end || seg.endTime || 0,
      text: (seg.text || seg.word || '').trim(),
    }))
    const duration = transcriptData.duration || transcriptData.duration_seconds || 0

    // Update database with transcript - status: analyzing
    const { error: updateError } = await supabase
      .from('drill_videos')
      .update({ 
        transcript,
        transcript_segments: segments,
        duration_seconds: Math.round(duration),
        status: 'analyzing'
      })
      .eq('id', video_id)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw updateError
    }

    console.log('Transcription saved, triggering auto-tag...')

    // Automatically trigger auto-tag (chain the pipeline)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    fetch(`${supabaseUrl}/functions/v1/auto-tag-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ 
        video_id,
        auto_publish
      })
    }).catch(err => console.error('Failed to trigger auto-tag:', err))

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcript, 
        segments,
        duration,
        message: 'Transcription complete. Auto-tagging started.'
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
