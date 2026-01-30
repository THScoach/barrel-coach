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

    // ========== PLAYER DATA COMMANDS ==========
    const pullDataMatch = commandLower.match(/(?:pull|get|show|fetch|look up|find)\s+(?:(.+?)(?:'s|s')?\s+)?(?:data|scores|profile|info|stats)/i) 
      || commandLower.match(/(?:pull|get|show)\s+(.+)/i);
    
    if (pullDataMatch || commandLower.includes("data") || commandLower.includes("scores")) {
      // Extract player name from command
      let playerName = pullDataMatch?.[1]?.trim();
      
      if (!playerName) {
        // Try to extract any name-like pattern
        const nameMatch = command.match(/(?:for|about|on)\s+(\w+)/i);
        playerName = nameMatch?.[1];
      }

      if (playerName) {
        console.log("Looking up player:", playerName);
        
        // Search for player by name (fuzzy match), prioritize those with scores
        const { data: players, error: playerError } = await supabase
          .from("players")
          .select(`
            id, name, email, phone, motor_profile_sensor, level, team,
            swing_4b_scores(id)
          `)
          .ilike("name", `%${playerName}%`)
          .limit(10);

        if (playerError) {
          console.error("Player lookup error:", playerError);
          response = `Error looking up player: ${playerError.message}`;
        } else if (!players || players.length === 0) {
          response = `Couldn't find a player matching "${playerName}". Try the full name or check spelling.`;
        } else {
          // Prioritize player with scores over one without
          const sortedPlayers = players.sort((a: any, b: any) => {
            const aHasScores = Array.isArray(a.swing_4b_scores) && a.swing_4b_scores.length > 0;
            const bHasScores = Array.isArray(b.swing_4b_scores) && b.swing_4b_scores.length > 0;
            if (aHasScores && !bHasScores) return -1;
            if (!aHasScores && bHasScores) return 1;
            return 0;
          });
          
          const player = sortedPlayers[0];
          console.log("Found player:", player.name, "has scores:", Array.isArray(player.swing_4b_scores) && player.swing_4b_scores.length > 0);

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
            response = `**${player.name}** - ${player.motor_profile_sensor || "No profile yet"}\n\n`;
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
            response = `Found **${player.name}** but no 4B scores yet. They may need a session.`;
          }
        }
      } else {
        response = "Who would you like me to look up? Say something like \"Pull Marcus's data\" or \"Get Connor's scores\".";
      }
    }
    // ========== ATTENTION/FLAGS COMMANDS ==========
    else if (commandLower.includes("attention") || commandLower.includes("flag") || commandLower.includes("who needs")) {
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
    // ========== STATS/BUSINESS COMMANDS ==========
    else if (commandLower.includes("how are we") || commandLower.includes("stats") || commandLower.includes("dashboard")) {
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
        response = "I can help with:\n• \"Pull [name]'s data\" - View player scores\n• \"Who needs attention?\" - Flag declining players\n• \"How are we doing?\" - Business dashboard\n\nWhat would you like to do?";
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
                content: `You are RickBot, Coach Rick Strickland's personal AI operator for Catching Barrels baseball hitting training.

You help Coach Rick:
- Pull player data and 4B scores
- Generate reports
- Manage content and newsletters
- Track business metrics

Keep responses brief and actionable. Use markdown formatting.

If you can't do something, suggest what commands are available:
- "Pull [name]'s data" - View player 4B scores
- "Who needs attention?" - Flag players with declining scores
- "How are we doing?" - Business dashboard overview

Be direct, professional, and helpful.`,
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
          response = "I can help with:\n• \"Pull [name]'s data\" - View player scores\n• \"Who needs attention?\" - Flag declining players\n• \"How are we doing?\" - Business dashboard\n\nWhat would you like to do?";
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
