import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PointPrompt {
  x: number;
  y: number;
  label: 0 | 1; // 0 = negative, 1 = positive
}

interface BoxPrompt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface SegmentRequest {
  imageUrl?: string;
  imageDataUrl?: string; // base64 data URL
  mode?: "hitter" | "bat" | "barrel" | "background" | "custom";
  prompt?: string;
  points?: PointPrompt[];
  box?: BoxPrompt;
}

interface SegmentResponse {
  maskUrl: string;
  mode: string;
  processingTime: number;
  confidence?: number;
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

    const body: SegmentRequest = await req.json();
    const { imageUrl, imageDataUrl, mode = "custom", prompt, points, box } = body;

    // Accept either URL or base64 data
    const image = imageDataUrl || imageUrl;
    if (!image) {
      return new Response(
        JSON.stringify({ error: "imageUrl or imageDataUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startTime = Date.now();
    const hasPointOrBox = (points && points.length > 0) || box;

    console.log(`SAM3 request: mode=${mode}, points=${points?.length || 0}, hasBox=${!!box}`);

    // If we have point/box prompts, use SAM 2.1 with coordinate prompts
    if (hasPointOrBox) {
      return await segmentWithPrompts(REPLICATE_API_KEY, image, points, box, mode, startTime, corsHeaders);
    }

    // Otherwise use text-based Grounded-SAM
    const segmentPrompt = getSegmentPrompt(mode, prompt);
    return await fallbackGroundedSAM(REPLICATE_API_KEY, image, segmentPrompt, mode, startTime, corsHeaders);

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

// SAM 2.1 with point/box prompts
async function segmentWithPrompts(
  apiKey: string,
  image: string,
  points: PointPrompt[] | undefined,
  box: BoxPrompt | undefined,
  mode: string,
  startTime: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log("Using SAM 2.1 with coordinate prompts");

  // Format point coordinates for SAM 2.1
  // SAM expects [[x1,y1], [x2,y2], ...]
  let pointCoords: number[][] | null = null;
  let pointLabels: number[] | null = null;
  
  if (points && points.length > 0) {
    pointCoords = points.map(p => [p.x, p.y]);
    pointLabels = points.map(p => p.label);
  }

  // Format box for SAM 2.1: [x1, y1, x2, y2]
  let boxInput: number[] | null = null;
  if (box) {
    boxInput = [box.x1, box.y1, box.x2, box.y2];
  }

  const prediction = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Prefer": "wait",
    },
    body: JSON.stringify({
      // SAM 2.1 Pro model
      version: "fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83",
      input: {
        image: image,
        point_coords: pointCoords,
        point_labels: pointLabels,
        box: boxInput,
        multimask_output: false,
        return_logits: false,
      }
    }),
  });

  if (!prediction.ok) {
    const errorText = await prediction.text();
    console.error("SAM 2.1 API error:", prediction.status, errorText);
    throw new Error(`SAM segmentation failed: ${prediction.status}`);
  }

  const result = await prediction.json();

  // Handle async prediction
  if (result.status === "starting" || result.status === "processing") {
    const finalResult = await pollPrediction(apiKey, result.id);
    return formatResponse(finalResult, mode, startTime, corsHeaders);
  }

  return formatResponse(result, mode, startTime, corsHeaders);
}

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
  image: string,
  prompt: string,
  mode: string,
  startTime: number,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log("Using Grounded-SAM for text-based segmentation");
  
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
        image: image,
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
    } else if (result.output.combined_mask) {
      maskUrl = result.output.combined_mask;
    }
  }

  const response: SegmentResponse = {
    maskUrl,
    mode,
    processingTime,
  };

  console.log(`SAM3 segmentation complete: mode=${mode}, time=${processingTime}ms, maskUrl=${maskUrl ? 'present' : 'missing'}`);

  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
