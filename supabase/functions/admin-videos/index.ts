// =============================================================================
// SECURITY SELF-TEST CHECKLIST
// =============================================================================
// ✅ 1. Admin check via is_admin() RPC happens BEFORE any database mutations
// ✅ 2. Returns 401 { error: "Unauthorized: Admin access required" } if not admin
// ✅ 3. Uses anon key + user token for auth verification (not service_role)
// ✅ 4. Service_role client created ONLY AFTER admin verification passes (line 54-57)
// ✅ 5. No inserts/updates occur before admin check completes (line 45-51)
// ✅ 6. Request body/params parsed AFTER admin verification (line 60-61)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Generate a hash from video URL for deduplication
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)
}

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
    const url = new URL(req.url)
    const videoId = url.searchParams.get('id')

    if (req.method === 'GET') {
      const action = url.searchParams.get('action')

      // Kommodo: list recordings
      if (action === 'kommodo-list') {
        const kommodoApiKey = Deno.env.get('KOMMODO_API_KEY')
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')

        console.log('Fetching recordings from Kommodo...')
        const response = await fetch('https://api.komododecks.com/v1/recordings', {
          headers: { 'Authorization': `Bearer ${kommodoApiKey}` }
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Kommodo list error:', response.status, errorText)
          throw new Error(`Kommodo API error: ${response.status}`)
        }

        const data = await response.json()
        return new Response(
          JSON.stringify({ recordings: data.recordings || data.data || data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

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

    // Kommodo: import recordings
    if (req.method === 'POST') {
      const url2 = new URL(req.url)
      const action = url2.searchParams.get('action')
      
      if (action === 'kommodo-import') {
        const kommodoApiKey = Deno.env.get('KOMMODO_API_KEY')
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')

        const { recording_ids, auto_publish = false } = await req.json()
        if (!recording_ids || !Array.isArray(recording_ids)) throw new Error('recording_ids array required')

        console.log('Importing recordings to permanent storage:', recording_ids)
        const results: { id: string; success: boolean; error?: string; video_id?: string }[] = []

        for (const recordingId of recording_ids) {
          try {
            const response = await fetch(`https://api.komododecks.com/v1/recordings/${recordingId}`, {
              headers: { 'Authorization': `Bearer ${kommodoApiKey}` }
            })
            if (!response.ok) throw new Error(`Failed to fetch recording: ${response.status}`)

            const recording = await response.json()
            const videoUrl = recording.urls?.video || recording.urls?.page || recording.video_url || recording.playback_url || recording.url
            const transcriptUrl = recording.urls?.transcript || null
            const title = recording.title || recording.name || `Imported ${recordingId}`
            const duration = recording.duration || recording.duration_seconds || 0

            if (!videoUrl) throw new Error('No video URL found in recording')

            const fileHash = await hashString(videoUrl + recordingId)
            const { data: existing } = await supabase.rpc('check_academy_video_duplicate', { p_file_hash: fileHash })
            if (existing && existing.length > 0) {
              results.push({ id: recordingId, success: false, error: `Already imported as "${existing[0].title}"` })
              continue
            }

            let transcript = ''
            if (transcriptUrl) {
              try {
                const vttResponse = await fetch(transcriptUrl)
                if (vttResponse.ok) {
                  const vttText = await vttResponse.text()
                  transcript = vttText.split('\n').filter(line => !line.startsWith('WEBVTT') && !line.match(/^\d{2}:\d{2}/) && line.trim() !== '').join(' ').trim()
                }
              } catch (e) { console.error('Failed to fetch transcript:', e) }
            }

            console.log('Downloading video from Kommodo:', videoUrl)
            const videoResponse = await fetch(videoUrl)
            if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.status}`)

            const videoBlob = await videoResponse.blob()
            const contentType = videoResponse.headers.get('content-type') || 'video/mp4'
            const extension = contentType.includes('quicktime') ? 'mov' : contentType.includes('webm') ? 'webm' : 'mp4'

            const storagePath = `drills/kommodo-${recordingId}-${Date.now()}.${extension}`
            const { error: uploadError } = await supabase.storage.from('videos').upload(storagePath, videoBlob, { contentType, cacheControl: '3600', upsert: false })
            if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

            const supabaseUrl = Deno.env.get('SUPABASE_URL')!
            const gumletResponse = await fetch(`${supabaseUrl}/functions/v1/upload-to-gumlet`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
              body: JSON.stringify({ storage_path: storagePath, original_title: title, auto_publish, file_hash: fileHash })
            })

            if (!gumletResponse.ok) throw new Error(`Gumlet processing failed: ${await gumletResponse.text()}`)
            const gumletData = await gumletResponse.json()
            if (!gumletData.success) throw new Error(gumletData.error || 'Gumlet processing failed')

            if (transcript) {
              await supabase.from('drill_videos').update({ transcript, duration_seconds: Math.round(duration) }).eq('id', gumletData.video_id)
              fetch(`${supabaseUrl}/functions/v1/auto-tag-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
                body: JSON.stringify({ video_id: gumletData.video_id, auto_publish })
              }).catch(err => console.error('Failed to trigger auto-tag:', err))
            }

            results.push({ id: recordingId, success: true, video_id: gumletData.video_id })
          } catch (err) {
            console.error('Error importing recording:', recordingId, err)
            results.push({ id: recordingId, success: false, error: err instanceof Error ? err.message : 'Unknown error' })
          }
        }

        return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
