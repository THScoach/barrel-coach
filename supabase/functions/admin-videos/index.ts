// =============================================================================
// ADMIN VIDEOS + KOMMODO API - Consolidated admin endpoint
// =============================================================================
// ✅ Admin check via is_admin() RPC happens BEFORE any database mutations
// ✅ Returns 401 if not admin
// ✅ Uses anon key + user token for auth verification
// ✅ Service_role client created ONLY AFTER admin verification passes
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// ── Admin verification ──
async function verifyAdmin(req: Request): Promise<{ isAdmin: boolean; error?: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return { isAdmin: false, error: 'Missing authorization header' }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  })
  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return { isAdmin: false, error: 'Invalid token' }
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')
  if (roleError || isAdmin !== true) return { isAdmin: false, error: 'Unauthorized: Admin access required' }
  return { isAdmin: true }
}

// ── Kommodo HTTP client with rate-limit handling ──
async function kommodoFetch(path: string, apiKey: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`https://api.komododecks.com${path}`)
  if (params) for (const [k, v] of Object.entries(params)) { if (v) url.searchParams.set(k, v) }
  let attempts = 0
  while (attempts < 3) {
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${apiKey}` } })
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
      console.warn(`Kommodo rate limited, retrying in ${retryAfter}s...`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      attempts++
      continue
    }
    if (!res.ok) { const text = await res.text(); throw new Error(`Kommodo API ${res.status}: ${text}`) }
    return res.json()
  }
  throw new Error('Kommodo rate limit exceeded after retries')
}

// ── Title parsing: PlayerLast_PlayerFirst_TeamOrOrg_SessionType_YYYYMMDD_optionalFreeText ──
interface ParsedTitle {
  lastName: string
  firstName: string
  team?: string
  sessionType?: string
  recordingDate?: string // ISO date
}

function parseRecordingTitle(title: string): ParsedTitle | null {
  if (!title) return null
  const parts = title.split('_')
  if (parts.length < 2) return null

  const lastName = parts[0].trim()
  const firstName = parts[1].trim()
  if (!lastName || !firstName) return null

  const result: ParsedTitle = { lastName, firstName }

  if (parts.length >= 3) result.team = parts[2].trim()
  if (parts.length >= 4) result.sessionType = parts[3].trim()
  if (parts.length >= 5) {
    const dateStr = parts[4].trim()
    if (/^\d{8}$/.test(dateStr)) {
      const y = dateStr.slice(0, 4), m = dateStr.slice(4, 6), d = dateStr.slice(6, 8)
      result.recordingDate = `${y}-${m}-${d}`
    }
  }

  return result
}

// ── Respond helper ──
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { isAdmin, error: authError } = await verifyAdmin(req)
  if (!isAdmin) return json({ error: authError }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''
    const videoId = url.searchParams.get('id')
    const kommodoApiKey = Deno.env.get('KOMMODO_API_KEY')

    // ════════════════════════════════════════
    // GET actions
    // ════════════════════════════════════════
    if (req.method === 'GET') {

      // --- Original video CRUD ---
      if (!action) {
        if (videoId) {
          const { data, error } = await supabase.from('drill_videos').select('*').eq('id', videoId).single()
          if (error) throw error
          return json(data)
        } else {
          const { data, error } = await supabase.from('drill_videos').select('*').order('created_at', { ascending: false })
          if (error) throw error
          return json(data)
        }
      }

      // --- Kommodo: list recordings from their API ---
      if (action === 'kommodo-list') {
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')
        const response = await fetch('https://api.komododecks.com/v1/recordings', {
          headers: { 'Authorization': `Bearer ${kommodoApiKey}` }
        })
        if (!response.ok) throw new Error(`Kommodo API error: ${response.status}`)
        const data = await response.json()
        return json({ recordings: data.recordings || data.data || data })
      }

      // --- Kommodo: paginated list with search ---
      if (action === 'kommodo-list-recordings') {
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')
        const page = url.searchParams.get('page') || '1'
        const perPage = url.searchParams.get('per_page') || '25'
        const search = url.searchParams.get('search') || ''
        const data = await kommodoFetch('/v1/recordings', kommodoApiKey, {
          page, pageSize: perPage, ...(search ? { search } : {}),
        })
        return json(data)
      }

      // --- Kommodo: list team members (extracted from recordings) ---
      if (action === 'kommodo-list-members') {
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')
        // Kommodo API has no /v1/team/members endpoint
        // Extract unique creators/members from all recordings instead
        const allRecs = await kommodoFetch('/v1/recordings', kommodoApiKey, { pageSize: '100' })
        const recordings = allRecs.recordings || allRecs.data || allRecs || []
        const membersMap = new Map<string, { id: string; name: string; email?: string; recording_count: number }>()
        for (const rec of recordings) {
          // Parse title to extract member name: LastName_FirstName_...
          const title = rec.title || ''
          const parts = title.split('_')
          if (parts.length >= 2) {
            const memberKey = `${parts[0]}_${parts[1]}`.toLowerCase()
            const memberName = `${parts[1]} ${parts[0]}`
            if (!membersMap.has(memberKey)) {
              membersMap.set(memberKey, { id: memberKey, name: memberName, recording_count: 0 })
            }
            membersMap.get(memberKey)!.recording_count++
          }
        }
        return json({ members: Array.from(membersMap.values()).sort((a, b) => a.name.localeCompare(b.name)) })
      }

      // --- Kommodo: unlinked recordings ---
      if (action === 'kommodo-unlinked') {
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')
        const allRecs = await kommodoFetch('/v1/recordings', kommodoApiKey, { pageSize: '100' })
        const recordings = allRecs.recordings || allRecs.data || allRecs || []
        const { data: linked } = await supabase.from('player_kommodo_recordings').select('kommodo_recording_id')
        const linkedIds = new Set((linked || []).map((r: any) => r.kommodo_recording_id))
        // Normalize field names from Kommodo camelCase to our format
        const normalized = recordings
          .filter((r: any) => !linkedIds.has(r.id))
          .map((r: any) => ({
            ...r,
            created_at: r.createdAt || r.created_at,
          }))
        return json({ recordings: normalized })
      }

      // --- Kommodo: sync status ---
      if (action === 'kommodo-sync-status') {
        const { data } = await supabase
          .from('kommodo_sync_log').select('*')
          .order('started_at', { ascending: false }).limit(1).maybeSingle()
        return json({ last_sync: data })
      }

      // --- Kommodo: player recordings ---
      if (action === 'kommodo-player-recordings') {
        const playerId = url.searchParams.get('player_id')
        if (!playerId) throw new Error('player_id required')
        const { data, error } = await supabase
          .from('player_kommodo_recordings').select('*')
          .eq('player_id', playerId).order('recording_created_at', { ascending: false })
        if (error) throw error
        return json({ recordings: data })
      }
    }

    // ════════════════════════════════════════
    // POST actions
    // ════════════════════════════════════════
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))

      // --- Original Kommodo import (download + Gumlet pipeline) ---
      if (action === 'kommodo-import') {
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')
        const { recording_ids, auto_publish = false } = body
        if (!recording_ids || !Array.isArray(recording_ids)) throw new Error('recording_ids array required')

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
            if (existing && existing.length > 0) { results.push({ id: recordingId, success: false, error: `Already imported as "${existing[0].title}"` }); continue }

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
        return json({ results })
      }

      // --- Kommodo: link recording to player ---
      if (action === 'kommodo-link-recording') {
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')
        const { kommodo_recording_id, player_id } = body
        if (!kommodo_recording_id || !player_id) throw new Error('kommodo_recording_id and player_id required')
        const rec = await kommodoFetch(`/v1/recordings/${kommodo_recording_id}`, kommodoApiKey)
        const { error } = await supabase.from('player_kommodo_recordings').upsert({
          kommodo_recording_id,
          player_id,
          title: rec.title || rec.name || 'Untitled',
          description: rec.description || null,
          duration_seconds: rec.duration || rec.duration_seconds || null,
          thumbnail_url: rec.urls?.poster || rec.thumbnail_url || null,
          video_url: rec.urls?.video || rec.video_url || null,
          page_url: rec.urls?.page || rec.page_url || null,
          kommodo_member_id: rec.member_id || rec.creator_id || null,
          kommodo_member_name: rec.member_name || rec.creator_name || null,
          link_method: 'manual',
          recording_created_at: rec.created_at || null,
        }, { onConflict: 'kommodo_recording_id' })
        if (error) throw error
        return json({ success: true })
      }

      // --- Kommodo: unlink recording ---
      if (action === 'kommodo-unlink-recording') {
        const { kommodo_recording_id } = body
        if (!kommodo_recording_id) throw new Error('kommodo_recording_id required')
        const { error } = await supabase.from('player_kommodo_recordings').delete().eq('kommodo_recording_id', kommodo_recording_id)
        if (error) throw error
        return json({ success: true })
      }

      // --- Kommodo: update player ↔ member mapping ---
      if (action === 'kommodo-update-member-mapping') {
        const { player_id, kommodo_member_id } = body
        if (!player_id) throw new Error('player_id required')
        const { error } = await supabase.from('players').update({ kommodo_member_id: kommodo_member_id || null }).eq('id', player_id)
        if (error) throw error
        return json({ success: true })
      }

      // --- Kommodo: run sync ---
      if (action === 'kommodo-run-sync') {
        if (!kommodoApiKey) throw new Error('KOMMODO_API_KEY not configured')
        console.log('Starting Kommodo sync...')

        const { data: syncLog, error: logErr } = await supabase
          .from('kommodo_sync_log').insert({ status: 'running', triggered_by: 'manual' }).select().single()
        if (logErr) throw logErr

        let recordingsFound = 0, recordingsLinked = 0, recordingsUnlinked = 0

        try {
          const allRecs = await kommodoFetch('/v1/recordings', kommodoApiKey, { per_page: '100' })
          const recordings = allRecs.recordings || allRecs.data || allRecs || []
          recordingsFound = recordings.length

          const { data: linked } = await supabase.from('player_kommodo_recordings').select('kommodo_recording_id')
          const linkedIds = new Set((linked || []).map((r: any) => r.kommodo_recording_id))

          const { data: playersWithMember } = await supabase.from('players').select('id, name, kommodo_member_id').not('kommodo_member_id', 'is', null)
          const memberToPlayer = new Map<string, { id: string; name: string }>()
          for (const p of playersWithMember || []) { if (p.kommodo_member_id) memberToPlayer.set(p.kommodo_member_id, { id: p.id, name: p.name || '' }) }

          const { data: allPlayers } = await supabase.from('players').select('id, name')
          const nameToPlayer = new Map<string, { id: string; name: string }>()
          for (const p of allPlayers || []) {
            if (!p.name) continue
            const parts = p.name.trim().split(/\s+/)
            if (parts.length >= 2) nameToPlayer.set(`${parts[parts.length - 1]}_${parts[0]}`.toLowerCase(), { id: p.id, name: p.name })
          }

          for (const rec of recordings) {
            if (linkedIds.has(rec.id)) continue
            let matchedPlayer: { id: string; name: string } | null = null
            let linkMethod = ''
            let parsedSessionType: string | null = null
            let parsedDate: string | null = null

            // Strategy 1: Name-based parsing (priority)
            const parsed = parseRecordingTitle(rec.title || rec.name || '')
            if (parsed?.lastName && parsed?.firstName) {
              const key = `${parsed.lastName}_${parsed.firstName}`.toLowerCase()
              if (nameToPlayer.has(key)) {
                matchedPlayer = nameToPlayer.get(key)!
                linkMethod = 'auto_name'
                parsedSessionType = parsed.sessionType || null
                parsedDate = parsed.recordingDate || null
              }
            }

            // Strategy 2: Member-based fallback
            const memberId = rec.member_id || rec.creator_id
            if (!matchedPlayer && memberId && memberToPlayer.has(memberId)) {
              matchedPlayer = memberToPlayer.get(memberId)!
              linkMethod = 'auto_member'
            }

            if (matchedPlayer) {
              const { error: insertErr } = await supabase.from('player_kommodo_recordings').insert({
                kommodo_recording_id: rec.id, player_id: matchedPlayer.id,
                title: rec.title || rec.name || 'Untitled', description: rec.description || null,
                duration_seconds: rec.duration || rec.duration_seconds || null,
                thumbnail_url: rec.urls?.poster || rec.thumbnail_url || null,
                video_url: rec.urls?.video || rec.video_url || null,
                page_url: rec.urls?.page || rec.page_url || null,
                kommodo_member_id: memberId || null,
                kommodo_member_name: rec.member_name || rec.creator_name || null,
                link_method: linkMethod, recording_created_at: rec.created_at || null,
                session_type: parsedSessionType,
                recording_date: parsedDate,
              })
              if (!insertErr) { recordingsLinked++; console.log(`Linked "${rec.title}" → ${matchedPlayer.name} (${linkMethod})`) }
            } else { recordingsUnlinked++ }
          }

          await supabase.from('kommodo_sync_log').update({
            status: 'completed', finished_at: new Date().toISOString(),
            recordings_found: recordingsFound, recordings_linked: recordingsLinked, recordings_unlinked: recordingsUnlinked,
          }).eq('id', syncLog.id)

        } catch (syncErr) {
          await supabase.from('kommodo_sync_log').update({
            status: 'failed', finished_at: new Date().toISOString(),
            error: syncErr instanceof Error ? syncErr.message : 'Unknown error', recordings_found: recordingsFound,
          }).eq('id', syncLog.id)
          throw syncErr
        }

        return json({ success: true, recordings_found: recordingsFound, recordings_linked: recordingsLinked, recordings_unlinked: recordingsUnlinked })
      }
    }

    // ════════════════════════════════════════
    // PUT - Update video
    // ════════════════════════════════════════
    if (req.method === 'PUT') {
      const updates = await req.json()
      if (updates.status === 'published' && !updates.published_at) updates.published_at = new Date().toISOString()
      const { data, error } = await supabase.from('drill_videos').update(updates).eq('id', videoId).select().single()
      if (error) throw error
      return json(data)
    }

    // ════════════════════════════════════════
    // DELETE - Delete video
    // ════════════════════════════════════════
    if (req.method === 'DELETE') {
      const { error } = await supabase.from('drill_videos').delete().eq('id', videoId)
      if (error) throw error
      return json({ success: true })
    }

    return json({ error: 'Method not allowed' }, 405)

  } catch (error: unknown) {
    console.error('Admin videos error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})
