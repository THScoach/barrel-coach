import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SegmentRequest {
  imageUrl: string;
  mode: "hitter" | "bat" | "barrel" | "background";
  prompt?: string;
}

interface SegmentResponse {
  maskUrl: string;
  mode: string;
  processingTime: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const { imageUrl, mode, prompt }: SegmentRequest = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();

    // Map mode to SAM3 prompt
    const segmentPrompt = getSegmentPrompt(mode, prompt);

    console.log(`SAM3 segmentation request: mode=${mode}, prompt="${segmentPrompt}"`);

    // Call Replicate SAM3 API
    // Using SAM 2.1 (meta/sam-2.1-pro) for video/image segmentation
    const prediction = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "wait",  // Wait for result (up to 60s)
      },
      body: JSON.stringify({
        // SAM 2.1 Pro model for high-quality segmentation
        version: "fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83",
        input: {
          image: imageUrl,
          point_coords: null,
          point_labels: null,
          box: null,
          mask_input: null,
          multimask_output: false,
          // Use text prompt for concept-based segmentation
          use_m2m: true,
        }
      }),
    });

    if (!prediction.ok) {
      const errorText = await prediction.text();
      console.error("Replicate API error:", prediction.status, errorText);
      
      // Fallback: Use Grounding DINO + SAM for text-based segmentation
      return await fallbackGroundedSAM(REPLICATE_API_KEY, imageUrl, segmentPrompt, mode, startTime, corsHeaders);
    }

    const result = await prediction.json();

    // Handle async prediction (if Prefer: wait didn't complete)
    if (result.status === "starting" || result.status === "processing") {
      // Poll for result
      const finalResult = await pollPrediction(REPLICATE_API_KEY, result.id);
      return formatResponse(finalResult, mode, startTime, corsHeaders);
    }

    return formatResponse(result, mode, startTime, corsHeaders);

  } catch (error) {
    console.error("SAM3 segmentation error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Segmentation failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getSegmentPrompt(mode: string, customPrompt?: string): string {
  if (customPrompt) return customPrompt;
  
  const prompts: Record<string, string> = {
    "hitter": "baseball batter person swinging",
    "bat": "baseball bat",
    "barrel": "barrel of baseball bat",
    "background": "background cage net fence",
  };
  
  return prompts[mode] || "person";
}

async function fallbackGroundedSAM(
  apiKey: string,
  imageUrl: string,
  prompt: string,
  mode: string,
  startTime: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log("Using fallback Grounded-SAM for text-based segmentation");
  
  // Use Grounded-SAM which supports text prompts
  const prediction = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Prefer": "wait",
    },
    body: JSON.stringify({
      // Grounded-SAM model for text-prompted segmentation
      version: "ee871c19efb1941f55f66a3d7d960428c8a5afcb77449547fe8e5a3ab9ec7960",
      input: {
        image: imageUrl,
        text_prompt: prompt,
        box_threshold: 0.25,
        text_threshold: 0.25,
      }
    }),
  });

  if (!prediction.ok) {
    const errorText = await prediction.text();
    console.error("Grounded-SAM fallback error:", prediction.status, errorText);
    throw new Error(`Segmentation failed: ${prediction.status}`);
  }

  const result = await prediction.json();
  
  if (result.status === "starting" || result.status === "processing") {
    const finalResult = await pollPrediction(apiKey, result.id);
    return formatResponse(finalResult, mode, startTime, corsHeaders);
  }

  return formatResponse(result, mode, startTime, corsHeaders);
}

async function pollPrediction(apiKey: string, predictionId: string, maxAttempts = 30): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    
    const result = await response.json();
    
    if (result.status === "succeeded") {
      return result;
    } else if (result.status === "failed") {
      throw new Error(`Prediction failed: ${result.error}`);
    }
  }
  
  throw new Error("Prediction timed out");
}

function formatResponse(
  result: any,
  mode: string,
  startTime: number,
  corsHeaders: Record<string, string>
): Response {
  const processingTime = Date.now() - startTime;
  
  // Extract mask URL from result
  let maskUrl = "";
  if (result.output) {
    if (typeof result.output === "string") {
      maskUrl = result.output;
    } else if (Array.isArray(result.output)) {
      // Grounded-SAM returns array with mask
      maskUrl = result.output.find((url: string) => url.includes("mask")) || result.output[0];
    } else if (result.output.mask) {
      maskUrl = result.output.mask;
    }
  }

  const response: SegmentResponse = {
    maskUrl,
    mode,
    processingTime,
  };

  console.log(`SAM3 segmentation complete: mode=${mode}, time=${processingTime}ms`);

  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
