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

    // Get video transcript
    const { data: video, error: videoError } = await supabase
      .from('drill_videos')
      .select('transcript, title, description, transcript_segments')
      .eq('id', video_id)
      .single()

    if (videoError || !video) {
      throw new Error('Video not found')
    }

    if (!video.transcript) {
      throw new Error('No transcript found. Please transcribe the video first.')
    }

    console.log('Analyzing transcript for video:', video_id)

    // Use Lovable AI Gateway for comprehensive analysis
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You analyze baseball coaching video transcripts from Coach Rick and generate comprehensive metadata.

Coach Rick uses the "4B System" for hitting analysis:
- Brain: timing, pitch recognition, mental approach, sequencing
- Body: lower half, hip rotation, weight transfer, ground force
- Bat: swing path, bat lag, hand position, bat speed
- Ball: contact point, barrel accuracy, launch angle, exit velocity

Return ONLY valid JSON with ALL these fields:
{
  "title": "Clear, specific title that describes what this video teaches (e.g., 'Fix Your Hip Rotation with the Wall Drill' or 'Reading Pitch Spin for Better Timing')",
  "description": "A compelling 1-2 sentence description explaining what players will learn and why it matters",
  "four_b_category": "brain" | "body" | "bat" | "ball" (the PRIMARY category this video addresses),
  "problems_addressed": ["problem1", "problem2"] (from: spinning_out, casting, late_timing, early_timing, drifting, rolling_over, ground_balls, no_power, chasing_pitches, collapsing_back_side, long_swing, weak_rotation, poor_balance, head_movement, bat_drag, uppercut, chopping),
  "drill_name": "Name of the specific drill if one is being taught, or null",
  "motor_profiles": [] (from: "whipper", "spinner", "slinger", "puncher" - which swing types benefit most, empty if general),
  "player_level": [] (from: "youth", "travel", "high_school", "college", "pro" - appropriate skill levels),
  "video_type": "drill" | "lesson" | "breakdown" | "q_and_a" | "live_session",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] (5 searchable terms that players might search for),
  "thumbnail_timestamp": number (seconds into the video that would make the best thumbnail - usually when demonstrating the key concept)
}

Be specific with titles - avoid generic names like "Hitting Tips" or "Swing Lesson". Reference the actual drill or concept being taught.`
          },
          {
            role: 'user',
            content: `Current title: ${video.title || 'Untitled'}
Current description: ${video.description || 'None'}

Full Transcript:
${video.transcript.substring(0, 8000)}`
          }
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI Gateway error:', errorText)
      
      // Update status to failed
      await supabase
        .from('drill_videos')
        .update({ status: 'failed' })
        .eq('id', video_id)
        
      throw new Error(`AI analysis failed: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from AI')
    }

    // Parse JSON from response (handle markdown code blocks)
    let analysis
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, content]
      analysis = JSON.parse(jsonMatch[1] || content)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      throw new Error('Failed to parse AI analysis')
    }

    console.log('Analysis complete:', analysis)

    // Determine final status
    const finalStatus = auto_publish ? 'published' : 'ready_for_review'
    const publishedAt = auto_publish ? new Date().toISOString() : null

    // Save ALL generated metadata to database
    const { error: updateError } = await supabase
      .from('drill_videos')
      .update({
        title: analysis.title || video.title,
        description: analysis.description || null,
        four_b_category: analysis.four_b_category || null,
        problems_addressed: analysis.problems_addressed?.length ? analysis.problems_addressed : null,
        drill_name: analysis.drill_name || null,
        motor_profiles: analysis.motor_profiles?.length ? analysis.motor_profiles : null,
        player_level: analysis.player_level?.length ? analysis.player_level : null,
        video_type: analysis.video_type || 'drill',
        tags: analysis.tags?.length ? analysis.tags : null,
        status: finalStatus,
        published_at: publishedAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', video_id)

    if (updateError) {
      console.error('Database update error:', updateError)
      throw updateError
    }

    console.log('Video fully processed:', video_id, 'Status:', finalStatus)

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis,
        status: finalStatus,
        message: auto_publish 
          ? 'Video processed and published automatically!'
          : 'Video processed and ready for review!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Auto-tag error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})