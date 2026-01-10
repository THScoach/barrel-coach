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
    const kommodoApiKey = Deno.env.get('KOMMODO_API_KEY')
    if (!kommodoApiKey) {
      throw new Error('KOMMODO_API_KEY not configured')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    // List all recordings from Kommodo
    if (action === 'list') {
      console.log('Fetching recordings from Kommodo...')
      
      const response = await fetch('https://api.komododecks.com/v1/recordings', {
        headers: {
          'Authorization': `Bearer ${kommodoApiKey}`,
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Kommodo list error:', response.status, errorText)
        throw new Error(`Kommodo API error: ${response.status}`)
      }

      const data = await response.json()
      console.log('Kommodo recordings:', data)

      return new Response(
        JSON.stringify({ recordings: data.recordings || data.data || data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Import selected recordings
    if (action === 'import') {
      const { recording_ids, auto_publish = false } = await req.json()

      if (!recording_ids || !Array.isArray(recording_ids)) {
        throw new Error('recording_ids array required')
      }

      console.log('Importing recordings:', recording_ids)
      const results: { id: string; success: boolean; error?: string; video_id?: string }[] = []

      for (const recordingId of recording_ids) {
        try {
          // Fetch full recording details from Kommodo
          const response = await fetch(`https://api.komododecks.com/v1/recordings/${recordingId}`, {
            headers: {
              'Authorization': `Bearer ${kommodoApiKey}`,
            }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch recording: ${response.status}`)
          }

          const recording = await response.json()
          console.log('Recording details:', recording)

          // Extract data from Kommodo response - URLs are nested under 'urls' object
          const videoUrl = recording.urls?.video || recording.urls?.page || recording.video_url || recording.playback_url || recording.url
          const thumbnailUrl = recording.urls?.poster || recording.thumbnail_url || null
          const transcriptUrl = recording.urls?.transcript || null
          const title = recording.title || recording.name || `Imported ${recordingId}`
          const duration = recording.duration || recording.duration_seconds || 0

          if (!videoUrl) {
            throw new Error('No video URL found in recording')
          }

          // Fetch transcript from VTT URL if available
          let transcript = ''
          if (transcriptUrl) {
            try {
              const vttResponse = await fetch(transcriptUrl)
              if (vttResponse.ok) {
                const vttText = await vttResponse.text()
                // Parse VTT to plain text (remove timestamps and WEBVTT header)
                transcript = vttText
                  .split('\n')
                  .filter(line => !line.startsWith('WEBVTT') && !line.match(/^\d{2}:\d{2}/) && line.trim() !== '')
                  .join(' ')
                  .trim()
                console.log('Fetched transcript length:', transcript.length)
              }
            } catch (e) {
              console.error('Failed to fetch transcript:', e)
            }
          }

          // Check if already imported
          const { data: existing } = await supabase
            .from('drill_videos')
            .select('id')
            .eq('video_url', videoUrl)
            .single()

          if (existing) {
            results.push({ id: recordingId, success: false, error: 'Already imported' })
            continue
          }

          // Insert into drill_videos
          const { data: video, error: dbError } = await supabase
            .from('drill_videos')
            .insert({
              title,
              video_url: videoUrl,
              thumbnail_url: thumbnailUrl,
              transcript,
              duration_seconds: Math.round(duration),
              status: transcript ? 'analyzing' : 'ready_for_review'
            })
            .select()
            .single()

          if (dbError) {
            throw dbError
          }

          console.log('Imported video:', video.id)

          // If we have a transcript, trigger auto-tagging
          if (transcript) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!
            fetch(`${supabaseUrl}/functions/v1/auto-tag-video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({ 
                video_id: video.id,
                auto_publish
              })
            }).catch(err => console.error('Failed to trigger auto-tag:', err))
          }

          results.push({ id: recordingId, success: true, video_id: video.id })

        } catch (err) {
          console.error('Error importing recording:', recordingId, err)
          results.push({ 
            id: recordingId, 
            success: false, 
            error: err instanceof Error ? err.message : 'Unknown error' 
          })
        }
      }

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Unknown action: ${action}`)

  } catch (error: unknown) {
    console.error('Kommodo import error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
