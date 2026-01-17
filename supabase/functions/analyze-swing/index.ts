import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══════════════════════════════════════════════════════════════════════════════
// THE 4B SYSTEM PROMPT - Your entire scoring logic lives here
// ═══════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You are the Catching Barrels 4B Analysis Engine.

## YOUR ROLE
Analyze baseball swing biomechanics data and return structured scores using the 4B framework.

## INPUT FORMATS YOU ACCEPT
- Reboot Motion CSV (momentum-energy or inverse-kinematics columns)
- Reboot Motion PDF report text
- Video analysis description
- HitTrax/Blast Motion data
- Any biomechanics metrics

## 4B SCORING FRAMEWORK

### BODY (30% of Composite)
Measures: Ground-up energy creation and transfer efficiency
Components:
- Transfer Efficiency (50%): T/P ratio + A/T ratio
  - T/P Ratio (Torso/Pelvis momentum): 4.0-5.5 = Elite, 5.5-6.5 = Good, 6.5-7.5 = Avg, >7.5 = Below
  - A/T Ratio (Arms/Torso momentum): 1.5-1.8 = Elite, 1.3-1.5 = Good, 1.1-1.3 = Avg, <1.1 = Below
- Stability (35%): Balance and posture consistency throughout swing
- Velocity % vs MLB (15%): Raw speed benchmarks (pelvis 600-900 deg/s elite, torso 800-1100 elite)

### BRAIN (20% of Composite)  
Measures: Timing and consistency
Components:
- Timing Gap (50%): Pelvis-to-Torso peak timing separation. 14-18% of swing = Elite
- Consistency (50%): CV of velocities across swings. <10% = Elite, >20% = Poor

### BAT (30% of Composite)
Measures: Upper body delivery to the ball
Components:
- A/T Momentum Ratio (40%): Arms properly amplifying torso energy
- Torso Deceleration (30%): Torso braking before contact (allows arms to fire)
- Bat Path (30%): Direction consistency and attack angle

### BALL (20% of Composite)
Measures: Output quality

**When actual contact data IS available** (HitTrax, Statcast, Rapsodo):
Components:
- Exit Velocity (40%): vs age-level benchmarks
- Barrel Rate (30%): Sweet spot contact %
- Hard Hit Rate (30%): 95+ mph contact %

**When NO contact data is available (Reboot-only sessions):**
Calculate KINETIC POTENTIAL - estimate exit velocity capability from body mechanics:

1. Estimate exit velocity potential from Bat KE:
   - Bat KE of 300-350J → ~80-85 mph potential
   - Bat KE of 350-400J → ~85-90 mph potential
   - Bat KE of 400-450J → ~90-95 mph potential
   - Bat KE of 450-500J → ~95-100 mph potential
   - Bat KE of 500J+ → ~100-105 mph potential

2. Factor in transfer efficiency:
   - 40%+ efficiency = full potential (no penalty)
   - 30-40% efficiency = -5 mph from potential
   - <30% efficiency = -10 mph from potential

3. Factor in consistency (CV):
   - CV <10% = consistent output (full score)
   - CV 10-15% = moderate variance (-3 from score)
   - CV >15% = high variance (-6 from score)

4. Ball score from kinetic potential:
   - 100+ mph potential = 70-80 (Elite)
   - 95-100 mph = 60-70 (Plus)
   - 90-95 mph = 55-60 (Above Avg)
   - 85-90 mph = 50-55 (Average)
   - 80-85 mph = 45-50 (Below Avg)
   - <80 mph = 40-45 (Fringe)

When no contact data, the output MUST include a kinetic_potential object:

### COMPOSITE FORMULA
COMPOSITE = (BODY × 0.30) + (BRAIN × 0.20) + (BAT × 0.30) + (BALL × 0.20)

## SCORE SCALE (20-80 Baseball Scouting)
- 70+ = Plus-Plus (Elite)
- 65-69 = Plus-Plus
- 60-64 = Plus
- 55-59 = Above Average  
- 50-54 = Average
- 45-49 = Below Average
- 40-44 = Fringe Average
- 30-39 = Fringe
- 20-29 = Poor

## LEAK DETECTION
Identify exactly ONE of these patterns (the PRIMARY leak):
- EARLY_ARMS: Arms fire with or before torso (timing gap <5%), A/T spikes early
- CAST: Hands drift away from body before hip turn, losing leverage
- LUNGE: Weight moves forward before rotation starts
- COLLAPSE: Front leg bends at contact instead of bracing, losing energy
- DISCONNECTION: T/P ratio >8.0 (torso working alone without lower body)
- SPIN_OUT: Hips over-rotate, losing connection to ground
- POOR_SEPARATION: X-Factor <25°, not creating stretch
- ENERGY_LEAK: Transfer efficiency <30%, energy dying in transition
- CLEAN_TRANSFER: No major leaks detected (only use if scores are 60+)

## MOTOR PROFILE CLASSIFICATION
Based on timing signatures, classify as ONE:
- SPINNER: Tight timing gap (0-14%), rotational dominant, quick-twitch
- WHIPPER: Optimal separation (14-22%), sequential fire, balanced
- SLINGSHOTTER: Extended timing (18-25%), ground force dominant, power-loaded
- TITAN: Variable timing, raw power focused, brute force

## COACH RICK VOICE
Coach Rick is direct, uses baseball language, focuses on feel cues:
- Never generic advice
- Reference specific metrics from the data
- Give ONE clear priority focus
- Mention mph or degrees left on the table
- End with actionable cue

Examples:
- "Your engine is generating good power, but you're leaving 5-8 mph on the table because the arms are firing early. Feel the stretch across your chest BEFORE the hands go."
- "Strong lower half - that's your weapon. But the torso isn't finishing the delivery. You're spinning out instead of bracing. Plant that front leg like you're stopping a truck."

## PRIORITY DRILL FORMAT
Name the drill + one sentence of what to feel/focus on.
Match the drill to the detected leak.

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown code blocks, no explanation before/after):
{
  "composite": 65,
  "body": 70,
  "brain": 55,
  "bat": 68,
  "ball": 62,
  "grade": "Plus",
  "body_components": {
    "transfer_efficiency": 72,
    "stability": 68,
    "velocity_pct": 65
  },
  "brain_components": {
    "timing_gap": 50,
    "consistency": 60
  },
  "bat_components": {
    "at_ratio_score": 70,
    "torso_decel": 65,
    "bat_path": 68
  },
  "ball_components": {
    "exit_velo_score": 65,
    "barrel_rate": 58,
    "hard_hit": 62,
    "data_source": "measured" // or "estimated_from_mechanics"
  },
  "kinetic_potential": {  // REQUIRED when data_source is "estimated_from_mechanics"
    "estimated_exit_velo": "88-92 mph",
    "based_on": "Bat KE 355J + 38.9% transfer efficiency",
    "ceiling": "With cleaner transfer (40%+), capable of 95+ mph",
    "limiting_factor": "Transfer efficiency below 40% - energy dying before bat"
  },
  "raw_metrics": {
    "tp_ratio": 5.8,
    "at_ratio": 1.45,
    "timing_gap_pct": 12.5,
    "x_factor_deg": 42,
    "pelvis_velocity_deg_s": 520,
    "torso_velocity_deg_s": 780,
    "bat_ke_joules": 280,
    "transfer_efficiency_pct": 38,
    "consistency_cv": 12.5
  },
  "leak_detected": "EARLY_ARMS",
  "motor_profile": "WHIPPER",
  "weakest_link": "brain",
  "coach_rick_take": "Your engine is generating good power, but you're rushing the sequence. The arms are firing too early - you're leaving 5-8 mph on the table. Focus on letting the hips LEAD and feeling that stretch across your chest before the hands go.",
  "priority_drill": "Hip Lead Drill - Fire hips while keeping hands frozen at load position. Feel the stretch, then release.",
  "swing_count": 5,
  "confidence": 0.85
}

CRITICAL RULES:
1. All scores MUST be integers between 20-80
2. composite must equal the weighted formula result (rounded)
3. weakest_link must be "body", "brain", "bat", or "ball" (lowercase)
4. leak_detected must be one of the defined leak types
5. motor_profile must be SPINNER, WHIPPER, SLINGSHOTTER, or TITAN
6. Return ONLY the JSON object, nothing else`;

// Tool definition for structured output (backup if direct JSON fails)
const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Submit the 4B swing analysis results",
    parameters: {
      type: "object",
      properties: {
        composite: { type: "number", minimum: 20, maximum: 80 },
        body: { type: "number", minimum: 20, maximum: 80 },
        brain: { type: "number", minimum: 20, maximum: 80 },
        bat: { type: "number", minimum: 20, maximum: 80 },
        ball: { type: "number", minimum: 20, maximum: 80 },
        grade: { type: "string" },
        body_components: {
          type: "object",
          properties: {
            transfer_efficiency: { type: "number" },
            stability: { type: "number" },
            velocity_pct: { type: "number" }
          }
        },
        brain_components: {
          type: "object",
          properties: {
            timing_gap: { type: "number" },
            consistency: { type: "number" }
          }
        },
        bat_components: {
          type: "object",
          properties: {
            at_ratio_score: { type: "number" },
            torso_decel: { type: "number" },
            bat_path: { type: "number" }
          }
        },
        ball_components: {
          type: "object",
          properties: {
            exit_velo_score: { type: "number" },
            barrel_rate: { type: "number" },
            hard_hit: { type: "number" },
            data_source: { type: "string", enum: ["measured", "estimated_from_mechanics"] }
          }
        },
        kinetic_potential: {
          type: "object",
          properties: {
            estimated_exit_velo: { type: "string" },
            based_on: { type: "string" },
            ceiling: { type: "string" },
            limiting_factor: { type: "string" }
          }
        },
        raw_metrics: {
          type: "object",
          properties: {
            tp_ratio: { type: "number" },
            at_ratio: { type: "number" },
            timing_gap_pct: { type: "number" },
            x_factor_deg: { type: "number" },
            pelvis_velocity_deg_s: { type: "number" },
            torso_velocity_deg_s: { type: "number" },
            bat_ke_joules: { type: "number" },
            transfer_efficiency_pct: { type: "number" },
            consistency_cv: { type: "number" }
          }
        },
        leak_detected: { type: "string" },
        motor_profile: { type: "string", enum: ["SPINNER", "WHIPPER", "SLINGSHOTTER", "TITAN"] },
        weakest_link: { type: "string", enum: ["body", "brain", "bat", "ball"] },
        coach_rick_take: { type: "string" },
        priority_drill: { type: "string" },
        swing_count: { type: "number" },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      },
      required: ["composite", "body", "brain", "bat", "ball", "grade", "leak_detected", "motor_profile", "weakest_link"]
    }
  }
};

interface AnalyzeRequest {
  data_type: "reboot_csv" | "reboot_pdf" | "video_frames" | "hittrax" | "manual" | "combined";
  content: string;
  player_id?: string;
  session_id?: string;
  save_to_db?: boolean;
}

// Truncate content to fit in context window while preserving structure
function prepareContent(content: string, maxChars: number = 15000): string {
  if (content.length <= maxChars) return content;
  
  // For CSV, keep header + sample rows
  if (content.includes(",") && content.includes("\n")) {
    const lines = content.split("\n");
    const header = lines[0];
    const dataLines = lines.slice(1).filter(l => l.trim());
    
    // Sample evenly across the data
    const targetRows = 100;
    const step = Math.max(1, Math.floor(dataLines.length / targetRows));
    const sampledLines = [];
    for (let i = 0; i < dataLines.length && sampledLines.length < targetRows; i += step) {
      sampledLines.push(dataLines[i]);
    }
    
    console.log(`[AI] Truncated from ${dataLines.length} to ${sampledLines.length} rows`);
    return [header, ...sampledLines].join("\n");
  }
  
  // For other content, truncate with indicator
  return content.slice(0, maxChars) + "\n\n[Content truncated for analysis...]";
}

// Parse AI response - handles both direct JSON and tool calls
function parseAIResponse(responseData: any): any {
  // Check for tool call first
  const toolCall = responseData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("[AI] Failed to parse tool arguments");
    }
  }
  
  // Try direct content
  const content = responseData.choices?.[0]?.message?.content;
  if (content) {
    // Clean markdown if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();
    
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("[AI] Failed to parse content as JSON:", jsonStr.slice(0, 200));
    }
  }
  
  throw new Error("Could not parse AI response");
}

// Validate and normalize the analysis result
function normalizeAnalysis(raw: any): any {
  const clamp = (v: number, min: number, max: number) => 
    Math.round(Math.max(min, Math.min(max, Number(v) || min)));
  
  // Ensure all required fields exist with valid values
  const analysis = {
    composite: clamp(raw.composite, 20, 80),
    body: clamp(raw.body, 20, 80),
    brain: clamp(raw.brain, 20, 80),
    bat: clamp(raw.bat, 20, 80),
    ball: clamp(raw.ball, 20, 80),
    grade: raw.grade || getGrade(raw.composite),
    
    body_components: {
      transfer_efficiency: clamp(raw.body_components?.transfer_efficiency || 50, 20, 80),
      stability: clamp(raw.body_components?.stability || 50, 20, 80),
      velocity_pct: clamp(raw.body_components?.velocity_pct || 50, 20, 80),
    },
    brain_components: {
      timing_gap: clamp(raw.brain_components?.timing_gap || 50, 20, 80),
      consistency: clamp(raw.brain_components?.consistency || 50, 20, 80),
    },
    bat_components: {
      at_ratio_score: clamp(raw.bat_components?.at_ratio_score || 50, 20, 80),
      torso_decel: clamp(raw.bat_components?.torso_decel || 50, 20, 80),
      bat_path: clamp(raw.bat_components?.bat_path || 50, 20, 80),
    },
    ball_components: {
      exit_velo_score: clamp(raw.ball_components?.exit_velo_score || 50, 20, 80),
      barrel_rate: raw.ball_components?.barrel_rate ?? null,
      hard_hit: raw.ball_components?.hard_hit ?? null,
      data_source: raw.ball_components?.data_source || "estimated_from_mechanics",
    },
    
    // Kinetic potential (when no contact data available)
    kinetic_potential: raw.kinetic_potential || null,
    
    raw_metrics: {
      tp_ratio: Math.round((raw.raw_metrics?.tp_ratio || 0) * 100) / 100,
      at_ratio: Math.round((raw.raw_metrics?.at_ratio || 0) * 100) / 100,
      timing_gap_pct: Math.round((raw.raw_metrics?.timing_gap_pct || 0) * 10) / 10,
      x_factor_deg: Math.round(raw.raw_metrics?.x_factor_deg || 0),
      pelvis_velocity_deg_s: Math.round(raw.raw_metrics?.pelvis_velocity_deg_s || 0),
      torso_velocity_deg_s: Math.round(raw.raw_metrics?.torso_velocity_deg_s || 0),
      bat_ke_joules: Math.round(raw.raw_metrics?.bat_ke_joules || 0),
      transfer_efficiency_pct: Math.round((raw.raw_metrics?.transfer_efficiency_pct || 0) * 10) / 10,
      consistency_cv: Math.round((raw.raw_metrics?.consistency_cv || 15) * 10) / 10,
    },
    
    leak_detected: raw.leak_detected || "CLEAN_TRANSFER",
    motor_profile: raw.motor_profile || "WHIPPER",
    weakest_link: raw.weakest_link || findWeakest(raw),
    coach_rick_take: raw.coach_rick_take || "",
    priority_drill: raw.priority_drill || "",
    swing_count: raw.swing_count || 1,
    confidence: Math.max(0, Math.min(1, raw.confidence || 0.7)),
  };
  
  return analysis;
}

function findWeakest(scores: any): string {
  const s = { body: scores.body || 50, brain: scores.brain || 50, bat: scores.bat || 50, ball: scores.ball || 50 };
  return Object.entries(s).reduce((a, b) => a[1] < b[1] ? a : b)[0];
}

function getGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 50) return "Average";
  if (score >= 45) return "Below Avg";
  if (score >= 40) return "Fringe Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data_type, content, player_id, session_id, save_to_db }: AnalyzeRequest = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Analyze] Processing ${data_type} data (${content.length} chars) for player ${player_id || "unknown"}`);

    // Build the user message based on data type
    let userMessage = "";
    const preparedContent = prepareContent(content);
    
    switch (data_type) {
      case "reboot_csv":
        userMessage = `Analyze this Reboot Motion CSV data. The data may contain momentum-energy columns (angular_momentum, kinetic_energy) and/or inverse-kinematics columns (pelvis_rot, torso_rot, timestamps).

CSV DATA:
${preparedContent}

Calculate all 4B scores, detect leaks, classify motor profile, and provide Coach Rick's take.`;
        break;
        
      case "reboot_pdf":
        userMessage = `Analyze this Reboot Motion report text. Extract the metrics and calculate 4B scores.

REPORT TEXT:
${preparedContent}`;
        break;
        
      case "video_frames":
        userMessage = `Analyze these swing video frame descriptions and estimate 4B scores based on visible mechanics.

VIDEO ANALYSIS:
${preparedContent}`;
        break;
        
      case "hittrax":
        userMessage = `Analyze this HitTrax session data focusing on ball flight metrics. Calculate 4B scores with emphasis on the Ball category.

HITTRAX DATA:
${preparedContent}`;
        break;
        
      case "combined":
        userMessage = `Analyze this combined swing data from multiple sources. Calculate comprehensive 4B scores.

COMBINED DATA:
${preparedContent}`;
        break;
        
      default:
        userMessage = `Analyze this swing data and calculate 4B scores.

DATA:
${preparedContent}`;
    }

    // Call Gemini via Lovable gateway
    console.log("[AI] Sending to Gemini for analysis...");
    
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        temperature: 0.3, // Lower = more consistent scoring
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[AI] Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const aiResult = await response.json();
    console.log("[AI] Response received");

    // Parse and normalize the response
    const rawAnalysis = parseAIResponse(aiResult);
    const analysis = normalizeAnalysis(rawAnalysis);
    
    console.log(`[AI] Analysis complete: Composite=${analysis.composite} (${analysis.grade}), Leak=${analysis.leak_detected}, Profile=${analysis.motor_profile}`);

    // Add metadata
    const result = {
      ...analysis,
      player_id,
      session_id,
      data_type,
      analyzed_at: new Date().toISOString(),
      analysis_method: "gemini-ai",
    };

    // Optionally save to database
    if (save_to_db && player_id) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      
      // Update player's latest scores
      await supabase
        .from("players")
        .update({
          latest_brain_score: analysis.brain,
          latest_body_score: analysis.body,
          latest_bat_score: analysis.bat,
          latest_ball_score: analysis.ball,
          latest_composite_score: analysis.composite,
        })
        .eq("id", player_id);

      // Upsert reboot_uploads record (update if exists, insert if new)
      const getConsistencyGrade = (cv: number): string => {
        if (cv <= 8) return "A";
        if (cv <= 12) return "B";
        if (cv <= 18) return "C";
        if (cv <= 25) return "D";
        return "F";
      };

      const uploadData = {
        brain_score: analysis.brain,
        body_score: analysis.body,
        bat_score: analysis.bat,
        composite_score: analysis.composite,
        grade: analysis.grade,
        ground_flow_score: analysis.body_components?.transfer_efficiency || null,
        core_flow_score: analysis.body_components?.stability || null,
        upper_flow_score: analysis.bat_components?.at_ratio_score || null,
        weakest_link: analysis.weakest_link,
        pelvis_velocity: analysis.raw_metrics?.pelvis_velocity_deg_s || null,
        torso_velocity: analysis.raw_metrics?.torso_velocity_deg_s || null,
        x_factor: analysis.raw_metrics?.x_factor_deg || null,
        bat_ke: analysis.raw_metrics?.bat_ke_joules || null,
        transfer_efficiency: analysis.raw_metrics?.transfer_efficiency_pct || null,
        consistency_cv: analysis.raw_metrics?.consistency_cv || null,
        consistency_grade: getConsistencyGrade(analysis.raw_metrics?.consistency_cv || 15),
        processing_status: "complete",
        completed_at: new Date().toISOString(),
      };

      // Check for existing record by player + session
      const { data: existing } = await supabase
        .from("reboot_uploads")
        .select("id")
        .eq("player_id", player_id)
        .eq("reboot_session_id", session_id)
        .maybeSingle();

      if (existing) {
        // UPDATE existing record
        const { error: updateError } = await supabase
          .from("reboot_uploads")
          .update(uploadData)
          .eq("id", existing.id);

        if (updateError) {
          console.error("[AI] Failed to update reboot_uploads record:", updateError);
        } else {
          console.log(`[AI] Updated existing record ${existing.id}`);
        }
      } else {
        // INSERT new record (only if truly new session)
        const { error: insertError } = await supabase.from("reboot_uploads").insert({
          ...uploadData,
          player_id,
          session_date: new Date().toISOString().split("T")[0],
          upload_source: data_type,
          video_filename: `AI Analysis - ${session_id || new Date().toISOString()}`,
          reboot_session_id: session_id || null,
        });

        if (insertError) {
          console.error("[AI] Failed to create reboot_uploads record:", insertError);
        } else {
          console.log(`[AI] Created new record for session ${session_id}`);
        }
      }

      // Log activity
      await supabase.from("activity_log").insert({
        action: "ai_swing_analysis",
        description: `4B Score: ${analysis.composite} (${analysis.grade}) - ${analysis.motor_profile}`,
        player_id,
        metadata: {
          scores: { body: analysis.body, brain: analysis.brain, bat: analysis.bat, ball: analysis.ball },
          leak: analysis.leak_detected,
          motor_profile: analysis.motor_profile,
          coach_take: analysis.coach_rick_take,
          data_type,
          session_id,
        },
      });

      console.log("[AI] Saved analysis to database");
      
      // Send Coach Rick SMS after analysis completion
      try {
        console.log("[AI] Triggering Coach Rick SMS for player:", player_id);
        await supabase.functions.invoke("send-coach-rick-sms", {
          body: {
            type: "analysis_complete",
            player_id,
            session_id,
          },
        });
        console.log("[AI] Coach Rick SMS triggered successfully");
      } catch (smsError) {
        // Don't fail the analysis if SMS fails
        console.error("[AI] Coach Rick SMS failed (non-fatal):", smsError);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[Analyze] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
