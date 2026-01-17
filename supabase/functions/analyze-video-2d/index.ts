import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_2D_PROMPT = `You are Coach Rick's 2D Video Analysis Engine.

## YOUR TASK
Analyze a baseball swing video and provide 4B scores based on what you can SEE in the 2D footage.

## WHAT YOU CAN ASSESS FROM 2D VIDEO

### VISIBLE & SCOREABLE:
1. **Sequence** - Do hips fire before hands? Can clearly see rotation order.
2. **Hip Lead** - Does pelvis open before shoulders? Visible in any angle.
3. **Front Leg Action** - Bracing (straight) vs Collapsing (bent) at contact. Very visible.
4. **Hand Path** - Casting (hands drift out) vs Connected (hands stay in). Clear in side view.
5. **Head Stability** - Does head move during swing? Easy to track.
6. **Spine Angle** - Posture at setup vs contact. Visible in side view.
7. **Finish Position** - Balanced vs falling off. Clear indicator of control.
8. **Bat Path** - Attack angle, barrel position through zone. Visible in most angles.
9. **Stride Length** - Relative to body, directional. Measurable visually.
10. **Load Position** - Hands back, hip hinge, weight distribution.

### NOT VISIBLE - MUST ESTIMATE OR CAP:
1. **Exact velocities** - Can't measure deg/s from video → estimate from visual speed
2. **Timing gaps (ms)** - Can see sequence, can't measure precise timing → estimate
3. **Momentum/Energy** - No sensor data → infer from movement quality
4. **X-Factor (precise)** - Can estimate hip-shoulder separation visually
5. **Exit velocity** - No ball flight data → cannot score

## SCORING RULES FOR 2D

### BODY Score (Full Range 20-80)
You CAN see:
- Hip rotation quality and timing
- Ground force indicators (leg drive visible)
- Core rotation sequence
- Connection between lower and upper half

Score normally based on what you observe.

### BRAIN Score (CAPPED at 55)
You CAN see:
- General sequence (hips before hands)
- Obvious timing issues

You CANNOT measure:
- Precise timing gaps
- Consistency across multiple swings (unless multiple swings in video)
- CV of velocities

Cap at 55. Note: "Limited by 2D - full analysis needed for precise timing"

### BAT Score (Full Range 20-80)
You CAN see:
- Hand path and barrel control
- Attack angle
- Bat lag / casting
- Extension through contact

Score normally based on what you observe.

### BALL Score (CAPPED at 50)
You CANNOT see:
- Exit velocity
- Launch angle
- Ball flight

Default to 50 with note: "No ball flight data - estimated from mechanics"
If swing looks powerful with good extension, can go to 50.
If swing looks weak or cut off, score 40-45.

### COMPOSITE
Calculate normally: (Body × 0.30) + (Brain × 0.20) + (Bat × 0.30) + (Ball × 0.20)

The caps on Brain and Ball will naturally limit composite ceiling to ~60-65 range for even great swings.

## ANALYSIS APPROACH

1. **Identify the camera angle:**
   - Side view (open or closed) - Best for most metrics
   - Behind view - Good for path and direction
   - Front view - Limited utility
   
2. **Find key frames:**
   - Setup/Stance
   - Load complete (max hip hinge)
   - Stride foot down
   - Launch (hips start firing)
   - Contact
   - Extension/Finish

3. **Assess each visible metric**

4. **Identify the PRIMARY issue visible** (becomes leak_detected)

5. **Classify motor profile from movement PATTERN:**
   - SPINNER: Quick, rotational, tight movements
   - WHIPPER: Smooth sequence, visible separation
   - SLINGSHOTTER: Big load, ground-driven
   - TITAN: Powerful but variable timing

## LEAK DETECTION FROM VIDEO

What you CAN identify:
- EARLY_ARMS: Hands move forward before hips open (very visible)
- CAST: Hands extend away from body during load (very visible)
- COLLAPSE: Front knee bends at contact (very visible)
- LUNGE: Head/body drifts forward before rotation (visible)
- POOR_SEPARATION: Shoulders and hips turn together (visible)
- SPIN_OUT: Back foot spins, hips over-rotate (visible)

If none clearly visible: "CLEAN_TRANSFER" (but note 2D limitation)

## OUTPUT FORMAT

Return valid JSON only, no markdown:

{
  "composite": 52,
  "body": 58,
  "brain": 48,
  "bat": 55,
  "ball": 45,
  "grade": "Average",
  
  "body_components": {
    "hip_rotation": 60,
    "sequence_quality": 55,
    "ground_connection": 58,
    "notes": "Good hip lead visible, slight early drift"
  },
  "brain_components": {
    "timing_estimate": 48,
    "notes": "CAPPED - Sequence looks slightly rushed but can't measure precisely"
  },
  "bat_components": {
    "hand_path": 58,
    "barrel_control": 52,
    "attack_angle": 55,
    "notes": "Slight cast at launch, recovers to decent path"
  },
  "ball_components": {
    "power_estimate": 45,
    "notes": "CAPPED - No ball data. Swing looks medium power."
  },
  
  "visible_metrics": {
    "hip_shoulder_separation_estimate": "35-40 degrees",
    "front_leg_action": "slight collapse",
    "head_movement": "minimal - good",
    "finish_balance": "balanced",
    "stride_direction": "slightly closed"
  },
  
  "leak_detected": "CAST",
  "leak_evidence": "At launch position, hands drift 4-5 inches away from back shoulder before hips fire. Loses leverage.",
  
  "motor_profile": "WHIPPER",
  "profile_evidence": "Shows natural separation between hip and shoulder turn, smooth tempo",
  
  "coach_rick_take": "I can see good things here - your hips are leading, which is the foundation. But watch your hands at load: they're drifting away from your body before you fire. That's a Cast pattern - you're losing leverage before you even start. Quick fix: feel your hands stay connected to your back shoulder until the hips PULL them through. Don't push the hands out - let them get dragged.",
  
  "priority_drill": "Connection Drill - Put a glove under your lead armpit. Take swings without dropping it until contact. This keeps the hands connected.",
  
  "limitations": [
    "Brain score capped at 55 - precise timing requires 3D data",
    "Ball score estimated - no exit velocity data",
    "Single camera angle - some metrics estimated"
  ],
  
  "camera_angle": "side_open",
  "video_quality": "good",
  "frames_analyzed": 45,
  "confidence": 0.72,
  
  "upgrade_cta": "Want exact measurements? Your full biomechanics analysis will show precise timing, velocities, and what's leaving MPH on the table."
}

## AGE-ADJUSTED BENCHMARKS

Always consider player age when scoring:

| Age | Good BODY | Good BAT | Notes |
|-----|-----------|----------|-------|
| 12-13 | 45-55 | 45-55 | Still developing patterns |
| 14-15 | 50-60 | 50-60 | Patterns forming |
| 16-17 | 55-65 | 55-65 | Should show intent |
| 18+ | 60-70 | 60-70 | Expect refinement |

## CRITICAL RULES

1. Never guess wildly - If you can't see it, say so and cap the score
2. Be specific about what you SEE - "I can see hands drift 4 inches" not "hands look bad"
3. Camera angle matters - Note limitations based on angle
4. Video quality matters - Dark/blurry = lower confidence
5. Always identify ONE clear leak - The most obvious visible issue
6. Always give ONE drill - Matched to the visible leak
7. Confidence score reflects video quality + angle
8. Frame the upgrade naturally - Not salesy, just factual
9. Return ONLY valid JSON - no markdown, no code blocks`;

interface Video2DRequest {
  player_id: string;
  video_url: string;
  is_paid_user: boolean;
  player_age?: number;
  player_level?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { player_id, video_url, is_paid_user, player_age, player_level } = await req.json() as Video2DRequest;

    if (!player_id || !video_url) {
      return new Response(
        JSON.stringify({ error: "player_id and video_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Analyzing 2D video for player ${player_id}`);

    // Build context for the prompt
    const contextInfo = [];
    if (player_age) contextInfo.push(`Player age: ${player_age}`);
    if (player_level) contextInfo.push(`Player level: ${player_level}`);
    const contextString = contextInfo.length > 0 ? `\n\nPlayer Context:\n${contextInfo.join('\n')}` : '';

    // Call Gemini Vision for video analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: GEMINI_2D_PROMPT },
          { 
            role: "user", 
            content: [
              { 
                type: "text", 
                text: `Analyze this baseball swing video and provide a comprehensive 2D analysis with scores.${contextString}` 
              },
              { 
                type: "image_url", 
                image_url: { url: video_url } 
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let analysis;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      analysis = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse analysis response");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create reboot_uploads record with 2D analysis
    const sessionDate = new Date().toISOString().split('T')[0];
    
    const { data: uploadRecord, error: insertError } = await supabase
      .from("reboot_uploads")
      .insert({
        player_id,
        session_date: sessionDate,
        analysis_type: "2d_video",
        pending_reboot: is_paid_user, // Only add to queue for paid users
        original_video_url: video_url,
        video_2d_analysis: analysis,
        composite_score: analysis.composite,
        body_score: analysis.body,
        brain_score: analysis.brain,
        bat_score: analysis.bat,
        grade: analysis.grade,
        camera_angle: analysis.camera_angle,
        video_quality: analysis.video_quality,
        leak_detected: analysis.leak_detected,
        leak_evidence: analysis.leak_evidence,
        motor_profile: analysis.motor_profile,
        motor_profile_evidence: analysis.profile_evidence,
        priority_drill: analysis.priority_drill,
        analysis_confidence: analysis.confidence,
        processing_status: "complete",
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting upload record:", insertError);
      throw new Error("Failed to save analysis");
    }

    // Update player's latest scores (with 2D marker)
    await supabase
      .from("players")
      .update({
        latest_body_score: analysis.body,
        latest_brain_score: analysis.brain,
        latest_bat_score: analysis.bat,
        latest_composite_score: analysis.composite,
        updated_at: new Date().toISOString(),
      })
      .eq("id", player_id);

    // Log activity
    await supabase.from("activity_log").insert({
      player_id,
      action: "2d_video_analyzed",
      description: `2D video analysis complete: Composite ${analysis.composite}, Leak: ${analysis.leak_detected}`,
      metadata: {
        upload_id: uploadRecord.id,
        composite_score: analysis.composite,
        leak_detected: analysis.leak_detected,
        is_paid_user,
        pending_reboot: is_paid_user,
      },
    });

    // If paid user, notify admin (could trigger SMS or notification)
    if (is_paid_user) {
      console.log(`Video added to Reboot queue for player ${player_id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        upload_id: uploadRecord.id,
        analysis,
        is_paid_user,
        pending_reboot: is_paid_user,
        message: is_paid_user 
          ? "Analysis complete. Full biomechanics analysis pending - check back in 24 hours."
          : "Analysis complete. Upgrade to get your full biomechanics analysis.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-video-2d error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
