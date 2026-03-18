import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { documentId, imageBase64, imageMimeType, noteText } = await req.json();

    if (!documentId) {
      throw new Error("documentId is required");
    }

    console.log(`Processing player intel document: ${documentId}, hasImage: ${!!imageBase64}, hasNote: ${!!noteText}`);

    let extractedText = "";
    let summary = "";

    if (imageBase64 && imageMimeType) {
      // Image extraction via Gemini Vision
      const imagePrompt = `Extract all text, numbers, and data from this image. This is a baseball biomechanics document. Preserve table structures, metric names, and values exactly as shown. After extraction, provide a 2-3 sentence summary of what this document shows about the player's swing mechanics.

Format your response as:
EXTRACTED TEXT:
[all text and data from the image]

SUMMARY:
[2-3 sentence summary]`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
                },
                { type: "text", text: imagePrompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI Vision error:", response.status, errText);
        throw new Error(`AI Vision failed: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";

      // Parse extracted text and summary
      const extractedMatch = content.match(/EXTRACTED TEXT:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
      const summaryMatch = content.match(/SUMMARY:\s*([\s\S]*?)$/i);

      extractedText = extractedMatch?.[1]?.trim() || content;
      summary = summaryMatch?.[1]?.trim() || "";

    } else if (noteText) {
      // Generate summary for text notes
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          max_tokens: 200,
          messages: [
            {
              role: "system",
              content: "You are a baseball biomechanics assistant. Summarize coaching notes in 2-3 sentences, highlighting key observations about the player's swing mechanics, physical limitations, or training insights.",
            },
            {
              role: "user",
              content: `Summarize this coaching note:\n\n${noteText}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        summary = aiData.choices?.[0]?.message?.content || "";
      }
    }

    // Update the document with AI results
    const updateData: Record<string, any> = {};
    if (extractedText) updateData.ai_extracted_text = extractedText;
    if (summary) updateData.ai_summary = summary;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from("player_documents")
        .update(updateData)
        .eq("id", documentId);

      if (error) {
        console.error("Failed to update document:", error);
        throw error;
      }

      console.log(`Document ${documentId} updated with AI extraction`);
    }

    return new Response(
      JSON.stringify({ success: true, hasExtraction: !!extractedText, hasSummary: !!summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("process-player-intel error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
