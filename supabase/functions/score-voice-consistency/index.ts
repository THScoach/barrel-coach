import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coach Rick's voice characteristics for scoring
const VOICE_CRITERIA = {
  positiveIndicators: [
    "Direct, confident statements without hedging",
    "Uses terminology: Motor Profile, Transfer Ratio, 4B, KRS, timing gap",
    "References real players (Soto, Freeman, Judge, Betts, etc.)",
    "Challenges conventional thinking or data-first approaches",
    "Actionable, results-focused language (Hormozi-style)",
    "Experience-backed claims ('I've seen thousands of swings')",
    "Short, punchy sentences at 5th-8th grade reading level",
    "Uses signature phrases: 'We don't add, we unlock', 'Data as compass', etc.",
  ],
  negativeIndicators: [
    "Generic AI language or coach-speak clichés",
    "Hedging words: 'might', 'possibly', 'could be', 'in some cases'",
    "Overly formal or academic tone",
    "Passive voice instead of active",
    "Apologetic or uncertain statements",
    "Generic motivational fluff without substance",
    "Dumbed-down explanations that lose technical nuance",
    "Content that could come from any coach (not distinctive)",
  ],
  brandPhrases: [
    "We don't add, we unlock",
    "Data as compass, not judgment",
    "They measure WHAT, I explain WHY",
    "The swing is a sequence, not a position",
    "Averages hide the truth, timing reveals it",
    "Motor Profile",
    "Transfer Ratio",
    "4B Framework",
    "Kinetic Readiness",
    "timing gap",
    "Spinner",
    "Whipper",
    "Slingshotter",
  ],
};

interface ScoreRequest {
  content_output_id?: string;
  text?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_output_id, text }: ScoreRequest = await req.json();

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    let contentToScore = text;

    // If content_output_id provided, fetch from database
    if (content_output_id && !text) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: output, error } = await supabase
        .from("content_outputs")
        .select("formatted_content, hook")
        .eq("id", content_output_id)
        .single();

      if (error || !output) {
        throw new Error("Content output not found");
      }

      contentToScore = `${output.hook || ""}\n\n${output.formatted_content}`;
    }

    if (!contentToScore) {
      throw new Error("No content to score");
    }

    // Score the content using AI
    const scoringPrompt = `You are evaluating if content sounds authentically like Coach Rick Strickland, a baseball hitting coach with 15+ years of experience.

## POSITIVE INDICATORS (content should have these):
${VOICE_CRITERIA.positiveIndicators.map(i => `- ${i}`).join("\n")}

## NEGATIVE INDICATORS (deduct points for these):
${VOICE_CRITERIA.negativeIndicators.map(i => `- ${i}`).join("\n")}

## COACH RICK'S BRAND PHRASES (bonus if present naturally):
${VOICE_CRITERIA.brandPhrases.join(", ")}

## CONTENT TO EVALUATE:
"""
${contentToScore}
"""

Score this content 0-100 on how much it sounds like Coach Rick. Be strict - generic AI content should score below 50.

Return JSON with:
- "score": number 0-100
- "positives": array of specific things that sound like Rick (quote the phrases)
- "negatives": array of specific things that don't sound like Rick (quote the phrases)
- "suggestions": array of specific edits to make it sound more authentic
- "verdict": "authentic" (80+), "needs_work" (50-79), or "too_generic" (<50)

Return ONLY valid JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a brand voice evaluator. Return valid JSON only." },
          { role: "user", content: scoringPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI scoring failed:", errorText);
      throw new Error("Failed to score content");
    }

    const result = await response.json();
    let scoreData;
    
    try {
      const content = result.choices?.[0]?.message?.content || "{}";
      scoreData = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
    } catch (e) {
      console.error("Failed to parse score:", e);
      scoreData = { score: 50, positives: [], negatives: [], suggestions: [], verdict: "needs_work" };
    }

    // Update the content output with the score if ID was provided
    if (content_output_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Store score in performance_metrics or a dedicated field
      await supabase
        .from("content_outputs")
        .update({
          performance_metrics: {
            voice_score: scoreData.score,
            voice_verdict: scoreData.verdict,
            voice_feedback: {
              positives: scoreData.positives,
              negatives: scoreData.negatives,
              suggestions: scoreData.suggestions,
            },
          },
        })
        .eq("id", content_output_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: scoreData.score,
        verdict: scoreData.verdict,
        positives: scoreData.positives,
        negatives: scoreData.negatives,
        suggestions: scoreData.suggestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Score voice consistency error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
