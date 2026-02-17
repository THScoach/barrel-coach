import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiKey = Deno.env.get("OPENAI_API_KEY"); // fallback; we'll use Gemini via Google
  const googleKey = Deno.env.get("GOOGLE_API_KEY") || Deno.env.get("OPENAI_API_KEY");

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { session_id, video_url, player_id } = await req.json();

    if (!session_id || !video_url) {
      return new Response(
        JSON.stringify({ error: "session_id and video_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("swing_sessions")
      .update({ analysis_status: "processing", player_id: player_id || null })
      .eq("id", session_id);

    // Build the Gemini prompt
    const analysisPrompt = `You are an elite baseball swing analyst. Analyze this swing video and return a JSON object with these exact fields:

{
  "body_score": <integer 0-80, overall body mechanics>,
  "brain_score": <integer 0-55, timing/decision making — capped at 55 for 2D>,
  "bat_score": <integer 0-80, bat path/speed efficiency>,
  "ball_score": <integer 0-50, estimated contact quality — capped at 50 for 2D>,
  "composite_score": <integer 0-80, weighted overall>,
  "motor_profile_hint": <"spinner" | "whipper" | "slingshotter" | "unknown">,
  "energy_pattern": <"spike" | "plateau" | "double_bump" | "unknown">,
  "contact_window_type": <"centered" | "split" | "narrow" | "late" | "unknown">,
  "coaching_priority": <string, single most important thing to fix>,
  "confidence": <integer 0-100, how confident you are in this analysis>,
  "leaks": [
    {
      "leak_name": <"cast" | "drift" | "no_hip_lead" | "early_extension" | "barrel_dump" | "no_front_leg_brace" | "one_piece_firing">,
      "severity": <"mild" | "moderate" | "severe">,
      "description": <string, 1-2 sentence explanation>,
      "frame_reference": <string, where in the swing you see it>
    }
  ],
  "speed_gains": {
    "pt_ratio": <number, pelvis-to-torso transfer ratio estimate>,
    "ta_ratio": <number, torso-to-arms transfer ratio estimate>,
    "ah_ratio": <number, arms-to-hands transfer ratio estimate>
  }
}

Score guidelines:
- body_score: hip/shoulder separation, weight transfer, posture, lower half drive
- brain_score: load timing, rhythm, tempo (capped at 55 for video-only analysis)
- bat_score: bat path, barrel accuracy, attack angle, hand path
- ball_score: estimated contact quality (capped at 50 since we can't see ball flight)
- composite_score: weighted average (body 30%, brain 20%, bat 30%, ball 20%)

Be honest and precise. If you can't see something clearly, say so in the description and lower your confidence score.
Return ONLY valid JSON, no markdown, no explanation.`;

    // Call Gemini API with video URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                file_data: {
                  mime_type: "video/mp4",
                  file_uri: video_url,
                },
              },
              { text: analysisPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("[analyze-swing-2d] Gemini error:", errText);

      await supabase
        .from("swing_sessions")
        .update({
          analysis_status: "failed",
          raw_gemini_response: { error: errText },
        })
        .eq("id", session_id);

      return new Response(
        JSON.stringify({ error: "Analysis failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let analysis: any;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      console.error("[analyze-swing-2d] Failed to parse Gemini JSON:", rawText);
      await supabase
        .from("swing_sessions")
        .update({
          analysis_status: "failed",
          raw_gemini_response: geminiData,
        })
        .eq("id", session_id);

      return new Response(
        JSON.stringify({ error: "Failed to parse analysis response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Write results to swing_sessions
    const { error: updateError } = await supabase
      .from("swing_sessions")
      .update({
        analysis_status: "complete",
        body_score: analysis.body_score ?? null,
        brain_score: analysis.brain_score ?? null,
        bat_score: analysis.bat_score ?? null,
        ball_score: analysis.ball_score ?? null,
        composite_score: analysis.composite_score ?? null,
        motor_profile_hint: analysis.motor_profile_hint ?? "unknown",
        energy_pattern: analysis.energy_pattern ?? "unknown",
        contact_window_type: analysis.contact_window_type ?? "unknown",
        coaching_priority: analysis.coaching_priority ?? null,
        gemini_confidence: analysis.confidence ?? null,
        leaks_detected: analysis.leaks ?? [],
        speed_gains: analysis.speed_gains ?? null,
        raw_gemini_response: geminiData,
      })
      .eq("id", session_id);

    if (updateError) {
      console.error("[analyze-swing-2d] DB update error:", updateError);
    }

    // Insert individual leaks
    if (analysis.leaks && Array.isArray(analysis.leaks) && analysis.leaks.length > 0) {
      const leakRows = analysis.leaks.map((leak: any) => ({
        session_id,
        leak_name: leak.leak_name,
        severity: leak.severity || "moderate",
        description: leak.description || null,
        frame_reference: leak.frame_reference || null,
      }));

      const { error: leakError } = await supabase
        .from("swing_leaks")
        .insert(leakRows);

      if (leakError) {
        console.error("[analyze-swing-2d] Leak insert error:", leakError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id,
        composite_score: analysis.composite_score,
        leaks_count: analysis.leaks?.length ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[analyze-swing-2d] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
