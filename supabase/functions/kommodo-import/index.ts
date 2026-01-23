/**
 * KOMMODO IMPORT - Downloads videos to Supabase Storage for permanent hosting
 * 
 * Instead of storing expiring Kommodo signed URLs, this function:
 * 1. Downloads the video from Kommodo
 * 2. Uploads to Supabase Storage (videos bucket)
 * 3. Routes through upload-to-gumlet for HLS streaming
 * 4. Preserves transcript if available
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate a hash from video URL for deduplication
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)
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

    // Import selected recordings - now downloads to Supabase Storage
    if (action === 'import') {
      const { recording_ids, auto_publish = false } = await req.json()

      if (!recording_ids || !Array.isArray(recording_ids)) {
        throw new Error('recording_ids array required')
      }

      console.log('Importing recordings to permanent storage:', recording_ids)
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

          // Extract data from Kommodo response
          const videoUrl = recording.urls?.video || recording.urls?.page || recording.video_url || recording.playback_url || recording.url
          const thumbnailUrl = recording.urls?.poster || recording.thumbnail_url || null
          const transcriptUrl = recording.urls?.transcript || null
          const title = recording.title || recording.name || `Imported ${recordingId}`
          const duration = recording.duration || recording.duration_seconds || 0

          if (!videoUrl) {
            throw new Error('No video URL found in recording')
          }

          // Generate file hash from source URL for deduplication
          const fileHash = await hashString(videoUrl + recordingId)

          // Check if already imported by hash
          const { data: existing } = await supabase
            .rpc('check_academy_video_duplicate', { p_file_hash: fileHash })

          if (existing && existing.length > 0) {
            results.push({ id: recordingId, success: false, error: `Already imported as "${existing[0].title}"` })
            continue
          }

          // Fetch transcript from VTT URL if available
          let transcript = ''
          if (transcriptUrl) {
            try {
              const vttResponse = await fetch(transcriptUrl)
              if (vttResponse.ok) {
                const vttText = await vttResponse.text()
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

          // STEP 1: Download video from Kommodo
          console.log('Downloading video from Kommodo:', videoUrl)
          const videoResponse = await fetch(videoUrl)
          if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.status}`)
          }

          const videoBlob = await videoResponse.blob()
          const contentType = videoResponse.headers.get('content-type') || 'video/mp4'
          const extension = contentType.includes('quicktime') ? 'mov' : 
                           contentType.includes('webm') ? 'webm' : 'mp4'
          
          console.log(`Downloaded video: ${(videoBlob.size / 1024 / 1024).toFixed(2)}MB, type: ${contentType}`)

          // STEP 2: Upload to Supabase Storage
          const storagePath = `drills/kommodo-${recordingId}-${Date.now()}.${extension}`
          
          const { error: uploadError } = await supabase.storage
            .from('videos')
            .upload(storagePath, videoBlob, {
              contentType,
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`)
          }

          console.log('Uploaded to storage:', storagePath)

          // STEP 3: Route through Gumlet pipeline for HLS streaming
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!
          const gumletResponse = await fetch(`${supabaseUrl}/functions/v1/upload-to-gumlet`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              storage_path: storagePath,
              original_title: title,
              auto_publish,
              file_hash: fileHash
            })
          })

          if (!gumletResponse.ok) {
            const errorText = await gumletResponse.text()
            throw new Error(`Gumlet processing failed: ${errorText}`)
          }

          const gumletData = await gumletResponse.json()
          
          if (!gumletData.success) {
            throw new Error(gumletData.error || 'Gumlet processing failed')
          }

          console.log('Gumlet pipeline started for video:', gumletData.video_id)

          // STEP 4: Update record with transcript if available
          if (transcript) {
            await supabase
              .from('drill_videos')
              .update({ 
                transcript,
                duration_seconds: Math.round(duration)
              })
              .eq('id', gumletData.video_id)

            // Trigger auto-tagging with existing transcript
            fetch(`${supabaseUrl}/functions/v1/auto-tag-video`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({ 
                video_id: gumletData.video_id,
                auto_publish
              })
            }).catch(err => console.error('Failed to trigger auto-tag:', err))
          }

          results.push({ id: recordingId, success: true, video_id: gumletData.video_id })

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
