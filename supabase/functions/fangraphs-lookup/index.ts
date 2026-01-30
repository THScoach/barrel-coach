import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FangraphsPlayer {
  playerId: number;
  playerName: string;
  team?: string;
  position?: string;
}

interface FangraphsStats {
  playerId: number;
  playerName: string;
  team?: string;
  // Plate discipline
  o_swing_pct?: number; // Outside zone swing %
  z_swing_pct?: number; // Zone swing %
  swing_pct?: number;   // Overall swing %
  o_contact_pct?: number; // Outside zone contact %
  z_contact_pct?: number; // Zone contact %
  contact_pct?: number;   // Overall contact %
  zone_pct?: number;      // % pitches in zone
  f_strike_pct?: number;  // First pitch strike %
  swstr_pct?: number;     // Swinging strike %
  // Advanced hitting
  woba?: number;
  wrc_plus?: number;
  iso?: number;
  babip?: number;
  k_pct?: number;
  bb_pct?: number;
  hr_fb?: number;
  // Batted ball
  gb_pct?: number;
  fb_pct?: number;
  ld_pct?: number;
  iffb_pct?: number;
  pull_pct?: number;
  cent_pct?: number;
  oppo_pct?: number;
  soft_pct?: number;
  med_pct?: number;
  hard_pct?: number;
  // Value
  war?: number;
  off?: number;
  def?: number;
  // Projections
  projections?: {
    steamer?: any;
    zips?: any;
  };
  raw?: any;
}

// Search for player by name via FanGraphs API
async function searchPlayer(playerName: string): Promise<FangraphsPlayer | null> {
  try {
    const searchUrl = `https://www.fangraphs.com/api/players/search?searchstring=${encodeURIComponent(playerName)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("FanGraphs search failed:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data && Array.isArray(data) && data.length > 0) {
      // Find best match - prioritize active players
      const player = data.find((p: any) => p.isActive) || data[0];
      return {
        playerId: player.playerid,
        playerName: player.name,
        team: player.team,
        position: player.position,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error searching FanGraphs player:", error);
    return null;
  }
}

// Get player stats from FanGraphs
async function getPlayerStats(playerId: number, season?: number): Promise<FangraphsStats | null> {
  try {
    const currentYear = season || new Date().getFullYear();
    
    // FanGraphs player page data endpoint
    const statsUrl = `https://www.fangraphs.com/api/players/stats?playerid=${playerId}&position=all`;
    
    const response = await fetch(statsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("FanGraphs stats fetch failed:", response.status);
      return null;
    }

    const data = await response.json();
    
    // Find current season hitting data
    const hittingData = data?.data?.find((d: any) => 
      d.Season === currentYear && d.aseason === currentYear
    ) || data?.data?.[0];

    if (!hittingData) {
      console.log("No hitting data found for player:", playerId);
      return {
        playerId,
        playerName: "Unknown",
        raw: data,
      };
    }

    return {
      playerId,
      playerName: hittingData.Name || hittingData.PlayerName || "Unknown",
      team: hittingData.Team || hittingData.TeamName,
      // Plate discipline (percentages in decimals, convert to %)
      o_swing_pct: parseFloat(hittingData["O-Swing%"]) || undefined,
      z_swing_pct: parseFloat(hittingData["Z-Swing%"]) || undefined,
      swing_pct: parseFloat(hittingData["Swing%"]) || undefined,
      o_contact_pct: parseFloat(hittingData["O-Contact%"]) || undefined,
      z_contact_pct: parseFloat(hittingData["Z-Contact%"]) || undefined,
      contact_pct: parseFloat(hittingData["Contact%"]) || undefined,
      zone_pct: parseFloat(hittingData["Zone%"]) || undefined,
      swstr_pct: parseFloat(hittingData["SwStr%"]) || undefined,
      // Advanced
      woba: parseFloat(hittingData.wOBA) || undefined,
      wrc_plus: parseFloat(hittingData["wRC+"]) || undefined,
      iso: parseFloat(hittingData.ISO) || undefined,
      babip: parseFloat(hittingData.BABIP) || undefined,
      k_pct: parseFloat(hittingData["K%"]) || undefined,
      bb_pct: parseFloat(hittingData["BB%"]) || undefined,
      hr_fb: parseFloat(hittingData["HR/FB"]) || undefined,
      // Batted ball
      gb_pct: parseFloat(hittingData["GB%"]) || undefined,
      fb_pct: parseFloat(hittingData["FB%"]) || undefined,
      ld_pct: parseFloat(hittingData["LD%"]) || undefined,
      pull_pct: parseFloat(hittingData["Pull%"]) || undefined,
      cent_pct: parseFloat(hittingData["Cent%"]) || undefined,
      oppo_pct: parseFloat(hittingData["Oppo%"]) || undefined,
      soft_pct: parseFloat(hittingData["Soft%"]) || undefined,
      med_pct: parseFloat(hittingData["Med%"]) || undefined,
      hard_pct: parseFloat(hittingData["Hard%"]) || undefined,
      // Value
      war: parseFloat(hittingData.WAR) || undefined,
      off: parseFloat(hittingData.Off) || undefined,
      raw: hittingData,
    };
  } catch (error) {
    console.error("Error fetching FanGraphs stats:", error);
    return null;
  }
}

// Get projections for a player
async function getProjections(playerId: number): Promise<any> {
  try {
    // FanGraphs projections endpoint
    const projectionsUrl = `https://www.fangraphs.com/api/projections?playerid=${playerId}&position=all`;
    
    const response = await fetch(projectionsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching projections:", error);
    return null;
  }
}

// Get plate discipline leaderboard
async function getPlateDisciplineLeaderboard(season?: number, minPA: number = 100): Promise<any[]> {
  try {
    const currentYear = season || new Date().getFullYear();
    
    const url = `https://www.fangraphs.com/api/leaders/major-league/data?age=&pos=all&stats=bat&lg=all&qual=${minPA}&season=${currentYear}&season1=${currentYear}&ind=0&team=0&rost=0&players=&startdate=&enddate=&sort=7,d&type=5`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data?.data || [];
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, playerName, playerId, season, minPA } = await req.json();

    let result: any = null;

    switch (action) {
      case "search":
        if (!playerName) {
          throw new Error("playerName is required for search");
        }
        result = await searchPlayer(playerName);
        break;

      case "stats":
        if (!playerId && !playerName) {
          throw new Error("playerId or playerName is required for stats");
        }
        
        let pid = playerId;
        if (!pid && playerName) {
          const player = await searchPlayer(playerName);
          if (!player) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Player "${playerName}" not found in FanGraphs`,
                source: "fangraphs"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          pid = player.playerId;
          result = { player, stats: await getPlayerStats(pid, season) };
        } else {
          result = await getPlayerStats(pid, season);
        }
        break;

      case "projections":
        if (!playerId && !playerName) {
          throw new Error("playerId or playerName is required for projections");
        }
        
        let projPid = playerId;
        if (!projPid && playerName) {
          const player = await searchPlayer(playerName);
          if (!player) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Player "${playerName}" not found in FanGraphs`,
                source: "fangraphs"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          projPid = player.playerId;
        }
        result = await getProjections(projPid);
        break;

      case "leaderboard":
        result = await getPlateDisciplineLeaderboard(season, minPA || 100);
        break;

      case "full_lookup":
        // Combined search + stats + projections
        if (!playerName) {
          throw new Error("playerName is required for full_lookup");
        }
        
        const player = await searchPlayer(playerName);
        if (!player) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Player "${playerName}" not found in FanGraphs`,
              source: "fangraphs"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const [stats, projections] = await Promise.all([
          getPlayerStats(player.playerId, season),
          getProjections(player.playerId),
        ]);

        result = {
          player,
          stats,
          projections,
          source: "fangraphs",
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result, source: "fangraphs" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("FanGraphs lookup error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        source: "fangraphs"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
