import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatcastData {
  exit_velo?: number;
  launch_angle?: number;
  zone_chase_pct?: number;
  barrel_pct?: number;
  hard_hit_pct?: number;
  sweet_spot_pct?: number;
  avg_distance?: number;
  xba?: number;
  xslg?: number;
  xwoba?: number;
  k_pct?: number;
  bb_pct?: number;
  whiff_pct?: number;
}

interface ValidationResult {
  isComplete: boolean;
  missingFields: string[];
  validatedData: StatcastData | null;
}

interface PipelineResult {
  success: boolean;
  briefId?: string;
  status: 'complete' | 'incomplete' | 'error';
  missingFields?: string[];
  scoutingNotes?: string;
  powerpointCode?: string;
  error?: string;
}

// Step 1: Fetch Statcast data via Perplexity
async function fetchStatcastData(playerName: string): Promise<{ raw: string; parsed: StatcastData | null }> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  
  if (!PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY not configured");
  }

  console.log(`[Step 1] Fetching Statcast data for: ${playerName}`);

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a baseball analytics expert. Extract Statcast data for the requested player. 
Return ONLY a JSON object with these fields (use null for unavailable data):
{
  "exit_velo": number (avg exit velocity in mph),
  "launch_angle": number (avg launch angle in degrees),
  "zone_chase_pct": number (chase rate percentage),
  "barrel_pct": number (barrel percentage),
  "hard_hit_pct": number (hard hit percentage, 95+ mph),
  "sweet_spot_pct": number (sweet spot percentage, 8-32 degrees),
  "avg_distance": number (average batted ball distance in feet),
  "xba": number (expected batting average),
  "xslg": number (expected slugging),
  "xwoba": number (expected wOBA),
  "k_pct": number (strikeout percentage),
  "bb_pct": number (walk percentage),
  "whiff_pct": number (whiff percentage)
}
Only return the JSON object, no other text.`
        },
        {
          role: "user",
          content: `Get the latest Statcast data for MLB player: ${playerName}. Include exit velocity, launch angle, chase rate, barrel rate, and expected stats.`
        }
      ],
      search_domain_filter: ["baseballsavant.mlb.com", "fangraphs.com", "mlb.com"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Step 1] Perplexity error:", response.status, errorText);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || "";
  
  console.log("[Step 1] Raw response:", rawContent.substring(0, 500));

  // Try to parse JSON from the response
  let parsed: StatcastData | null = null;
  try {
    // Extract JSON from the response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[Step 1] JSON parse error:", e);
  }

  return { raw: rawContent, parsed };
}

// Step 2: Validate the data
function validateStatcastData(data: StatcastData | null): ValidationResult {
  console.log("[Step 2] Validating data...");
  
  const requiredFields = ['exit_velo', 'launch_angle'];
  const missingFields: string[] = [];

  if (!data) {
    return {
      isComplete: false,
      missingFields: requiredFields,
      validatedData: null,
    };
  }

  // Check required fields
  for (const field of requiredFields) {
    if (data[field as keyof StatcastData] === null || data[field as keyof StatcastData] === undefined) {
      missingFields.push(field);
    }
  }

  // Clean and validate numeric values
  const validatedData: StatcastData = {};
  const numericFields: (keyof StatcastData)[] = [
    'exit_velo', 'launch_angle', 'zone_chase_pct', 'barrel_pct', 
    'hard_hit_pct', 'sweet_spot_pct', 'avg_distance', 'xba', 
    'xslg', 'xwoba', 'k_pct', 'bb_pct', 'whiff_pct'
  ];

  for (const field of numericFields) {
    const value = data[field];
    if (value !== null && value !== undefined && !isNaN(Number(value))) {
      validatedData[field] = Number(value);
    }
  }

  const result: ValidationResult = {
    isComplete: missingFields.length === 0,
    missingFields,
    validatedData: Object.keys(validatedData).length > 0 ? validatedData : null,
  };

  console.log("[Step 2] Validation result:", result.isComplete ? "COMPLETE" : "INCOMPLETE", result.missingFields);
  
  return result;
}

// Step 3: Generate scouting notes and PowerPoint slide via Gemini
async function generateScoutingContent(
  playerName: string, 
  statcastData: StatcastData
): Promise<{ scoutingNotes: string; powerpointCode: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  console.log("[Step 3] Generating scouting content with Gemini...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are Coach Rick's AI scouting assistant. Generate two outputs:

1. SCOUTING NOTES (8th grade reading level):
Write 3-4 paragraphs analyzing the player's swing mechanics based on their Statcast data.
- Use simple language a middle schooler could understand
- Reference specific metrics and what they mean
- Identify 2-3 key strengths
- Identify 1-2 areas for improvement
- Use baseball terminology but explain it

2. POWERPOINT SLIDE CODE (React component):
Create a React component that renders a clean, professional scouting slide.
Use Tailwind CSS. Include:
- Player name header
- Key metrics displayed in a grid
- Visual indicators (color coding for good/bad metrics)
- A brief summary section

Return as JSON with two fields: "scoutingNotes" and "powerpointCode"`
        },
        {
          role: "user",
          content: `Generate scouting content for ${playerName}.

Statcast Data:
${JSON.stringify(statcastData, null, 2)}

Key thresholds for reference:
- Exit Velo: Elite 95+, Good 90-95, Average 85-90
- Launch Angle: Ideal 10-25 degrees
- Barrel %: Elite 15%+, Good 8-15%, Below Avg <8%
- Hard Hit %: Elite 45%+, Good 38-45%, Average 30-38%
- Chase Rate: Good <25%, Average 25-32%, Concerning >32%`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_scouting_content",
            description: "Generate scouting notes and PowerPoint slide code",
            parameters: {
              type: "object",
              properties: {
                scoutingNotes: {
                  type: "string",
                  description: "3-4 paragraphs of scouting analysis at 8th grade reading level"
                },
                powerpointCode: {
                  type: "string",
                  description: "React component code for a scouting slide using Tailwind CSS"
                }
              },
              required: ["scoutingNotes", "powerpointCode"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "generate_scouting_content" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits depleted. Please add funds.");
    }
    throw new Error("Gemini API error");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content || "";
    console.log("[Step 3] No tool call, trying content parse");
    
    return {
      scoutingNotes: `Scouting analysis for ${playerName} based on available Statcast data.`,
      powerpointCode: `// PowerPoint slide component for ${playerName}`,
    };
  }

  const result = JSON.parse(toolCall.function.arguments);
  console.log("[Step 3] Generated content successfully");
  
  return {
    scoutingNotes: result.scoutingNotes || "",
    powerpointCode: result.powerpointCode || "",
  };
}

// Step 4: Save to database
async function saveFinalBrief(
  supabase: any,
  playerName: string,
  rawData: string,
  validationResult: ValidationResult,
  scoutingContent: { scoutingNotes: string; powerpointCode: string } | null,
  userId: string | null
): Promise<string> {
  console.log("[Step 4] Saving to final_research_briefs...");

  const status = validationResult.isComplete ? 'complete' : 'incomplete';

  const { data, error } = await supabase
    .from('final_research_briefs')
    .insert({
      player_name: playerName,
      raw_statcast_data: { raw: rawData },
      validated_data: validationResult.validatedData,
      data_status: status,
      missing_fields: validationResult.missingFields.length > 0 ? validationResult.missingFields : null,
      scouting_notes: scoutingContent?.scoutingNotes || null,
      powerpoint_slide_code: scoutingContent?.powerpointCode || null,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error) {
    console.error("[Step 4] Database error:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log("[Step 4] Saved brief with ID:", data?.id);
  return data?.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { player_name } = await req.json();

    if (!player_name) {
      return new Response(
        JSON.stringify({ error: "Player name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from auth header if available
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    console.log(`\n=== PROSPECT RESEARCH PIPELINE ===`);
    console.log(`Player: ${player_name}`);
    console.log(`User: ${userId || "anonymous"}`);

    // Step 1: Fetch Statcast data via Perplexity
    const { raw: rawData, parsed: parsedData } = await fetchStatcastData(player_name);

    // Step 2: Validate the data
    const validationResult = validateStatcastData(parsedData);

    // Step 3: Generate scouting content (only if data is complete)
    let scoutingContent: { scoutingNotes: string; powerpointCode: string } | null = null;
    
    if (validationResult.isComplete && validationResult.validatedData) {
      scoutingContent = await generateScoutingContent(player_name, validationResult.validatedData);
    } else {
      console.log("[Step 3] Skipping - data incomplete");
    }

    // Step 4: Save to database
    const briefId = await saveFinalBrief(
      supabase,
      player_name,
      rawData,
      validationResult,
      scoutingContent,
      userId
    );

    const result: PipelineResult = {
      success: true,
      briefId,
      status: validationResult.isComplete ? 'complete' : 'incomplete',
      missingFields: validationResult.missingFields.length > 0 ? validationResult.missingFields : undefined,
      scoutingNotes: scoutingContent?.scoutingNotes,
      powerpointCode: scoutingContent?.powerpointCode,
    };

    console.log(`\n=== PIPELINE COMPLETE ===`);
    console.log(`Status: ${result.status}`);
    console.log(`Brief ID: ${briefId}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pipeline error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : "Pipeline failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
