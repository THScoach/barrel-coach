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

    // Get video transcript
    const { data: video, error: videoError } = await supabase
      .from('drill_videos')
      .select('transcript, title, description')
      .eq('id', video_id)
      .single()

    if (videoError || !video) {
      throw new Error('Video not found')
    }

    if (!video.transcript) {
      throw new Error('No transcript found. Please transcribe the video first.')
    }

    console.log('Analyzing transcript for video:', video_id)

    // Use Lovable AI Gateway for analysis
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
            content: `You analyze baseball coaching video transcripts and categorize them.

Return ONLY valid JSON with these fields:
{
  "four_b_category": "brain" | "body" | "bat" | "ball" (pick the PRIMARY category based on Coach Rick's 4B System - Brain=timing/mental, Body=legs/hips/rotation, Bat=swing mechanics, Ball=contact/impact),
  "problems_addressed": ["problem1", "problem2"] (from this list: spinning_out, casting, late_timing, early_timing, drifting, rolling_over, ground_balls, no_power, chasing_pitches, collapsing_back_side, long_swing, weak_rotation, poor_balance, head_movement, bat_drag, uppercut, chopping),
  "drill_name": "Name of drill if one is being taught" or null,
  "motor_profiles": [] (which profiles this applies to from: "whipper", "spinner", "slinger", "puncher" - empty array if general),
  "player_level": [] (which levels this is appropriate for from: "youth", "travel", "high_school", "college", "pro"),
  "video_type": "drill" | "lesson" | "breakdown" | "q_and_a" | "live_session",
  "suggested_title": "A clear, specific title for this video",
  "suggested_description": "A 1-2 sentence description of what this video teaches",
  "suggested_tags": ["tag1", "tag2", "tag3"] (additional searchable terms, max 5)
}`
          },
          {
            role: 'user',
            content: `Title: ${video.title || 'Untitled'}
Description: ${video.description || 'None'}

Transcript:
${video.transcript.substring(0, 6000)}`
          }
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI Gateway error:', errorText)
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

    return new Response(
      JSON.stringify({ success: true, analysis }),
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
