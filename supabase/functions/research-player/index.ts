import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface SearchResult {
  title: string;
  url: string;
  description: string;
  markdown?: string;
}

interface PlayerResearch {
  name: string;
  organization?: string;
  current_team?: string;
  level?: string;
  position?: string;
  bats?: string;
  throws?: string;
  age?: number;
  height?: string;
  weight?: number;
  stats?: {
    avg?: string;
    hr?: number;
    rbi?: number;
    sb?: number;
    ops?: string;
    year?: string;
  };
  scouting_grades?: {
    hit?: number;
    power?: number;
    speed?: number;
    field?: number;
    arm?: number;
  };
  scouting_reports?: string[];
  known_issues?: string[];
  sources?: string[];
  raw_data?: string;
}

async function searchFirecrawl(query: string): Promise<SearchResult[]> {
  if (!FIRECRAWL_API_KEY) {
    console.error("FIRECRAWL_API_KEY not configured");
    return [];
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    });

    if (!response.ok) {
      console.error("Firecrawl search error:", response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Firecrawl search error:", error);
    return [];
  }
}

async function analyzeWithAI(playerName: string, searchResults: SearchResult[]): Promise<PlayerResearch> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const combinedContent = searchResults
    .map(r => `Source: ${r.url}\nTitle: ${r.title}\n${r.markdown || r.description}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are Coach Rick's AI research assistant for baseball player scouting. 
Your job is to extract structured player information from web search results.

Extract the following information if available:
- Organization (MLB team)
- Current team name
- Level (MLB, AAA, AA, High-A, Low-A, College, High School, etc.)
- Position
- Bats (Left/Right/Switch)
- Throws (Left/Right)
- Age
- Height
- Weight
- Stats (AVG, HR, RBI, SB, OPS) with year
- Scouting grades on 20-80 scale (Hit, Power, Speed, Field, Arm)
- Notable scouting report quotes
- Known swing issues or areas to work on

Be accurate. Only include information that is explicitly stated in the sources.
For scouting grades, use 20-80 scale (50 is average). Convert if needed.
For "known_issues", identify swing mechanics problems, plate discipline issues, or areas scouts say need work.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Research player: ${playerName}\n\nSearch results:\n${combinedContent}\n\nExtract all available information about this player.` 
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_player_info",
            description: "Extract structured player information from search results",
            parameters: {
              type: "object",
              properties: {
                organization: { type: "string", description: "MLB organization (e.g., Boston Red Sox)" },
                current_team: { type: "string", description: "Current team name" },
                level: { type: "string", description: "Playing level (MLB, AAA, AA, High-A, etc.)" },
                position: { type: "string", description: "Primary position" },
                bats: { type: "string", enum: ["Left", "Right", "Switch"] },
                throws: { type: "string", enum: ["Left", "Right"] },
                age: { type: "integer" },
                height: { type: "string", description: "Height (e.g., 6'2\")" },
                weight: { type: "integer", description: "Weight in lbs" },
                stats: {
                  type: "object",
                  properties: {
                    avg: { type: "string" },
                    hr: { type: "integer" },
                    rbi: { type: "integer" },
                    sb: { type: "integer" },
                    ops: { type: "string" },
                    year: { type: "string" },
                  },
                },
                scouting_grades: {
                  type: "object",
                  properties: {
                    hit: { type: "integer", description: "20-80 scale" },
                    power: { type: "integer", description: "20-80 scale" },
                    speed: { type: "integer", description: "20-80 scale" },
                    field: { type: "integer", description: "20-80 scale" },
                    arm: { type: "integer", description: "20-80 scale" },
                  },
                },
                scouting_reports: {
                  type: "array",
                  items: { type: "string" },
                  description: "Notable quotes from scouting reports",
                },
                known_issues: {
                  type: "array",
                  items: { type: "string" },
                  description: "Swing issues or areas needing work",
                },
              },
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_player_info" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("AI credits depleted. Please add funds.");
    }
    throw new Error("AI analysis failed");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    return {
      name: playerName,
      sources: searchResults.map(r => r.url),
      raw_data: combinedContent,
    };
  }

  const extracted = JSON.parse(toolCall.function.arguments);
  
  return {
    name: playerName,
    ...extracted,
    sources: searchResults.map(r => r.url),
  };
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

    console.log(`Researching player: ${player_name}`);

    // Search multiple baseball sources
    const searches = await Promise.all([
      searchFirecrawl(`${player_name} baseball player stats milb fangraphs`),
      searchFirecrawl(`${player_name} scouting report prospect`),
    ]);

    const allResults = searches.flat();
    
    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No information found for this player",
          player: { name: player_name }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Analyze with AI
    const playerData = await analyzeWithAI(player_name, allResults);

    console.log("Research complete:", playerData);

    return new Response(
      JSON.stringify({ success: true, player: playerData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Research error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Research failed" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
