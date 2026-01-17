import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BASEBALL_HITTING_TYPE_ID = 1;
const DEG = 57.29577951308232; // 180/PI

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
  // Raw metrics
  pelvis_velocity: number;
  torso_velocity: number;
  x_factor: number;
  bat_ke: number;
  transfer_efficiency: number;
  consistency_cv: number;
  consistency_grade: string;
  // Additional metrics for display
  pelvis_momentum: number;
  torso_momentum: number;
  arms_momentum: number;
  tp_ratio: number;
  at_ratio: number;
  legs_ke: number;
  stretch_rate: number;
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

// Parse CSV to column-based arrays with lowercase headers
function parseCsvToArrays(csvText: string): Record<string, number[]> {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return {};

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/"/g, "").toLowerCase());
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

// Parse CSV into per-swing grouped data
interface SwingData {
  movementId: string;
  indices: number[];
  data: Record<string, number[]>;
}

function parseCsvBySwing(csvText: string): { allData: Record<string, number[]>; swings: SwingData[] } {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return { allData: {}, swings: [] };

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/"/g, "").toLowerCase());
  
  // Find movement ID column
  const movementIdCol = headers.findIndex(h => 
    h === "org_movement_id" || h === "movement_id" || h === "movementid"
  );
  
  const allData: Record<string, number[]> = {};
  const rawRows: { values: string[]; movementId: string }[] = [];
  
  headers.forEach((h) => {
    allData[h] = [];
  });

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim());
    const movementId = movementIdCol >= 0 ? values[movementIdCol] || `swing_${i}` : `swing_0`;
    rawRows.push({ values, movementId });
    
    headers.forEach((header, idx) => {
      const raw = values[idx] ?? "";
      const val = parseFloat(raw);
      allData[header].push(Number.isFinite(val) ? val : 0);
    });
  }

  // Group by movement ID
  const swingMap = new Map<string, number[]>();
  rawRows.forEach((row, idx) => {
    if (!swingMap.has(row.movementId)) {
      swingMap.set(row.movementId, []);
    }
    swingMap.get(row.movementId)!.push(idx);
  });

  // Create per-swing data
  const swings: SwingData[] = [];
  for (const [movementId, indices] of swingMap) {
    const swingData: Record<string, number[]> = {};
    headers.forEach((header) => {
      swingData[header] = indices.map(idx => allData[header][idx]);
    });
    swings.push({ movementId, indices, data: swingData });
  }

  console.log(`[Parse] Found ${swings.length} swings in CSV: ${swings.map(s => s.movementId.slice(-8)).join(", ")}`);

  return { allData, swings };
}

function getRawCsvHeaderLine(csvText: string): string {
  return (csvText.split("\n")[0] ?? "").trim();
}

function formatSample(values: number[], count = 5): string {
  return values
    .slice(0, count)
    .map((v) => (Number.isFinite(v) ? String(v) : "NaN"))
    .join(", ");
}

function logAllKeys(label: string, keys: string[], chunkSize = 30): void {
  const sorted = [...keys].sort();
  console.log(`[Headers] ${label} (${sorted.length})`);
  for (let i = 0; i < sorted.length; i += chunkSize) {
    console.log(`[Headers] ${label} ${i}-${Math.min(i + chunkSize, sorted.length) - 1}: ${sorted
      .slice(i, i + chunkSize)
      .join(", ")}`);
  }
}

type ColumnMatch = { key: string | null; values: number[] };

function findColumnMeta(csvData: Record<string, number[]>, ...patterns: string[]): ColumnMatch {
  // Exact match first
  for (const pattern of patterns) {
    if (csvData[pattern]) return { key: pattern, values: csvData[pattern] };
  }

  // Partial match
  const keys = Object.keys(csvData);
  for (const pattern of patterns) {
    const match = keys.find((k) => k.includes(pattern));
    if (match) return { key: match, values: csvData[match] };
  }

  return { key: null, values: [] };
}

function logColumnMatch(label: string, match: ColumnMatch): void {
  const nonZero = match.values.filter((v) => Math.abs(v) > 1e-9).length;
  console.log(
    `[Match] ${label}: key=${match.key ?? "NONE"}, len=${match.values.length}, nonZero=${nonZero}, sample=[${formatSample(
      match.values,
      5,
    )}]`,
  );
}

// 20-80 scale conversion per documentation
function to2080Scale(value: number, min: number, max: number, inverted = false): number {
  let normalized = (value - min) / (max - min);
  if (inverted) normalized = 1 - normalized;
  normalized = Math.max(0, Math.min(1, normalized)); // clamp 0-1
  return Math.round(20 + normalized * 60); // returns 20-80
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

// Stats helpers
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
  const s = Math.max(0, start);
  const e = Math.min(values.length - 1, end);
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

// Find column by trying multiple patterns
function findColumn(csvData: Record<string, number[]>, ...patterns: string[]): number[] {
  return findColumnMeta(csvData, ...patterns).values;
}

// Detect frame rate from timestamp column
function detectFrameRate(csvData: Record<string, number[]>): number {
  const timestamps = csvData["timestamp"] || csvData["time"] || csvData["t"] || [];
  if (timestamps.length >= 2) {
    const dt = timestamps[1] - timestamps[0];
    if (dt > 0 && dt < 1) {
      return 1 / dt;
    }
  }
  return 240; // Default Reboot fps
}

// Check if values are in radians and convert to degrees
function maybeRadiansToDegrees(values: number[]): number[] {
  if (!values?.length) return [];
  const maxAbs = Math.max(...values.map(Math.abs));
  // If peak is "small" (<8), it's likely radians
  if (maxAbs > 0 && maxAbs < 8) {
    return values.map((v) => (v || 0) * DEG);
  }
  return values;
}

// Calculate derivative (velocity from position)
function derivative(values: number[], dt: number): number[] {
  const result: number[] = [];
  for (let i = 1; i < values.length; i++) {
    result.push((values[i] - values[i - 1]) / dt);
  }
  return result;
}

// Detect contact frame per documentation priority
function detectContactFrame(
  meCsv: Record<string, number[]>,
  ikCsv: Record<string, number[]>
): { contactFrame: number; strideFrame: number; confidence: string } {
  const frameCount =
    meCsv["rel_frame"]?.length ||
    ikCsv["rel_frame"]?.length ||
    meCsv["frame"]?.length ||
    ikCsv["frame"]?.length ||
    meCsv["index"]?.length ||
    ikCsv["index"]?.length ||
    100;

  console.log(
    `[Contact] frameCount=${frameCount} (me rel_frame=${meCsv["rel_frame"]?.length ?? 0}, ik rel_frame=${ikCsv["rel_frame"]?.length ?? 0}, me index=${meCsv["index"]?.length ?? 0}, ik index=${ikCsv["index"]?.length ?? 0})`,
  );

  // 1) Try contact_frame column if exists
  if (meCsv["contact_frame"]?.length) {
    const cf = meCsv["contact_frame"][0];
    console.log(`[Contact] contact_frame sample=${formatSample(meCsv["contact_frame"], 5)}`);
    if (cf > 0) {
      console.log(`[Contact] Using contact_frame column: ${cf}`);
      return { contactFrame: cf, strideFrame: Math.floor(cf * 0.3), confidence: "high" };
    }
  }

  // 2) Try bat kinetic energy peak
  const batKEMatch = findColumnMeta(meCsv, "bat_kinetic_energy", "bat_ke");
  logColumnMatch("contact.bat_kinetic_energy", batKEMatch);
  if (batKEMatch.values.length > 0) {
    const peakFrame = findPeakFrame(batKEMatch.values);
    console.log(`[Contact] bat_ke peakFrame=${peakFrame}, peakValue=${(batKEMatch.values[peakFrame] || 0).toFixed(3)}`);
    if (peakFrame > frameCount * 0.2) {
      const strideFrame = Math.floor(peakFrame * 0.4);
      console.log(`[Contact] Using bat_ke peak: frame ${peakFrame}`);
      return { contactFrame: peakFrame, strideFrame, confidence: "high" };
    }
  }

  // 3) Try total kinetic energy peak
  const totalKEMatch = findColumnMeta(meCsv, "total_kinetic_energy", "total_ke");
  logColumnMatch("contact.total_kinetic_energy", totalKEMatch);
  if (totalKEMatch.values.length > 0) {
    const peakFrame = findPeakFrame(totalKEMatch.values);
    console.log(`[Contact] total_ke peakFrame=${peakFrame}, peakValue=${(totalKEMatch.values[peakFrame] || 0).toFixed(3)}`);
    if (peakFrame > frameCount * 0.2) {
      const strideFrame = Math.floor(peakFrame * 0.4);
      console.log(`[Contact] Using total_ke peak: frame ${peakFrame}`);
      return { contactFrame: peakFrame, strideFrame, confidence: "medium" };
    }
  }

  // 4) Fallback: 80% of frames
  const contactFrame = Math.floor(frameCount * 0.8);
  const strideFrame = Math.floor(frameCount * 0.3);
  console.log(`[Contact] Using fallback: contact=${contactFrame}, stride=${strideFrame}`);
  return { contactFrame, strideFrame, confidence: "low" };
}

// SCORING THRESHOLDS per documentation
const THRESHOLDS = {
  // From IK - calculated velocities (deg/s)
  pelvis_velocity: { min: 400, max: 900 },
  torso_velocity: { min: 400, max: 900 },
  x_factor: { min: 10, max: 45 },
  stretch_rate: { min: 400, max: 1200 },
  // From ME - kinetic energy (Joules)
  bat_ke: { min: 100, max: 600 },
  legs_ke: { min: 100, max: 500 },
  // Efficiency (%)
  transfer_efficiency: { min: 25, max: 65 },
  // Consistency (lower is better)
  consistency_cv: { min: 5, max: 40 },
};

// Calculate 4B scores for a SINGLE swing (not multi-swing CSV)
function calculate4BScoresForSwing(
  ikData: Record<string, number[]>, 
  meData: Record<string, number[]>,
  swingId: string
): FourBScores | null {
  const frameCount = ikData["rel_frame"]?.length || meData["rel_frame"]?.length || 
                    ikData["frame"]?.length || meData["frame"]?.length || 
                    ikData["index"]?.length || meData["index"]?.length || 0;
  
  if (frameCount < 10) {
    console.log(`[Scoring] Swing ${swingId}: Skipping - only ${frameCount} frames`);
    return null;
  }
  
  // Detect frame rate from timestamps within this swing
  const timestamps = ikData["timestamp"] || ikData["time"] || ikData["t"] || [];
  let fps = 240;
  if (timestamps.length >= 2) {
    const dt = timestamps[1] - timestamps[0];
    if (dt > 0 && dt < 1) {
      fps = 1 / dt;
    }
  }
  const dt = 1 / fps;

  console.log(`[Scoring] Swing ${swingId}: ${frameCount} frames at ${fps.toFixed(0)} fps`);

  // Simple contact/stride detection for single swing
  const contactFrame = Math.floor(frameCount * 0.85);
  const strideFrame = Math.floor(frameCount * 0.25);

  // ===== MOMENTUM DATA (from ME CSV) =====
  const pelvisMomentum = findColumn(meData, "lowertorso_angular_momentum_z", "pelvis_angular_momentum_z");
  const torsoMomentum = findColumn(meData, "torso_angular_momentum_z");
  const armsMomentum = findColumn(meData, "arms_angular_momentum_z", "larm_angular_momentum_z");

  const pelvisMomentumPeak = getPeakAbsInWindow(pelvisMomentum, strideFrame, contactFrame);
  const torsoMomentumPeak = getPeakAbsInWindow(torsoMomentum, strideFrame, contactFrame);
  const armsMomentumPeak = getPeakAbsInWindow(armsMomentum, strideFrame, contactFrame);

  const tpRatio = pelvisMomentumPeak > 0.01 ? torsoMomentumPeak / pelvisMomentumPeak : 0;
  const atRatio = torsoMomentumPeak > 0.01 ? armsMomentumPeak / torsoMomentumPeak : 0;

  // ===== KINETIC ENERGY DATA (from ME CSV) =====
  const batKE = findColumn(meData, "bat_kinetic_energy", "bat_ke");
  const totalKE = findColumn(meData, "total_kinetic_energy", "total_ke");
  
  let legsKE = findColumn(meData, "legs_kinetic_energy", "legs_ke");
  if (legsKE.length === 0) {
    const llegKE = findColumn(meData, "lleg_kinetic_energy");
    const rlegKE = findColumn(meData, "rleg_kinetic_energy");
    if (llegKE.length > 0 && rlegKE.length > 0) {
      legsKE = llegKE.map((v, i) => v + (rlegKE[i] || 0));
    }
  }

  const batKEMax = getPeakAbsInWindow(batKE, strideFrame, contactFrame);
  const totalKEMax = Math.max(getPeakAbsInWindow(totalKE, strideFrame, contactFrame), 1);
  const legsKEMax = getPeakAbsInWindow(legsKE, strideFrame, contactFrame);
  const transferEfficiency = totalKEMax > 1 ? (batKEMax / totalKEMax) * 100 : 0;

  // ===== VELOCITY DATA (from IK CSV - derivative of angles) =====
  const pelvisRotRaw = findColumn(ikData, "pelvis_rot", "pelvisrot", "pelvis_rotation");
  const torsoRotRaw = findColumn(ikData, "torso_rot", "torsorot", "torso_rotation");
  
  // Convert radians to degrees if needed
  const pelvisRotDeg = maybeRadiansToDegrees(pelvisRotRaw);
  const torsoRotDeg = maybeRadiansToDegrees(torsoRotRaw);

  // Calculate velocities (derivative of angles) - THIS IS NOW SAFE since we're per-swing
  const pelvisVelocities = derivative(pelvisRotDeg, dt);
  const torsoVelocities = derivative(torsoRotDeg, dt);
  
  // Filter out noise spikes (values > 3000 deg/s are likely bad data)
  const pelvisVelFiltered = pelvisVelocities.map(v => Math.abs(v) < 3000 ? v : 0);
  const torsoVelFiltered = torsoVelocities.map(v => Math.abs(v) < 3000 ? v : 0);
  
  const pelvisPeakVel = getPeakAbsInWindow(pelvisVelFiltered, strideFrame, contactFrame);
  const torsoPeakVel = getPeakAbsInWindow(torsoVelFiltered, strideFrame, contactFrame);
  
  // ===== X-FACTOR (separation) =====
  const xFactors: number[] = [];
  for (let i = 0; i < Math.min(pelvisRotDeg.length, torsoRotDeg.length); i++) {
    xFactors.push(Math.abs(torsoRotDeg[i] - pelvisRotDeg[i]));
  }
  const xFactorMax = getPeakAbsInWindow(xFactors, strideFrame, contactFrame);
  
  // Stretch rate = derivative of x-factor (also per-swing safe)
  const xFactorVelocities = derivative(xFactors, dt);
  const xFactorVelFiltered = xFactorVelocities.map(v => Math.abs(v) < 5000 ? v : 0);
  const stretchRate = getPeakAbsInWindow(xFactorVelFiltered, strideFrame, contactFrame);
  
  console.log(`[Scoring] Swing ${swingId}: Pelvis=${pelvisPeakVel.toFixed(0)}°/s, Torso=${torsoPeakVel.toFixed(0)}°/s, X-Factor=${xFactorMax.toFixed(1)}°, BatKE=${batKEMax.toFixed(1)}J`);
  
  // ===== CALCULATE COMPONENT SCORES =====
  const pelvisVelScore = to2080Scale(pelvisPeakVel, THRESHOLDS.pelvis_velocity.min, THRESHOLDS.pelvis_velocity.max);
  const legsKEScore = to2080Scale(legsKEMax, THRESHOLDS.legs_ke.min, THRESHOLDS.legs_ke.max);
  const groundFlowScore = Math.round((pelvisVelScore + legsKEScore) / 2);
  
  const torsoVelScore = to2080Scale(torsoPeakVel, THRESHOLDS.torso_velocity.min, THRESHOLDS.torso_velocity.max);
  const xFactorScore = to2080Scale(xFactorMax, THRESHOLDS.x_factor.min, THRESHOLDS.x_factor.max);
  const stretchRateScore = to2080Scale(stretchRate, THRESHOLDS.stretch_rate.min, THRESHOLDS.stretch_rate.max);
  const coreFlowScore = Math.round((torsoVelScore + xFactorScore + stretchRateScore) / 3);
  
  // BAT score - handle missing bat data
  let upperFlowScore: number;
  if (batKEMax > 1) {
    const batKEScore = to2080Scale(batKEMax, THRESHOLDS.bat_ke.min, THRESHOLDS.bat_ke.max);
    const efficiencyScore = to2080Scale(transferEfficiency, THRESHOLDS.transfer_efficiency.min, THRESHOLDS.transfer_efficiency.max);
    upperFlowScore = Math.round((batKEScore + efficiencyScore) / 2);
  } else {
    // No bat data - estimate from body metrics (fallback)
    console.log(`[Scoring] Swing ${swingId}: No bat KE data - using fallback scoring`);
    upperFlowScore = Math.round((groundFlowScore + coreFlowScore) / 2 * 0.9); // 10% penalty
  }
  
  // Consistency CV for this single swing
  const windowPelvisVel = pelvisVelFiltered.slice(strideFrame, contactFrame).filter(v => Math.abs(v) > 10);
  const windowTorsoVel = torsoVelFiltered.slice(strideFrame, contactFrame).filter(v => Math.abs(v) > 10);
  const pelvisCV = windowPelvisVel.length > 2 ? coefficientOfVariation(windowPelvisVel) : 20;
  const torsoCV = windowTorsoVel.length > 2 ? coefficientOfVariation(windowTorsoVel) : 20;
  const avgCV = (pelvisCV + torsoCV) / 2;
  
  const brainScore = to2080Scale(avgCV, THRESHOLDS.consistency_cv.min, THRESHOLDS.consistency_cv.max, true);
  const bodyScore = Math.round(groundFlowScore * 0.4 + coreFlowScore * 0.6);
  const batScore = upperFlowScore;
  const ballScore = batKEMax > 1 
    ? to2080Scale(transferEfficiency, THRESHOLDS.transfer_efficiency.min, THRESHOLDS.transfer_efficiency.max)
    : Math.round(upperFlowScore * 0.85); // Fallback when no bat data
  
  const compositeScore = Math.round(
    bodyScore * 0.35 + batScore * 0.30 + brainScore * 0.20 + ballScore * 0.15
  );
  
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
    pelvis_velocity: Math.min(Math.round(pelvisPeakVel), 2000),
    torso_velocity: Math.min(Math.round(torsoPeakVel), 2000),
    x_factor: Math.min(Math.round(xFactorMax * 10) / 10, 90),
    bat_ke: Math.min(Math.round(batKEMax), 1000),
    transfer_efficiency: Math.min(Math.round(transferEfficiency * 10) / 10, 100),
    consistency_cv: Math.min(Math.round(avgCV * 10) / 10, 100),
    consistency_grade: getConsistencyGrade(avgCV),
    pelvis_momentum: Math.round(pelvisMomentumPeak * 100) / 100,
    torso_momentum: Math.round(torsoMomentumPeak * 100) / 100,
    arms_momentum: Math.round(armsMomentumPeak * 100) / 100,
    tp_ratio: Math.round(tpRatio * 100) / 100,
    at_ratio: Math.round(atRatio * 100) / 100,
    legs_ke: Math.min(Math.round(legsKEMax), 1000),
    stretch_rate: Math.min(Math.round(stretchRate), 2000),
  };
}

// Main 4B scoring - handles multi-swing CSVs by processing each swing separately
function calculate4BScores(
  ikCsv: Record<string, number[]>, 
  meCsv: Record<string, number[]>,
  ikSwings: SwingData[],
  meSwings: SwingData[]
): FourBScores {
  const ikKeys = Object.keys(ikCsv);
  const meKeys = Object.keys(meCsv);
  logAllKeys("IK", ikKeys);
  logAllKeys("ME", meKeys);

  // If we have per-swing data, process each swing separately
  if (ikSwings.length > 1 || meSwings.length > 1) {
    console.log(`[Scoring] Processing ${Math.max(ikSwings.length, meSwings.length)} swings separately`);
    
    // Match swings by movement ID
    const swingScores: FourBScores[] = [];
    
    // Use IK swings as primary (they should match ME swings)
    for (const ikSwing of ikSwings) {
      // Find matching ME swing
      const meSwing = meSwings.find(s => s.movementId === ikSwing.movementId) || meSwings[0];
      
      const scores = calculate4BScoresForSwing(
        ikSwing.data, 
        meSwing?.data || meCsv,
        ikSwing.movementId.slice(-8)
      );
      
      if (scores) {
        swingScores.push(scores);
      }
    }

    if (swingScores.length === 0) {
      console.log(`[Scoring] No valid swings found, falling back to aggregate`);
      const fallback = calculate4BScoresForSwing(ikCsv, meCsv, "aggregate");
      return fallback || getDefaultScores();
    }

    // Average all swing scores
    console.log(`[Scoring] Averaging ${swingScores.length} swing scores`);
    return averageScores(swingScores);
  }

  // Single swing or no movement ID column - process as-is
  console.log(`[Scoring] Processing as single swing`);
  const scores = calculate4BScoresForSwing(ikCsv, meCsv, "single");
  return scores || getDefaultScores();
}

// Average multiple swing scores
function averageScores(scores: FourBScores[]): FourBScores {
  if (scores.length === 0) return getDefaultScores();
  if (scores.length === 1) return scores[0];

  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const avgDec = (arr: number[], dec = 1) => {
    const factor = Math.pow(10, dec);
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * factor) / factor;
  };

  const brainScore = avg(scores.map(s => s.brain_score));
  const bodyScore = avg(scores.map(s => s.body_score));
  const batScore = avg(scores.map(s => s.bat_score));
  const ballScore = avg(scores.map(s => s.ball_score));
  const compositeScore = Math.round(bodyScore * 0.35 + batScore * 0.30 + brainScore * 0.20 + ballScore * 0.15);

  const allScores = { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore };
  const weakestLink = Object.entries(allScores).reduce((a, b) => (a[1] < b[1] ? a : b))[0];

  console.log(`[Scoring] FINAL AVERAGED: Brain=${brainScore}, Body=${bodyScore}, Bat=${batScore}, Ball=${ballScore}, Composite=${compositeScore}`);

  return {
    brain_score: brainScore,
    body_score: bodyScore,
    bat_score: batScore,
    ball_score: ballScore,
    composite_score: compositeScore,
    grade: getGrade(compositeScore),
    ground_flow_score: avg(scores.map(s => s.ground_flow_score)),
    core_flow_score: avg(scores.map(s => s.core_flow_score)),
    upper_flow_score: avg(scores.map(s => s.upper_flow_score)),
    weakest_link: weakestLink,
    pelvis_velocity: avg(scores.map(s => s.pelvis_velocity)),
    torso_velocity: avg(scores.map(s => s.torso_velocity)),
    x_factor: avgDec(scores.map(s => s.x_factor)),
    bat_ke: avg(scores.map(s => s.bat_ke)),
    transfer_efficiency: avgDec(scores.map(s => s.transfer_efficiency)),
    consistency_cv: avgDec(scores.map(s => s.consistency_cv)),
    consistency_grade: getConsistencyGrade(avgDec(scores.map(s => s.consistency_cv))),
    pelvis_momentum: avgDec(scores.map(s => s.pelvis_momentum), 2),
    torso_momentum: avgDec(scores.map(s => s.torso_momentum), 2),
    arms_momentum: avgDec(scores.map(s => s.arms_momentum), 2),
    tp_ratio: avgDec(scores.map(s => s.tp_ratio), 2),
    at_ratio: avgDec(scores.map(s => s.at_ratio), 2),
    legs_ke: avg(scores.map(s => s.legs_ke)),
    stretch_rate: avg(scores.map(s => s.stretch_rate)),
  };
}

function getDefaultScores(): FourBScores {
  return {
    brain_score: 50, body_score: 50, bat_score: 50, ball_score: 50,
    composite_score: 50, grade: "Average",
    ground_flow_score: 50, core_flow_score: 50, upper_flow_score: 50,
    weakest_link: "body",
    pelvis_velocity: 0, torso_velocity: 0, x_factor: 0, bat_ke: 0,
    transfer_efficiency: 0, consistency_cv: 20, consistency_grade: "Average",
    pelvis_momentum: 0, torso_momentum: 0, arms_momentum: 0,
    tp_ratio: 0, at_ratio: 0, legs_ke: 0, stretch_rate: 0,
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

    const ikUrl = await getRebootExportUrl(session_id, org_player_id, "inverse-kinematics");
    const meUrl = await getRebootExportUrl(session_id, org_player_id, "momentum-energy");

    const [ikCsvText, meCsvText] = await Promise.all([
      downloadCsv(ikUrl),
      downloadCsv(meUrl),
    ]);

    // Parse CSV with per-swing grouping to avoid cross-swing derivative spikes
    const { allData: ikData, swings: ikSwings } = parseCsvBySwing(ikCsvText);
    const { allData: meData, swings: meSwings } = parseCsvBySwing(meCsvText);

    const scores = calculate4BScores(ikData, meData, ikSwings, meSwings);

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
      const uploadData = {
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
        reboot_session_id: session_id,
      };

      if (upload_id) {
        // Update existing upload record
        const { error } = await supabase
          .from("reboot_uploads")
          .update(uploadData)
          .eq("id", upload_id);

        if (error) {
          console.error("Error updating reboot_uploads:", error);
        } else {
          console.log(`[Process] Updated reboot_uploads ${upload_id}`);
        }
      } else {
        // Create new upload record for API import
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
        } else {
          console.log(`[Process] Created reboot_uploads for session ${session_id}`);
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
