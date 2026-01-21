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
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { documentId } = await req.json();
    console.log("[ProcessVaultDocument] Processing:", documentId);

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Update status to processing
    await supabase
      .from("knowledge_documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    let extractedText = "";

    if (doc.source_type === "url" && doc.original_url) {
      // Use Firecrawl to scrape URL content
      if (!firecrawlKey) {
        throw new Error("FIRECRAWL_API_KEY not configured");
      }

      console.log("[ProcessVaultDocument] Scraping URL:", doc.original_url);
      
      const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: doc.original_url,
          formats: ["markdown"],
        }),
      });

      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text();
        throw new Error(`Firecrawl error: ${errorText}`);
      }

      const scrapeData = await scrapeResponse.json();
      extractedText = scrapeData.data?.markdown || scrapeData.data?.content || "";
      
      console.log("[ProcessVaultDocument] Scraped", extractedText.length, "chars");

    } else if (doc.storage_path) {
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("coach_knowledge")
        .download(doc.storage_path);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      // For PDFs and DOCs, we need to extract text
      // Using simple text extraction for now
      if (doc.source_type === "pdf") {
        // PDF text extraction - using basic approach
        // For better extraction, you'd want to use a PDF parsing library
        const arrayBuffer = await fileData.arrayBuffer();
        const textDecoder = new TextDecoder("utf-8", { fatal: false });
        const rawText = textDecoder.decode(arrayBuffer);
        
        // Try to extract readable text from PDF (basic approach)
        // Real implementation would use pdf.js or similar
        extractedText = rawText
          .replace(/[\x00-\x1F\x7F-\xFF]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        
        // If extraction is too garbled, note it
        if (extractedText.length < 100) {
          extractedText = `[PDF content - ${fileData.size} bytes. Full text extraction requires additional processing. Title: ${doc.title}]`;
        }
      } else {
        // DOC/DOCX - basic text extraction
        const text = await fileData.text();
        extractedText = text.replace(/[\x00-\x1F]/g, " ").trim();
      }
      
      console.log("[ProcessVaultDocument] Extracted", extractedText.length, "chars from file");
    }

    // Update document with extracted text
    const { error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        extracted_text: extractedText.substring(0, 500000), // Limit to 500KB
        status: "ready",
        error_message: null,
      })
      .eq("id", documentId);

    if (updateError) {
      throw updateError;
    }

    console.log("[ProcessVaultDocument] Document processed successfully");

    return new Response(
      JSON.stringify({ success: true, textLength: extractedText.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const error = err as Error;
    console.error("[ProcessVaultDocument] Error:", error);

    // Try to update document status to error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { documentId } = await (await fetch(new Request(req.url, req))).json().catch(() => ({}));
      
      if (documentId) {
        await supabase
          .from("knowledge_documents")
          .update({ status: "error", error_message: error.message })
          .eq("id", documentId);
      }
    } catch (e) {
      console.error("[ProcessVaultDocument] Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
