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
