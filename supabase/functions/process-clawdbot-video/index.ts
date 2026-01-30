import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessVideoRequest {
  videoUrl: string;
  videoId?: string;
  title?: string;
  contentType: "teaching" | "analysis" | "both";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { videoUrl, videoId, title, contentType } = await req.json() as ProcessVideoRequest;

    console.log("Processing video for ClawdBot learning:", { videoUrl, contentType });

    // Step 1: Get transcript from drill_videos if available, or transcribe
    let transcript = "";
    
    if (videoId) {
      const { data: video } = await supabase
        .from("drill_videos")
        .select("transcript, title, description")
        .eq("id", videoId)
        .single();
      
      if (video?.transcript) {
        transcript = video.transcript;
        console.log("Using existing transcript from drill_videos");
      }
    }

    // If no transcript, request transcription from video URL
    if (!transcript && videoUrl) {
      console.log("Transcribing video via Gemini...");
      
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
                  text: `Transcribe this baseball coaching video. Include all spoken content verbatim. Focus on the instructional content, coaching cues, and key teaching points. Format as a clean transcript.`,
                },
                {
                  type: "file",
                  file: {
                    url: videoUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 8000,
        }),
      });

      if (!transcribeResponse.ok) {
        const error = await transcribeResponse.text();
        console.error("Transcription failed:", error);
        throw new Error(`Transcription failed: ${transcribeResponse.status}`);
      }

      const transcribeData = await transcribeResponse.json();
      transcript = transcribeData.choices?.[0]?.message?.content || "";
      console.log("Transcript generated:", transcript.substring(0, 200) + "...");
    }

    if (!transcript) {
      throw new Error("Could not obtain transcript for video");
    }

    // Step 2: Extract knowledge entries and Q&A scenarios
    console.log("Extracting knowledge and scenarios from transcript...");

    const extractPrompt = `You are analyzing a baseball coaching video transcript from Coach Rick. Extract knowledge entries and training scenarios for an AI coaching assistant.

## Video Type: ${contentType === "teaching" ? "Instructional teaching content" : contentType === "analysis" ? "Player swing analysis" : "Mixed content"}
## Video Title: ${title || "Untitled"}

## Transcript:
${transcript}

Based on this transcript, extract:

1. **KNOWLEDGE ENTRIES** - Key teaching concepts, techniques, and insights that should be stored in the knowledge base. Each entry should be self-contained and useful for answering player questions.

2. **Q&A SCENARIOS** - Player questions and ideal Coach Rick responses based on what he says in the video. These train the AI on how to respond to similar questions.

3. **COACHING CUES** - Short, memorable phrases Coach Rick uses that players should remember during practice.

Return a JSON object with this exact structure:
{
  "knowledge": [
    {
      "title": "Short descriptive title",
      "category": "technique|philosophy|motor_profile|4b_system|drill",
      "subcategory": "optional - e.g., spinner, body, bat",
      "content": "Detailed explanation in Coach Rick's voice",
      "tags": ["tag1", "tag2"]
    }
  ],
  "scenarios": [
    {
      "player_input": "A question a player might ask about this topic",
      "ideal_response": "How Coach Rick would respond (1-3 sentences, direct, actionable)",
      "category": "technique|mindset|drill|assessment",
      "tags": ["tag1", "tag2"]
    }
  ],
  "cues": [
    {
      "cue_type": "encouragement|correction|profile_spinner|profile_whipper|profile_slingshotter",
      "cue_text": "The memorable phrase",
      "context_hint": "When to use this cue"
    }
  ]
}

Focus on:
- Extracting 3-8 knowledge entries (prioritize quality over quantity)
- Creating 3-6 realistic Q&A scenarios
- Capturing any memorable coaching phrases as cues
- Using Coach Rick's voice: direct, casual, results-focused
- Including specific drill recommendations when mentioned
- Connecting to the 4B System (Body, Brain, Bat, Ball) when relevant`;

    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: extractPrompt },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!extractResponse.ok) {
      const error = await extractResponse.text();
      console.error("Extraction failed:", error);
      throw new Error(`Extraction failed: ${extractResponse.status}`);
    }

    const extractData = await extractResponse.json();
    const extractedContent = extractData.choices?.[0]?.message?.content;
    
    let parsed;
    try {
      parsed = JSON.parse(extractedContent);
    } catch (e) {
      console.error("Failed to parse extraction response:", extractedContent);
      throw new Error("Failed to parse AI extraction response");
    }

    console.log("Extracted:", {
      knowledge: parsed.knowledge?.length || 0,
      scenarios: parsed.scenarios?.length || 0,
      cues: parsed.cues?.length || 0,
    });

    // Step 3: Insert extracted content into database
    const results = {
      knowledge_added: 0,
      scenarios_added: 0,
      cues_added: 0,
      errors: [] as string[],
    };

    // Insert knowledge entries
    if (parsed.knowledge?.length > 0) {
      for (const k of parsed.knowledge) {
        const { error } = await supabase.from("clawdbot_knowledge").insert({
          title: k.title,
          category: k.category || "technique",
          subcategory: k.subcategory || null,
          content: k.content,
          tags: k.tags || [],
          is_active: true,
          priority: 5,
        });
        if (error) {
          console.error("Failed to insert knowledge:", error);
          results.errors.push(`Knowledge: ${k.title} - ${error.message}`);
        } else {
          results.knowledge_added++;
        }
      }
    }

    // Insert scenarios
    if (parsed.scenarios?.length > 0) {
      for (const s of parsed.scenarios) {
        const { error } = await supabase.from("clawdbot_scenarios").insert({
          player_input: s.player_input,
          ideal_response: s.ideal_response,
          category: s.category || "technique",
          tags: s.tags || [],
          is_active: true,
        });
        if (error) {
          console.error("Failed to insert scenario:", error);
          results.errors.push(`Scenario: ${s.player_input.substring(0, 30)}... - ${error.message}`);
        } else {
          results.scenarios_added++;
        }
      }
    }

    // Insert cues
    if (parsed.cues?.length > 0) {
      for (const c of parsed.cues) {
        const { error } = await supabase.from("clawdbot_cues").insert({
          cue_type: c.cue_type || "encouragement",
          cue_text: c.cue_text,
          context_hint: c.context_hint || null,
          is_active: true,
        });
        if (error) {
          console.error("Failed to insert cue:", error);
          results.errors.push(`Cue: ${c.cue_text.substring(0, 30)}... - ${error.message}`);
        } else {
          results.cues_added++;
        }
      }
    }

    console.log("Processing complete:", results);

    return new Response(
      JSON.stringify({
        success: true,
        transcript: transcript.substring(0, 500) + "...",
        results,
        extracted: {
          knowledge: parsed.knowledge || [],
          scenarios: parsed.scenarios || [],
          cues: parsed.cues || [],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process video error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
