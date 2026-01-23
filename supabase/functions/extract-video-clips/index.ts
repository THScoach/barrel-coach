import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClipRequest {
  content_item_id: string;
}

interface SuggestedClip {
  start_seconds: number;
  end_seconds: number;
  duration: number;
  title: string;
  hook: string;
  topic: string;
  platforms: string[];
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_item_id }: ClipRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the content item
    const { data: contentItem, error: fetchError } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", content_item_id)
      .single();

    if (fetchError || !contentItem) {
      throw new Error("Content item not found");
    }

    if (contentItem.source_type !== "video") {
      throw new Error("Content must be a video for clip extraction");
    }

    if (!contentItem.transcript) {
      throw new Error("Video must be transcribed first");
    }

    const duration = contentItem.media_duration_seconds || 0;
    console.log(`Analyzing video: ${content_item_id}, duration: ${duration}s`);

    // Use AI to identify clip-worthy segments
    const clipPrompt = `Analyze this video transcript from Coach Rick Strickland and identify segments that would make great short-form content (15-60 seconds).

## VIDEO DURATION: ${duration} seconds

## TRANSCRIPT:
"""
${contentItem.transcript}
"""

## WHAT MAKES A GREAT CLIP:
1. Strong hook in first 3 seconds (surprising statement, question, or bold claim)
2. Single, complete idea or insight
3. Natural start and end points (not mid-sentence)
4. Quotable or shareable moment
5. Coach Rick's signature directness and expertise

## PLATFORM REQUIREMENTS:
- TikTok/Reels: 15-60 seconds, punchy, hook-driven
- YouTube Shorts: 30-60 seconds, can be more educational
- Twitter/X video: 15-45 seconds, controversial or insightful

Identify 3-5 potential clips from this transcript.

For each clip, estimate the timestamp based on speech patterns and content breaks. Assume average speaking pace of 150 words per minute.

Return JSON with:
{
  "clips": [
    {
      "start_seconds": number (estimated start time),
      "end_seconds": number (estimated end time),
      "duration": number (clip length),
      "title": string (short title for the clip),
      "hook": string (the attention-grabbing opening),
      "topic": string (main topic: motor_profile, transfer_ratio, etc.),
      "platforms": ["tiktok", "instagram_reel", "youtube_short"] (best platforms),
      "confidence": number 0-100 (how confident this is a good clip),
      "transcript_segment": string (the text of this segment)
    }
  ],
  "analysis": string (brief explanation of why these clips were chosen)
}

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
          { role: "system", content: "You are a video editor identifying clip-worthy moments. Return valid JSON only." },
          { role: "user", content: clipPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI clip extraction failed:", errorText);
      throw new Error("Failed to analyze video for clips");
    }

    const result = await response.json();
    let clipData;
    
    try {
      const content = result.choices?.[0]?.message?.content || "{}";
      clipData = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
    } catch (e) {
      console.error("Failed to parse clips:", e);
      clipData = { clips: [], analysis: "Failed to parse AI response" };
    }

    // Validate and sanitize clip times
    const validatedClips = (clipData.clips || []).map((clip: any) => ({
      start_seconds: Math.max(0, Math.min(clip.start_seconds || 0, duration)),
      end_seconds: Math.max(0, Math.min(clip.end_seconds || 60, duration)),
      duration: clip.duration || (clip.end_seconds - clip.start_seconds),
      title: clip.title || "Untitled Clip",
      hook: clip.hook || "",
      topic: clip.topic || "general",
      platforms: clip.platforms || ["tiktok"],
      confidence: Math.min(100, Math.max(0, clip.confidence || 50)),
      transcript_segment: clip.transcript_segment || "",
    })).filter((clip: SuggestedClip) => clip.duration >= 10 && clip.duration <= 90);

    // Store clip suggestions in the content item's extracted_insights
    const existingInsights = contentItem.extracted_insights || [];
    
    await supabase
      .from("content_items")
      .update({
        extracted_insights: {
          ...existingInsights,
          suggested_clips: validatedClips,
          clip_analysis: clipData.analysis,
        },
        source_metadata: {
          ...(contentItem.source_metadata || {}),
          clips_extracted_at: new Date().toISOString(),
          clips_count: validatedClips.length,
        },
      })
      .eq("id", content_item_id);

    console.log(`Extracted ${validatedClips.length} clips from video ${content_item_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        content_item_id,
        clips: validatedClips,
        analysis: clipData.analysis,
        total_clips: validatedClips.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Extract video clips error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
