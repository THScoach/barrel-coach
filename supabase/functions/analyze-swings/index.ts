import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mock analysis data - Replace with your real Gemini API integration
const generateMockAnalysis = (swingIndex: number) => {
  const baseScore = 55 + Math.random() * 25; // 55-80 range
  return {
    composite_score: Math.round(baseScore * 100) / 100,
    four_b_brain: Math.round((baseScore + (Math.random() - 0.5) * 15) * 100) / 100,
    four_b_body: Math.round((baseScore + (Math.random() - 0.5) * 15) * 100) / 100,
    four_b_bat: Math.round((baseScore + (Math.random() - 0.5) * 15) * 100) / 100,
    four_b_ball: Math.round((baseScore + (Math.random() - 0.5) * 15) * 100) / 100,
    grade: baseScore >= 70 ? "Excellent" : baseScore >= 60 ? "Above Avg" : "Average",
    analysis_json: {
      swing_index: swingIndex,
      timing: {
        load_start: "0.15s",
        stride_land: "0.45s",
        contact: "0.72s",
      },
      mechanics: {
        hip_rotation: "Good",
        bat_path: "Slightly uppercut",
        weight_transfer: "Needs work",
      },
      recommendations: [
        "Focus on earlier hip rotation",
        "Keep hands inside the ball",
        "Improve weight transfer timing",
      ],
    },
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    console.log("Starting analysis for session:", sessionId);

    // Update session to analyzing
    await supabase
      .from("sessions")
      .update({ status: "analyzing" })
      .eq("id", sessionId);

    // Fetch all swings for this session
    const { data: swings, error: swingsError } = await supabase
      .from("swings")
      .select("*")
      .eq("session_id", sessionId)
      .order("swing_index");

    if (swingsError || !swings) {
      throw new Error("Failed to fetch swings");
    }

    console.log(`Analyzing ${swings.length} swings`);

    // Analyze each swing (mock for now - replace with your Gemini service)
    for (const swing of swings) {
      const analysis = generateMockAnalysis(swing.swing_index);

      await supabase
        .from("swings")
        .update({
          status: "complete",
          composite_score: analysis.composite_score,
          grade: analysis.grade,
          four_b_brain: analysis.four_b_brain,
          four_b_body: analysis.four_b_body,
          four_b_bat: analysis.four_b_bat,
          four_b_ball: analysis.four_b_ball,
          analysis_json: analysis.analysis_json,
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", swing.id);

      console.log(`Analyzed swing ${swing.swing_index}: ${analysis.composite_score}`);
    }

    // Calculate session aggregates using the database function
    const { error: aggregateError } = await supabase.rpc(
      "calculate_session_aggregates",
      { p_session_id: sessionId }
    );

    if (aggregateError) {
      console.error("Failed to calculate aggregates:", aggregateError);
    }

    // Generate mock problem and drill data
    const mockResults = {
      percentile: Math.floor(Math.random() * 30) + 50, // 50-80 range
      analysis_json: {
        problem: {
          category: "bat",
          name: "Late Barrel Release",
          description:
            "You're swinging too late. Your bat reaches full speed AFTER you should hit the ball.",
          consequences: [
            "You're losing 30-50 feet of distance",
            "You'll hit weak grounders instead of line drives",
            "Pitchers will throw inside and jam you",
          ],
        },
        drill: {
          name: "Connection Ball",
          sets: 3,
          reps: 10,
          instructions:
            "Put a tennis ball under your front armpit. Swing without dropping it.",
          why_it_works: "Makes you swing earlier and stay connected through contact.",
        },
        thirty_day_plan: {
          week_1_2: "Connection Ball (3×10, every day)",
          week_3_4: "Timing Tees (2×15, every day)",
          week_5_6: "Film 5 swings and upload",
          schedule: {
            weekday: "10 minutes before practice",
            saturday: "Film 5 swings",
            sunday: "Rest",
          },
        },
      },
    };

    // Update session with final results
    await supabase
      .from("sessions")
      .update({
        status: "complete",
        percentile: mockResults.percentile,
        analysis_json: mockResults.analysis_json,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    console.log("Analysis complete for session:", sessionId);

    return new Response(
      JSON.stringify({ success: true, sessionId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
