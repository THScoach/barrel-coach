import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SavantPlayer {
  id: number;
  name: string;
  team?: string;
  position?: string;
}

interface StatcastData {
  playerId: number;
  playerName: string;
  team?: string;
  position?: string;
  // Hitting stats
  avg_exit_velocity?: number;
  max_exit_velocity?: number;
  avg_launch_angle?: number;
  barrel_pct?: number;
  hard_hit_pct?: number;
  sweet_spot_pct?: number;
  xba?: number;
  xslg?: number;
  xwoba?: number;
  xwobacon?: number;
  // Plate discipline
  chase_rate?: number;
  whiff_rate?: number;
  k_pct?: number;
  bb_pct?: number;
  // Speed
  sprint_speed?: number;
  // Raw data for further analysis
  raw?: any;
}

// Search for player by name
async function searchPlayer(playerName: string): Promise<SavantPlayer | null> {
  try {
    const searchUrl = `https://baseballsavant.mlb.com/player/search-all?search=${encodeURIComponent(playerName)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Savant search failed:", response.status);
      return null;
    }

    const data = await response.json();
    
    if (data && Array.isArray(data) && data.length > 0) {
      const player = data[0];
      return {
        id: player.id,
        name: player.name || player.name_display_first_last,
        team: player.team || player.team_abbrev,
        position: player.position,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error searching player:", error);
    return null;
  }
}

// Get Statcast hitting data for a player
async function getStatcastData(playerId: number, season?: number): Promise<StatcastData | null> {
  try {
    const currentYear = season || new Date().getFullYear();
    
    // Statcast expected stats endpoint
    const statsUrl = `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=${currentYear}&position=&team=&min=1&csv=false`;
    
    const response = await fetch(statsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Statcast stats fetch failed:", response.status);
      return null;
    }

    const data = await response.json();
    
    // Find player in the leaderboard
    const playerStats = data?.find((p: any) => p.player_id === playerId);
    
    if (!playerStats) {
      // Try alternative endpoint for specific player
      return await getPlayerSpecificStats(playerId, currentYear);
    }

    return {
      playerId,
      playerName: playerStats.player_name || playerStats.name,
      team: playerStats.team || playerStats.team_name,
      avg_exit_velocity: parseFloat(playerStats.avg_exit_velocity) || undefined,
      max_exit_velocity: parseFloat(playerStats.max_exit_velocity) || undefined,
      barrel_pct: parseFloat(playerStats.barrel_pct) || undefined,
      hard_hit_pct: parseFloat(playerStats.hard_hit_pct) || undefined,
      xba: parseFloat(playerStats.xba) || undefined,
      xslg: parseFloat(playerStats.xslg) || undefined,
      xwoba: parseFloat(playerStats.xwoba) || undefined,
      k_pct: parseFloat(playerStats.k_percent) || undefined,
      bb_pct: parseFloat(playerStats.bb_percent) || undefined,
      raw: playerStats,
    };
  } catch (error) {
    console.error("Error fetching Statcast data:", error);
    return null;
  }
}

// Get player-specific stats from Savant player page API
async function getPlayerSpecificStats(playerId: number, season: number): Promise<StatcastData | null> {
  try {
    // Player stats endpoint
    const statsUrl = `https://baseballsavant.mlb.com/statcast_search/csv?player_type=batter&hfSit=&hfZ=&hfGT=R%7C&hfPR=&hfAB=&stadium=&hfBBT=&hfBBL=&game_date_gt=&game_date_lt=&hfC=&hfSea=${season}%7C&hfInfield=&hfOutfield=&pitcher_throws=&hfOuts=&hfOpponent=&metric_1=&hfRO=&hfFlag=&hfPull=&min_pitches=0&min_results=0&group_by=name&sort_col=pitches&player_event_sort=api_p_release_speed&sort_order=desc&min_pas=1&chk_stats_xwoba=on&chk_stats_xba=on&chk_stats_xslg=on&chk_stats_exit_velocity=on&chk_stats_launch_angle=on&chk_stats_barrel_pct=on&chk_stats_hard_hit_pct=on&batters_lookup%5B%5D=${playerId}&type=details`;

    const response = await fetch(statsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error("Player stats fetch failed:", response.status);
      return null;
    }

    // This returns CSV, need to parse
    const csvText = await response.text();
    const lines = csvText.trim().split("\n");
    
    if (lines.length < 2) {
      return null;
    }

    // Parse CSV headers and first data row
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
    const values = lines[1].split(",").map(v => v.trim().replace(/"/g, ""));

    const getValue = (key: string) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? values[idx] : undefined;
    };

    return {
      playerId,
      playerName: getValue("player_name") || "Unknown",
      team: getValue("player_team") || undefined,
      avg_exit_velocity: parseFloat(getValue("launch_speed") || "") || undefined,
      avg_launch_angle: parseFloat(getValue("launch_angle") || "") || undefined,
      xba: parseFloat(getValue("xba") || "") || undefined,
      xslg: parseFloat(getValue("xslg") || "") || undefined,
      xwoba: parseFloat(getValue("xwoba") || "") || undefined,
    };
  } catch (error) {
    console.error("Error fetching player-specific stats:", error);
    return null;
  }
}

// Get leaderboard data for a specific stat
async function getLeaderboard(stat: string, season?: number, minPA: number = 50): Promise<any[]> {
  try {
    const currentYear = season || new Date().getFullYear();
    
    let endpoint = "";
    switch (stat.toLowerCase()) {
      case "exit_velocity":
      case "ev":
        endpoint = `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${currentYear}&position=&team=&min=${minPA}&csv=false`;
        break;
      case "sprint_speed":
      case "speed":
        endpoint = `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${currentYear}&position=&team=&min=${minPA}`;
        break;
      case "xstats":
      case "expected":
      default:
        endpoint = `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=${currentYear}&position=&team=&min=${minPA}&csv=false`;
    }

    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    return await response.json();
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
    const { action, playerName, playerId, stat, season, minPA } = await req.json();

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
                error: `Player "${playerName}" not found in Baseball Savant`,
                source: "baseball_savant"
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          pid = player.id;
          result = { player, stats: await getStatcastData(pid, season) };
        } else {
          result = await getStatcastData(pid, season);
        }
        break;

      case "leaderboard":
        result = await getLeaderboard(stat || "xstats", season, minPA || 50);
        break;

      case "full_lookup":
        // Combined search + stats in one call
        if (!playerName) {
          throw new Error("playerName is required for full_lookup");
        }
        
        const player = await searchPlayer(playerName);
        if (!player) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Player "${playerName}" not found in Baseball Savant`,
              source: "baseball_savant"
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const stats = await getStatcastData(player.id, season);
        result = {
          player,
          stats,
          source: "baseball_savant",
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result, source: "baseball_savant" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Baseball Savant lookup error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        source: "baseball_savant"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
