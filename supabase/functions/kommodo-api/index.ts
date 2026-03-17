/**
 * KOMMODO API - Unified backend client for Kommodo.ai REST API
 * 
 * Actions (all admin-verified):
 *   GET  ?action=list-recordings[&page=1&per_page=25&search=...]
 *   GET  ?action=get-recording&recording_id=xxx
 *   GET  ?action=list-members
 *   GET  ?action=unlinked-recordings
 *   GET  ?action=sync-status
 *   POST ?action=run-sync
 *   POST ?action=link-recording   { kommodo_recording_id, player_id }
 *   POST ?action=unlink-recording { kommodo_recording_id }
 *   POST ?action=update-member-mapping { player_id, kommodo_member_id }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Kommodo HTTP client with rate-limit handling ──

async function kommodoFetch(path: string, apiKey: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`https://api.komododecks.com${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v)
    }
  }

  let attempts = 0
  while (attempts < 3) {
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10)
      console.warn(`Kommodo rate limited, retrying in ${retryAfter}s...`)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      attempts++
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Kommodo API ${res.status}: ${text}`)
    }

    return res.json()
  }
  throw new Error('Kommodo rate limit exceeded after retries')
}

// ── Admin verification (same pattern as admin-videos) ──

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
  if (error || !data.user) return { isAdmin: false, error: 'Invalid token' }

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')
  if (roleError || isAdmin !== true) return { isAdmin: false, error: 'Unauthorized: Admin access required' }

  return { isAdmin: true }
}

// ── Auto-linking: parse "LastName_FirstName_Type_Date" titles ──

function parseRecordingTitle(title: string): { lastName?: string; firstName?: string } | null {
  if (!title) return null
  // Try underscore pattern: Smith_John_BP_20250315
  const parts = title.split('_')
  if (parts.length >= 2) {
    return { lastName: parts[0].trim(), firstName: parts[1].trim() }
  }
  return null
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Admin check for ALL requests
  const { isAdmin, error: authError } = await verifyAdmin(req)
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: authError }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const kommodoApiKey = Deno.env.get('KOMMODO_API_KEY')
  if (!kommodoApiKey) {
    return new Response(JSON.stringify({ error: 'KOMMODO_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''

    // ── GET actions ──

    if (req.method === 'GET') {
      if (action === 'list-recordings') {
        const page = url.searchParams.get('page') || '1'
        const perPage = url.searchParams.get('per_page') || '25'
        const search = url.searchParams.get('search') || ''
        const data = await kommodoFetch('/v1/recordings', kommodoApiKey, {
          page, per_page: perPage, ...(search ? { search } : {}),
        })
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'get-recording') {
        const recordingId = url.searchParams.get('recording_id')
        if (!recordingId) throw new Error('recording_id required')
        const data = await kommodoFetch(`/v1/recordings/${recordingId}`, kommodoApiKey)
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'list-members') {
        const data = await kommodoFetch('/v1/team/members', kommodoApiKey)
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'unlinked-recordings') {
        // Get all Kommodo recordings, then subtract already-linked ones
        const allRecs = await kommodoFetch('/v1/recordings', kommodoApiKey, { per_page: '100' })
        const recordings = allRecs.recordings || allRecs.data || allRecs || []

        const { data: linked } = await supabase
          .from('player_kommodo_recordings')
          .select('kommodo_recording_id')

        const linkedIds = new Set((linked || []).map((r: any) => r.kommodo_recording_id))
        const unlinked = recordings.filter((r: any) => !linkedIds.has(r.id))

        return new Response(JSON.stringify({ recordings: unlinked }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'sync-status') {
        const { data } = await supabase
          .from('kommodo_sync_log')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        return new Response(JSON.stringify({ last_sync: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'player-recordings') {
        const playerId = url.searchParams.get('player_id')
        if (!playerId) throw new Error('player_id required')
        const { data, error } = await supabase
          .from('player_kommodo_recordings')
          .select('*')
          .eq('player_id', playerId)
          .order('recording_created_at', { ascending: false })
        if (error) throw error
        return new Response(JSON.stringify({ recordings: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ── POST actions ──

    if (req.method === 'POST') {
      const body = await req.json()

      if (action === 'link-recording') {
        const { kommodo_recording_id, player_id } = body
        if (!kommodo_recording_id || !player_id) throw new Error('kommodo_recording_id and player_id required')

        // Fetch recording details from Kommodo
        const rec = await kommodoFetch(`/v1/recordings/${kommodo_recording_id}`, kommodoApiKey)

        const { error } = await supabase
          .from('player_kommodo_recordings')
          .upsert({
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
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'unlink-recording') {
        const { kommodo_recording_id } = body
        if (!kommodo_recording_id) throw new Error('kommodo_recording_id required')

        const { error } = await supabase
          .from('player_kommodo_recordings')
          .delete()
          .eq('kommodo_recording_id', kommodo_recording_id)

        if (error) throw error
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'update-member-mapping') {
        const { player_id, kommodo_member_id } = body
        if (!player_id) throw new Error('player_id required')

        const { error } = await supabase
          .from('players')
          .update({ kommodo_member_id: kommodo_member_id || null })
          .eq('id', player_id)

        if (error) throw error
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (action === 'run-sync') {
        console.log('Starting Kommodo sync...')

        // Create sync log entry
        const { data: syncLog, error: logErr } = await supabase
          .from('kommodo_sync_log')
          .insert({ status: 'running', triggered_by: 'manual' })
          .select()
          .single()
        if (logErr) throw logErr

        let recordingsFound = 0
        let recordingsLinked = 0
        let recordingsUnlinked = 0

        try {
          // Fetch all recordings from Kommodo
          const allRecs = await kommodoFetch('/v1/recordings', kommodoApiKey, { per_page: '100' })
          const recordings = allRecs.recordings || allRecs.data || allRecs || []
          recordingsFound = recordings.length

          // Get already-linked recording IDs
          const { data: linked } = await supabase
            .from('player_kommodo_recordings')
            .select('kommodo_recording_id')
          const linkedIds = new Set((linked || []).map((r: any) => r.kommodo_recording_id))

          // Get players with kommodo_member_id for member-based matching
          const { data: playersWithMember } = await supabase
            .from('players')
            .select('id, name, kommodo_member_id')
            .not('kommodo_member_id', 'is', null)

          const memberToPlayer = new Map<string, { id: string; name: string }>()
          for (const p of playersWithMember || []) {
            if (p.kommodo_member_id) memberToPlayer.set(p.kommodo_member_id, { id: p.id, name: p.name || '' })
          }

          // Get all players for name-based matching
          const { data: allPlayers } = await supabase
            .from('players')
            .select('id, name')

          // Build name lookup (lowercase "last first" → player)
          const nameToPlayer = new Map<string, { id: string; name: string }>()
          for (const p of allPlayers || []) {
            if (!p.name) continue
            const parts = p.name.trim().split(/\s+/)
            if (parts.length >= 2) {
              const lastFirst = `${parts[parts.length - 1]}_${parts[0]}`.toLowerCase()
              nameToPlayer.set(lastFirst, { id: p.id, name: p.name })
            }
          }

          // Process each new recording
          for (const rec of recordings) {
            if (linkedIds.has(rec.id)) continue

            let matchedPlayer: { id: string; name: string } | null = null
            let linkMethod = ''

            // Strategy 1: Member-based mapping
            const memberId = rec.member_id || rec.creator_id
            if (memberId && memberToPlayer.has(memberId)) {
              matchedPlayer = memberToPlayer.get(memberId)!
              linkMethod = 'auto_member'
            }

            // Strategy 2: Name-based parsing from title
            if (!matchedPlayer) {
              const parsed = parseRecordingTitle(rec.title || rec.name || '')
              if (parsed?.lastName && parsed?.firstName) {
                const key = `${parsed.lastName}_${parsed.firstName}`.toLowerCase()
                if (nameToPlayer.has(key)) {
                  matchedPlayer = nameToPlayer.get(key)!
                  linkMethod = 'auto_name'
                }
              }
            }

            if (matchedPlayer) {
              const { error: insertErr } = await supabase
                .from('player_kommodo_recordings')
                .insert({
                  kommodo_recording_id: rec.id,
                  player_id: matchedPlayer.id,
                  title: rec.title || rec.name || 'Untitled',
                  description: rec.description || null,
                  duration_seconds: rec.duration || rec.duration_seconds || null,
                  thumbnail_url: rec.urls?.poster || rec.thumbnail_url || null,
                  video_url: rec.urls?.video || rec.video_url || null,
                  page_url: rec.urls?.page || rec.page_url || null,
                  kommodo_member_id: memberId || null,
                  kommodo_member_name: rec.member_name || rec.creator_name || null,
                  link_method: linkMethod,
                  recording_created_at: rec.created_at || null,
                })

              if (!insertErr) {
                recordingsLinked++
                console.log(`Linked "${rec.title}" → ${matchedPlayer.name} (${linkMethod})`)
              }
            } else {
              recordingsUnlinked++
            }
          }

          // Update sync log as completed
          await supabase
            .from('kommodo_sync_log')
            .update({
              status: 'completed',
              finished_at: new Date().toISOString(),
              recordings_found: recordingsFound,
              recordings_linked: recordingsLinked,
              recordings_unlinked: recordingsUnlinked,
            })
            .eq('id', syncLog.id)

        } catch (syncErr) {
          await supabase
            .from('kommodo_sync_log')
            .update({
              status: 'failed',
              finished_at: new Date().toISOString(),
              error: syncErr instanceof Error ? syncErr.message : 'Unknown error',
              recordings_found: recordingsFound,
            })
            .eq('id', syncLog.id)
          throw syncErr
        }

        return new Response(JSON.stringify({
          success: true,
          recordings_found: recordingsFound,
          recordings_linked: recordingsLinked,
          recordings_unlinked: recordingsUnlinked,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    throw new Error(`Unknown action: ${action}`)

  } catch (error: unknown) {
    console.error('Kommodo API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
