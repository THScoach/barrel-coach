import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const BASEBALL_HITTING_TYPE_ID = 1;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RebootExportResponse {
  session_id: string;
  movement_type_id: number;
  org_player_id: string;
  data_type: string;
  data_format: string;
  aggregate: boolean;
  download_urls: string[];
}

interface ProcessRequest {
  session_id: string;
  org_player_id: string;
  player_id?: string;
  upload_id?: string;
}

interface FourBScores {
  brain_score: number;
  body_score: number;
  bat_score: number;
  ball_score: number;
  composite_score: number;
  grade: string;
  ground_flow_score: number;
  core_flow_score: number;
  upper_flow_score: number;
  weakest_link: string;
  pelvis_velocity: number;
  torso_velocity: number;
  x_factor: number;
  bat_ke: number;
  transfer_efficiency: number;
  consistency_cv: number;
  consistency_grade: string;
  pelvis_momentum: number;
  torso_momentum: number;
  arms_momentum: number;
  tp_ratio: number;
  at_ratio: number;
  legs_ke: number;
  stretch_rate: number;
  // AI analysis extras
  leaks_detected?: string[];
  coaching_notes?: string;
}

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// 4B SCORING SYSTEM PROMPT - Comprehensive scoring logic for AI
const FOURB_SCORING_SYSTEM_PROMPT = `You are an expert baseball biomechanics analyst using the 4B Scoring System.

## THE 4B SYSTEM
The 4B System evaluates hitting mechanics across 4 categories:
- BRAIN (20%): Timing, tempo, and consistency of movement patterns
- BODY (35%): Ground reaction forces, hip/torso separation, kinetic chain efficiency  
- BAT (30%): Bat speed, bat path, energy transfer to the bat
- BALL (15%): Contact quality, launch conditions, transfer efficiency

## SCORING SCALE (20-80)
- 20-29: Poor (Well Below Average)
- 30-39: Fringe (Below Average)
- 40-49: Below Average
- 50-54: Average
- 55-59: Above Average
- 60-64: Plus
- 65-69: Plus-Plus
- 70-80: Elite

## CSV DATA INTERPRETATION

### Inverse Kinematics (IK) CSV - Contains rotation/position data:
- pelvis_rot / pelvis_rotation: Pelvis rotation in degrees (may be radians if values < 4)
- torso_rot / torso_rotation: Torso rotation in degrees
- timestamp/time: Used to calculate frame rate and velocities

From these, calculate:
- Pelvis Velocity (deg/s): derivative of pelvis_rot. Elite: 600-900, Average: 400-500
- Torso Velocity (deg/s): derivative of torso_rot. Elite: 700-1000, Average: 500-600
- X-Factor (degrees): Max separation between torso and pelvis. Elite: 40-55°, Average: 25-35°
- Stretch Rate (deg/s): Rate of X-Factor increase. Elite: 800-1200, Average: 400-600

### Momentum-Energy (ME) CSV - Contains kinetic energy and momentum:
- bat_kinetic_energy / bat_ke: Bat kinetic energy in Joules. Elite: 400-600J, Average: 150-250J
- total_kinetic_energy: Total body KE
- legs_kinetic_energy: Lower body contribution
- lowertorso_angular_momentum_z / pelvis_angular_momentum_z: Pelvis momentum
- torso_angular_momentum_z: Torso momentum
- arms_angular_momentum_z: Arms momentum

From these, calculate:
- Transfer Efficiency (%): bat_ke / total_ke * 100. Elite: 50-65%, Average: 30-40%
- T:P Ratio: torso_momentum / pelvis_momentum (should be > 1.0 for good sequencing)
- A:T Ratio: arms_momentum / torso_momentum

## COMPONENT SCORE FORMULAS

### BODY Score (35% weight):
- Ground Flow = (Pelvis Velocity Score + Legs KE Score) / 2
- Core Flow = (Torso Velocity Score + X-Factor Score + Stretch Rate Score) / 3
- BODY = Ground Flow * 0.4 + Core Flow * 0.6

### BAT Score (30% weight):
- Upper Flow = (Bat KE Score + Transfer Efficiency Score) / 2
- BAT = Upper Flow

### BRAIN Score (20% weight):
- Based on Consistency CV (coefficient of variation in velocities)
- Lower CV = higher score (inverted scale)
- CV < 6%: Elite (70-80), CV 6-10%: Plus (60-69), CV 10-15%: Average (50-59)

### BALL Score (15% weight):
- Based on Transfer Efficiency
- How much energy reaches the bat vs total body energy

### COMPOSITE Score:
- Composite = Body*0.35 + Bat*0.30 + Brain*0.20 + Ball*0.15

## LEAK DETECTION
Identify swing inefficiencies:
- EARLY_ARMS: Arms momentum peaks before torso (A:T ratio spikes early)
- CAST: Hands extend too early, losing leverage
- LATE_HIP_ROTATION: Pelvis velocity peaks late or is low
- SPIN_OUT: Pelvis over-rotates, losing connection
- POOR_SEPARATION: X-Factor < 25 degrees
- ENERGY_LEAK: Transfer efficiency < 30%
- INCONSISTENT: CV > 20%
- CLEAN_TRANSFER: No major leaks detected

## GRADE LABELS
- 70+: Plus-Plus
- 60-69: Plus
- 55-59: Above Avg
- 45-54: Average
- 40-44: Below Avg
- 30-39: Fringe
- <30: Poor

## CONSISTENCY GRADES
- CV < 6%: Elite
- CV 6-10%: Plus
- CV 10-15%: Average
- CV 15-20%: Below Avg
- CV > 20%: Poor

When analyzing, identify the swing window (stride to contact) by finding:
1. contact_frame column if present, OR
2. Peak bat_kinetic_energy frame, OR
3. Peak total_kinetic_energy frame
4. Stride frame is typically 30-40% into the swing

Convert radians to degrees if rotation values are < 4 (indicating radians).
Calculate velocities using timestamp differences (typically 240fps = dt of 0.00417s).`;

// Tool definition for structured output
const FOURB_ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "submit_4b_analysis",
    description: "Submit the 4B biomechanics analysis results",
    parameters: {
      type: "object",
      properties: {
        brain_score: { type: "number", description: "Brain score (20-80 scale)" },
        body_score: { type: "number", description: "Body score (20-80 scale)" },
        bat_score: { type: "number", description: "Bat score (20-80 scale)" },
        ball_score: { type: "number", description: "Ball score (20-80 scale)" },
        composite_score: { type: "number", description: "Weighted composite (Body*0.35 + Bat*0.30 + Brain*0.20 + Ball*0.15)" },
        grade: { type: "string", description: "Overall grade (Plus-Plus, Plus, Above Avg, Average, etc.)" },
        ground_flow_score: { type: "number", description: "Ground flow sub-score (20-80)" },
        core_flow_score: { type: "number", description: "Core flow sub-score (20-80)" },
        upper_flow_score: { type: "number", description: "Upper flow sub-score (20-80)" },
        weakest_link: { type: "string", enum: ["brain", "body", "bat", "ball"], description: "Lowest scoring category" },
        pelvis_velocity: { type: "number", description: "Peak pelvis velocity in deg/s" },
        torso_velocity: { type: "number", description: "Peak torso velocity in deg/s" },
        x_factor: { type: "number", description: "Max hip-shoulder separation in degrees" },
        bat_ke: { type: "number", description: "Peak bat kinetic energy in Joules" },
        transfer_efficiency: { type: "number", description: "Bat KE / Total KE percentage" },
        consistency_cv: { type: "number", description: "Coefficient of variation in velocity patterns %" },
        consistency_grade: { type: "string", description: "Consistency grade (Elite, Plus, Average, etc.)" },
        pelvis_momentum: { type: "number", description: "Peak pelvis angular momentum" },
        torso_momentum: { type: "number", description: "Peak torso angular momentum" },
        arms_momentum: { type: "number", description: "Peak arms angular momentum" },
        tp_ratio: { type: "number", description: "Torso-to-Pelvis momentum ratio" },
        at_ratio: { type: "number", description: "Arms-to-Torso momentum ratio" },
        legs_ke: { type: "number", description: "Legs kinetic energy in Joules" },
        stretch_rate: { type: "number", description: "Rate of X-Factor change in deg/s" },
        leaks_detected: { 
          type: "array", 
          items: { type: "string" },
          description: "List of swing inefficiencies detected (EARLY_ARMS, CAST, LATE_HIP_ROTATION, etc.)"
        },
        coaching_notes: { type: "string", description: "Brief coaching insight (1-2 sentences)" }
      },
      required: [
        "brain_score", "body_score", "bat_score", "ball_score", "composite_score", 
        "grade", "ground_flow_score", "core_flow_score", "upper_flow_score", "weakest_link",
        "pelvis_velocity", "torso_velocity", "x_factor", "bat_ke", "transfer_efficiency",
        "consistency_cv", "consistency_grade", "pelvis_momentum", "torso_momentum", 
        "arms_momentum", "tp_ratio", "at_ratio", "legs_ke", "stretch_rate", "leaks_detected"
      ]
    }
  }
};

// Get OAuth access token from Reboot
async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  console.log("[Auth] Fetching new Reboot access token");
  
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${error}`);
  }

  const data: RebootTokenResponse = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

async function getRebootHeaders(): Promise<Record<string, string>> {
  const token = await getRebootAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function verifyAdminOrService(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");
  if (token === SUPABASE_SERVICE_KEY) {
    console.log("[Process] Authorized via service role key");
    return null;
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  if (claimsError || !claimsData?.user) {
    throw new Error("Unauthorized");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return claimsData.user.id;
}

async function getRebootExportUrl(
  sessionId: string,
  orgPlayerId: string,
  dataType: "inverse-kinematics" | "momentum-energy"
): Promise<string> {
  const headers = await getRebootHeaders();
  
  const response = await fetch(`${REBOOT_API_BASE}/data_export`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      org_player_id: orgPlayerId,
      data_type: dataType,
      movement_type_id: BASEBALL_HITTING_TYPE_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot API error (${response.status}): ${error}`);
  }

  const data: RebootExportResponse = await response.json();
  if (!data.download_urls || data.download_urls.length === 0) {
    throw new Error(`No download URL returned for ${dataType}`);
  }

  return data.download_urls[0];
}

async function downloadCsv(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.status}`);
  }
  return await response.text();
}

// Truncate CSV to manageable size for AI (keep headers + representative sample)
function prepareCsvForAI(csvText: string, maxRows: number = 150): string {
  const lines = csvText.trim().split("\n");
  if (lines.length <= maxRows + 1) {
    return csvText;
  }
  
  const header = lines[0];
  const dataLines = lines.slice(1);
  
  // Sample evenly across the swing
  const step = Math.floor(dataLines.length / maxRows);
  const sampledLines = [];
  for (let i = 0; i < dataLines.length && sampledLines.length < maxRows; i += step) {
    sampledLines.push(dataLines[i]);
  }
  
  console.log(`[AI] Truncated CSV from ${dataLines.length} to ${sampledLines.length} rows for AI analysis`);
  
  return [header, ...sampledLines].join("\n");
}

// Call Gemini AI to analyze the CSV data
async function analyzeWithGemini(ikCsv: string, meCsv: string): Promise<FourBScores> {
  console.log("[AI] Sending CSV data to Gemini for 4B analysis...");
  
  const preparedIK = prepareCsvForAI(ikCsv, 150);
  const preparedME = prepareCsvForAI(meCsv, 150);
  
  const userPrompt = `Analyze this baseball swing biomechanics data and calculate the 4B scores.

## INVERSE KINEMATICS CSV (rotation/position data):
\`\`\`csv
${preparedIK}
\`\`\`

## MOMENTUM-ENERGY CSV (kinetic energy and momentum data):
\`\`\`csv
${preparedME}
\`\`\`

Instructions:
1. Identify the swing window (look for peak bat_kinetic_energy or total_kinetic_energy)
2. Check if rotation values are in radians (values < 4) and convert to degrees
3. Calculate velocities from rotation derivatives using timestamp intervals
4. Extract momentum and KE peaks within the swing window
5. Apply the 4B scoring formulas exactly as specified
6. Detect any swing leaks/inefficiencies
7. Submit your analysis using the submit_4b_analysis function

Be precise with the calculations. If data is missing for a metric, use reasonable estimates based on the available data.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: FOURB_SCORING_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      tools: [FOURB_ANALYSIS_TOOL],
      tool_choice: { type: "function", function: { name: "submit_4b_analysis" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[AI] Gemini API error:", response.status, errorText);
    
    // Fall back to default scores on AI error
    if (response.status === 429) {
      console.log("[AI] Rate limited, using fallback scoring");
      return getDefaultScores();
    }
    if (response.status === 402) {
      console.log("[AI] Payment required, using fallback scoring");
      return getDefaultScores();
    }
    
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[AI] Gemini response received");

  // Extract tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== "submit_4b_analysis") {
    console.error("[AI] No valid tool call in response:", JSON.stringify(data.choices?.[0]?.message, null, 2));
    throw new Error("AI did not return structured analysis");
  }

  let analysis;
  try {
    analysis = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error("[AI] Failed to parse tool arguments:", toolCall.function.arguments);
    throw new Error("Failed to parse AI analysis");
  }

  console.log(`[AI] 4B Analysis: Brain=${analysis.brain_score}, Body=${analysis.body_score}, Bat=${analysis.bat_score}, Ball=${analysis.ball_score}, Composite=${analysis.composite_score}`);
  console.log(`[AI] Leaks detected: ${analysis.leaks_detected?.join(", ") || "none"}`);
  if (analysis.coaching_notes) {
    console.log(`[AI] Coaching notes: ${analysis.coaching_notes}`);
  }

  // Validate and cap scores to reasonable ranges
  return {
    brain_score: clamp(analysis.brain_score, 20, 80),
    body_score: clamp(analysis.body_score, 20, 80),
    bat_score: clamp(analysis.bat_score, 20, 80),
    ball_score: clamp(analysis.ball_score, 20, 80),
    composite_score: clamp(analysis.composite_score, 20, 80),
    grade: analysis.grade || getGrade(analysis.composite_score),
    ground_flow_score: clamp(analysis.ground_flow_score, 20, 80),
    core_flow_score: clamp(analysis.core_flow_score, 20, 80),
    upper_flow_score: clamp(analysis.upper_flow_score, 20, 80),
    weakest_link: analysis.weakest_link || "body",
    pelvis_velocity: clamp(analysis.pelvis_velocity, 0, 2000),
    torso_velocity: clamp(analysis.torso_velocity, 0, 2000),
    x_factor: clamp(analysis.x_factor, 0, 90),
    bat_ke: clamp(analysis.bat_ke, 0, 1000),
    transfer_efficiency: clamp(analysis.transfer_efficiency, 0, 100),
    consistency_cv: clamp(analysis.consistency_cv, 0, 100),
    consistency_grade: analysis.consistency_grade || getConsistencyGrade(analysis.consistency_cv),
    pelvis_momentum: clamp(analysis.pelvis_momentum, 0, 100),
    torso_momentum: clamp(analysis.torso_momentum, 0, 100),
    arms_momentum: clamp(analysis.arms_momentum, 0, 100),
    tp_ratio: clamp(analysis.tp_ratio, 0, 5),
    at_ratio: clamp(analysis.at_ratio, 0, 5),
    legs_ke: clamp(analysis.legs_ke, 0, 1000),
    stretch_rate: clamp(analysis.stretch_rate, 0, 2000),
    leaks_detected: analysis.leaks_detected || [],
    coaching_notes: analysis.coaching_notes || undefined,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 45) return "Average";
  if (score >= 40) return "Below Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

function getConsistencyGrade(cv: number): string {
  if (cv < 6) return "Elite";
  if (cv < 10) return "Plus";
  if (cv < 15) return "Average";
  if (cv < 20) return "Below Avg";
  return "Poor";
}

function getDefaultScores(): FourBScores {
  return {
    brain_score: 50, body_score: 50, bat_score: 50, ball_score: 50,
    composite_score: 50, grade: "Average",
    ground_flow_score: 50, core_flow_score: 50, upper_flow_score: 50,
    weakest_link: "body",
    pelvis_velocity: 0, torso_velocity: 0, x_factor: 0, bat_ke: 0,
    transfer_efficiency: 0, consistency_cv: 15, consistency_grade: "Average",
    pelvis_momentum: 0, torso_momentum: 0, arms_momentum: 0,
    tp_ratio: 0, at_ratio: 0, legs_ke: 0, stretch_rate: 0,
    leaks_detected: [],
  };
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifyAdminOrService(req);

    const { session_id, org_player_id, player_id, upload_id }: ProcessRequest = await req.json();

    if (!session_id || !org_player_id) {
      return new Response(
        JSON.stringify({ error: "session_id and org_player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Process] Processing session ${session_id} for player ${org_player_id}`);

    // Fetch CSV data from Reboot
    const ikUrl = await getRebootExportUrl(session_id, org_player_id, "inverse-kinematics");
    const meUrl = await getRebootExportUrl(session_id, org_player_id, "momentum-energy");

    const [ikCsvText, meCsvText] = await Promise.all([
      downloadCsv(ikUrl),
      downloadCsv(meUrl),
    ]);

    console.log(`[Process] Downloaded CSVs: IK=${ikCsvText.split("\n").length} rows, ME=${meCsvText.split("\n").length} rows`);

    // Use Gemini AI to analyze the CSV data
    const scores = await analyzeWithGemini(ikCsvText, meCsvText);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let internalPlayerId = player_id;
    if (!internalPlayerId) {
      const { data: player } = await supabase
        .from("players")
        .select("id")
        .eq("reboot_athlete_id", org_player_id)
        .single();

      internalPlayerId = player?.id;
    }

    if (internalPlayerId) {
      // Create reboot_sessions record
      const { error: sessionError } = await supabase
        .from("reboot_sessions")
        .insert({
          player_id: internalPlayerId,
          reboot_session_id: session_id,
          status: "completed",
          processed_at: new Date().toISOString(),
        });

      if (sessionError) {
        console.error("Error creating reboot session:", sessionError);
      }

      // Always create/update reboot_uploads so it shows in Upload History
      // Round integer columns to avoid "invalid input syntax for type integer" errors
      const uploadData = {
        brain_score: Math.round(scores.brain_score),
        body_score: Math.round(scores.body_score),
        bat_score: Math.round(scores.bat_score),
        composite_score: scores.composite_score, // numeric type, no rounding needed
        grade: scores.grade,
        ground_flow_score: Math.round(scores.ground_flow_score),
        core_flow_score: Math.round(scores.core_flow_score),
        upper_flow_score: Math.round(scores.upper_flow_score),
        weakest_link: scores.weakest_link,
        pelvis_velocity: scores.pelvis_velocity,
        torso_velocity: scores.torso_velocity,
        x_factor: scores.x_factor,
        bat_ke: scores.bat_ke,
        transfer_efficiency: scores.transfer_efficiency,
        consistency_cv: scores.consistency_cv,
        consistency_grade: scores.consistency_grade,
        processing_status: "complete",
        completed_at: new Date().toISOString(),
        reboot_session_id: session_id,
      };

      if (upload_id) {
        // Update existing upload record by ID
        const { error } = await supabase
          .from("reboot_uploads")
          .update(uploadData)
          .eq("id", upload_id);

        if (error) {
          console.error("Error updating reboot_uploads:", error);
          throw new Error(`Database error saving session: ${error.message}`);
        }
        console.log(`[Process] Updated reboot_uploads ${upload_id}`);
      } else {
        // Check for existing record by player + session (upsert logic)
        const { data: existing } = await supabase
          .from("reboot_uploads")
          .select("id")
          .eq("player_id", internalPlayerId)
          .eq("reboot_session_id", session_id)
          .maybeSingle();

        if (existing) {
          // UPDATE existing record
          const { error } = await supabase
            .from("reboot_uploads")
            .update(uploadData)
            .eq("id", existing.id);

          if (error) {
            console.error("Error updating existing reboot_uploads:", error);
            throw new Error(`Database error updating session: ${error.message}`);
          }
          console.log(`[Process] Updated existing record ${existing.id} for session ${session_id}`);
        } else {
          // INSERT new record
          const { error } = await supabase
            .from("reboot_uploads")
            .insert({
              ...uploadData,
              player_id: internalPlayerId,
              session_date: new Date().toISOString().split("T")[0],
              upload_source: "reboot_api",
              video_filename: `Reboot Session ${session_id.slice(0, 8)}`,
            });

          if (error) {
            console.error("Error inserting reboot_uploads:", error);
            throw new Error(`Database error creating session record: ${error.message}`);
          }
          console.log(`[Process] Created reboot_uploads for session ${session_id}`);
        }
      }

      // Update player's latest scores (round integer columns)
      const { error: playerUpdateError } = await supabase
        .from("players")
        .update({
          latest_brain_score: Math.round(scores.brain_score),
          latest_body_score: Math.round(scores.body_score),
          latest_bat_score: Math.round(scores.bat_score),
          latest_ball_score: Math.round(scores.ball_score),
          latest_composite_score: scores.composite_score, // numeric type
        })
        .eq("id", internalPlayerId);

      if (playerUpdateError) {
        console.error("Error updating player scores:", playerUpdateError);
      }

      // Log activity with AI analysis details
      await supabase.from("activity_log").insert({
        action: "reboot_session_processed",
        description: `4B Score: ${scores.composite_score} (${scores.grade}) - AI Analyzed`,
        player_id: internalPlayerId,
        metadata: { 
          session_id, 
          org_player_id, 
          scores,
          upload_id,
          analysis_method: "gemini-ai",
          leaks_detected: scores.leaks_detected,
          coaching_notes: scores.coaching_notes,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id,
        org_player_id,
        player_id: internalPlayerId,
        scores,
        analysis_method: "gemini-ai",
        message: `4B Score: ${scores.composite_score} (${scores.grade})`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
