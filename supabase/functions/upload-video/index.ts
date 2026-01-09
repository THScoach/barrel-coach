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
    const formData = await req.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string || 'Untitled Video'

    if (!file) {
      throw new Error('No file provided')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'mp4'
    const filename = `${crypto.randomUUID()}.${ext}`
    const storagePath = `drills/${filename}`

    console.log('Uploading video:', filename, 'Size:', file.size)

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }

    // Get signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

    if (!urlData?.signedUrl) {
      throw new Error('Failed to generate video URL')
    }

    // Create database record
    const { data: video, error: dbError } = await supabase
      .from('drill_videos')
      .insert({
        title,
        video_url: urlData.signedUrl,
        status: 'draft'
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw dbError
    }

    console.log('Video record created:', video.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        video_id: video.id,
        video_url: urlData.signedUrl
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
