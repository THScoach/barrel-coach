import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const COACH_RICK_BRAND_VOICE = `
Coach Rick's Voice Characteristics:
- Direct, no fluff
- Confident, backed by experience
- Uses specific terminology (not dumbed down)
- Stories and examples from real players
- Challenges conventional thinking
- "Here's what most people get wrong..."
- "The data shows X, but here's WHY..."
- Never apologetic, never hedging

Signature Phrases:
- "We don't add, we unlock"
- "Data as compass, not judgment"
- "They measure WHAT, I explain WHY"
- "The swing is a sequence, not a position"
- "Averages hide the truth, timing reveals it"

Core Topics (4B Framework):
- Brain: Mental approach, timing recognition, pitch selection
- Body: Motor Profile (Spinner, Slingshotter, Whipper, Titan), movement patterns
- Bat: Bat speed, attack angle, swing mechanics
- Ball: Exit velocity, launch angle, contact quality, Transfer Ratio
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transcript } = await req.json()

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const systemPrompt = `You are a content analysis expert specializing in coaching content for baseball hitting instruction. 
You analyze video transcripts for Coach Rick's brand at Catching Barrels.

${COACH_RICK_BRAND_VOICE}

Analyze the provided transcript and return a JSON object with these fields:
- hookScore (0-100): How strong is the opening hook? Does it grab attention immediately?
- ctaScore (0-100): Is there a clear call-to-action? Does it drive engagement?
- brandVoiceScore (0-100): How well does it match Coach Rick's voice and style?
- overallScore (0-100): Weighted average considering all factors
- teachingMoments (array of strings): Key teaching moments that could be highlighted
- quotablePhrases (array of strings): Memorable, shareable quotes from the transcript
- fourBConcepts (array of strings): Which 4B concepts are covered (Brain, Body, Bat, Ball topics)
- suggestions (array of strings): Specific improvements to make the content stronger
- platformFormats: Object with formatted versions for each platform:
  - tiktok: 30-60 second script, punchy hook
  - instagram: 150-300 word caption with story format
  - twitter: Single tweet or thread starter (280 chars)
  - youtube: 60 second script with problem-solution format

Return ONLY valid JSON, no markdown or explanation.`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this video transcript:\n\n${transcript}` }
        ],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI gateway error:', response.status, errorText)
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error('AI analysis failed')
    }

    const aiResponse = await response.json()
    const content = aiResponse.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content in AI response')
    }

    // Parse the JSON response
    let analysisResult
    try {
      // Clean up potential markdown formatting
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      analysisResult = JSON.parse(cleanedContent)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      throw new Error('Failed to parse analysis results')
    }

    console.log('Analysis completed successfully')

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Video script analysis error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
