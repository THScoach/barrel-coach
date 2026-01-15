import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BASEBALL_HITTING_TYPE_ID = 1;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types
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
  upload_id?: string;  // Optional: link to reboot_uploads record for automated flow
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

// Verify admin user or service role (for automated polling)
async function verifyAdminOrService(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "");

  // Check if this is a service role token (used by poll-reboot-sessions)
  if (token === SUPABASE_SERVICE_KEY) {
    console.log("[Process] Authorized via service role key");
    return null; // Service role doesn't have a user ID
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
  const response = await fetch(`${REBOOT_API_BASE}/data_export`, {
    method: "POST",
    headers: {
      "X-Api-Key": REBOOT_API_KEY,
      "Content-Type": "application/json",
    },
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

// Parse CSV to objects
function parseCsv(csvText: string): Record<string, number | string>[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const rows: Record<string, number | string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, number | string> = {};

    headers.forEach((header, idx) => {
      const value = values[idx];
      const num = parseFloat(value);
      row[header] = isNaN(num) ? value : num;
    });

    rows.push(row);
  }

  return rows;
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

// Main 4B scoring calculation
function calculate4BScores(ikData: Record<string, number | string>[], meData: Record<string, number | string>[]): FourBScores {
  // GROUND FLOW (Pelvis/Lower Body)
  const pelvisRotations = ikData
    .filter((row) => row.pelvis_rot !== undefined && typeof row.pelvis_rot === 'number')
    .map((row) => (row.pelvis_rot as number) * (180 / Math.PI));

  const pelvisVelocities = calculateAngularVelocity(pelvisRotations);
  const pelvisPeakVel = Math.max(...pelvisVelocities.map(Math.abs), 0);

  const legsKE = meData
    .filter((row) => row.legs_kinetic_energy !== undefined && typeof row.legs_kinetic_energy === 'number')
    .map((row) => row.legs_kinetic_energy as number);
  const legsKEMax = Math.max(...legsKE, 0);

  const pelvisScore = to2080Scale(pelvisPeakVel, THRESHOLDS.pelvis_velocity.min, THRESHOLDS.pelvis_velocity.max);
  const legsScore = to2080Scale(legsKEMax, THRESHOLDS.legs_ke.min, THRESHOLDS.legs_ke.max);
  const groundFlowScore = Math.round((pelvisScore + legsScore) / 2);

  // CORE FLOW (Torso/X-Factor)
  const torsoRotations = ikData
    .filter((row) => row.torso_rot !== undefined && typeof row.torso_rot === 'number')
    .map((row) => (row.torso_rot as number) * (180 / Math.PI));

  const torsoVelocities = calculateAngularVelocity(torsoRotations);
  const torsoPeakVel = Math.max(...torsoVelocities.map(Math.abs), 0);

  const xFactors: number[] = [];
  for (let i = 0; i < Math.min(pelvisRotations.length, torsoRotations.length); i++) {
    xFactors.push(Math.abs(pelvisRotations[i] - torsoRotations[i]));
  }
  const xFactorMax = Math.max(...xFactors, 0);

  const xFactorVelocities = calculateAngularVelocity(xFactors);
  const stretchRate = Math.max(...xFactorVelocities.map(Math.abs), 0);

  const torsoScore = to2080Scale(torsoPeakVel, THRESHOLDS.torso_velocity.min, THRESHOLDS.torso_velocity.max);
  const xFactorScore = to2080Scale(xFactorMax, THRESHOLDS.x_factor.min, THRESHOLDS.x_factor.max);
  const stretchScore = to2080Scale(stretchRate, THRESHOLDS.stretch_rate.min, THRESHOLDS.stretch_rate.max);
  const coreFlowScore = Math.round((torsoScore + xFactorScore + stretchScore) / 3);

  // UPPER FLOW (Bat/Arms)
  const batKE = meData
    .filter((row) => row.bat_kinetic_energy !== undefined && typeof row.bat_kinetic_energy === 'number')
    .map((row) => row.bat_kinetic_energy as number);
  const batKEMax = Math.max(...batKE, 0);

  const totalKE = meData
    .filter((row) => row.total_kinetic_energy !== undefined && typeof row.total_kinetic_energy === 'number')
    .map((row) => row.total_kinetic_energy as number);
  const totalKEMax = Math.max(...totalKE, 1);
  const transferEfficiency = (batKEMax / totalKEMax) * 100;

  const batKEScore = to2080Scale(batKEMax, THRESHOLDS.bat_ke.min, THRESHOLDS.bat_ke.max);
  const efficiencyScore = to2080Scale(transferEfficiency, THRESHOLDS.bat_efficiency.min, THRESHOLDS.bat_efficiency.max);
  const upperFlowScore = Math.round((batKEScore + efficiencyScore) / 2);

  // CONSISTENCY (Brain) - CV of pelvis/torso velocities (lower CV = higher score)
  const pelvisCV = coefficientOfVariation(pelvisVelocities);
  const torsoCV = coefficientOfVariation(torsoVelocities);
  const avgCV = (pelvisCV + torsoCV) / 2;

  const consistencyScore = to2080Scale(avgCV, THRESHOLDS.consistency_cv.min, THRESHOLDS.consistency_cv.max, true);
  const consistencyGrade = getConsistencyGrade(avgCV);

  // BALL SCORE - Energy Delivery Consistency at Contact
  const contactFrameKE = totalKE;
  const contactKECV = coefficientOfVariation(contactFrameKE);
  const ballScoreRaw = to2080Scale(contactKECV, 5, 40, true);
  const ballScore = Math.max(20, Math.min(80, ballScoreRaw));

  // 4B COMPOSITE SCORES
  const brainScore = consistencyScore;
  const bodyScore = Math.round((groundFlowScore * 0.4 + coreFlowScore * 0.6));
  const batScore = upperFlowScore;

  const compositeScore = Math.round(
    brainScore * 0.20 +
    bodyScore * 0.35 +
    batScore * 0.30 +
    ballScore * 0.15
  );

  // WEAKEST LINK
  const scores = { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore };
  const weakestLink = Object.entries(scores).reduce((a, b) => (a[1] < b[1] ? a : b))[0];

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
    // Verify admin or service role access
    await verifyAdminOrService(req);

    const { session_id, org_player_id, player_id, upload_id }: ProcessRequest = await req.json();

    if (!session_id || !org_player_id) {
      return new Response(
        JSON.stringify({ error: "session_id and org_player_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing session ${session_id} for player ${org_player_id}`);

    // 1. Get download URLs from Reboot API
    const ikUrl = await getRebootExportUrl(session_id, org_player_id, "inverse-kinematics");
    const meUrl = await getRebootExportUrl(session_id, org_player_id, "momentum-energy");

    // 2. Download CSVs
    const [ikCsv, meCsv] = await Promise.all([
      downloadCsv(ikUrl),
      downloadCsv(meUrl),
    ]);

    // 3. Parse CSVs
    const ikData = parseCsv(ikCsv);
    const meData = parseCsv(meCsv);

    // 4. Calculate 4B Scores
    const scores = calculate4BScores(ikData, meData);

    // 5. Save to Database
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
      // Create reboot_session record
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

      // Insert 4B scores
      const { error: scoresError } = await supabase.from("fourb_scores").insert({
        player_id: internalPlayerId,
        reboot_session_id: newSession?.id,
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

      // If this was triggered from video upload flow, update the upload record with scores
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

      // Update player's latest scores
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

      // Log activity
      await supabase.from("activity_log").insert({
        action: "reboot_session_processed",
        description: `4B Score: ${scores.composite_score} (${scores.grade})`,
        player_id: internalPlayerId,
        metadata: { session_id, org_player_id, scores, upload_id },
      });
    }

    // 6. Return Results
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
