import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
}

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get OAuth access token from Reboot
async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  console.log("[Auth] Fetching new Reboot access token");
  
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

// Get auth headers for Reboot API calls
async function getRebootHeaders(): Promise<Record<string, string>> {
  const token = await getRebootAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Verify admin user or service role
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

// Get download URL from Reboot API
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

// Download CSV from S3
async function downloadCsv(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.status}`);
  }
  return await response.text();
}

// Parse CSV to numeric arrays (column-based format matching compute-4b-from-csv)
function parseCsvToArrays(csvText: string): Record<string, number[]> {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return {};

  // Use lowercase headers for consistency
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, "").toLowerCase());
  const result: Record<string, number[]> = {};
  headers.forEach((h) => {
    result[h] = [];
  });

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim());
    headers.forEach((header, idx) => {
      const raw = values[idx] ?? "";
      const val = parseFloat(raw);
      result[header].push(Number.isFinite(val) ? val : 0);
    });
  }

  return result;
}

// Check if values are in radians (small values) and convert to degrees
function maybeRadiansToDegrees(values: number[]): number[] {
  if (!values?.length) return [];
  const maxAbs = Math.max(...values.map(Math.abs));
  
  // If peak is "small" (<8), it's likely radians
  if (maxAbs > 0 && maxAbs < 8) {
    const DEG = 57.29577951308232; // 180/PI
    return values.map((v) => (v || 0) * DEG);
  }
  return values;
}

// Scoring thresholds for 20-80 scale
const THRESHOLDS = {
  pelvis_velocity: { min: 400, max: 900 },
  torso_velocity: { min: 400, max: 900 },
  x_factor: { min: 10, max: 45 },
  stretch_rate: { min: 400, max: 1200 },
  bat_ke: { min: 100, max: 600 },
  legs_ke: { min: 100, max: 500 },
  bat_efficiency: { min: 25, max: 65 },
  consistency_cv: { min: 5, max: 40 },
};

function to2080Scale(value: number, min: number, max: number, invert = false): number {
  let normalized = (value - min) / (max - min);
  if (invert) normalized = 1 - normalized;
  normalized = Math.max(0, Math.min(1, normalized));
  return Math.round(20 + normalized * 60);
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

function calculateAngularVelocity(angles: number[], dt: number = 0.008333): number[] {
  const velocities: number[] = [];
  for (let i = 1; i < angles.length; i++) {
    velocities.push((angles[i] - angles[i - 1]) / dt);
  }
  return velocities;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length);
}

function coefficientOfVariation(arr: number[]): number {
  const m = mean(arr);
  if (m === 0) return 0;
  return (std(arr) / Math.abs(m)) * 100;
}

// Get peak absolute value from an array
function getPeakAbs(values: number[]): number {
  let maxVal = 0;
  for (const val of values) {
    const absVal = Math.abs(val || 0);
    if (absVal > maxVal) maxVal = absVal;
  }
  return maxVal;
}

// Get peak absolute value within a window
function getPeakAbsInWindow(values: number[], start: number, end: number): number {
  const s = Math.max(0, Math.min(values.length - 1, start));
  const e = Math.max(s, Math.min(values.length - 1, end));
  let maxVal = 0;
  for (let i = s; i <= e; i++) {
    const absVal = Math.abs(values[i] || 0);
    if (absVal > maxVal) maxVal = absVal;
  }
  return maxVal;
}

// Find frame with peak value
function findPeakFrame(values: number[]): number {
  let maxVal = -Infinity;
  let maxIdx = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] || 0;
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  }
  return maxIdx;
}

// Detect frame rate from timestamp column
function detectFrameRate(csvData: Record<string, number[]>): number {
  const timestamps = csvData["timestamp"] || csvData["time"] || csvData["t"] || [];
  if (timestamps.length >= 2) {
    const dt = timestamps[1] - timestamps[0];
    if (dt > 0 && dt < 1) {
      const fps = 1 / dt;
      console.log(`[FPS] Detected from timestamps: ${fps.toFixed(1)} fps`);
      return fps;
    }
  }
  return 300; // Default Reboot fps
}

// Find column by searching for partial matches
function findColumn(csvData: Record<string, number[]>, ...patterns: string[]): number[] {
  for (const pattern of patterns) {
    if (csvData[pattern]) return csvData[pattern];
  }
  const keys = Object.keys(csvData);
  for (const pattern of patterns) {
    const match = keys.find(k => k.includes(pattern));
    if (match) return csvData[match];
  }
  return [];
}

// Detect contact frame using bat kinetic energy peak or other proxies
function detectContactFrame(
  meCsv: Record<string, number[]>,
  ikCsv: Record<string, number[]>
): { contactFrame: number; strideFrame: number; confidence: string } {
  const frameCount = meCsv["rel_frame"]?.length || ikCsv["rel_frame"]?.length || 100;
  
  // 1) Try bat kinetic energy peak (most reliable)
  const batKE = findColumn(meCsv, "bat_kinetic_energy", "bat_ke");
  if (batKE.length > 0) {
    const peakFrame = findPeakFrame(batKE);
    if (peakFrame > frameCount * 0.3) {
      const strideFrame = Math.floor(peakFrame * 0.3);
      console.log(`[Contact] Using bat_ke peak: frame ${peakFrame}, stride: ${strideFrame}`);
      return { contactFrame: peakFrame, strideFrame, confidence: "high" };
    }
  }
  
  // 2) Try total kinetic energy peak
  const totalKE = findColumn(meCsv, "total_kinetic_energy", "total_ke");
  if (totalKE.length > 0) {
    const peakFrame = findPeakFrame(totalKE);
    if (peakFrame > frameCount * 0.3) {
      const strideFrame = Math.floor(peakFrame * 0.3);
      console.log(`[Contact] Using total_ke peak: frame ${peakFrame}, stride: ${strideFrame}`);
      return { contactFrame: peakFrame, strideFrame, confidence: "medium" };
    }
  }
  
  // 3) Fallback: assume swing happens in last 60% of capture
  const contactFrame = Math.floor(frameCount * 0.7);
  const strideFrame = Math.floor(frameCount * 0.3);
  console.log(`[Contact] Using fallback ratio: contact=${contactFrame}, stride=${strideFrame}`);
  return { contactFrame, strideFrame, confidence: "low" };
}

// Main 4B scoring calculation using column-based arrays WITH swing window
function calculate4BScores(ikCsv: Record<string, number[]>, meCsv: Record<string, number[]>): FourBScores {
  const frameCount = ikCsv["rel_frame"]?.length || ikCsv["frame"]?.length || 100;
  const fps = detectFrameRate(ikCsv);
  const dt = 1 / fps;
  
  // Detect swing window (stride → contact)
  const { contactFrame, strideFrame, confidence } = detectContactFrame(meCsv, ikCsv);
  const swingWindow = contactFrame - strideFrame;
  
  console.log(`[Scoring] ${frameCount} frames at ${fps} fps, swing window: ${strideFrame}-${contactFrame} (${swingWindow} frames, confidence: ${confidence})`);
  
  // Get rotation data
  const pelvisRaw = findColumn(ikCsv, "pelvis_rot", "pelvisrot", "pelvis_rotation");
  const torsoRaw = findColumn(ikCsv, "torso_rot", "torsorot", "torso_rotation");
  
  console.log(`[Scoring] Found ${pelvisRaw.length} pelvis values, ${torsoRaw.length} torso values`);
  
  // Auto-convert radians to degrees if needed
  const pelvisRotations = maybeRadiansToDegrees(pelvisRaw);
  const torsoRotations = maybeRadiansToDegrees(torsoRaw);
  
  console.log(`[Scoring] Pelvis range: ${Math.min(...pelvisRotations).toFixed(1)} to ${Math.max(...pelvisRotations).toFixed(1)} deg`);
  
  // Calculate velocities (frame-to-frame)
  const pelvisVelocities: number[] = [];
  const torsoVelocities: number[] = [];
  for (let i = 1; i < pelvisRotations.length; i++) {
    pelvisVelocities.push((pelvisRotations[i] - pelvisRotations[i - 1]) / dt);
  }
  for (let i = 1; i < torsoRotations.length; i++) {
    torsoVelocities.push((torsoRotations[i] - torsoRotations[i - 1]) / dt);
  }
  
  // Get peak velocities WITHIN the swing window only
  const pelvisPeakVel = getPeakAbsInWindow(pelvisVelocities, strideFrame, contactFrame);
  const torsoPeakVel = getPeakAbsInWindow(torsoVelocities, strideFrame, contactFrame);
  
  console.log(`[Scoring] Pelvis peak vel: ${pelvisPeakVel.toFixed(1)} deg/s, Torso: ${torsoPeakVel.toFixed(1)} deg/s`);
  
  // X-Factor (separation) within swing window
  const xFactors: number[] = [];
  for (let i = 0; i < Math.min(pelvisRotations.length, torsoRotations.length); i++) {
    xFactors.push(Math.abs(pelvisRotations[i] - torsoRotations[i]));
  }
  const xFactorMax = getPeakAbsInWindow(xFactors, strideFrame, contactFrame);
  
  const xFactorVelocities: number[] = [];
  for (let i = 1; i < xFactors.length; i++) {
    xFactorVelocities.push((xFactors[i] - xFactors[i - 1]) / dt);
  }
  const stretchRate = getPeakAbsInWindow(xFactorVelocities, strideFrame, contactFrame);
  
  console.log(`[Scoring] X-Factor max: ${xFactorMax.toFixed(1)} deg, stretch rate: ${stretchRate.toFixed(1)} deg/s`);
  
  // Get kinetic energy data
  const batKE = findColumn(meCsv, "bat_kinetic_energy", "bat_ke");
  const totalKE = findColumn(meCsv, "total_kinetic_energy", "total_ke");
  const legsKE = findColumn(meCsv, "legs_kinetic_energy", "legs_ke");
  
  console.log(`[Scoring] Found bat_ke: ${batKE.length} values, total_ke: ${totalKE.length}, legs_ke: ${legsKE.length}`);
  
  // Get peak KE within swing window
  const batKEMax = getPeakAbsInWindow(batKE, strideFrame, contactFrame);
  const totalKEMax = Math.max(getPeakAbsInWindow(totalKE, strideFrame, contactFrame), 1);
  const legsKEMax = getPeakAbsInWindow(legsKE, strideFrame, contactFrame);
  const transferEfficiency = totalKEMax > 1 ? (batKEMax / totalKEMax) * 100 : 0;
  
  console.log(`[Scoring] Bat KE: ${batKEMax.toFixed(1)} J, Total KE: ${totalKEMax.toFixed(1)} J, Efficiency: ${transferEfficiency.toFixed(1)}%`);
  
  // Calculate scores using thresholds
  const pelvisScore = to2080Scale(pelvisPeakVel, THRESHOLDS.pelvis_velocity.min, THRESHOLDS.pelvis_velocity.max);
  const torsoScore = to2080Scale(torsoPeakVel, THRESHOLDS.torso_velocity.min, THRESHOLDS.torso_velocity.max);
  const xFactorScore = to2080Scale(xFactorMax, THRESHOLDS.x_factor.min, THRESHOLDS.x_factor.max);
  const stretchScore = to2080Scale(stretchRate, THRESHOLDS.stretch_rate.min, THRESHOLDS.stretch_rate.max);
  const legsScore = to2080Scale(legsKEMax, THRESHOLDS.legs_ke.min, THRESHOLDS.legs_ke.max);
  const batKEScore = to2080Scale(batKEMax, THRESHOLDS.bat_ke.min, THRESHOLDS.bat_ke.max);
  const efficiencyScore = to2080Scale(transferEfficiency, THRESHOLDS.bat_efficiency.min, THRESHOLDS.bat_efficiency.max);
  
  // Combine into flow scores
  const groundFlowScore = Math.round((pelvisScore + legsScore) / 2);
  const coreFlowScore = Math.round((torsoScore + xFactorScore + stretchScore) / 3);
  const upperFlowScore = Math.round((batKEScore + efficiencyScore) / 2);
  
  // Consistency (CV of velocities within swing window)
  const windowPelvisVel = pelvisVelocities.slice(strideFrame, contactFrame).filter(v => Math.abs(v) > 10 && Math.abs(v) < 2000);
  const windowTorsoVel = torsoVelocities.slice(strideFrame, contactFrame).filter(v => Math.abs(v) > 10 && Math.abs(v) < 2000);
  const pelvisCV = windowPelvisVel.length > 2 ? coefficientOfVariation(windowPelvisVel) : 20;
  const torsoCV = windowTorsoVel.length > 2 ? coefficientOfVariation(windowTorsoVel) : 20;
  const avgCV = (pelvisCV + torsoCV) / 2;
  
  const consistencyScore = to2080Scale(avgCV, THRESHOLDS.consistency_cv.min, THRESHOLDS.consistency_cv.max, true);
  const consistencyGrade = getConsistencyGrade(avgCV);
  
  // Final 4B scores
  const brainScore = consistencyScore;
  const bodyScore = Math.round((groundFlowScore * 0.4 + coreFlowScore * 0.6));
  const batScore = upperFlowScore;
  const ballScore = transferEfficiency > 0 
    ? Math.max(20, Math.min(80, to2080Scale(transferEfficiency, 25, 65, false)))
    : 50;
  
  const compositeScore = Math.round(
    brainScore * 0.20 +
    bodyScore * 0.35 +
    batScore * 0.30 +
    ballScore * 0.15
  );
  
  const scores = { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore };
  const weakestLink = Object.entries(scores).reduce((a, b) => (a[1] < b[1] ? a : b))[0];
  
  console.log(`[Scoring] Final: Brain=${brainScore}, Body=${bodyScore}, Bat=${batScore}, Ball=${ballScore}, Composite=${compositeScore}`);
  
  return {
    brain_score: brainScore,
    body_score: bodyScore,
    bat_score: batScore,
    ball_score: ballScore,
    composite_score: compositeScore,
    grade: getGrade(compositeScore),
    ground_flow_score: groundFlowScore,
    core_flow_score: coreFlowScore,
    upper_flow_score: upperFlowScore,
    weakest_link: weakestLink,
    pelvis_velocity: Math.round(pelvisPeakVel),
    torso_velocity: Math.round(torsoPeakVel),
    x_factor: Math.round(xFactorMax * 10) / 10,
    bat_ke: Math.round(batKEMax),
    transfer_efficiency: Math.round(transferEfficiency * 10) / 10,
    consistency_cv: Math.round(avgCV * 10) / 10,
    consistency_grade: consistencyGrade,
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

    console.log(`Processing session ${session_id} for player ${org_player_id}`);

    const ikUrl = await getRebootExportUrl(session_id, org_player_id, "inverse-kinematics");
    const meUrl = await getRebootExportUrl(session_id, org_player_id, "momentum-energy");

    const [ikCsv, meCsv] = await Promise.all([
      downloadCsv(ikUrl),
      downloadCsv(meUrl),
    ]);

    // Parse CSV into column-based arrays
    const ikData = parseCsvToArrays(ikCsv);
    const meData = parseCsvToArrays(meCsv);

    const scores = calculate4BScores(ikData, meData);

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
      const { data: newSession, error: sessionError } = await supabase
        .from("reboot_sessions")
        .insert({
          player_id: internalPlayerId,
          reboot_session_id: session_id,
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (sessionError) {
        console.error("Error creating reboot session:", sessionError);
      }

      const { error: scoresError } = await supabase.from("swing_4b_scores").insert({
        player_id: internalPlayerId,
        session_id: newSession?.id,
        brain_score: scores.brain_score,
        body_score: scores.body_score,
        bat_score: scores.bat_score,
        ball_score: scores.ball_score,
        composite_score: scores.composite_score,
        grade: scores.grade,
        ground_flow_score: scores.ground_flow_score,
        core_flow_score: scores.core_flow_score,
        upper_flow_score: scores.upper_flow_score,
        weakest_link: scores.weakest_link,
        pelvis_velocity: scores.pelvis_velocity,
        torso_velocity: scores.torso_velocity,
        x_factor: scores.x_factor,
        bat_ke: scores.bat_ke,
        transfer_efficiency: scores.transfer_efficiency,
        consistency_cv: scores.consistency_cv,
        consistency_grade: scores.consistency_grade,
        primary_issue_category: scores.weakest_link,
      });

      if (scoresError) {
        console.error("Error inserting 4B scores:", scoresError);
      }

      if (upload_id) {
        const { error: uploadUpdateError } = await supabase
          .from("reboot_uploads")
          .update({
            brain_score: scores.brain_score,
            body_score: scores.body_score,
            bat_score: scores.bat_score,
            composite_score: scores.composite_score,
            grade: scores.grade,
            ground_flow_score: scores.ground_flow_score,
            core_flow_score: scores.core_flow_score,
            upper_flow_score: scores.upper_flow_score,
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
          })
          .eq("id", upload_id);

        if (uploadUpdateError) {
          console.error("Error updating reboot_uploads:", uploadUpdateError);
        } else {
          console.log(`[Process] Updated reboot_uploads record ${upload_id} with scores`);
        }
      }

      const { error: playerUpdateError } = await supabase
        .from("players")
        .update({
          latest_brain_score: scores.brain_score,
          latest_body_score: scores.body_score,
          latest_bat_score: scores.bat_score,
          latest_ball_score: scores.ball_score,
          latest_composite_score: scores.composite_score,
        })
        .eq("id", internalPlayerId);

      if (playerUpdateError) {
        console.error("Error updating player scores:", playerUpdateError);
      }

      await supabase.from("activity_log").insert({
        action: "reboot_session_processed",
        description: `4B Score: ${scores.composite_score} (${scores.grade})`,
        player_id: internalPlayerId,
        metadata: { session_id, org_player_id, scores, upload_id },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id,
        org_player_id,
        player_id: internalPlayerId,
        scores,
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
