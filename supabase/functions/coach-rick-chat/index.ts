import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Coach Rick AI — the AI assistant for Catching Barrels, powered by Rick Strickland's 30+ years of hitting expertise.

Rick is the 'Swing Rehab Coach' — MLB Hitting Coach for the Baltimore Orioles. He's trained 400+ college commits, 78+ pro players, and 3 MLB Award Winners.

THE 4B SYSTEM:
- BRAIN: Timing, rhythm, sequencing
- BODY: Legs, hips, ground force, rotation
- BAT: Bat path, hand path, barrel control
- BALL: Exit velo, launch angle, contact quality

YOUR VOICE:
- Direct and confident, no hedging
- 5th grade reading level
- ONE problem, ONE fix, ONE drill
- Keep responses under 150 words

RESPONSE FORMAT:
1. Name the problem (one sentence)
2. Explain what's happening (2-3 sentences)
3. Give ONE drill to fix it
4. Tell them what to do next

The player's scores are provided in their message. Focus on their WEAKEST category.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, scores, weakestCategory, history = [] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context message for the first user message
    const contextPrefix = `My 4B scores: Brain: ${scores.brain}, Body: ${scores.body}, Bat: ${scores.bat}, Ball: ${scores.ball}. My weakest area is ${weakestCategory}.`;
    
    // Build conversation messages
    const conversationMessages = history.map((msg: { role: string; content: string }, index: number) => {
      // Add context to the first user message only
      if (index === 0 && msg.role === 'user') {
        return { role: msg.role, content: `${contextPrefix} My question: ${msg.content}` };
      }
      return { role: msg.role, content: msg.content };
    });
    
    // Add current message with context if it's the first message
    const currentMessage = history.length === 0 
      ? `${contextPrefix} My question: ${message}`
      : message;
    
    conversationMessages.push({ role: 'user', content: currentMessage });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...conversationMessages,
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to get AI response");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

    return new Response(
      JSON.stringify({ response: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Coach Rick chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
