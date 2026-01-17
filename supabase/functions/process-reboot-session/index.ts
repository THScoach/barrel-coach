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

// Main 4B scoring calculation per BARREL_COACH_SCORING_LOGIC_DOCUMENTATION
function calculate4BScores(
  ikCsv: Record<string, number[]>, 
  meCsv: Record<string, number[]>
): FourBScores {
  const frameCount =
    ikCsv["rel_frame"]?.length ||
    meCsv["rel_frame"]?.length ||
    ikCsv["frame"]?.length ||
    meCsv["frame"]?.length ||
    ikCsv["index"]?.length ||
    meCsv["index"]?.length ||
    100;
  const fps = detectFrameRate(ikCsv);
  const dt = 1 / fps;

  console.log(
    `[Scoring] ${frameCount} frames at ${fps.toFixed(0)} fps, dt=${(dt * 1000).toFixed(2)}ms (ik time len=${ikCsv["time"]?.length ?? 0}, ik timestamp len=${ikCsv["timestamp"]?.length ?? 0})`,
  );

  const ikKeys = Object.keys(ikCsv);
  const meKeys = Object.keys(meCsv);
  logAllKeys("IK", ikKeys);
  logAllKeys("ME", meKeys);

  // Detect swing window (stride → contact)
  const { contactFrame, strideFrame, confidence } = detectContactFrame(meCsv, ikCsv);
  console.log(`[Scoring] Swing window: frames ${strideFrame}-${contactFrame} (confidence: ${confidence})`);

  // ===== MOMENTUM DATA (from ME CSV) =====
  // Per docs: lowertorso_angular_momentum_z, torso_angular_momentum_z, arms_angular_momentum_z
  const pelvisMomentumMatch = findColumnMeta(
    meCsv,
    "lowertorso_angular_momentum_z",
    "pelvis_angular_momentum_z",
    "lowertorso_angmom_z",
  );
  const torsoMomentumMatch = findColumnMeta(meCsv, "torso_angular_momentum_z", "torso_angmom_z");
  const armsMomentumMatch = findColumnMeta(meCsv, "arms_angular_momentum_z", "arms_angmom_z", "larm_angular_momentum_z");

  logColumnMatch("me.pelvis_momentum", pelvisMomentumMatch);
  logColumnMatch("me.torso_momentum", torsoMomentumMatch);
  logColumnMatch("me.arms_momentum", armsMomentumMatch);

  const pelvisMomentum = pelvisMomentumMatch.values;
  const torsoMomentum = torsoMomentumMatch.values;
  const armsMomentum = armsMomentumMatch.values;
  
  const pelvisMomentumPeak = getPeakAbsInWindow(pelvisMomentum, strideFrame, contactFrame);
  const torsoMomentumPeak = getPeakAbsInWindow(torsoMomentum, strideFrame, contactFrame);
  const armsMomentumPeak = getPeakAbsInWindow(armsMomentum, strideFrame, contactFrame);
  
  console.log(`[Scoring] Momentum peaks - Pelvis: ${pelvisMomentumPeak.toFixed(2)}, Torso: ${torsoMomentumPeak.toFixed(2)}, Arms: ${armsMomentumPeak.toFixed(2)} kg·m²/s`);
  
  // Calculate momentum ratios per documentation
  const tpRatio = pelvisMomentumPeak > 0.01 ? torsoMomentumPeak / pelvisMomentumPeak : 0;
  const atRatio = torsoMomentumPeak > 0.01 ? armsMomentumPeak / torsoMomentumPeak : 0;
  
  console.log(`[Scoring] Momentum ratios - T/P: ${tpRatio.toFixed(2)}, A/T: ${atRatio.toFixed(2)}`);
  
  // ===== KINETIC ENERGY DATA (from ME CSV) =====
  const batKEMatch = findColumnMeta(meCsv, "bat_kinetic_energy", "bat_ke");
  const totalKEMatch = findColumnMeta(meCsv, "total_kinetic_energy", "total_ke");
  logColumnMatch("me.bat_kinetic_energy", batKEMatch);
  logColumnMatch("me.total_kinetic_energy", totalKEMatch);

  const batKE = batKEMatch.values;
  const totalKE = totalKEMatch.values;

  // Legs KE: sum of left and right leg if separate columns exist
  let legsKE: number[] = [];
  const legsKEMatch = findColumnMeta(meCsv, "legs_kinetic_energy", "legs_ke");
  logColumnMatch("me.legs_kinetic_energy", legsKEMatch);
  legsKE = legsKEMatch.values;

  if (legsKE.length === 0) {
    const llegKEMatch = findColumnMeta(meCsv, "lleg_kinetic_energy", "lleg_ke");
    const rlegKEMatch = findColumnMeta(meCsv, "rleg_kinetic_energy", "rleg_ke");
    logColumnMatch("me.lleg_kinetic_energy", llegKEMatch);
    logColumnMatch("me.rleg_kinetic_energy", rlegKEMatch);

    if (llegKEMatch.values.length > 0 && rlegKEMatch.values.length > 0) {
      legsKE = llegKEMatch.values.map((v, i) => v + (rlegKEMatch.values[i] || 0));
      console.log(`[Match] me.legs_ke_summed: len=${legsKE.length}, sample=[${formatSample(legsKE, 5)}]`);
    }
  }

  const batKEMax = getPeakAbsInWindow(batKE, strideFrame, contactFrame);
  const totalKEMax = Math.max(getPeakAbsInWindow(totalKE, strideFrame, contactFrame), 1);
  const legsKEMax = getPeakAbsInWindow(legsKE, strideFrame, contactFrame);

  // Transfer efficiency per docs: (bat_ke / total_ke) * 100
  const transferEfficiency = totalKEMax > 1 ? (batKEMax / totalKEMax) * 100 : 0;

  console.log(`[Scoring] KE peaks - Bat: ${batKEMax.toFixed(1)}J, Total: ${totalKEMax.toFixed(1)}J, Legs: ${legsKEMax.toFixed(1)}J`);
  console.log(`[Scoring] Transfer efficiency: ${transferEfficiency.toFixed(1)}%`);

  // ===== VELOCITY DATA (from IK CSV - derivative of angles) =====
  const pelvisRotMatch = findColumnMeta(ikCsv, "pelvis_rot", "pelvisrot", "pelvis_rotation");
  const torsoRotMatch = findColumnMeta(ikCsv, "torso_rot", "torsorot", "torso_rotation");
  logColumnMatch("ik.pelvis_rot", pelvisRotMatch);
  logColumnMatch("ik.torso_rot", torsoRotMatch);

  const pelvisRotRaw = pelvisRotMatch.values;
  const torsoRotRaw = torsoRotMatch.values;
  
  // Convert radians to degrees if needed
  const pelvisRotDeg = maybeRadiansToDegrees(pelvisRotRaw);
  const torsoRotDeg = maybeRadiansToDegrees(torsoRotRaw);

  const pelvisRawMaxAbs = pelvisRotRaw.length ? Math.max(...pelvisRotRaw.map((v) => Math.abs(v))) : 0;
  const torsoRawMaxAbs = torsoRotRaw.length ? Math.max(...torsoRotRaw.map((v) => Math.abs(v))) : 0;
  const pelvisDegMaxAbs = pelvisRotDeg.length ? Math.max(...pelvisRotDeg.map((v) => Math.abs(v))) : 0;
  const torsoDegMaxAbs = torsoRotDeg.length ? Math.max(...torsoRotDeg.map((v) => Math.abs(v))) : 0;
  console.log(
    `[Scoring] IK angle maxAbs raw pelvis=${pelvisRawMaxAbs.toFixed(4)}, torso=${torsoRawMaxAbs.toFixed(4)} | deg pelvis=${pelvisDegMaxAbs.toFixed(2)}, torso=${torsoDegMaxAbs.toFixed(2)}`,
  );
  console.log(`[Scoring] IK angle samples pelvisDeg=[${formatSample(pelvisRotDeg, 5)}], torsoDeg=[${formatSample(torsoRotDeg, 5)}]`);

  // Calculate velocities (derivative of angles) per docs
  const pelvisVelocities = derivative(pelvisRotDeg, dt);
  const torsoVelocities = derivative(torsoRotDeg, dt);
  
  // Get peak velocities within swing window
  const pelvisPeakVel = getPeakAbsInWindow(pelvisVelocities, strideFrame, contactFrame);
  const torsoPeakVel = getPeakAbsInWindow(torsoVelocities, strideFrame, contactFrame);
  
  console.log(`[Scoring] Velocities - Pelvis: ${pelvisPeakVel.toFixed(1)}°/s, Torso: ${torsoPeakVel.toFixed(1)}°/s`);
  
  // ===== X-FACTOR (separation) =====
  // Per docs: x_factor = max(abs(torso_rot - pelvis_rot))
  const xFactors: number[] = [];
  for (let i = 0; i < Math.min(pelvisRotDeg.length, torsoRotDeg.length); i++) {
    xFactors.push(Math.abs(torsoRotDeg[i] - pelvisRotDeg[i]));
  }
  const xFactorMax = getPeakAbsInWindow(xFactors, strideFrame, contactFrame);
  
  // Stretch rate = derivative of x-factor
  const xFactorVelocities = derivative(xFactors, dt);
  const stretchRate = getPeakAbsInWindow(xFactorVelocities, strideFrame, contactFrame);
  
  console.log(`[Scoring] X-Factor: ${xFactorMax.toFixed(1)}°, Stretch rate: ${stretchRate.toFixed(1)}°/s`);
  
  // ===== CALCULATE COMPONENT SCORES =====
  
  // GROUND FLOW: Pelvis velocity + Legs KE
  const pelvisVelScore = to2080Scale(pelvisPeakVel, THRESHOLDS.pelvis_velocity.min, THRESHOLDS.pelvis_velocity.max);
  const legsKEScore = to2080Scale(legsKEMax, THRESHOLDS.legs_ke.min, THRESHOLDS.legs_ke.max);
  const groundFlowScore = Math.round((pelvisVelScore + legsKEScore) / 2);
  
  // CORE FLOW: Torso velocity + X-Factor + Stretch rate
  const torsoVelScore = to2080Scale(torsoPeakVel, THRESHOLDS.torso_velocity.min, THRESHOLDS.torso_velocity.max);
  const xFactorScore = to2080Scale(xFactorMax, THRESHOLDS.x_factor.min, THRESHOLDS.x_factor.max);
  const stretchRateScore = to2080Scale(stretchRate, THRESHOLDS.stretch_rate.min, THRESHOLDS.stretch_rate.max);
  const coreFlowScore = Math.round((torsoVelScore + xFactorScore + stretchRateScore) / 3);
  
  // UPPER FLOW (BAT): Bat KE + Transfer efficiency
  const batKEScore = to2080Scale(batKEMax, THRESHOLDS.bat_ke.min, THRESHOLDS.bat_ke.max);
  const efficiencyScore = to2080Scale(transferEfficiency, THRESHOLDS.transfer_efficiency.min, THRESHOLDS.transfer_efficiency.max);
  const upperFlowScore = Math.round((batKEScore + efficiencyScore) / 2);
  
  console.log(`[Scoring] Flow scores - Ground: ${groundFlowScore}, Core: ${coreFlowScore}, Upper: ${upperFlowScore}`);
  
  // ===== CONSISTENCY (BRAIN) =====
  // Per docs: CV = (StdDev / Mean) × 100, lower is better
  const windowPelvisVel = pelvisVelocities.slice(strideFrame, contactFrame).filter(v => Math.abs(v) > 10 && Math.abs(v) < 2000);
  const windowTorsoVel = torsoVelocities.slice(strideFrame, contactFrame).filter(v => Math.abs(v) > 10 && Math.abs(v) < 2000);
  
  const pelvisCV = windowPelvisVel.length > 2 ? coefficientOfVariation(windowPelvisVel) : 20;
  const torsoCV = windowTorsoVel.length > 2 ? coefficientOfVariation(windowTorsoVel) : 20;
  const avgCV = (pelvisCV + torsoCV) / 2;
  
  console.log(`[Scoring] Consistency CV: Pelvis=${pelvisCV.toFixed(1)}%, Torso=${torsoCV.toFixed(1)}%, Avg=${avgCV.toFixed(1)}%`);
  
  // BRAIN = consistency score (inverted - lower CV = higher score)
  const brainScore = to2080Scale(avgCV, THRESHOLDS.consistency_cv.min, THRESHOLDS.consistency_cv.max, true);
  const consistencyGrade = getConsistencyGrade(avgCV);
  
  // BODY = (Ground Flow × 0.4) + (Core Flow × 0.6)
  const bodyScore = Math.round(groundFlowScore * 0.4 + coreFlowScore * 0.6);
  
  // BAT = Upper Flow
  const batScore = upperFlowScore;
  
  // BALL = based on transfer efficiency (output quality)
  const ballScore = to2080Scale(transferEfficiency, THRESHOLDS.transfer_efficiency.min, THRESHOLDS.transfer_efficiency.max);
  
  // COMPOSITE = (Body × 0.35) + (Bat × 0.30) + (Brain × 0.20) + (Ball × 0.15)
  const compositeScore = Math.round(
    bodyScore * 0.35 +
    batScore * 0.30 +
    brainScore * 0.20 +
    ballScore * 0.15
  );
  
  const scores = { brain: brainScore, body: bodyScore, bat: batScore, ball: ballScore };
  const weakestLink = Object.entries(scores).reduce((a, b) => (a[1] < b[1] ? a : b))[0];
  
  console.log(`[Scoring] FINAL: Brain=${brainScore}, Body=${bodyScore}, Bat=${batScore}, Ball=${ballScore}, Composite=${compositeScore} (${getGrade(compositeScore)})`);
  
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
    // Raw metrics (capped to prevent DB overflow)
    pelvis_velocity: Math.min(Math.round(pelvisPeakVel), 2000),
    torso_velocity: Math.min(Math.round(torsoPeakVel), 2000),
    x_factor: Math.min(Math.round(xFactorMax * 10) / 10, 180),
    bat_ke: Math.min(Math.round(batKEMax), 1000),
    transfer_efficiency: Math.min(Math.round(transferEfficiency * 10) / 10, 100),
    consistency_cv: Math.min(Math.round(avgCV * 10) / 10, 100),
    consistency_grade: consistencyGrade,
    // Additional metrics
    pelvis_momentum: Math.round(pelvisMomentumPeak * 100) / 100,
    torso_momentum: Math.round(torsoMomentumPeak * 100) / 100,
    arms_momentum: Math.round(armsMomentumPeak * 100) / 100,
    tp_ratio: Math.round(tpRatio * 100) / 100,
    at_ratio: Math.round(atRatio * 100) / 100,
    legs_ke: Math.min(Math.round(legsKEMax), 1000),
    stretch_rate: Math.min(Math.round(stretchRate), 2000),
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
