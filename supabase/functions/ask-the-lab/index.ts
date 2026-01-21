import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueryContext {
  rebootSessions?: any[] | null;
  videoSessions?: any[] | null;
  players?: any[] | null;
  kineticFingerprints?: any[] | null;
  validationResults?: any[] | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { query, action, playerId, dateRange } = await req.json();

    console.log("[AskTheLab] Query:", query, "Action:", action);

    let context: QueryContext = {};
    let responseText = "";

    // Handle specific actions
    if (action === "batch_validation") {
      // Compare all 2D Video sessions against Reboot IK sessions
      const { data: videoSessions } = await supabase
        .from("video_swing_sessions")
        .select(`
          id,
          player_id,
          session_date,
          brain_score,
          body_score,
          bat_score,
          ball_score,
          composite_score,
          correlated_reboot_id,
          reboot_composite_delta,
          accuracy_tier,
          validation_status
        `)
        .not("composite_score", "is", null)
        .order("session_date", { ascending: false })
        .limit(100);

      const { data: rebootSessions } = await supabase
        .from("reboot_uploads")
        .select(`
          id,
          player_id,
          session_date,
          brain_score,
          body_score,
          bat_score,
          composite_score,
          correlated_video_session_id,
          video_composite_delta,
          validation_status
        `)
        .not("composite_score", "is", null)
        .order("session_date", { ascending: false })
        .limit(100);

      // Match sessions by player and date
      const validationResults: any[] = [];
      
      for (const video of videoSessions || []) {
        const matchingReboot = (rebootSessions || []).find(
          r => r.player_id === video.player_id && 
               r.session_date === video.session_date
        );
        
        if (matchingReboot) {
          const delta = Math.abs((video.composite_score || 0) - (matchingReboot.composite_score || 0));
          const accuracyTier = delta < 5 ? "High" : delta < 10 ? "Medium" : "Low";
          
          validationResults.push({
            playerId: video.player_id,
            date: video.session_date,
            videoComposite: video.composite_score,
            rebootComposite: matchingReboot.composite_score,
            delta: delta.toFixed(1),
            accuracy: accuracyTier,
            videoBrain: video.brain_score,
            videoBody: video.body_score,
            videoBat: video.bat_score,
            rebootBrain: matchingReboot.brain_score,
            rebootBody: matchingReboot.body_score,
            rebootBat: matchingReboot.bat_score,
          });
        }
      }

      // Calculate summary stats
      const highAccuracy = validationResults.filter(r => r.accuracy === "High").length;
      const mediumAccuracy = validationResults.filter(r => r.accuracy === "Medium").length;
      const lowAccuracy = validationResults.filter(r => r.accuracy === "Low").length;
      const avgDelta = validationResults.length > 0 
        ? (validationResults.reduce((sum, r) => sum + parseFloat(r.delta), 0) / validationResults.length).toFixed(1)
        : 0;

      responseText = `## Batch Validation Report

**Summary:**
- Total matched sessions: ${validationResults.length}
- High Accuracy (Δ < 5): ${highAccuracy} (${validationResults.length > 0 ? ((highAccuracy / validationResults.length) * 100).toFixed(0) : 0}%)
- Medium Accuracy (Δ 5-10): ${mediumAccuracy}
- Low Accuracy (Δ > 10): ${lowAccuracy}
- Average Delta: ${avgDelta} points

${validationResults.length > 0 ? `**Top 5 Most Accurate Sessions:**
${validationResults
  .sort((a, b) => parseFloat(a.delta) - parseFloat(b.delta))
  .slice(0, 5)
  .map(r => `- ${r.date}: Video ${r.videoComposite} vs Reboot ${r.rebootComposite} (Δ${r.delta})`)
  .join('\n')}` : "No matching sessions found for validation."}

${validationResults.filter(r => r.accuracy === "Low").length > 0 ? `
**Sessions Needing Review (High Delta):**
${validationResults
  .filter(r => r.accuracy === "Low")
  .slice(0, 5)
  .map(r => `- ${r.date}: Video ${r.videoComposite} vs Reboot ${r.rebootComposite} (Δ${r.delta})`)
  .join('\n')}` : ""}`;

      context.validationResults = validationResults;

    } else {
      // Natural language query - fetch relevant data first
      const { data: players } = await supabase
        .from("players")
        .select(`
          id,
          name,
          level,
          team,
          age,
          handedness,
          motor_profile_sensor,
          latest_brain_score,
          latest_body_score,
          latest_bat_score,
          latest_ball_score,
          latest_composite_score,
          total_xp,
          current_streak
        `)
        .limit(500);

      const { data: rebootSessions } = await supabase
        .from("reboot_uploads")
        .select(`
          id,
          player_id,
          session_date,
          brain_score,
          body_score,
          bat_score,
          composite_score,
          leak_detected,
          weakest_link,
          motor_profile,
          swing_count
        `)
        .order("session_date", { ascending: false })
        .limit(200);

      const { data: kineticFingerprints } = await supabase
        .from("kinetic_fingerprints")
        .select(`
          player_id,
          motor_profile,
          swing_count,
          intent_map,
          timing_signature,
          pattern_metrics
        `)
        .limit(300);

      context = { players, rebootSessions, kineticFingerprints };

      // Use AI to analyze the data
      const aiUrl = Deno.env.get("AI_GATEWAY_URL") || "https://ai.lovable.dev/v1/chat/completions";
      const aiKey = Deno.env.get("AI_GATEWAY_KEY");

      const systemPrompt = `You are "The Lab" - an elite AI research assistant for a baseball training analytics platform. You have access to comprehensive player data, Reboot IK motion capture sessions, and kinetic fingerprints.

Your role is to:
1. Analyze player performance data and find patterns
2. Compare 2D video scores with 3D Reboot IK data
3. Identify trends across the athlete population
4. Provide actionable insights for coaches

Current data context:
- ${players?.length || 0} players in the system
- ${rebootSessions?.length || 0} recent Reboot IK sessions
- ${kineticFingerprints?.length || 0} kinetic fingerprints

Player Levels: Youth, HS, College, Indy, A, A+, AA, AAA, MLB

When analyzing:
- Use specific numbers and percentages
- Reference the 4B scoring system (Brain, Body, Bat, Ball)
- Identify patterns and outliers
- Be concise but thorough

Data available:
Players: ${JSON.stringify(players?.slice(0, 20) || [], null, 2).substring(0, 3000)}...
Recent Sessions: ${JSON.stringify(rebootSessions?.slice(0, 10) || [], null, 2).substring(0, 2000)}...`;

      const aiResponse = await fetch(aiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(aiKey ? { "Authorization": `Bearer ${aiKey}` } : {}),
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("[AskTheLab] AI Error:", errorText);
        throw new Error(`AI request failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      responseText = aiData.choices?.[0]?.message?.content || "I couldn't analyze that query. Please try rephrasing.";
    }

    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        context: {
          playerCount: context.players?.length || 0,
          sessionCount: context.rebootSessions?.length || 0,
          validationCount: context.validationResults?.length || 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    const error = err as Error;
    console.error("[AskTheLab] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        response: `Error processing your query: ${error.message}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
