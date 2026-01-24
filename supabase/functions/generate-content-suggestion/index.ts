import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand voice configuration
const BRAND_VOICE = {
  style: "Direct, confident, coach-led. Hormozi-style clarity. No fluff.",
  phrases: [
    "We don't add, we unlock",
    "Data as compass, not judgment",
    "They measure WHAT, I explain WHY",
    "The swing is a sequence, not a position",
  ],
  topics: {
    motor_profile: "Spinner, Slingshotter, Whipper, Titan - every player has a natural movement signature",
    transfer_ratio: "Peak torso momentum ÷ peak pelvis momentum. Elite range: 1.5-1.8",
    "4b_framework": "Ball (outcome), Bat (delivery), Body (process), Brain (rhythm)",
    tempo: "Timing of momentum transfer - the universal performance variable",
    biomechanics: "Movement science - ground force, kinetic chain, energy transfer",
    mindset: "Mental approach - confidence, process focus, competitive mentality",
    drills: "Constraint-based learning - the band teaches what words cannot",
    unlock_vs_add: "Philosophy of revealing what the body wants to do, not forcing mechanics",
    data_critique: "Experience gap - pattern recognition vs data literacy",
    player_story: "Real examples showing transformation and results",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, prompt } = await req.json() as { topic: string; prompt: string };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const topicContext = BRAND_VOICE.topics[topic as keyof typeof BRAND_VOICE.topics] || topic;

    const systemPrompt = `You are Coach Rick Strickland's content ghostwriter. You write social media content in his voice.

BRAND VOICE:
- Style: ${BRAND_VOICE.style}
- Key phrases he uses: ${BRAND_VOICE.phrases.join(", ")}

TOPIC CONTEXT:
${topicContext}

OUTPUT FORMAT:
Generate content for multiple platforms. Return as JSON:

{
  "insights": [
    {
      "platform": "instagram" | "twitter" | "tiktok" | "youtube",
      "hook": "Attention-grabbing first line (max 10 words)",
      "formatted_content": "Full post content",
      "hashtags": ["relevant", "hashtags"],
      "cta": "Call to action"
    }
  ],
  "teaching_moment": "The core insight or lesson (1-2 sentences)"
}

RULES:
1. Sound like Rick - direct, confident, backed by experience
2. Each platform should have slightly different content optimized for that platform
3. Instagram: 150-200 words, storytelling format
4. Twitter: 280 chars max, punchy and quotable
5. TikTok: Script format, hook + insight + CTA, 30-60 seconds
6. YouTube: Educational script, problem + explanation + takeaway`;

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
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
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
      throw new Error("Failed to parse AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Create content_item first
    const { data: contentItem, error: itemError } = await supabase
      .from("content_items")
      .insert({
        source_type: "ai_generated",
        status: "ready",
        topics: [topic],
        extracted_insights: { teaching_moment: parsed.teaching_moment },
        raw_content: prompt,
      })
      .select()
      .single();

    if (itemError) {
      console.error("Error creating content item:", itemError);
      throw itemError;
    }

    // Create content_outputs for each platform
    const outputs = parsed.insights || [];
    for (const output of outputs) {
      await supabase.from("content_outputs").insert({
        content_item_id: contentItem.id,
        platform: output.platform,
        formatted_content: output.formatted_content,
        hook: output.hook,
        hashtags: output.hashtags,
        cta: output.cta,
        status: "pending_approval",
      });
    }

    // Update topic last_posted tracking (as pending)
    await supabase
      .from("content_topics")
      .update({ content_count: supabase.rpc("increment_count") })
      .eq("name", topic);

    return new Response(JSON.stringify({ 
      success: true, 
      content_item_id: contentItem.id,
      outputs_created: outputs.length 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-content-suggestion:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
