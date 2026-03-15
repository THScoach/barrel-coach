import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for in-memory processing

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let documentId: string | undefined;

  try {
    const body = await req.json();
    documentId = body.documentId;
    console.log("[ProcessVaultDocument] Processing:", documentId);

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
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (doc.source_type === "url" && doc.original_url) {
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
      // Check file size before downloading
      const fileSize = doc.file_size || 0;
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        console.log(`[ProcessVaultDocument] File too large (${fileSize} bytes), storing metadata only`);
        extractedText = `[File: ${doc.title} | Type: ${doc.source_type} | Size: ${(fileSize / 1024 / 1024).toFixed(1)}MB — file exceeds processing limit. Content indexed by title and metadata.]`;
      } else {
        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("coach_knowledge")
          .download(doc.storage_path);

        if (downloadError) {
          throw new Error(`Failed to download file: ${downloadError.message}`);
        }

        if (doc.source_type === "pdf") {
          // Stream-safe: read only first 500KB of text content from PDF
          const slice = fileData.slice(0, 512 * 1024);
          const arrayBuffer = await slice.arrayBuffer();
          const textDecoder = new TextDecoder("utf-8", { fatal: false });
          const rawText = textDecoder.decode(arrayBuffer);

          extractedText = rawText
            .replace(/[\x00-\x1F\x7F-\xFF]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (extractedText.length < 100) {
            extractedText = `[PDF content - ${fileData.size} bytes. Title: ${doc.title}. Full text extraction requires additional processing.]`;
          }
        } else {
          // DOC/DOCX - read as text, limit size
          const slice = fileData.slice(0, 512 * 1024);
          const text = await slice.text();
          extractedText = text.replace(/[\x00-\x1F]/g, " ").trim();
        }

        console.log("[ProcessVaultDocument] Extracted", extractedText.length, "chars from file");
      }
    }

    // Limit stored text to 200KB to reduce memory pressure
    const { error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        extracted_text: extractedText.substring(0, 200000),
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
    console.error("[ProcessVaultDocument] Error:", error.message);

    if (documentId) {
      try {
        await supabase
          .from("knowledge_documents")
          .update({ status: "error", error_message: error.message })
          .eq("id", documentId);
      } catch (e) {
        console.error("[ProcessVaultDocument] Failed to update error status:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
