import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NAPKIN_API_BASE = "https://api.napkin.ai/v1";

// Available Napkin styles
const NAPKIN_STYLES = {
  vibrant: "CDQPRVVJCSTPRBBCD5Q6AWR",
  sketch: "D1GPWS1DDHMPWSBK",
  corporate: "CSQQ4VB1DGPPTVVEDXHPGWKFDNJJTSKCC5T0",
  minimal: "DNQPWVV3D1S6YVB55NK6RRBM",
  elegant: "CSQQ4VB1DGPP4V31CDNJTVKFBXK6JV3C",
  bold: "CDQPRVVJCSTPRBB6DHGQ8",
  artistic: "D1GPWS1DCDQPRVVJCSTPR",
} as const;

type NapkinStyle = keyof typeof NAPKIN_STYLES;

interface GenerateDiagramRequest {
  content: string;
  style?: NapkinStyle;
  format?: "svg" | "png";
  width?: number;
  height?: number;
  contextBefore?: string;
  contextAfter?: string;
  saveToStorage?: boolean;
  filename?: string;
}

interface NapkinCreateResponse {
  id: string;
  status: "pending" | "completed" | "failed";
  request: Record<string, unknown>;
  generated_files?: Array<{
    id: string;
    url: string;
    format: string;
    width?: number;
    height?: number;
  }>;
}

// Helper: wait function
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Poll for completion with exponential backoff
async function pollForCompletion(
  requestId: string,
  apiKey: string,
  maxAttempts = 30
): Promise<NapkinCreateResponse> {
  let delay = 2000; // Start with 2 seconds
  const maxDelay = 15000; // Max 15 seconds
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await wait(delay);
    
    const response = await fetch(
      `${NAPKIN_API_BASE}/visual/${requestId}/status`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Napkin status check failed [${response.status}]: ${errorText}`);
    }
    
    const result: NapkinCreateResponse = await response.json();
    
    if (result.status === "completed") {
      return result;
    }
    
    if (result.status === "failed") {
      throw new Error("Napkin diagram generation failed");
    }
    
    // Exponential backoff
    delay = Math.min(Math.round(delay * 1.5), maxDelay);
  }
  
  throw new Error("Napkin diagram generation timed out");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NAPKIN_API_KEY = Deno.env.get("NAPKIN_API_KEY");
    if (!NAPKIN_API_KEY) {
      throw new Error("NAPKIN_API_KEY is not configured");
    }

    const body: GenerateDiagramRequest = await req.json();
    const {
      content,
      style = "corporate",
      format = "png",
      width = 1200,
      height,
      contextBefore,
      contextAfter,
      saveToStorage = false,
      filename,
    } = body;

    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating Napkin diagram: "${content.substring(0, 50)}..." with style: ${style}`);

    // Step 1: Create visual request
    const createPayload: Record<string, unknown> = {
      format,
      content,
      style_id: NAPKIN_STYLES[style] || NAPKIN_STYLES.corporate,
      number_of_visuals: 1,
      language: "en-US",
    };

    if (format === "png" && width) {
      createPayload.width = width;
    }
    if (format === "png" && height && !width) {
      createPayload.height = height;
    }
    if (contextBefore) {
      createPayload.context_before = contextBefore;
    }
    if (contextAfter) {
      createPayload.context_after = contextAfter;
    }

    const createResponse = await fetch(`${NAPKIN_API_BASE}/visual`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${NAPKIN_API_KEY}`,
      },
      body: JSON.stringify(createPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Napkin API error:", createResponse.status, errorText);
      
      if (createResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Napkin API failed [${createResponse.status}]: ${errorText}`);
    }

    const createResult: NapkinCreateResponse = await createResponse.json();
    console.log(`Napkin request created: ${createResult.id}, status: ${createResult.status}`);

    // Step 2: Poll for completion
    let finalResult: NapkinCreateResponse;
    
    if (createResult.status === "completed") {
      finalResult = createResult;
    } else {
      finalResult = await pollForCompletion(createResult.id, NAPKIN_API_KEY);
    }

    if (!finalResult.generated_files || finalResult.generated_files.length === 0) {
      throw new Error("No files generated");
    }

    const generatedFile = finalResult.generated_files[0];
    console.log(`Diagram generated: ${generatedFile.url}`);

    // Step 3: Optionally save to Supabase storage
    let storageUrl: string | null = null;
    
    if (saveToStorage) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Download the image
      const imageResponse = await fetch(generatedFile.url);
      if (!imageResponse.ok) {
        throw new Error("Failed to download generated image");
      }
      const imageBlob = await imageResponse.blob();

      // Generate filename
      const ext = format === "svg" ? "svg" : "png";
      const finalFilename = filename || `napkin-${Date.now()}.${ext}`;
      const storagePath = `diagrams/${finalFilename}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("content-media")
        .upload(storagePath, imageBlob, {
          contentType: format === "svg" ? "image/svg+xml" : "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("content-media")
          .getPublicUrl(storagePath);
        storageUrl = publicUrlData.publicUrl;
        console.log(`Image saved to storage: ${storageUrl}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: generatedFile.url,
        storageUrl,
        format: generatedFile.format,
        width: generatedFile.width,
        height: generatedFile.height,
        requestId: finalResult.id,
        expiresIn: "30 minutes",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Generate diagram error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
