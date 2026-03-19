import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "submit_swing_analysis",
    description: "Submit the complete swing analysis results.",
    parameters: {
      type: "object",
      properties: {
        body_score: { type: "integer", description: "Overall body mechanics score 0-80" },
        brain_score: { type: "integer", description: "Timing/decision making score 0-45 (capped for 2D)" },
        bat_score: { type: "integer", description: "Bat path/speed efficiency score 0-80" },
        ball_score: { type: "integer", description: "Estimated contact quality score 0-50 (capped for 2D)" },
        composite_score: { type: "integer", description: "Weighted overall score 0-80" },
        motor_profile_hint: { type: "string", enum: ["spinner", "whipper", "slingshotter", "unknown"] },
        energy_pattern: { type: "string", enum: ["spike", "plateau", "double_bump", "unknown"] },
        contact_window_type: { type: "string", enum: ["centered", "split", "narrow", "late", "unknown"] },
        coaching_priority: { type: "string", description: "Single most important thing to fix" },
        confidence: { type: "integer", description: "How confident you are in this analysis 0-100" },
        leaks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              leak_name: { type: "string", enum: ["cast", "drift", "no_hip_lead", "early_extension", "barrel_dump", "no_front_leg_brace", "one_piece_firing"] },
              severity: { type: "string", enum: ["mild", "moderate", "severe"] },
              description: { type: "string", description: "1-2 sentence explanation" },
              frame_reference: { type: "string", description: "Where in the swing you see it" },
            },
            required: ["leak_name", "severity", "description", "frame_reference"],
            additionalProperties: false,
          },
        },
        speed_gains: {
          type: "object",
          properties: {
            pt_ratio: { type: "number", description: "Pelvis-to-torso transfer ratio estimate" },
            ta_ratio: { type: "number", description: "Torso-to-arms transfer ratio estimate" },
            ah_ratio: { type: "number", description: "Arms-to-hands transfer ratio estimate" },
          },
          required: ["pt_ratio", "ta_ratio", "ah_ratio"],
          additionalProperties: false,
        },
      },
      required: ["body_score", "brain_score", "bat_score", "ball_score", "composite_score", "motor_profile_hint", "energy_pattern", "contact_window_type", "coaching_priority", "confidence", "leaks", "speed_gains"],
      additionalProperties: false,
    },
  },
};

const ENERGY_DELIVERY_FRAMEWORK = `## HOW TO THINK ABOUT A SWING

You are not analyzing a bat path. You are analyzing an ENERGY DELIVERY SYSTEM.

The swing exists to do one thing: deliver maximum energy to the ball, on the same plane the ball is traveling, at the moment the ball arrives. Every metric you evaluate is either contributing to that delivery or leaking away from it.

The bat is the delivery truck. Energy is the package. The pitch plane is the destination.

A 75 mph bat moving off-plane is less productive than a 70 mph bat moving on-plane. Bat speed is not the goal — it is a measure of how much energy the truck is carrying. The question is always: WHERE IS THAT ENERGY GOING?

### THE ENERGY DELIVERY CHAIN

Evaluate every swing through this chain, in order. Each step depends on the one before it. If an upstream step fails, everything downstream is compromised — do not praise downstream metrics when upstream is broken.

STEP 1: ENERGY PRODUCTION — How much energy did the body produce? (TKE, pelvis velocity, mass utilization)
STEP 2: ENERGY SEQUENCING — Did the energy flow in the right order? Pelvis must peak BEFORE torso. "Dead pelvis" (low velocity) vs "Late pelvis" (high velocity, wrong timing) require OPPOSITE fixes.
STEP 3: ENERGY TIMING — Optimal P→T gap is 14-18ms. Too tight (<10ms) = no whip. Too wide (>25ms) = disconnected.
STEP 4: ENERGY CONCENTRATION — Front side must BRAKE. TKE should spike before contact. Brake efficiency 0% = zero energy concentrated.
STEP 5: ENERGY DIRECTION — Trunk tilt sets swing plane. Must match pitch plane. COM drift = energy leaving the system.
STEP 6: ENERGY DELIVERY — BBA near 0° = barrel IS the pitch plane. Attack angle must match pitch trajectory.

### HOW TO DIAGNOSE
When you identify a problem, trace it UPSTREAM. The barrel path is almost always a SYMPTOM, not a cause. Fix the upstream cause, the barrel path corrects itself.

### HOW TO TALK ABOUT IT
Never say "bat path needs work" — say "energy is arriving late."
Never say "need more bat speed" — say "energy exists but arrives after the barrel is through the zone."
Frame everything as: How much energy? In what order? Aimed where? Delivered when? To what destination?
"We don't add, we unlock."`;

const SYSTEM_PROMPT = `You are an elite baseball swing analyst. You will be given a video URL of a baseball swing. Analyze the swing mechanics and use the submit_swing_analysis tool to return your analysis.

${ENERGY_DELIVERY_FRAMEWORK}

Score guidelines:

BODY SCORE (0-80) — hip/shoulder separation, weight transfer, posture, lower half drive.
CALIBRATION NOTE: Video tends to UNDERESTIMATE body mechanics. A swing can LOOK average on video but have elite internal stability. When in doubt on Body, score HIGHER not lower.
  70-80: Clear hip lead, front leg brace, trunk tilt, balanced finish.
  55-69: Some visible hip rotation. Front leg shows some brace. Sequence appears mostly correct even if not explosive-looking. Trunk shows some tilt. Err toward 55-65 for any swing with visible hip lead.
  40-54: Reserve for swings with clearly simultaneous firing AND collapsing front side AND no visible tilt.
  20-39: Only for swings with zero rotation visible.

BRAIN SCORE (0-45) — load timing, rhythm, tempo. CAPPED AT 45 for video-only analysis.
CALIBRATION NOTE: From 2D video you CANNOT distinguish a 1.8% timing gap from a 14% timing gap. Both look like "hips fire first." Be conservative. Only score 40+ when the separation is OBVIOUS — meaning you can count frames between hip turn start and shoulder turn start.
  40-45: Clear sequential firing visible with obvious separation gap between hip and shoulder turn.
  30-39: Sequence appears correct but gap is small or hard to confirm.
  20-29: Simultaneous or inverted sequence.

BAT SCORE (0-80) — bat path, barrel accuracy, attack angle, hand path.
CALIBRATION NOTE: Arm dominance (e.g. 69% arm energy) is INVISIBLE on video. A swing can look connected on camera while the arms carry most of the energy. Default to conservative scoring. Most swings should land 35-50, not 48-60.
  70-80: Truly connected, short path, barrel on plane through the zone.
  55-69: Reserved for swings where hands clearly stay inside and barrel takes a direct route. No visible casting at all.
  40-54: Any swing where the barrel path looks reasonable but you can't confirm connection. This should be the DEFAULT range for most swings. When uncertain, score 40-50.
  20-39: Clear casting, barrel dump, or severely disconnected path.

BALL SCORE (0-50) — estimated contact quality (capped at 50 since we can't see ball flight).

COMPOSITE SCORE (0-80) — weighted average (body 30%, brain 20%, bat 30%, ball 20%).

Be honest and precise. If you can't see something clearly, lower your confidence score.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (!lovableKey) {
    console.error("[analyze-swing-2d] LOVABLE_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "AI service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

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

    // Call Lovable AI Gateway with video URL
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: video_url } },
              { type: "text", text: "Analyze this baseball swing video. Use the submit_swing_analysis tool to return your complete analysis." },
            ],
          },
        ],
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: "function", function: { name: "submit_swing_analysis" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[analyze-swing-2d] AI Gateway error:", aiResponse.status, errText);

      await supabase
        .from("swing_sessions")
        .update({ analysis_status: "failed", raw_gemini_response: { error: errText, status: aiResponse.status } })
        .eq("id", session_id);

      return new Response(
        JSON.stringify({ error: "Analysis failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("[analyze-swing-2d] No tool call in response:", JSON.stringify(aiData));
      await supabase
        .from("swing_sessions")
        .update({ analysis_status: "failed", raw_gemini_response: aiData })
        .eq("id", session_id);

      return new Response(
        JSON.stringify({ error: "Failed to parse analysis response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analysis: any;
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("[analyze-swing-2d] Failed to parse tool arguments:", toolCall.function.arguments);
      await supabase
        .from("swing_sessions")
        .update({ analysis_status: "failed", raw_gemini_response: aiData })
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
        raw_gemini_response: aiData,
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

      const { error: leakError } = await supabase.from("swing_leaks").insert(leakRows);
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
