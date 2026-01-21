import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { query, maxResults = 5 } = await req.json();
    console.log("[SearchVault] Query:", query);

    // Fetch all ready documents
    const { data: documents, error: docError } = await supabase
      .from("knowledge_documents")
      .select("id, title, description, source_type, extracted_text, original_url")
      .eq("status", "ready")
      .not("extracted_text", "is", null);

    if (docError) {
      throw docError;
    }

    if (!documents || documents.length === 0) {
      console.log("[SearchVault] No documents in vault");
      return new Response(
        JSON.stringify({ 
          success: true, 
          results: [], 
          message: "No documents in vault yet" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[SearchVault] Found", documents.length, "documents to search");

    // Use AI to find relevant passages
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build context from documents
    const documentContext = documents.map((doc, i) => {
      const text = doc.extracted_text || "";
      // Truncate each document to reasonable size
      const truncated = text.substring(0, 10000);
      return `[DOC ${i + 1}: "${doc.title}"]\n${truncated}\n---`;
    }).join("\n\n");

    const searchPrompt = `You are a search assistant for a coaching knowledge base. Given the user's query, find the most relevant passages from the documents below.

USER QUERY: "${query}"

DOCUMENTS:
${documentContext.substring(0, 50000)}

Instructions:
1. Find passages that directly answer or relate to the query
2. Return up to ${maxResults} relevant excerpts
3. Include the document title for each excerpt
4. Focus on coaching philosophy, training methods, and technical concepts

Return your response as a JSON array:
[
  {
    "docTitle": "Document Title",
    "excerpt": "The relevant passage from the document...",
    "relevance": "High/Medium/Low"
  }
]

If no relevant content is found, return an empty array: []`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: searchPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted. Please add more credits.");
      }
      const errorText = await aiResponse.text();
      throw new Error(`AI search failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON response
    let results = [];
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("[SearchVault] Failed to parse AI response:", parseError);
      results = [];
    }

    console.log("[SearchVault] Found", results.length, "relevant passages");

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        documentsSearched: documents.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("[SearchVault] Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
