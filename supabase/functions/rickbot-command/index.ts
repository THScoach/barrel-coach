import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CommandRequest {
  command: string;
  history?: { role: string; content: string }[];
}

interface PlayerData {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  motorProfile?: string;
  level?: string;
  team?: string;
  scores?: {
    brain?: number;
    body?: number;
    bat?: number;
    ball?: number;
    composite?: number;
  };
  weakestCategory?: string;
  lastSessionDate?: string;
  swingCount?: number;
  trend?: "up" | "down" | "stable";
  source?: "internal" | "baseball_savant" | "fangraphs" | "combined";
  // External data fields
  statcast?: {
    avg_exit_velocity?: number;
    max_exit_velocity?: number;
    barrel_pct?: number;
    hard_hit_pct?: number;
    xba?: number;
    xslg?: number;
    xwoba?: number;
    k_pct?: number;
    bb_pct?: number;
    sprint_speed?: number;
  };
  fangraphs?: {
    woba?: number;
    wrc_plus?: number;
    war?: number;
    o_swing_pct?: number;
    z_contact_pct?: number;
    chase_rate?: number;
    hard_pct?: number;
    pull_pct?: number;
    gb_pct?: number;
    fb_pct?: number;
  };
}

// Known MLB/MiLB player names for quick detection
const MLB_KEYWORDS = ["mlb", "major league", "statcast", "savant", "fangraphs", "prospects", "minor league", "milb"];

function isExternalPlayerQuery(command: string): boolean {
  const commandLower = command.toLowerCase();
  
  // Check for MLB-related keywords
  if (MLB_KEYWORDS.some(kw => commandLower.includes(kw))) {
    return true;
  }
  
  // Check for famous player names (common MLB players)
  const famousPlayers = [
    "ohtani", "trout", "soto", "judge", "tatis", "acuna", "betts", "freeman",
    "devers", "turner", "lindor", "riley", "schwarber", "alvarez", "tucker",
    "gunnar", "henderson", "carroll", "rutschman", "witt", "robert", "seager"
  ];
  
  if (famousPlayers.some(name => commandLower.includes(name))) {
    return true;
  }
  
  return false;
}

// Web research keywords
const WEB_RESEARCH_KEYWORDS = [
  "search", "find articles", "news", "latest on", "what's the latest",
  "look up", "google", "research on", "articles about", "read about",
  "recent news", "spring training", "trade", "injury", "contract"
];

function isWebResearchQuery(command: string): boolean {
  const commandLower = command.toLowerCase();
  return WEB_RESEARCH_KEYWORDS.some(kw => commandLower.includes(kw));
}

// Web search using Firecrawl
async function webSearch(query: string): Promise<{ success: boolean; results?: any[]; error?: string }> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  
  if (!FIRECRAWL_API_KEY) {
    console.error("FIRECRAWL_API_KEY not configured");
    return { success: false, error: "Web search not configured" };
  }

  try {
    console.log("Web search query:", query);
    
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
      console.error("Firecrawl search failed:", response.status);
      return { success: false, error: `Search failed: ${response.status}` };
    }

    const data = await response.json();
    console.log("Firecrawl search results:", data.data?.length || 0);
    
    return { success: true, results: data.data || [] };
  } catch (error) {
    console.error("Web search error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Search failed" };
  }
}

// Scrape a specific URL
async function scrapeUrl(url: string): Promise<{ success: boolean; content?: any; error?: string }> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  
  if (!FIRECRAWL_API_KEY) {
    return { success: false, error: "Web scraping not configured" };
  }

  try {
    console.log("Scraping URL:", url);
    
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Scrape failed: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, content: data.data || data };
  } catch (error) {
    console.error("Scrape error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Scrape failed" };
  }
}

// Format web search results
function formatWebResults(results: any[], query: string): string {
  if (!results || results.length === 0) {
    return `No results found for "${query}".`;
  }

  let response = `## 🔍 Web Research: "${query}"\n\n`;
  
  results.slice(0, 5).forEach((result, i) => {
    response += `### ${i + 1}. ${result.title || "Untitled"}\n`;
    if (result.description) {
      response += `${result.description}\n`;
    }
    if (result.url) {
      response += `[Read more](${result.url})\n`;
    }
    response += `\n`;
  });

  return response;
}

// Call Baseball Savant lookup function
async function lookupBaseballSavant(playerName: string, supabaseUrl: string, supabaseKey: string): Promise<any> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/baseball-savant-lookup`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "full_lookup",
        playerName,
      }),
    });

    if (!response.ok) {
      console.error("Baseball Savant lookup failed:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Baseball Savant lookup error:", error);
    return null;
  }
}

// Call FanGraphs lookup function
async function lookupFanGraphs(playerName: string, supabaseUrl: string, supabaseKey: string): Promise<any> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fangraphs-lookup`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "full_lookup",
        playerName,
      }),
    });

    if (!response.ok) {
      console.error("FanGraphs lookup failed:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("FanGraphs lookup error:", error);
    return null;
  }
}

// Format external player data for display
function formatExternalPlayerData(savantData: any, fgData: any, playerName: string): { response: string; playerData: PlayerData } {
  const savantStats = savantData?.data?.stats;
  const savantPlayer = savantData?.data?.player;
  const fgStats = fgData?.data?.stats;
  const fgPlayer = fgData?.data?.player;

  const displayName = savantPlayer?.name || fgPlayer?.playerName || playerName;
  const team = savantPlayer?.team || fgStats?.team || fgPlayer?.team;
  const position = savantPlayer?.position || fgPlayer?.position;

  let response = `# ${displayName}\n`;
  if (team) response += `**${team}**`;
  if (position) response += ` • ${position}`;
  response += `\n\n`;

  // Statcast section
  if (savantStats) {
    response += `## ⚡ Statcast\n`;
    if (savantStats.avg_exit_velocity) response += `• **Exit Velo:** ${savantStats.avg_exit_velocity.toFixed(1)} mph`;
    if (savantStats.max_exit_velocity) response += ` (max ${savantStats.max_exit_velocity.toFixed(1)})\n`;
    else response += `\n`;
    
    if (savantStats.barrel_pct) response += `• **Barrel %:** ${(savantStats.barrel_pct * 100).toFixed(1)}%\n`;
    if (savantStats.hard_hit_pct) response += `• **Hard Hit %:** ${(savantStats.hard_hit_pct * 100).toFixed(1)}%\n`;
    if (savantStats.xba) response += `• **xBA:** ${savantStats.xba.toFixed(3)}\n`;
    if (savantStats.xslg) response += `• **xSLG:** ${savantStats.xslg.toFixed(3)}\n`;
    if (savantStats.xwoba) response += `• **xwOBA:** ${savantStats.xwoba.toFixed(3)}\n`;
    response += `\n`;
  }

  // FanGraphs section
  if (fgStats) {
    response += `## 📊 FanGraphs\n`;
    if (fgStats.wrc_plus) response += `• **wRC+:** ${fgStats.wrc_plus}\n`;
    if (fgStats.war !== undefined) response += `• **WAR:** ${fgStats.war.toFixed(1)}\n`;
    if (fgStats.woba) response += `• **wOBA:** ${fgStats.woba.toFixed(3)}\n`;
    
    response += `\n### Plate Discipline\n`;
    if (fgStats.o_swing_pct) response += `• **O-Swing %:** ${(fgStats.o_swing_pct * 100).toFixed(1)}%\n`;
    if (fgStats.z_contact_pct) response += `• **Z-Contact %:** ${(fgStats.z_contact_pct * 100).toFixed(1)}%\n`;
    if (fgStats.swstr_pct) response += `• **SwStr %:** ${(fgStats.swstr_pct * 100).toFixed(1)}%\n`;
    if (fgStats.k_pct) response += `• **K %:** ${(fgStats.k_pct * 100).toFixed(1)}%\n`;
    if (fgStats.bb_pct) response += `• **BB %:** ${(fgStats.bb_pct * 100).toFixed(1)}%\n`;
    
    response += `\n### Batted Ball\n`;
    if (fgStats.hard_pct) response += `• **Hard %:** ${(fgStats.hard_pct * 100).toFixed(1)}%\n`;
    if (fgStats.gb_pct) response += `• **GB %:** ${(fgStats.gb_pct * 100).toFixed(1)}%\n`;
    if (fgStats.fb_pct) response += `• **FB %:** ${(fgStats.fb_pct * 100).toFixed(1)}%\n`;
    if (fgStats.pull_pct) response += `• **Pull %:** ${(fgStats.pull_pct * 100).toFixed(1)}%\n`;
  }

  // Build player data object
  const playerData: PlayerData = {
    id: savantPlayer?.id?.toString() || fgPlayer?.playerId?.toString() || "external",
    name: displayName,
    team,
    source: "combined",
    statcast: savantStats ? {
      avg_exit_velocity: savantStats.avg_exit_velocity,
      max_exit_velocity: savantStats.max_exit_velocity,
      barrel_pct: savantStats.barrel_pct,
      hard_hit_pct: savantStats.hard_hit_pct,
      xba: savantStats.xba,
      xslg: savantStats.xslg,
      xwoba: savantStats.xwoba,
      k_pct: savantStats.k_pct,
      bb_pct: savantStats.bb_pct,
    } : undefined,
    fangraphs: fgStats ? {
      woba: fgStats.woba,
      wrc_plus: fgStats.wrc_plus,
      war: fgStats.war,
      o_swing_pct: fgStats.o_swing_pct,
      z_contact_pct: fgStats.z_contact_pct,
      hard_pct: fgStats.hard_pct,
      pull_pct: fgStats.pull_pct,
      gb_pct: fgStats.gb_pct,
      fb_pct: fgStats.fb_pct,
    } : undefined,
  };

  if (!savantStats && !fgStats) {
    response = `Found **${displayName}** but couldn't retrieve detailed stats. The player may be in the minors or data may be limited.`;
  }

  return { response, playerData };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { command, history = [] }: CommandRequest = await req.json();
    
    console.log("RickBot command received:", command);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the command to determine intent
    const commandLower = command.toLowerCase();
    let response = "";
    let playerData: PlayerData | null = null;

    // ========== INTENT DETECTION ==========
    // Determine if this is a player lookup vs a business/strategy question
    
    // Explicit player lookup patterns - VERY SPECIFIC
    const isExplicitPlayerLookup = 
      // "Pull Marcus's data", "Get Connor's scores", "Show Jake's stats"
      /(?:pull|get|show|fetch)\s+\w+(?:'s|s')?\s+(?:data|scores|stats|profile|numbers)/i.test(commandLower) ||
      // "Look up Marcus", "Research Gunnar Henderson"
      /(?:look up|lookup)\s+\w+/i.test(commandLower) ||
      // "Pull data for Marcus", "Get stats for Connor"
      /(?:pull|get|show|fetch)\s+(?:data|scores|stats|profile)\s+(?:for|on)\s+\w+/i.test(commandLower) ||
      // "Who is Marcus?", "Tell me about Connor's swing"
      /(?:who is|who's)\s+\w+/i.test(commandLower) ||
      // Direct MLB player name mentions with data intent
      (isExternalPlayerQuery(command) && /(?:statcast|savant|fangraphs|stats|data|scores)/i.test(commandLower));

    // Dashboard/metrics patterns
    const isDashboardQuery = 
      /(?:how are we|dashboard|business stats|player count|session count|how many players)/i.test(commandLower);

    // Attention/flags patterns
    const isAttentionQuery = 
      /(?:who needs attention|flagged players|declining|needs work)/i.test(commandLower);

    // Compare patterns
    const isCompareQuery = 
      /(?:compare\s+\w+\s+(?:to|vs|versus|with)|vs\.?\s+\w+)/i.test(commandLower);

    // Web search patterns
    const isWebSearch = 
      /(?:search the web|google|find articles|news on|latest news|what's the latest)/i.test(commandLower);

    // Stack data entry patterns
    const isStackDataEntry = 
      /(?:stack data|stack session|stack training|log stack|record stack|add stack)/i.test(commandLower) ||
      /(?:bat speed|grit|overspeed|overload|responder|foundation)/i.test(commandLower) && /(?:for|data|session|complete)/i.test(commandLower);

    console.log("Intent detection:", { 
      isExplicitPlayerLookup, 
      isDashboardQuery, 
      isAttentionQuery, 
      isCompareQuery, 
      isWebSearch,
      isStackDataEntry,
      command: command.substring(0, 50) 
    });

    // ========== WEB SEARCH / NEWS COMMANDS ==========
    if (isWebSearch) {
      const webSearchMatch = commandLower.match(/(?:search|google|find articles|news on|latest on|what's the latest on|read about)\s+(.+)/i);
      const searchQuery = webSearchMatch?.[1]?.trim();
      
      if (searchQuery) {
        console.log("Web research requested:", searchQuery);
        const enrichedQuery = searchQuery.includes("baseball") ? searchQuery : `${searchQuery} baseball MLB`;
        const searchResult = await webSearch(enrichedQuery);
        
        if (searchResult.success && searchResult.results) {
          response = formatWebResults(searchResult.results, searchQuery);
        } else {
          response = `Couldn't search for "${searchQuery}". ${searchResult.error || "Try again later."}`;
        }
      } else {
        response = "What would you like me to search for? Try: \"Search latest on Gunnar Henderson\"";
      }
    }
    // ========== PLAYER DATA COMMANDS (EXPLICIT ONLY) ==========
    else if (isExplicitPlayerLookup) {
      // Extract player name from command - be specific about patterns
      const pullDataMatch = commandLower.match(/(?:pull|get|show|fetch)\s+(\w+)(?:'s|s')?\s+(?:data|scores|stats|profile|numbers)/i)
        || commandLower.match(/(?:look up|lookup)\s+(\w+(?:\s+\w+)?)/i)
        || commandLower.match(/(?:pull|get|show|fetch)\s+(?:data|scores|stats|profile)\s+(?:for|on)\s+(\w+(?:\s+\w+)?)/i)
        || commandLower.match(/(?:who is|who's)\s+(\w+(?:\s+\w+)?)/i);
      
      let playerName = pullDataMatch?.[1]?.trim();

      // Clean up player name
      if (playerName) {
        playerName = playerName.replace(/[''`]/g, "").replace(/\s+(data|scores|stats|profile|info|statcast)$/i, "").trim();
      }

      if (playerName) {
        console.log("Looking up player:", playerName);
        
        // First, check if this looks like an MLB/external player query
        const isExternalQuery = isExternalPlayerQuery(command) || isExternalPlayerQuery(playerName);
        
        // Search internal database first
        const { data: players, error: playerError } = await supabase
          .from("players")
          .select(`
            id, name, email, phone, motor_profile_sensor, level, team,
            swing_4b_scores(id)
          `)
          .ilike("name", `%${playerName}%`)
          .limit(10);

        let foundInternalPlayer = false;
        
        if (!playerError && players && players.length > 0) {
          // Prioritize player with scores over one without
          const sortedPlayers = players.sort((a: any, b: any) => {
            const aHasScores = Array.isArray(a.swing_4b_scores) && a.swing_4b_scores.length > 0;
            const bHasScores = Array.isArray(b.swing_4b_scores) && b.swing_4b_scores.length > 0;
            if (aHasScores && !bHasScores) return -1;
            if (!aHasScores && bHasScores) return 1;
            return 0;
          });
          
          const player = sortedPlayers[0];
          const hasScores = Array.isArray(player.swing_4b_scores) && player.swing_4b_scores.length > 0;
          
          // Only use internal player if they have scores OR this isn't an external query
          if (hasScores || !isExternalQuery) {
            foundInternalPlayer = true;
            console.log("Found internal player:", player.name);

            // Get latest 4B scores
            const { data: latestScore } = await supabase
              .from("swing_4b_scores")
              .select("brain_score, body_score, bat_score, ball_score, composite_score, weakest_link, created_at")
              .eq("player_id", player.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            // Get previous score for trend
            const { data: previousScores } = await supabase
              .from("swing_4b_scores")
              .select("composite_score, created_at")
              .eq("player_id", player.id)
              .order("created_at", { ascending: false })
              .limit(5);

            // Get swing count from sensor_sessions
            const { data: sessionStats } = await supabase
              .from("sensor_sessions")
              .select("swing_count")
              .eq("player_id", player.id);

            const totalSwings = sessionStats?.reduce((sum, s) => sum + (s.swing_count || 0), 0) || 0;

            // Calculate trend
            let trend: "up" | "down" | "stable" = "stable";
            if (previousScores && previousScores.length >= 2) {
              const current = previousScores[0]?.composite_score || 0;
              const previous = previousScores[1]?.composite_score || 0;
              if (current > previous + 2) trend = "up";
              else if (current < previous - 2) trend = "down";
            }

            // Build player data for the card
            playerData = {
              id: player.id,
              name: player.name || "Unknown",
              email: player.email,
              phone: player.phone,
              motorProfile: player.motor_profile_sensor,
              level: player.level,
              team: player.team,
              source: "internal",
              scores: latestScore ? {
                brain: latestScore.brain_score,
                body: latestScore.body_score,
                bat: latestScore.bat_score,
                ball: latestScore.ball_score,
                composite: latestScore.composite_score,
              } : undefined,
              weakestCategory: latestScore?.weakest_link,
              lastSessionDate: latestScore?.created_at 
                ? new Date(latestScore.created_at).toLocaleDateString() 
                : undefined,
              swingCount: totalSwings,
              trend,
            };

            // Build response summary
            const scores = playerData.scores;
            if (scores?.composite) {
              response = `**${player.name}** - ${player.motor_profile_sensor || "No profile yet"} _(Internal)_\n\n`;
              response += `**Composite: ${scores.composite.toFixed(0)}** (${trend === "up" ? "↑ improving" : trend === "down" ? "↓ declining" : "→ stable"})\n\n`;
              response += `• Brain: ${scores.brain?.toFixed(0) || "--"}\n`;
              response += `• Body: ${scores.body?.toFixed(0) || "--"}\n`;
              response += `• Bat: ${scores.bat?.toFixed(0) || "--"}\n`;
              response += `• Ball: ${scores.ball?.toFixed(0) || "--"}\n\n`;
              
              if (playerData.weakestCategory) {
                response += `**Priority:** ${playerData.weakestCategory} needs attention.\n`;
              }
              response += `\n${totalSwings.toLocaleString()} total swings analyzed.`;
            } else {
              response = `Found **${player.name}** in your system but no 4B scores yet. They may need a session.`;
            }
          }
        }

        // If not found internally OR this is an MLB player query, search external sources
        if (!foundInternalPlayer || isExternalQuery) {
          console.log("Searching external sources for:", playerName);
          
          // Search both sources in parallel
          const [savantResult, fgResult] = await Promise.all([
            lookupBaseballSavant(playerName, supabaseUrl, supabaseKey),
            lookupFanGraphs(playerName, supabaseUrl, supabaseKey),
          ]);

          console.log("Savant result:", savantResult?.success, "FG result:", fgResult?.success);

          if (savantResult?.success || fgResult?.success) {
            const formatted = formatExternalPlayerData(savantResult, fgResult, playerName);
            response = formatted.response;
            playerData = formatted.playerData;
          } else if (!foundInternalPlayer) {
            // Neither internal nor external found
            response = `Couldn't find **${playerName}** in Catching Barrels or MLB databases. Check the spelling or try a different name.`;
          }
        }
      } else {
        response = "Who would you like me to look up? I can search both your players and MLB/MiLB databases.\n\nTry: \"Pull Marcus's data\" or \"Research Gunnar Henderson\"";
      }
    }
    // ========== ATTENTION/FLAGS COMMANDS ==========
    else if (isAttentionQuery) {
      // Find players with declining scores or no recent activity
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentScores } = await supabase
        .from("swing_4b_scores")
        .select("player_id, composite_score, created_at, players(name)")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      // Group by player and check for declines
      const playerScoreMap = new Map<string, { name: string; scores: number[]; lastDate: string }>();
      
      recentScores?.forEach((score: any) => {
        const playerId = score.player_id;
        if (!playerScoreMap.has(playerId)) {
          playerScoreMap.set(playerId, {
            name: score.players?.name || "Unknown",
            scores: [],
            lastDate: score.created_at,
          });
        }
        playerScoreMap.get(playerId)!.scores.push(score.composite_score);
      });

      const needsAttention: string[] = [];
      
      playerScoreMap.forEach((data, playerId) => {
        if (data.scores.length >= 2) {
          const latest = data.scores[0];
          const previous = data.scores[1];
          if (latest < previous - 5) {
            needsAttention.push(`**${data.name}** - Score dropped ${(previous - latest).toFixed(0)} points`);
          }
        }
      });

      if (needsAttention.length > 0) {
        response = `🚨 **Players Needing Attention:**\n\n${needsAttention.join("\n")}`;
      } else {
        response = "✅ No players flagged right now. Everyone's holding steady or improving.";
      }
    }
    // ========== COMPARE PLAYERS ==========
    else if (isCompareQuery) {
      // Extract two player names
      const compareMatch = commandLower.match(/compare\s+(.+?)\s+(?:to|vs|versus|and|with)\s+(.+)/i)
        || commandLower.match(/(.+?)\s+vs\.?\s+(.+)/i);
      
      if (compareMatch) {
        const player1Name = compareMatch[1].trim();
        const player2Name = compareMatch[2].trim();
        
        // Fetch both players in parallel
        const [savant1, savant2, fg1, fg2] = await Promise.all([
          lookupBaseballSavant(player1Name, supabaseUrl, supabaseKey),
          lookupBaseballSavant(player2Name, supabaseUrl, supabaseKey),
          lookupFanGraphs(player1Name, supabaseUrl, supabaseKey),
          lookupFanGraphs(player2Name, supabaseUrl, supabaseKey),
        ]);

        const p1Name = savant1?.data?.player?.name || fg1?.data?.player?.playerName || player1Name;
        const p2Name = savant2?.data?.player?.name || fg2?.data?.player?.playerName || player2Name;
        
        response = `# ${p1Name} vs ${p2Name}\n\n`;
        response += `| Metric | ${p1Name} | ${p2Name} |\n`;
        response += `|--------|----------|----------|\n`;
        
        const s1 = savant1?.data?.stats;
        const s2 = savant2?.data?.stats;
        const f1 = fg1?.data?.stats;
        const f2 = fg2?.data?.stats;
        
        if (s1?.avg_exit_velocity || s2?.avg_exit_velocity) {
          response += `| Exit Velo | ${s1?.avg_exit_velocity?.toFixed(1) || "--"} | ${s2?.avg_exit_velocity?.toFixed(1) || "--"} |\n`;
        }
        if (s1?.barrel_pct || s2?.barrel_pct) {
          response += `| Barrel % | ${s1?.barrel_pct ? (s1.barrel_pct * 100).toFixed(1) + "%" : "--"} | ${s2?.barrel_pct ? (s2.barrel_pct * 100).toFixed(1) + "%" : "--"} |\n`;
        }
        if (s1?.xwoba || s2?.xwoba) {
          response += `| xwOBA | ${s1?.xwoba?.toFixed(3) || "--"} | ${s2?.xwoba?.toFixed(3) || "--"} |\n`;
        }
        if (f1?.wrc_plus || f2?.wrc_plus) {
          response += `| wRC+ | ${f1?.wrc_plus || "--"} | ${f2?.wrc_plus || "--"} |\n`;
        }
        if (f1?.war !== undefined || f2?.war !== undefined) {
          response += `| WAR | ${f1?.war?.toFixed(1) || "--"} | ${f2?.war?.toFixed(1) || "--"} |\n`;
        }
        if (f1?.o_swing_pct || f2?.o_swing_pct) {
          response += `| O-Swing % | ${f1?.o_swing_pct ? (f1.o_swing_pct * 100).toFixed(1) + "%" : "--"} | ${f2?.o_swing_pct ? (f2.o_swing_pct * 100).toFixed(1) + "%" : "--"} |\n`;
        }
      } else {
        response = "To compare players, try: \"Compare Soto to Judge\" or \"Gunnar vs Witt\"";
      }
    }
    // ========== STACK DATA ENTRY ==========
    else if (isStackDataEntry) {
      // Parse Stack training data from voice/text input
      // Example: "Stack data for Charlie Summers: Foundation complete, 68 to 67 mph, Grit 63%, overspeed responder"
      
      // Extract player name
      const playerNameMatch = command.match(/(?:stack (?:data|session|training)|log stack|record stack|add stack)\s+(?:for\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
        || command.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:/);
      
      const stackPlayerName = playerNameMatch?.[1]?.trim();
      
      if (!stackPlayerName) {
        response = `📊 **Stack Data Entry**\n\nI can store Stack training data. Just tell me:\n\n> "Stack data for [Player Name]: Foundation complete, 68 to 67 mph, Grit 63%, overspeed responder"\n\nI'll parse:\n• Program status (Foundation, Advanced, etc.)\n• Bat speed (start → current)\n• Grit score & variance\n• Force-velocity profile\n• Coach notes\n\nWhat's the move, Coach?`;
      } else {
        // Find the player in the database
        const { data: foundPlayers } = await supabase
          .from("players")
          .select("id, name")
          .ilike("name", `%${stackPlayerName}%`)
          .limit(1);
        
        const foundPlayer = foundPlayers?.[0];
        
        if (!foundPlayer) {
          response = `Couldn't find **${stackPlayerName}** in the database. Want me to create a new player record first?`;
        } else {
          // Parse the Stack data from the command
          const parseStackData = (input: string) => {
            const data: Record<string, any> = {};
            
            // Program status
            if (/foundation complete/i.test(input)) {
              data.program_name = "Foundation";
              data.program_status = "complete";
            } else if (/foundation/i.test(input)) {
              data.program_name = "Foundation";
              data.program_status = "in_progress";
            } else if (/advanced/i.test(input)) {
              data.program_name = "Advanced";
            }
            
            // Bat speed: "68 to 67 mph" or "68-67 mph" or "68 → 67"
            const batSpeedMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:to|→|->|-)\s*(\d+(?:\.\d+)?)\s*(?:mph)?/i);
            if (batSpeedMatch) {
              data.bat_speed_start = parseFloat(batSpeedMatch[1]);
              data.bat_speed_current = parseFloat(batSpeedMatch[2]);
            }
            
            // Single bat speed value
            const singleBatSpeed = input.match(/(\d+(?:\.\d+)?)\s*mph(?!\s*(?:to|→|->|-))/i);
            if (singleBatSpeed && !data.bat_speed_current) {
              data.bat_speed_current = parseFloat(singleBatSpeed[1]);
            }
            
            // Grit score: "Grit 63%" or "grit: 63" or "63% grit"
            const gritMatch = input.match(/grit[:\s]+(\d+(?:\.\d+)?)\s*%?/i) 
              || input.match(/(\d+(?:\.\d+)?)\s*%?\s*grit/i);
            if (gritMatch) {
              data.grit_score_avg = parseFloat(gritMatch[1]);
            }
            
            // Force-velocity profile
            if (/overspeed\s*responder/i.test(input)) {
              data.fv_profile = "overspeed_responder";
            } else if (/overload\s*responder/i.test(input)) {
              data.fv_profile = "overload_responder";
            } else if (/balanced/i.test(input)) {
              data.fv_profile = "balanced";
            }
            
            // Check for BRAIN issues (grit crashed, focus, mental)
            const brainIssues: string[] = [];
            if (/grit\s*(?:crashed|dropped|fell|tanked)/i.test(input)) {
              brainIssues.push("Grit instability - crashed mid-program");
            }
            if (/brain\s*(?:issue|problem)/i.test(input)) {
              brainIssues.push("Identified as BRAIN issue");
            }
            if (/focus|mental|concentration/i.test(input)) {
              brainIssues.push("Focus/mental component flagged");
            }
            if (brainIssues.length > 0) {
              data.grit_notes = brainIssues.join("; ");
              data.four_b_insights = { brain_flag: true, notes: brainIssues };
            }
            
            // Extract any personal bests (e.g., "94 mph at 0g")
            const pbMatch = input.match(/(\d+(?:\.\d+)?)\s*mph\s*(?:at|@)\s*(\d+(?:\.\d+)?)\s*(?:g|oz)/gi);
            if (pbMatch) {
              data.personal_bests = {};
              pbMatch.forEach(pb => {
                const pbParts = pb.match(/(\d+(?:\.\d+)?)\s*mph\s*(?:at|@)\s*(\d+(?:\.\d+)?)/i);
                if (pbParts) {
                  const weight = pbParts[2] + "oz";
                  data.personal_bests[weight] = parseFloat(pbParts[1]);
                }
              });
            }
            
            // Coach insight/notes - everything after a dash or colon at the end
            const insightMatch = input.match(/(?:insight|note|fix|recommendation)[:\s]+(.+)/i)
              || input.match(/[-–—]\s*(.{20,})$/);
            if (insightMatch) {
              data.insight_summary = insightMatch[1].trim();
            }
            
            return data;
          };
          
          const parsedData = parseStackData(command);
          
          // Insert into stack_sessions
          const { data: insertedSession, error: insertError } = await supabase
            .from("stack_sessions")
            .insert({
              player_id: foundPlayer.id,
              ...parsedData,
              coach_notes: command, // Store original input as notes
            })
            .select()
            .single();
          
          if (insertError) {
            console.error("Stack session insert error:", insertError);
            response = `Got it - Stack data for **${foundPlayer.name}**, but had trouble saving it. Error: ${insertError.message}`;
          } else {
            // Build confirmation response
            response = `✅ **Stack Data Logged for ${foundPlayer.name}**\n\n`;
            
            if (parsedData.program_name) {
              response += `📋 **Program:** ${parsedData.program_name} (${parsedData.program_status || "in progress"})\n`;
            }
            if (parsedData.bat_speed_start && parsedData.bat_speed_current) {
              const change = parsedData.bat_speed_current - parsedData.bat_speed_start;
              const changeStr = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
              response += `⚡ **Bat Speed:** ${parsedData.bat_speed_start} → ${parsedData.bat_speed_current} mph (${changeStr})\n`;
            } else if (parsedData.bat_speed_current) {
              response += `⚡ **Bat Speed:** ${parsedData.bat_speed_current} mph\n`;
            }
            if (parsedData.grit_score_avg) {
              response += `🧠 **Grit Score:** ${parsedData.grit_score_avg}%\n`;
            }
            if (parsedData.fv_profile) {
              const profileNames: Record<string, string> = {
                overspeed_responder: "Overspeed Responder",
                overload_responder: "Overload Responder",
                balanced: "Balanced",
              };
              response += `🎯 **F-V Profile:** ${profileNames[parsedData.fv_profile] || parsedData.fv_profile}\n`;
            }
            if (parsedData.grit_notes) {
              response += `\n⚠️ **4B Insight:** ${parsedData.grit_notes}\n`;
            }
            if (parsedData.personal_bests && Object.keys(parsedData.personal_bests).length > 0) {
              response += `\n🏆 **Personal Bests:** `;
              response += Object.entries(parsedData.personal_bests)
                .map(([weight, speed]) => `${speed} mph @ ${weight}`)
                .join(", ");
              response += `\n`;
            }
            if (parsedData.insight_summary) {
              response += `\n💡 **Coach Insight:** ${parsedData.insight_summary}\n`;
            }
            
            response += `\n_Session ID: ${insertedSession.id.slice(0, 8)}_`;
          }
        }
      }
    }
    // ========== STATS/BUSINESS DASHBOARD COMMANDS ==========
    else if (isDashboardQuery) {
      // Get counts
      const { count: playerCount } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true });

      const { count: sessionCount } = await supabase
        .from("sensor_sessions")
        .select("*", { count: "exact", head: true });

      const { count: messageCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true });

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count: recentSessions } = await supabase
        .from("sensor_sessions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString());

      response = `📊 **Catching Barrels Dashboard**\n\n`;
      response += `• **${playerCount?.toLocaleString() || 0}** total players\n`;
      response += `• **${sessionCount?.toLocaleString() || 0}** sessions completed\n`;
      response += `• **${recentSessions || 0}** sessions in the last 7 days\n`;
      response += `• **${messageCount?.toLocaleString() || 0}** SMS/WhatsApp messages\n\n`;
      response += `_Need more detail? Ask about a specific player or time range._`;
    }
    // ========== DEFAULT - AI RESPONSE ==========
    else {
      // Use Lovable AI for general questions
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        response = "I can help with:\n• \"Pull [name]'s data\" - View player scores (internal or MLB)\n• \"Research Gunnar Henderson\" - MLB/MiLB stats from Savant & FanGraphs\n• \"Compare Soto to Judge\" - Side-by-side comparison\n• \"Who needs attention?\" - Flag declining players\n• \"How are we doing?\" - Business dashboard\n\nWhat would you like to do?";
      } else {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `# RICKBOT SYSTEM PROMPT v2
## Coach Rick's Personal Business Operator

### IDENTITY

You are RickBot, Coach Rick Strickland's personal business operator for Catching Barrels. You are NOT a search engine. You are NOT a database query tool. You are Rick's strategic thinking partner and execution assistant.

**Your Role:**
- Business strategist and operator
- Marketing advisor (Hormozi-style value stacking)
- Pricing architect
- Content scheduler
- Website copywriter
- Task executor

**You Report To:** Coach Rick Strickland (and only him)

---

### CRITICAL BEHAVIOR RULES

**1. NEVER Search When Conversing**
- WRONG: When Rick says "store the documents" → searching databases for "store the documents"
- RIGHT: When Rick says "store the documents" → acknowledge and continue the conversation

You are having a CONVERSATION, not executing database queries. Only search when Rick explicitly asks you to look something up in player data or MLB comparisons.

**2. Maintain Context Within This Thread**
Everything discussed in this conversation is your working memory. You don't need to "store documents" - you already have the context. If Rick references something from earlier in the thread, use that context directly.

**3. Never Say "Couldn't Find X"**
If you can't find something in a database, that's fine - you're probably not supposed to be searching. Re-read the message and respond conversationally.

**4. When In Doubt, Summarize and Confirm**
If Rick's request is unclear, summarize what you understood and ask a clarifying question. Don't default to searching.

---

### YOUR CAPABILITIES

**What You CAN Do:**
- Draft pricing strategies, landing pages, email copy, social posts
- Analyze business models and suggest improvements
- Create action plans and checklists
- Remember and reference everything in this conversation
- Suggest Hormozi-style offers (value stacking, risk reversal, scarcity)
- Help structure membership tiers and pricing
- Draft website copy for catchingbarrels.io
- Create content calendars and posting schedules
- Remind Rick of tasks and deadlines

**What You CANNOT Do (And Should NOT Try):**
- Access Stripe directly (suggest changes, Rick implements)
- Access bank accounts or financial systems
- Make purchases or financial transactions
- Send emails/texts without Rick's approval
- Modify the live website (draft copy, Rick implements)
- Access external systems without explicit MCP tools

**When Rick Asks About External Systems:**
Instead of trying to access them, say: "I can draft the [pricing/copy/plan] for you. Once you approve it, you can implement it in [Stripe/the website/etc.] - takes about 5 minutes."

---

### THE SWING REHAB COACH BRANDING

**When discussing the AI coach, NEVER call it:**
- ClawdBot
- AI Bot
- The Bot
- Automated system

**ALWAYS call it:**
- The Swing Rehab Coach
- The Swing Rehab Digital Coach
- Rick's Digital Lab Assistant
- The Strickland System

**The Narrative:** "I've spent 30 years perfecting a proprietary system for developing elite hitters. I have now codified that entire knowledge base into a 24/7 digital interface so my hitters never have to guess what I'm thinking during a session."

---

### CURRENT PRICING STRUCTURE

| Tier | Name | Monthly | Annual | Notes |
|------|------|---------|--------|-------|
| 1 | Digital Lab (BYO Sensor) | $49/mo | $499/yr | ~90% margin |
| 2 | Founder's Startup (w/ Sensor) | $149/mo | $799/yr | Includes VAT sensor |
| 3 | Hybrid Lab (Video Audits) | $249/mo | $2,500/yr | Monthly Rick review |
| 4 | Pro Consulting | $1,000/mo | $10,000/yr | Direct 1-on-1 access |

**Cost Structure:**
- VAT Sensor: $50 (Rick's cost)
- Per-player monthly tech cost: $4.99
- Diamond Kinetics compatible (BYO option)

---

### HORMOZI PRINCIPLES TO APPLY

- **Value Equation:** Dream Outcome × Perceived Likelihood ÷ Time × Effort
- **Risk Reversal:** "If you don't see results in 30 days, send it back"
- **Scarcity:** "Opening 20 spots for Beta Group"
- **Price Anchoring:** Show the $1,000+ tier to make $149 look cheap
- **Grand Slam Offer:** Make it so good they feel stupid saying no

---

### RESPONSE FORMAT

Keep responses:
- **Actionable** - End with clear next steps or options
- **Structured** - Use tables for comparisons, bullets for lists
- **Conversational** - You're Rick's operator, not a corporate memo
- **Direct** - No fluff, no "As an AI..." disclaimers

When presenting options, always end with: "What's the move, Coach?" or "Which direction do you want to go?"

---

### MEMORY NOTE

You do NOT need external "document storage" to remember this conversation. Everything discussed here is your working context. If Rick says "remember this" or "store this," acknowledge it and keep it in mind for the rest of the conversation.

---

### FINAL RULE

You are Rick's thinking partner, not a search engine.

If something feels like it should be a conversation, have the conversation. If something feels like it needs a database lookup, ask Rick to clarify what data he needs. Never default to searching when a simple acknowledgment or strategic response is what's needed.`,
              },
              ...history.map(h => ({ role: h.role === "user" ? "user" : "assistant", content: h.content })),
              { role: "user", content: command },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          response = aiData.choices?.[0]?.message?.content || "I didn't catch that. Try a specific command.";
        } else {
          response = "I can help with:\n• \"Pull [name]'s data\" - View player scores (internal or MLB)\n• \"Research Gunnar Henderson\" - MLB/MiLB stats from Savant & FanGraphs\n• \"Compare Soto to Judge\" - Side-by-side comparison\n• \"Who needs attention?\" - Flag declining players\n• \"How are we doing?\" - Business dashboard\n\nWhat would you like to do?";
        }
      }
    }

    console.log("RickBot response generated, playerData:", playerData ? "yes" : "no");

    return new Response(
      JSON.stringify({ response, playerData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("RickBot error:", error);
    return new Response(
      JSON.stringify({ 
        response: "Something went wrong. Check the logs.", 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
