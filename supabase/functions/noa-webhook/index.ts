import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-noa-signature",
};

// Categories for coaching knowledge
const CATEGORIES = [
  "Coaching Insight",
  "Player Case Study", 
  "Drill Idea",
  "Training Philosophy",
  "Swing Analysis",
  "Mental Game",
  "Equipment Notes",
  "General Notes"
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming narrative from Halo glasses
    const payload = await req.json();
    console.log("[NoaWebhook] Received payload:", JSON.stringify(payload));

    // Extract the narrative text - Noa sends various formats
    const narrativeText = payload.text || payload.narrative || payload.summary || payload.content || "";
    
    if (!narrativeText || narrativeText.trim().length === 0) {
      console.log("[NoaWebhook] Empty narrative received");
      return new Response(
        JSON.stringify({ success: false, error: "No narrative text provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[NoaWebhook] Processing narrative:", narrativeText.substring(0, 200));

    // Use AI to categorize and title the narrative
    let category = "General Notes";
    let title = "Halo Note";
    let description = "";

    if (lovableApiKey) {
      try {
        const categorizationPrompt = `You are a baseball coaching assistant. Analyze this voice note from a professional hitting coach and categorize it.

VOICE NOTE:
"${narrativeText}"

AVAILABLE CATEGORIES:
${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "category": "exact category name from list above",
  "title": "short descriptive title (max 8 words)",
  "description": "one sentence summary of the key insight"
}`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: categorizationPrompt }],
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          
          // Parse JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            category = CATEGORIES.includes(parsed.category) ? parsed.category : "General Notes";
            title = parsed.title || "Halo Note";
            description = parsed.description || "";
            console.log("[NoaWebhook] AI categorized as:", category, "-", title);
          }
        } else {
          console.error("[NoaWebhook] AI categorization failed:", await aiResponse.text());
        }
      } catch (aiError) {
        console.error("[NoaWebhook] AI error:", aiError);
        // Continue with defaults
      }
    }

    // Store in knowledge_documents with source_type='noa'
    const { data: doc, error: insertError } = await supabase
      .from("knowledge_documents")
      .insert({
        title: title,
        description: description,
        source_type: "noa",
        status: "ready", // Immediately ready for search
        extracted_text: narrativeText,
        category: category,
        noa_metadata: {
          received_at: new Date().toISOString(),
          raw_payload: payload,
          device: "Brilliant Labs Halo",
          agent: "Narrative"
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error("[NoaWebhook] Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[NoaWebhook] Stored document:", doc.id, "Category:", category);

    return new Response(
      JSON.stringify({ 
        success: true, 
        document_id: doc.id,
        category: category,
        title: title,
        message: "Narrative indexed and ready for Research Assistant"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("[NoaWebhook] Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
