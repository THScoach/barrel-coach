import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coach Rick's complete brand voice configuration (from knowledge base)
const BRAND_VOICE = {
  characteristics: [
    "Direct, no fluff - 5th-8th grade reading level with expert vocabulary",
    "Confident, backed by 15+ years of experience watching thousands of swings",
    "Uses specific terminology: Motor Profiles, Transfer Ratio, 4B Framework, KRS",
    "Stories and examples from real MLB players (Soto, Freeman, Judge, Betts)",
    "Challenges conventional thinking - critiques data-first approaches like Driveline",
    "Never apologetic, never hedging - Coach Rick knows his stuff",
    "Hormozi-style directness: actionable, results-focused",
    "Bridges WHAT (data) and WHY (experience/pattern recognition)",
  ],
  phrases: [
    "We don't add, we unlock",
    "Data as compass, not judgment",
    "They measure WHAT, I explain WHY",
    "The swing is a sequence, not a position",
    "Averages hide the truth, timing reveals it",
    "You can't fix what you don't understand",
    "Pattern recognition comes from reps",
    "Every player has a natural Motor Profile",
    "Don't fight anatomy",
    "Transfer Ratio is the keystone metric",
  ],
  topics: [
    "Motor Profiles (Spinner, Slingshotter, Whipper) - based on body type and movement signature",
    "Transfer Ratio (1.5-1.8 is elite) - how momentum reaches the bat",
    "4B Framework (Ball, Bat, Body, Brain) - interconnected pillars of swing analysis",
    "Tempo and timing - 10-18% timing gap is elite (Kwon validated)",
    "Experience Gap - why pattern recognition beats data literacy",
    "Kinetic Readiness Score (KRS) - Creation (40%) + Transfer (60%)",
    "Energy leaks and compensation patterns",
    "Ground force, violent brake, X-Factor",
    "Whip timing and the 'Adapt or Die' hypothesis",
  ],
  antiPatterns: [
    "Never generic coach-speak or clichés",
    "Never dumbed-down explanations that lose nuance",
    "Never apologizing for strong opinions",
    "Never treating all swings the same - profiles matter",
    "Never pure data worship without experience context",
  ],
  scoreSeverity: {
    elite: { range: "90+", color: "#4ecdc4", meaning: "MLB-caliber mechanics" },
    good: { range: "80-89", color: "#4ecdc4", meaning: "College/MiLB level" },
    working: { range: "60-79", color: "#ffa500", meaning: "Clear development path" },
    priority: { range: "<60", color: "#ff6b6b", meaning: "Fundamental issues" },
  },
  motorProfiles: {
    spinner: { description: "Compact rotation, quick hands, tight coil", models: "Altuve, Betts, Peña", color: "#4488ff" },
    whipper: { description: "Hip lead, extension, leverage, whip-crack finish", models: "Soto, Freeman", color: "#44ff88" },
    slingshotter: { description: "Linear load, explosive transfer, ground force", models: "Judge, Guerrero Jr.", color: "#ff8844" },
  },
};

// Platform-specific formatting requirements
const PLATFORM_SPECS = {
  tiktok: {
    maxLength: 150,
    style: "Hook + Insight + CTA. Punchy, direct. Under 60 seconds when spoken. Start with a controversial take or surprising fact.",
    hashtags: 5,
    format: "Script format with [VISUAL:] cues for demonstrations",
  },
  instagram_reel: {
    maxLength: 200,
    style: "Hook + Insight + CTA. Visual-friendly, punchy. Under 60 seconds. Show, don't just tell.",
    hashtags: 8,
    format: "Script with visual direction",
  },
  instagram_post: {
    maxLength: 2200,
    style: "Story + Lesson + Question. Conversational, 150-300 words. End with engagement question.",
    hashtags: 15,
    format: "Prose with line breaks for readability",
  },
  twitter: {
    maxLength: 280,
    style: "Single sharp insight or hot take. Quotable. No hashtags in main text.",
    hashtags: 2,
    format: "Standalone tweet",
  },
  twitter_thread: {
    maxLength: 1400,
    style: "5-7 tweets building an argument. Each tweet standalone but connected. Number them.",
    hashtags: 2,
    format: "Numbered thread",
  },
  youtube_short: {
    maxLength: 200,
    style: "Problem + Explanation + Takeaway. Educational, under 60 seconds. Clear structure.",
    hashtags: 5,
    format: "Script with visual notes",
  },
};

interface ProcessRequest {
  content_item_id: string;
  regenerate?: boolean;
  platforms?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_item_id, regenerate, platforms }: ProcessRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the content item
    const { data: contentItem, error: fetchError } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", content_item_id)
      .single();

    if (fetchError || !contentItem) {
      throw new Error(`Content item not found: ${fetchError?.message}`);
    }

    console.log("Processing content item:", content_item_id, contentItem.source_type);

    // Step 1: Transcribe if it's audio/video
    let transcript = contentItem.transcript || contentItem.raw_content;
    
    if ((contentItem.source_type === "voice" || contentItem.source_type === "video") && contentItem.media_url && !contentItem.transcript) {
      // Get signed URL for the media file
      const { data: signedUrl } = await supabase.storage
        .from("content-engine")
        .createSignedUrl(contentItem.media_url, 3600);

      if (signedUrl?.signedUrl && lovableApiKey) {
        const isVideo = contentItem.source_type === "video";
        const mediaType = isVideo ? "video_url" : "audio_url";
        const mediaUrlKey = isVideo ? "video_url" : "audio_url";
        
        // Use Lovable AI for transcription via chat completion
        const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { 
                    type: "text", 
                    text: isVideo 
                      ? "Watch this video and transcribe what the person is saying. Also note any key visual demonstrations or actions they perform that are important for teaching. Return the transcription with [VISUAL: description] markers for important visual moments."
                      : "Transcribe this audio recording exactly as spoken. Return only the transcription, no additional commentary."
                  },
                  { type: mediaType, [mediaUrlKey]: { url: signedUrl.signedUrl } },
                ],
              },
            ],
          }),
        });

        if (transcribeResponse.ok) {
          const transcribeResult = await transcribeResponse.json();
          transcript = transcribeResult.choices?.[0]?.message?.content || "";
          
          // Update content item with transcript
          await supabase
            .from("content_items")
            .update({ transcript })
            .eq("id", content_item_id);
        } else {
          console.error("Transcription failed:", await transcribeResponse.text());
        }
      }
    }

    if (!transcript) {
      throw new Error("No content to process");
    }

    // Step 2: Extract insights using AI
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const extractionPrompt = `You are analyzing content from Coach Rick Strickland, a baseball hitting coach with 15+ years of experience. Extract the valuable teaching moments and insights.

## COACH RICK'S BRAND VOICE:
${BRAND_VOICE.characteristics.join("\n- ")}

## SIGNATURE PHRASES (use naturally):
${BRAND_VOICE.phrases.join("\n- ")}

## KEY TOPICS HE OWNS:
${BRAND_VOICE.topics.join("\n- ")}

## MOTOR PROFILES (core concept):
- SPINNER: ${BRAND_VOICE.motorProfiles.spinner.description} (models: ${BRAND_VOICE.motorProfiles.spinner.models})
- WHIPPER: ${BRAND_VOICE.motorProfiles.whipper.description} (models: ${BRAND_VOICE.motorProfiles.whipper.models})  
- SLINGSHOTTER: ${BRAND_VOICE.motorProfiles.slingshotter.description} (models: ${BRAND_VOICE.motorProfiles.slingshotter.models})

## WHAT TO AVOID:
${BRAND_VOICE.antiPatterns.join("\n- ")}

## CONTENT TO ANALYZE:
"""
${transcript}
"""

Extract and return a JSON object with:
1. "insights": Array of teaching moments/insights (each with "quote" - exact phrase, "topic" - main concept, "hook" - attention-grabbing reframe)
2. "topics": Array of topic tags that apply (from: motor_profile, transfer_ratio, 4b_framework, tempo, data_critique, unlock_vs_add, drills, mindset, player_story, biomechanics, experience_gap, kinetic_chain)
3. "content_type": One of (educational, controversial, personal_story, quick_tip, framework, player_example, myth_busting)
4. "best_quote": The single most shareable/quotable phrase that sounds like Rick
5. "motor_profile_mentioned": If any profile (spinner, whipper, slingshotter) is discussed, note which one

Return ONLY valid JSON, no markdown code blocks.`;

    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert at analyzing coaching content and extracting insights. Always respond with valid JSON only." },
          { role: "user", content: extractionPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!extractionResponse.ok) {
      console.error("Extraction failed:", await extractionResponse.text());
      throw new Error("Failed to extract insights");
    }

    const extractionResult = await extractionResponse.json();
    let extracted;
    try {
      const content = extractionResult.choices?.[0]?.message?.content || "{}";
      extracted = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
    } catch (e) {
      console.error("Failed to parse extraction:", e);
      extracted = { insights: [], topics: [], content_type: "educational", best_quote: "" };
    }

    // Update content item with extracted data
    await supabase
      .from("content_items")
      .update({
        extracted_insights: extracted.insights || [],
        topics: extracted.topics || [],
        content_type: extracted.content_type,
        status: "ready",
        processed_at: new Date().toISOString(),
      })
      .eq("id", content_item_id);

    // Step 3: Generate platform-specific outputs
    const targetPlatforms = platforms || ["instagram_post", "twitter", "tiktok"];
    const outputs = [];

    for (const platform of targetPlatforms) {
      const spec = PLATFORM_SPECS[platform as keyof typeof PLATFORM_SPECS];
      if (!spec) continue;

      const formatPrompt = `You ARE Coach Rick Strickland creating content for ${platform.replace("_", " ")}. You've been a hitting coach for 15+ years. You've seen thousands of swings. You know what works.

## YOUR VOICE (embody this):
${BRAND_VOICE.characteristics.join("\n- ")}

## YOUR SIGNATURE PHRASES (weave in naturally):
${BRAND_VOICE.phrases.join("\n- ")}

## YOUR CORE CONCEPTS:
- 4B Framework: Ball, Bat, Body, Brain (interconnected pillars)
- Motor Profiles: Spinner, Whipper, Slingshotter (every player has one)
- Transfer Ratio: 1.5-1.8 is elite (the keystone metric)
- Experience Gap: Data analysts see WHAT, you explain WHY

## NEVER DO THIS:
${BRAND_VOICE.antiPatterns.join("\n- ")}

## PLATFORM REQUIREMENTS FOR ${platform.toUpperCase()}:
- Max length: ${spec.maxLength} characters
- Style: ${spec.style}
- Format: ${(spec as any).format || "Natural prose"}
- Hashtags: ${spec.hashtags} relevant hashtags

## SOURCE CONTENT (your raw thoughts):
"""
${transcript}
"""

## EXTRACTED INSIGHTS:
${JSON.stringify(extracted.insights?.slice(0, 3) || [])}

## BEST QUOTE FROM THIS: "${extracted.best_quote || ""}"

Now write as Coach Rick for ${platform.replace("_", " ")}. Be direct. Be confident. Challenge conventional thinking. Make it sound like YOU, not like an AI.

Return JSON with:
- "hook": The opening hook/first line that grabs attention
- "content": The full formatted content ready to post
- "hashtags": Array of hashtag strings (without #)
- "cta": Call to action (if appropriate for this platform)

Return ONLY valid JSON.`;

      const formatResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are Coach Rick Strickland. Write in his direct, confident voice. Return valid JSON only." },
            { role: "user", content: formatPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (formatResponse.ok) {
        const formatResult = await formatResponse.json();
        try {
          const formattedContent = formatResult.choices?.[0]?.message?.content || "{}";
          const parsed = JSON.parse(formattedContent.replace(/```json\n?|\n?```/g, ""));

          outputs.push({
            content_item_id,
            platform,
            formatted_content: parsed.content || "",
            hook: parsed.hook || "",
            cta: parsed.cta || "",
            hashtags: parsed.hashtags || [],
            status: "draft",
          });
        } catch (e) {
          console.error(`Failed to parse ${platform} content:`, e);
        }
      }
    }

    // Insert outputs
    if (outputs.length > 0) {
      // Delete old outputs if regenerating
      if (regenerate) {
        await supabase
          .from("content_outputs")
          .delete()
          .eq("content_item_id", content_item_id);
      }

      const { error: insertError } = await supabase
        .from("content_outputs")
        .insert(outputs);

      if (insertError) {
        console.error("Failed to insert outputs:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        content_item_id,
        insights_count: extracted.insights?.length || 0,
        outputs_count: outputs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
