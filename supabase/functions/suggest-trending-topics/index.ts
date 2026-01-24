import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TopicInput {
  name: string;
  display_name: string;
  last_posted_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topics, currentMonth } = await req.json() as { 
      topics: TopicInput[]; 
      currentMonth: number 
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context about topic coverage
    const topicContext = topics.map(t => {
      const daysSince = t.last_posted_at 
        ? Math.floor((Date.now() - new Date(t.last_posted_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return `- ${t.display_name}: ${daysSince === null ? 'Never posted' : `${daysSince} days ago`}`;
    }).join('\n');

    // Get seasonal context
    const seasonalContext = getSeasonalContext(currentMonth);

    const systemPrompt = `You are a content strategist for Coach Rick Strickland's "Catching Barrels" baseball hitting coaching brand.

Brand Context:
- Core philosophy: "We don't add, we unlock" - optimizing each player's natural Motor Profile
- Key topics: Motor Profiles (Spinner, Slingshotter, Whipper), Transfer Ratio, 4B Framework (Ball, Bat, Body, Brain), Tempo & Timing
- Voice: Direct, confident, Hormozi-style, backed by data and experience
- Audience: Youth to pro baseball players, parents, coaches

Current Season: ${seasonalContext}

Your job is to analyze the topic coverage and suggest 3 trending/timely content ideas that would resonate with the audience right now.`;

    const userPrompt = `Here's our current topic coverage:

${topicContext}

Based on:
1. Topics that haven't been covered recently
2. Current baseball season timing (${seasonalContext})
3. What content tends to perform well for baseball coaching

Suggest 3 specific, actionable content topics with high urgency. Return as JSON:

{
  "suggestions": [
    {
      "topic": "topic_name_from_list",
      "display_name": "Display Name",
      "reason": "Why this is timely and will resonate (1 sentence)",
      "urgency": "high" | "medium" | "low"
    }
  ]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded", suggestions: [] }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", suggestions: [] }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ suggestions: parsed.suggestions || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in suggest-trending-topics:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
      suggestions: [] 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getSeasonalContext(month: number): string {
  if (month >= 2 && month <= 3) {
    return "Spring Training - players working on mechanics, preparing for the season";
  } else if (month >= 4 && month <= 5) {
    return "Early Season - games starting, in-season adjustments, timing focus";
  } else if (month >= 6 && month <= 7) {
    return "Mid-Season - performance analysis, maintaining consistency";
  } else if (month >= 8 && month <= 9) {
    return "Late Season/Playoffs - mental game, peak performance, clutch moments";
  } else {
    return "Off-Season - development time, fundamentals, swing changes, strength building";
  }
}
