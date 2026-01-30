/**
 * Twilio Webhook Handler - Admin Mode Enabled
 * 
 * Receives inbound SMS and WhatsApp messages from players and admins:
 * 1. Handles opt-out/opt-in keywords (STOP/START)
 * 2. Detects admin commands for memory management
 * 3. Logs messages to database
 * 4. Triggers AI-powered Coach Rick responses with full context
 * 
 * WhatsApp messages use format: whatsapp:+1234567890
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Admin phone numbers with special powers
const ADMIN_PHONES = ["+13148338250", "+13143868232"];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if the number is a WhatsApp number (prefixed with "whatsapp:")
 */
function isWhatsAppNumber(phone: string): boolean {
  return phone.toLowerCase().startsWith("whatsapp:");
}

/**
 * Extract the raw phone number from WhatsApp format
 * "whatsapp:+1234567890" -> "+1234567890"
 */
function extractPhoneFromWhatsApp(phone: string): string {
  if (isWhatsAppNumber(phone)) {
    return phone.substring(9); // Remove "whatsapp:" prefix
  }
  return phone;
}

/**
 * Normalize phone number to E.164 format
 * Handles both SMS and WhatsApp formats
 */
function normalizePhone(phone: string): string {
  // First extract phone from WhatsApp format if needed
  const rawPhone = extractPhoneFromWhatsApp(phone);
  
  let normalized = rawPhone.replace(/\D/g, "");
  if (normalized.length === 10) {
    normalized = "+1" + normalized;
  } else if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

function isAdmin(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return ADMIN_PHONES.some(admin => normalizePhone(admin) === normalized);
}

function isOptOut(message: string): boolean {
  const optOutKeywords = ["stop", "unsubscribe", "cancel", "quit", "end"];
  return optOutKeywords.includes(message.toLowerCase().trim());
}

function maskPhone(phone: string): string {
  const rawPhone = extractPhoneFromWhatsApp(phone);
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `***-***-${digits.slice(-4)}`;
  }
  return phone;
}

// ============================================================
// ADMIN COMMAND PARSER
// ============================================================

interface AdminCommand {
  type: "remember" | "motor_profile" | "lookup" | "last_messages" | "global_rule" | "status" | "block" | "unblock" | "fetch_sessions" | "video_analysis" | "none";
  playerName?: string;
  note?: string;
  motorProfile?: string;
  query?: string;
  count?: number;
  ruleType?: "always" | "never" | "global";
  ruleText?: string;
  phone?: string;
  videoUrl?: string;
  videoContentType?: string;
}

function parseAdminCommand(message: string, mediaUrl?: string, mediaContentType?: string): AdminCommand {
  const lower = message.toLowerCase().trim();
  
  // Check for MMS video attachment first
  if (mediaUrl && mediaContentType?.startsWith("video/")) {
    return { type: "video_analysis", videoUrl: mediaUrl, videoContentType: mediaContentType };
  }
  
  // Fetch sessions for [player name]
  const fetchMatch = message.match(/^(?:fetch|get|download)\s+(?:sessions?\s+for|reboot\s+(?:data|sessions?)\s+for)\s+(.+)$/i);
  if (fetchMatch) {
    return { type: "fetch_sessions", playerName: fetchMatch[1].trim() };
  }
  
  // Get [player name] Reboot data
  const rebootMatch = message.match(/^get\s+(.+?)\s+reboot\s+(?:data|sessions?)$/i);
  if (rebootMatch) {
    return { type: "fetch_sessions", playerName: rebootMatch[1].trim() };
  }
  
  // Download [player name] sessions
  const downloadMatch = message.match(/^download\s+(.+?)\s+sessions?$/i);
  if (downloadMatch) {
    return { type: "fetch_sessions", playerName: downloadMatch[1].trim() };
  }
  
  // Remember: [player name] [info]
  const rememberMatch = message.match(/^remember:\s*(\w+(?:\s+\w+)?)\s+(.+)$/i);
  if (rememberMatch) {
    return { type: "remember", playerName: rememberMatch[1], note: rememberMatch[2] };
  }
  
  // Note for [player name]: [info]
  const noteMatch = message.match(/^note\s+for\s+(\w+(?:\s+\w+)?):\s*(.+)$/i);
  if (noteMatch) {
    return { type: "remember", playerName: noteMatch[1], note: noteMatch[2] };
  }
  
  // [player name] is a [Motor Profile]
  const motorMatch = message.match(/^(\w+(?:\s+\w+)?)\s+is\s+(?:a|an)\s+(Spinner|Torquer|Puncher|Swinger|Slasher)/i);
  if (motorMatch) {
    return { type: "motor_profile", playerName: motorMatch[1], motorProfile: motorMatch[2] };
  }
  
  // Lookup [phone or name]
  const lookupMatch = message.match(/^lookup\s+(.+)$/i);
  if (lookupMatch) {
    return { type: "lookup", query: lookupMatch[1].trim() };
  }
  
  // Last [N] for [player name]
  const lastMatch = message.match(/^last\s+(\d+)\s+for\s+(\w+(?:\s+\w+)?)$/i);
  if (lastMatch) {
    return { type: "last_messages", count: parseInt(lastMatch[1]), playerName: lastMatch[2] };
  }
  
  // Global: [rule]
  const globalMatch = message.match(/^global:\s*(.+)$/i);
  if (globalMatch) {
    return { type: "global_rule", ruleType: "global", ruleText: globalMatch[1] };
  }
  
  // Always [instruction]
  const alwaysMatch = message.match(/^always\s+(.+)$/i);
  if (alwaysMatch) {
    return { type: "global_rule", ruleType: "always", ruleText: alwaysMatch[1] };
  }
  
  // Never [instruction]
  const neverMatch = message.match(/^never\s+(.+)$/i);
  if (neverMatch) {
    return { type: "global_rule", ruleType: "never", ruleText: neverMatch[1] };
  }
  
  // Status
  if (lower === "status") {
    return { type: "status" };
  }
  
  // Block [phone]
  const blockMatch = message.match(/^block\s+([\d\+\-\s\(\)]+)$/i);
  if (blockMatch) {
    return { type: "block", phone: blockMatch[1] };
  }
  
  // Unblock [phone]
  const unblockMatch = message.match(/^unblock\s+([\d\+\-\s\(\)]+)$/i);
  if (unblockMatch) {
    return { type: "unblock", phone: unblockMatch[1] };
  }
  
  return { type: "none" };
}

// ============================================================
// ADMIN COMMAND HANDLERS
// ============================================================

async function findPlayerByName(supabase: any, name: string): Promise<any | null> {
  const searchName = name.toLowerCase();
  
  // Try exact match first
  const { data: exactMatch } = await supabase
    .from("players")
    .select("*")
    .ilike("name", `%${searchName}%`)
    .limit(1)
    .maybeSingle();
  
  return exactMatch;
}

async function findPlayerByNameOrPhone(supabase: any, query: string): Promise<any | null> {
  // Check if query looks like a phone number
  const digits = query.replace(/\D/g, "");
  if (digits.length >= 7) {
    const { data: playerIdResult } = await supabase.rpc("find_player_by_phone", {
      phone_input: query,
    });
    
    if (playerIdResult) {
      const { data: player } = await supabase
        .from("players")
        .select("*")
        .eq("id", playerIdResult)
        .single();
      return player;
    }
  }
  
  // Otherwise search by name
  return findPlayerByName(supabase, query);
}

async function addCoachingNote(supabase: any, playerId: string, note: string, addedBy: string): Promise<void> {
  const { data: player } = await supabase
    .from("players")
    .select("coaching_notes")
    .eq("id", playerId)
    .single();
  
  const existingNotes = Array.isArray(player?.coaching_notes) ? player.coaching_notes : [];
  
  const newNote = {
    note,
    added_by: addedBy,
    added_at: new Date().toISOString(),
  };
  
  await supabase
    .from("players")
    .update({ coaching_notes: [...existingNotes, newNote] })
    .eq("id", playerId);
}

async function updateMotorProfile(supabase: any, playerId: string, motorProfile: string): Promise<void> {
  await supabase
    .from("players")
    .update({ motor_profile_sensor: motorProfile })
    .eq("id", playerId);
}

async function addGlobalRule(supabase: any, ruleType: string, ruleText: string, createdBy: string): Promise<void> {
  await supabase
    .from("coach_rick_rules")
    .insert({
      rule_type: ruleType,
      rule_text: ruleText,
      created_by: createdBy,
      active: true,
    });
}

async function getSystemStats(supabase: any): Promise<{
  messagesToday: number;
  activePlayersToday: number;
  totalPlayers: number;
  pendingSensors: number;
  globalRulesCount: number;
  blockedCount: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { count: messagesToday } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", today.toISOString());
  
  const { data: activeToday } = await supabase
    .from("messages")
    .select("player_id")
    .gte("created_at", today.toISOString())
    .not("player_id", "is", null);
  
  const uniquePlayers = new Set(activeToday?.map((m: any) => m.player_id) || []);
  
  const { count: totalPlayers } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });
  
  const { count: pendingSensors } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("has_sensor", true)
    .eq("sensor_connected", false);
  
  const { count: globalRulesCount } = await supabase
    .from("coach_rick_rules")
    .select("*", { count: "exact", head: true })
    .eq("active", true);
  
  const { count: blockedCount } = await supabase
    .from("blocked_numbers")
    .select("*", { count: "exact", head: true });
  
  return {
    messagesToday: messagesToday || 0,
    activePlayersToday: uniquePlayers.size,
    totalPlayers: totalPlayers || 0,
    pendingSensors: pendingSensors || 0,
    globalRulesCount: globalRulesCount || 0,
    blockedCount: blockedCount || 0,
  };
}

async function blockNumber(supabase: any, phone: string, blockedBy: string): Promise<void> {
  const normalized = normalizePhone(phone);
  await supabase
    .from("blocked_numbers")
    .upsert({
      phone: normalized,
      blocked_by: blockedBy,
      blocked_at: new Date().toISOString(),
    });
}

async function unblockNumber(supabase: any, phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  const { error } = await supabase
    .from("blocked_numbers")
    .delete()
    .eq("phone", normalized);
  
  return !error;
}

async function isBlocked(supabase: any, phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  const { data } = await supabase
    .from("blocked_numbers")
    .select("phone")
    .eq("phone", normalized)
    .maybeSingle();
  
  return !!data;
}

async function getRecentConversations(supabase: any, playerId: string, count: number): Promise<any[]> {
  const { data } = await supabase
    .from("messages")
    .select("direction, body, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(count);
  
  return data || [];
}

async function getGlobalRules(supabase: any): Promise<string> {
  const { data: rules } = await supabase
    .from("coach_rick_rules")
    .select("rule_type, rule_text")
    .eq("active", true)
    .order("created_at", { ascending: true });
  
  if (!rules || rules.length === 0) return "";
  
  const formattedRules = rules.map((r: any) => {
    if (r.rule_type === "always") return `ALWAYS: ${r.rule_text}`;
    if (r.rule_type === "never") return `NEVER: ${r.rule_text}`;
    return `RULE: ${r.rule_text}`;
  });
  
  return `\n\nCustom Coaching Rules:\n${formattedRules.join("\n")}`;
}

function formatPlayerProfile(player: any): string {
  const firstName = player.name?.split(" ")[0] || "Unknown";
  const profile = player.motor_profile_sensor || "Not assessed";
  
  const scores = {
    brain: player.latest_brain_score ?? "?",
    body: player.latest_body_score ?? "?",
    bat: player.latest_bat_score ?? "?",
    ball: player.latest_ball_score ?? "?",
    composite: player.latest_composite_score ?? "?",
  };
  
  const grade = getGrade(scores.composite as number);
  
  let response = `📊 ${player.name || "Unknown"}\n`;
  response += `Motor: ${profile}\n`;
  response += `Composite: ${scores.composite} (${grade})\n`;
  response += `Brain: ${scores.brain} | Body: ${scores.body} | Bat: ${scores.bat} | Ball: ${scores.ball}\n`;
  
  if (player.membership_tier) {
    response += `Tier: ${player.membership_tier}\n`;
  }
  
  if (player.has_sensor) {
    response += `Sensor: ${player.sensor_connected ? "✅ Connected" : "⏳ Pending"}\n`;
  }
  
  // Add coaching notes preview
  const notes = Array.isArray(player.coaching_notes) ? player.coaching_notes : [];
  if (notes.length > 0) {
    response += `\nNotes:\n`;
    notes.slice(-3).forEach((n: any) => {
      response += `• ${n.note}\n`;
    });
  }
  
  return response;
}

function getGrade(composite: number | null): string {
  if (!composite || composite === 0) return "N/A";
  if (composite >= 70) return "Elite";
  if (composite >= 60) return "Plus";
  if (composite >= 50) return "Average";
  if (composite >= 40) return "Below Avg";
  return "Developing";
}

// ============================================================
// REBOOT SESSION FETCH HANDLER
// ============================================================

interface RebootSession {
  id: string;
  session_date: string;
  name?: string;
  movement_count: number;
}

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

let cachedRebootToken: { token: string; expiresAt: number } | null = null;

async function getRebootAccessToken(): Promise<string> {
  if (cachedRebootToken && Date.now() < cachedRebootToken.expiresAt) {
    return cachedRebootToken.token;
  }

  const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME");
  const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD");
  
  if (!REBOOT_USERNAME || !REBOOT_PASSWORD) {
    throw new Error("Reboot credentials not configured");
  }

  console.log("[Fetch Sessions] Getting Reboot access token");
  
  const response = await fetch("https://api.rebootmotion.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error: ${response.status}`);
  }

  const data: RebootTokenResponse = await response.json();
  
  cachedRebootToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

async function checkSessionHasPlayerData(
  sessionId: string,
  orgPlayerId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch("https://api.rebootmotion.com/data_export", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        org_player_id: orgPlayerId,
        data_type: "momentum-energy",
        movement_type_id: 1,
      }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.download_urls && data.download_urls.length > 0;
  } catch {
    return false;
  }
}

async function fetchRebootSessionsForPlayer(
  supabase: any,
  playerId: string,
  orgPlayerId: string
): Promise<{ sessions: RebootSession[]; processed: number; latestKrs: number | null; error?: string }> {
  console.log(`[Fetch Sessions] Fetching for org_player_id=${orgPlayerId}`);
  
  const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY");
  if (!REBOOT_API_KEY) {
    return { sessions: [], processed: 0, latestKrs: null, error: "REBOOT_API_KEY not configured" };
  }

  try {
    // Fetch sessions from Reboot API
    const sinceDate = "2024-10-01";
    const url = new URL("https://api.rebootmotion.com/sessions");
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "100");
    url.searchParams.set("org_player_id", orgPlayerId);

    const sessionsResponse = await fetch(url.toString(), {
      headers: {
        "X-Api-Key": REBOOT_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!sessionsResponse.ok) {
      const error = await sessionsResponse.text();
      return { sessions: [], processed: 0, latestKrs: null, error: `Reboot API error: ${sessionsResponse.status}` };
    }

    const raw = await sessionsResponse.json();
    const allSessions = Array.isArray(raw) ? raw : (raw.sessions || raw.data || []);
    
    // Filter to processed sessions
    const processedSessions = allSessions.filter((s: any) => 
      s?.status === "processed" && (s?.completed_movements ?? 0) > 0
    );

    console.log(`[Fetch Sessions] Found ${processedSessions.length} processed sessions`);

    // Get OAuth token for data export checks
    const accessToken = await getRebootAccessToken();

    // Check first 10 sessions for player data
    const sessionsWithData: RebootSession[] = [];
    for (const session of processedSessions.slice(0, 10)) {
      if (!session?.id) continue;
      
      const hasData = await checkSessionHasPlayerData(session.id, orgPlayerId, accessToken);
      if (hasData) {
        sessionsWithData.push({
          id: session.id,
          session_date: session.session_date,
          name: session.session_name || `Session ${session.session_num || ""}`.trim(),
          movement_count: session.completed_movements || 0,
        });
      }
    }

    console.log(`[Fetch Sessions] ${sessionsWithData.length} sessions have data for player`);

    // Check which sessions are already imported
    const sessionIds = sessionsWithData.map(s => s.id);
    const { data: existingSessions } = await supabase
      .from("reboot_uploads")
      .select("reboot_session_id")
      .eq("player_id", playerId)
      .in("reboot_session_id", sessionIds);
    
    const existingIds = new Set((existingSessions || []).map((e: any) => e.reboot_session_id));
    const newSessions = sessionsWithData.filter(s => !existingIds.has(s.id));

    console.log(`[Fetch Sessions] ${newSessions.length} new sessions to process`);

    // Process new sessions via edge function
    let processedCount = 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const session of newSessions.slice(0, 3)) { // Limit to 3 per request
      try {
        const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-reboot-session`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: session.id,
            org_player_id: orgPlayerId,
            player_id: playerId,
          }),
        });

        if (processResponse.ok) {
          processedCount++;
          console.log(`[Fetch Sessions] Processed session ${session.id}`);
        }
      } catch (err) {
        console.error(`[Fetch Sessions] Error processing session ${session.id}:`, err);
      }
    }

    // Get latest KRS score
    const { data: latestUpload } = await supabase
      .from("reboot_uploads")
      .select("composite_score")
      .eq("player_id", playerId)
      .order("session_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      sessions: sessionsWithData,
      processed: processedCount,
      latestKrs: latestUpload?.composite_score || null,
    };
  } catch (error) {
    console.error("[Fetch Sessions] Error:", error);
    return { sessions: [], processed: 0, latestKrs: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================================
// VIDEO ANALYSIS HANDLER (MMS) - Level 1 & Level 2 System
// ============================================================

async function downloadTwilioMedia(mediaUrl: string): Promise<Uint8Array> {
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials not configured");
  }

  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  const response = await fetch(mediaUrl, {
    headers: {
      "Authorization": `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Level 1: Instant AI-powered swing feedback using Gemini vision
 * Returns quick coaching feedback within seconds
 */
async function analyzeSwingVideoLevel1(
  videoUrl: string,
  apiKey: string,
  playerContext?: { name?: string; motorProfile?: string }
): Promise<string> {
  console.log("[Video L1] Analyzing swing with Gemini vision");

  const firstName = playerContext?.name?.split(" ")[0] || "there";
  const profile = playerContext?.motorProfile || "Unknown";

  const analysisPrompt = `You are Coach Rick, an expert baseball swing analyst. Analyze this swing video and provide QUICK coaching feedback.

Player: ${firstName}
Motor Profile: ${profile}

Provide:
1. ONE thing they're doing well (be specific - what body part, what timing)
2. ONE thing to focus on improving (the biggest limiting factor)
3. ONE simple cue or drill to try

Keep it SHORT and ACTIONABLE - this is for SMS (under 250 characters if possible).
Use baseball terminology naturally but don't overwhelm.
Be encouraging but real about what needs work.
Sound like a cool older brother who played college ball.`;

  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: analysisPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this baseball swing video:" },
              { type: "image_url", image_url: { url: videoUrl } }
            ]
          }
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Video L1] Gemini error:", response.status, errorText);
      
      if (response.status === 429) {
        return "⚠️ I'm analyzing a lot of swings right now. Try again in a minute!";
      }
      if (response.status === 402) {
        return "⚠️ Video analysis temporarily unavailable.";
      }
      
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content?.trim();
    
    if (!analysis) {
      return "Couldn't analyze the video clearly. Try a side-angle clip with good lighting!";
    }

    return analysis;
  } catch (error) {
    console.error("[Video L1] Error:", error);
    return "❌ Video analysis failed. Try a shorter clip with better lighting.";
  }
}

/**
 * Queue Level 2 deep analysis via Reboot Motion API
 * Uploads video to Reboot, polls for processing, downloads data, runs 4B
 * Returns immediately, sends full Lab Report later via SMS/WhatsApp
 */
async function queueLevel2Analysis(
  supabase: any,
  playerId: string,
  videoUrl: string,
  storagePath: string,
  phone: string,
  isWhatsApp: boolean
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  console.log("[Video L2] Queueing Reboot Motion upload for player:", playerId);

  try {
    // Step 1: Ensure player has Reboot account
    const { data: player } = await supabase
      .from("players")
      .select("reboot_player_id, reboot_athlete_id, name")
      .eq("id", playerId)
      .single();

    let rebootPlayerId = player?.reboot_player_id || player?.reboot_athlete_id;

    // Create Reboot player if needed
    if (!rebootPlayerId) {
      console.log("[Video L2] Creating Reboot player account...");
      const createResponse = await fetch(`${supabaseUrl}/functions/v1/reboot-create-player`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          player_id: playerId,
          player_name: player?.name || "Unknown Player",
        }),
      });

      if (createResponse.ok) {
        const createResult = await createResponse.json();
        rebootPlayerId = createResult.reboot_player_id;
        console.log("[Video L2] Reboot player created:", rebootPlayerId);
      } else {
        console.error("[Video L2] Failed to create Reboot player:", await createResponse.text());
        return;
      }
    }

    // Step 2: Upload video to Reboot Motion (this triggers polling automatically)
    const filename = storagePath.split("/").pop() || `swing_${Date.now()}.mp4`;
    
    fetch(`${supabaseUrl}/functions/v1/reboot-upload-video`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        player_id: playerId,
        video_url: videoUrl,
        video_filename: filename,
        frame_rate: 240,
      }),
    }).catch(err => {
      console.error("[Video L2] Reboot upload error:", err);
    });

    console.log("[Video L2] Reboot Motion upload queued - polling will begin automatically");
  } catch (error) {
    console.error("[Video L2] Failed to queue Reboot upload:", error);
  }
}

/**
 * Full video handling: Level 1 instant + optional Level 2 deep
 */
async function handlePlayerVideoSubmission(
  supabase: any,
  videoUrl: string,
  contentType: string,
  apiKey: string,
  playerId: string | null,
  phone: string,
  isWhatsApp: boolean
): Promise<string> {
  console.log("[Video] Processing player video submission:", videoUrl);

  try {
    // 1. Download video from Twilio
    const videoData = await downloadTwilioMedia(videoUrl);
    console.log(`[Video] Downloaded ${videoData.length} bytes`);

    // 2. Upload to Supabase storage
    const timestamp = Date.now();
    const extension = contentType.includes("mp4") ? "mp4" : contentType.includes("mov") ? "mov" : "mp4";
    const storagePath = playerId 
      ? `player-uploads/${playerId}/${timestamp}_swing.${extension}`
      : `anonymous-uploads/${timestamp}_swing.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("swing-videos")
      .upload(storagePath, videoData, {
        contentType: contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Video] Storage upload error:", uploadError);
      return "❌ Failed to save video. Please try again.";
    }

    // 3. Get public URL
    const { data: urlData } = supabase.storage
      .from("swing-videos")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;
    console.log("[Video] Video saved to:", publicUrl);

    // 4. Get player context for personalized feedback
    let playerContext: { name?: string; motorProfile?: string } = {};
    if (playerId) {
      const { data: player } = await supabase
        .from("players")
        .select("name, motor_profile_sensor, reboot_player_id, reboot_athlete_id")
        .eq("id", playerId)
        .single();
      
      if (player) {
        playerContext = {
          name: player.name,
          motorProfile: player.motor_profile_sensor,
        };

        // Check if player is set up for Level 2 (Reboot Motion)
        const hasReboot = player.reboot_player_id || player.reboot_athlete_id;
        
        if (hasReboot) {
          // Queue Level 2 deep analysis (async, will send results later)
          queueLevel2Analysis(supabase, playerId, publicUrl, storagePath, phone, isWhatsApp);
        }
      }
    }

    // 5. Run Level 1 instant analysis with Gemini
    const instantFeedback = await analyzeSwingVideoLevel1(publicUrl, apiKey, playerContext);

    // 6. Log the video submission
    await supabase.from("activity_log").insert({
      action: "video_submitted",
      description: `Swing video submitted via ${isWhatsApp ? "WhatsApp" : "MMS"}`,
      player_id: playerId,
      metadata: {
        storage_path: storagePath,
        content_type: contentType,
        size_bytes: videoData.length,
        channel: isWhatsApp ? "whatsapp" : "sms",
      },
    });

    // Build response
    let response = `🎥 Quick Take:\n\n${instantFeedback}`;
    
    // If Level 2 is queued, mention it
    if (playerId) {
      const { data: player } = await supabase
        .from("players")
        .select("reboot_player_id, reboot_athlete_id")
        .eq("id", playerId)
        .single();
      
      if (player?.reboot_player_id || player?.reboot_athlete_id) {
        response += "\n\n🔬 Full 3D analysis coming in a few minutes...";
      }
    }

    return response;
  } catch (error) {
    console.error("[Video] Error:", error);
    return `❌ Video processing failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

/**
 * Admin-only video analysis (existing flow)
 */
async function handleVideoAnalysis(
  supabase: any,
  videoUrl: string,
  contentType: string,
  apiKey: string
): Promise<string> {
  console.log("[Video Analysis] Processing admin MMS video:", videoUrl);

  try {
    const videoData = await downloadTwilioMedia(videoUrl);
    console.log(`[Video Analysis] Downloaded ${videoData.length} bytes`);

    const timestamp = Date.now();
    const extension = contentType.includes("mp4") ? "mp4" : contentType.includes("mov") ? "mov" : "mp4";
    const storagePath = `admin-uploads/${timestamp}_swing.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("swing-videos")
      .upload(storagePath, videoData, {
        contentType: contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Video Analysis] Storage upload error:", uploadError);
      return "❌ Failed to save video. Please try again.";
    }

    const { data: urlData } = supabase.storage
      .from("swing-videos")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;
    console.log("[Video Analysis] Video saved to:", publicUrl);

    const analysis = await analyzeSwingVideoLevel1(publicUrl, apiKey);

    return `🎥 Swing Analysis:\n\n${analysis}`;
  } catch (error) {
    console.error("[Video Analysis] Error:", error);
    return `❌ Video processing failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// ============================================================
// ONBOARDING & NAME EXTRACTION FOR NEW PLAYERS
// ============================================================

/**
 * Generate a friendly onboarding response for new players
 */
async function generateOnboardingResponse(
  incomingMessage: string,
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You are Coach Rick, the AI hitting coach for Barrel Coach (formerly Catching Barrels).

A new person has texted you for the first time. You need to:
1. Greet them warmly and introduce yourself
2. Ask for their name so you can create their profile
3. Let them know they can send swing videos for analysis

Keep it SHORT (2-3 sentences max) and friendly. This is SMS/WhatsApp.

Example response:
"Hey! 👋 I'm Coach Rick, your AI hitting coach. What's your name? Once I know who you are, you can send me swing videos and I'll break 'em down for you!"

If they already said their name in the message, acknowledge it and welcome them.`
          },
          {
            role: "user",
            content: incomingMessage || "Hi"
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("[Onboarding] AI error:", response.status);
      return "Hey! 👋 I'm Coach Rick, your AI hitting coach. What's your name? Send me a swing video anytime and I'll break it down for you!";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Hey! 👋 I'm Coach Rick. What's your name?";
  } catch (error) {
    console.error("[Onboarding] Error:", error);
    return "Hey! 👋 I'm Coach Rick, your AI hitting coach. What's your name?";
  }
}

/**
 * Try to extract a player name from their message using AI
 */
async function extractPlayerNameFromMessage(
  message: string,
  apiKey: string
): Promise<string | null> {
  if (!message || message.length < 2) return null;
  
  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `You are a name extraction assistant. Extract the person's name from their message if they provided one.

Rules:
- Return ONLY the name (first name, or first + last if given)
- Return "null" (exactly) if no clear name is present
- Common patterns: "I'm [name]", "My name is [name]", "This is [name]", "Hey it's [name]", or just "[name]" by itself
- Do NOT extract random words as names
- Do NOT extract nicknames like "hey" or greetings

Examples:
"Hi I'm John Smith" → John Smith
"My name is Sarah" → Sarah
"This is Marcus" → Marcus
"yo" → null
"send me a video" → null
"Alex here" → Alex`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 50,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();
    
    if (!result || result.toLowerCase() === "null" || result.length < 2 || result.length > 50) {
      return null;
    }
    
    // Basic validation - should look like a name
    if (!/^[A-Za-z][A-Za-z\s\-'\.]+$/.test(result)) {
      return null;
    }
    
    return result;
  } catch (error) {
    console.error("[NameExtract] Error:", error);
    return null;
  }
}

// ============================================================
// AI RESPONSE GENERATION WITH FULL CONTEXT
// ============================================================

async function generateAIResponse(
  supabase: any,
  player: any,
  incomingMessage: string,
  conversationHistory: { role: string; content: string }[],
  apiKey: string
): Promise<string> {
  const firstName = player.name?.split(" ")[0] || "there";
  const globalRules = await getGlobalRules(supabase);
  
  // Get coaching notes
  const notes = Array.isArray(player.coaching_notes) ? player.coaching_notes : [];
  const notesText = notes.length > 0
    ? notes.map((n: any) => `- ${n.note}`).join("\n")
    : "None yet";
  
  const systemPrompt = `# CLAWDBOT - COACH RICK AI

You are **ClawdBot**, the AI hitting coach for Catching Barrels. You embody Coach Rick Strickland's voice, philosophy, and 20+ years of professional coaching experience (Cubs AAA, Baltimore Orioles AAA, 400+ college commits, 100+ pro players).

**Core Philosophy:** "We don't add, we unlock."

Every player has a natural Motor Profile. You optimize their existing movement signature — you never force universal mechanics.

---

## CURRENT PLAYER CONTEXT

**Player Name:** ${firstName}
**Motor Profile:** ${player.motor_profile_sensor || "Not yet assessed"}

**4B Scores (20-80 MLB Scout Scale):**
- BRAIN: ${player.latest_brain_score ?? "Not measured"} (timing, rhythm, pitch recognition)
- BODY: ${player.latest_body_score ?? "Not measured"} (ground force, kinetic chain, Transfer Ratio)
- BAT: ${player.latest_bat_score ?? "Not measured"} (swing path, attack angle, barrel control)
- BALL: ${player.latest_ball_score ?? "Not measured"} (exit velo, launch angle, contact quality)
- COMPOSITE: ${player.latest_composite_score ?? "Not measured"}

**Score Context:**
- 70+: Plus-Plus (elite)
- 60-69: Plus (above avg)
- 50-59: Average
- 40-49: Below average
- Below 40: Needs work

**Coaching Notes from Coach Rick:**
${notesText}

---

## VOICE & TONE

- **Reading level:** 5th-8th grade
- **Style:** Direct, energetic, actionable (Hormozi-style)
- **Voice:** Like a coach texting a player - casual but knowledgeable
- **Use emojis sparingly:** ⚾️ 💪 🔥 ✅ (not every message)
- **No jargon** unless explained immediately
- **Never condescending** - meet players where they are
- **Keep responses SHORT** - this is SMS/WhatsApp, 2-3 sentences max

**Example tone:**
- ✅ "Yo! That load is way cleaner. See how your hands stayed back? That's the Spinner in you."
- ❌ "Your biomechanical kinetic chain sequencing shows improved proximal-to-distal transfer."

---

## THE THREE MOTOR PROFILES

**CRITICAL: These are the ONLY three Motor Profiles. Never invent others.**

### 1. SPINNER (Blue #4488ff)
- **Pro Models:** Jose Altuve, Mookie Betts, Jeremy Peña
- **Body Type:** Typically shorter, compact, quick-twitch
- **Movement Pattern:** Compact rotation, quick hands, tight coil
- **Power Source:** Core and rotation — spins through the ball
- **Key Traits:** Lateral ground force (rotation), NOT vertical shear
- **Common Leaks:** Over-rotation, disconnection
- **Feel:** "A tight spring uncoiling"

### 2. WHIPPER (Green #44ff88)
- **Pro Models:** Juan Soto, Freddie Freeman
- **Body Type:** Medium build, long arms, flexible
- **Movement Pattern:** Hip lead, extension, leverage, whip-crack finish
- **Power Source:** Hips and extension — whips through the zone
- **Key Traits:** Long levers, effortless whip, elite timing (55-75% of swing)
- **Common Leaks:** Drift, getting out front
- **Feel:** "A whip cracking through the zone"

### 3. SLINGSHOTTER (Orange #ff8844)
- **Pro Models:** Aaron Judge, Vladimir Guerrero Jr.
- **Body Type:** Taller/bigger, strong legs, power frame
- **Movement Pattern:** Linear load, explosive transfer, ground force
- **Power Source:** Legs and ground — explodes up and through
- **Key Traits:** Vertical shear, ground force production
- **Common Leaks:** Over-stride, late timing, energy sequencing issues
- **Feel:** "A freight train hitting the ball"

**Titan** is a variant for raw power players, but the three main profiles are Spinner, Whipper, Slingshotter.

---

## THE 4B SCORING SYSTEM

### BODY (The Engine & Brake)
- Ground force production, kinetic chain sequencing
- The "Violent Brake" concept - energy transfer efficiency
- **Elite Transfer Ratio:** 1.5 - 1.8 (torso peak velocity ÷ pelvis peak velocity)
- **Elite Timing Gap:** 14-18% (time between pelvis and torso peaks)

### BRAIN (Timing & Rhythm)
- Tempo (load-to-launch ratio), internal clock, pitch recognition
- **Elite Load-to-Launch Ratio:** 2:1 to 3:1
- Tempo is the universal performance variable regardless of Motor Profile

### BAT (Path & Vector)
- Swing path optimization, attack angle (profile-specific), barrel control
- Attack angle varies by Motor Profile - don't force universal path

### BALL (Results & Data)
- Exit velocity, launch angle, spray chart, results tracking
- Exit velo is a symptom, not the goal. Focus on efficiency.

---

## WHIP TIMING - KEY CONCEPT

**Definition:** When does trunk momentum peak during the swing?
**Elite Zone:** 55% - 75% of swing
- Hands at back hip, bat releasing "like a pendulum toward the ground"

|Group    |Range |Implication                               |
|TOO EARLY|< 40% |Firing trunk too soon, losing energy      |
|ELITE    |55-75%|Optimal energy transfer                   |
|OK       |75-85%|Slightly late but workable                |
|TOO LATE |> 85% |Energy hasn't released into bat at contact|

**Cue:** "Release the bat when hands pass the back hip — like Freeman's pendulum."

---

## COMMON PROBLEMS & FIXES

**Drifting (BODY):** Weight moving forward before rotation → "Land, brake, THEN turn"
**Casting (BAT):** Hands getting away from body early → "Keep hands connected to your turn"
**Early/Late (BRAIN):** Tempo disruption → "Same rhythm, every pitch"
**Rolling Over (BAT):** Early barrel dump → "Stay through the ball, don't go around it"
**Losing Power (BODY):** Energy leak in chain → "Fire from the ground up"

---

## RESPONSE RULES

1. Keep responses SHORT - 2-3 sentences max for SMS/WhatsApp
2. Be encouraging but real - reference their actual scores when relevant
3. Use baseball slang naturally (barrel, rip, zone, oppo, etc.)
4. Sound like a cool older brother who played college ball
5. If they mention a problem, relate it to their Motor Profile and 4B scores
6. Don't overwhelm with multiple fixes - ONE thing at a time
7. If they ask about drills, tell them to check their "locker" in the app
8. Reference their Motor Profile when giving swing advice if known

---

## WHAT YOU DON'T DO

- ❌ Don't invent Motor Profile names (ONLY Spinner, Whipper, Slingshotter, Titan)
- ❌ Don't give generic "stay back" or "be athletic" advice
- ❌ Don't overwhelm with multiple fixes at once
- ❌ Don't pretend to see video you haven't analyzed
- ❌ Don't promise specific results ("you'll hit .400")
- ❌ Don't give medical advice for injuries
${globalRules}`;

  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-6),
          { role: "user", content: incomingMessage },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Twilio Webhook] AI error:", errorText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "Got your message! 💪 Check your locker for your next drill.";
  } catch (error) {
    console.error("[Twilio Webhook] AI error:", error);
    return "Thanks for the message! Let me think on that. Check your locker for your latest drills 🎯";
  }
}

// ============================================================
// SEND MESSAGE VIA TWILIO (SMS or WhatsApp)
// ============================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlMessage(message: string): string {
  // Keep it minimal and safe for XML.
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

/**
 * Send a message via Twilio (SMS or WhatsApp)
 * Automatically detects channel based on the original "from" address
 */
async function sendMessage(
  to: string,
  message: string,
  isWhatsApp: boolean = false,
): Promise<{ success: boolean; sid?: string; error?: { code?: number; message?: string; status?: number } }> {
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
  const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || TWILIO_PHONE_NUMBER;
  
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error("[Twilio Webhook] Missing Twilio credentials");
    return { success: false };
  }
  
  const formattedPhone = normalizePhone(to);
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  // Format To and From based on channel
  const toAddress = isWhatsApp ? `whatsapp:${formattedPhone}` : formattedPhone;
  const fromAddress = isWhatsApp ? `whatsapp:${TWILIO_WHATSAPP_NUMBER}` : TWILIO_PHONE_NUMBER;
  
  console.log(`[Twilio Webhook] Sending ${isWhatsApp ? "WhatsApp" : "SMS"} to ${toAddress} from ${fromAddress}`);
  
  const response = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toAddress,
      From: fromAddress,
      Body: message,
    }),
  });
  
  const data = await response.json();
  
  if (response.ok) {
    return { success: true, sid: data.sid };
  } else {
    console.error("[Twilio Webhook] Failed to send message:", data);
    return {
      success: false,
      error: {
        code: typeof data?.code === "number" ? data.code : undefined,
        message: typeof data?.message === "string" ? data.message : undefined,
        status: typeof data?.status === "number" ? data.status : undefined,
      },
    };
  }
}

// Backward compatibility alias
async function sendSMS(to: string, message: string): Promise<{ success: boolean; sid?: string }> {
  return sendMessage(to, message, false);
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    
    // Check if this is a status callback
    const messageSid = formData.get("MessageSid") as string;
    const messageStatus = formData.get("MessageStatus") as string;
    
    if (messageStatus && messageSid && !formData.get("Body")) {
      console.log("[Twilio Webhook] Status update:", messageSid, "->", messageStatus);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase
        .from("messages")
        .update({ status: messageStatus, updated_at: new Date().toISOString() })
        .eq("twilio_sid", messageSid);
      
      await supabase
        .from("sms_logs")
        .update({ status: messageStatus })
        .eq("twilio_sid", messageSid);
      
      return new Response("OK", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
        status: 200,
      });
    }
    
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string || "";
    
    // Detect if this is a WhatsApp message
    const isWhatsApp = isWhatsAppNumber(from);
    const channelType = isWhatsApp ? "whatsapp" : "sms";
    
    // Extract MMS media attachments
    const mediaUrl0 = formData.get("MediaUrl0") as string | null;
    const mediaContentType0 = formData.get("MediaContentType0") as string | null;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0", 10);

    console.log(`[Twilio Webhook] Received ${channelType.toUpperCase()} from:`, from, "Body:", body?.slice(0, 50), "Media:", numMedia);

    if (!from) {
      throw new Error("Missing required fields");
    }
    
    // For MMS/media without body text, set a default
    const messageBody = body || (numMedia > 0 ? "[Media attachment]" : "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if blocked (silent ignore)
    if (await isBlocked(supabase, from)) {
      console.log("[Twilio Webhook] Blocked number:", from);
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    const normalizedFrom = normalizePhone(from);
    const adminMode = isAdmin(from);
    
    console.log("[Twilio Webhook] Admin mode:", adminMode);

    // Find player by phone
    const { data: playerIdResult } = await supabase.rpc("find_player_by_phone", {
      phone_input: from,
    });
    
    const playerId = playerIdResult as string | null;
    
    // Find session (legacy)
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("player_phone", from)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ============================================================
    // ADMIN COMMAND HANDLING
    // ============================================================
    
    if (adminMode) {
      const command = parseAdminCommand(messageBody, mediaUrl0 || undefined, mediaContentType0 || undefined);
      console.log("[Twilio Webhook] Admin command:", command.type);
      
      if (command.type !== "none") {
        let responseText = "";
        
        switch (command.type) {
          case "remember": {
            const player = await findPlayerByName(supabase, command.playerName!);
            if (player) {
              await addCoachingNote(supabase, player.id, command.note!, normalizedFrom);
              responseText = `✅ Added note to ${player.name}'s profile.`;
            } else {
              responseText = `❌ No player found matching "${command.playerName}"`;
            }
            break;
          }
          
          case "motor_profile": {
            const player = await findPlayerByName(supabase, command.playerName!);
            if (player) {
              await updateMotorProfile(supabase, player.id, command.motorProfile!);
              responseText = `✅ ${player.name} → ${command.motorProfile}`;
            } else {
              responseText = `❌ No player found matching "${command.playerName}"`;
            }
            break;
          }
          
          case "lookup": {
            const player = await findPlayerByNameOrPhone(supabase, command.query!);
            if (player) {
              responseText = formatPlayerProfile(player);
            } else {
              responseText = `❌ No player found for "${command.query}"`;
            }
            break;
          }
          
          case "last_messages": {
            const player = await findPlayerByName(supabase, command.playerName!);
            if (player) {
              const messages = await getRecentConversations(supabase, player.id, command.count || 5);
              if (messages.length > 0) {
                responseText = `📜 Last ${messages.length} for ${player.name}:\n`;
                messages.reverse().forEach((m: any) => {
                  const dir = m.direction === "inbound" ? "→" : "←";
                  const preview = m.body?.slice(0, 40) || "";
                  responseText += `${dir} ${preview}${m.body?.length > 40 ? "..." : ""}\n`;
                });
              } else {
                responseText = `No messages found for ${player.name}`;
              }
            } else {
              responseText = `❌ No player found matching "${command.playerName}"`;
            }
            break;
          }
          
          case "global_rule": {
            await addGlobalRule(supabase, command.ruleType!, command.ruleText!, normalizedFrom);
            responseText = `✅ Rule added: ${command.ruleType?.toUpperCase()} ${command.ruleText}`;
            break;
          }
          
          case "status": {
            const stats = await getSystemStats(supabase);
            responseText = `📊 Coach Rick Status\n`;
            responseText += `Today: ${stats.messagesToday} msgs, ${stats.activePlayersToday} active\n`;
            responseText += `Total Players: ${stats.totalPlayers}\n`;
            responseText += `Pending Sensors: ${stats.pendingSensors}\n`;
            responseText += `Rules: ${stats.globalRulesCount} | Blocked: ${stats.blockedCount}`;
            break;
          }
          
          case "block": {
            await blockNumber(supabase, command.phone!, normalizedFrom);
            responseText = `🚫 Blocked ${maskPhone(command.phone!)}`;
            break;
          }
          
          case "unblock": {
            const success = await unblockNumber(supabase, command.phone!);
            responseText = success 
              ? `✅ Unblocked ${maskPhone(command.phone!)}`
              : `❌ Failed to unblock ${maskPhone(command.phone!)}`;
            break;
          }
          
          case "fetch_sessions": {
            const player = await findPlayerByName(supabase, command.playerName!);
            if (player) {
              if (!player.reboot_athlete_id) {
                responseText = `❌ ${player.name} has no Reboot athlete ID linked.`;
              } else {
                responseText = `⏳ Fetching Reboot sessions for ${player.name}...`;
                // Send initial response (use correct channel)
                await sendMessage(from, responseText, isWhatsApp);
                
                const result = await fetchRebootSessionsForPlayer(
                  supabase,
                  player.id,
                  player.reboot_athlete_id
                );
                
                if (result.error) {
                  responseText = `❌ Error: ${result.error}`;
                } else {
                  const krsText = result.latestKrs ? ` Latest KRS: ${result.latestKrs}` : "";
                  responseText = `✅ ${player.name}: Found ${result.sessions.length} sessions.`;
                  if (result.processed > 0) {
                    responseText += ` Processed ${result.processed} new.`;
                  }
                  responseText += krsText;
                }
              }
            } else {
              responseText = `❌ No player found matching "${command.playerName}"`;
            }
            break;
          }
          
          case "video_analysis": {
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
            if (!LOVABLE_API_KEY) {
              responseText = "❌ Video analysis not configured.";
            } else {
              responseText = `⏳ Analyzing swing video...`;
              await sendMessage(from, responseText, isWhatsApp);
              
              responseText = await handleVideoAnalysis(
                supabase,
                command.videoUrl!,
                command.videoContentType || "video/mp4",
                LOVABLE_API_KEY
              );
            }
            break;
          }
        }

        // For WhatsApp sandbox reliability: prefer responding via TwiML for quick, single-message admin replies.
        // (Keep REST send for multi-step commands that intentionally send progress + final messages.)
        const isMultiStepAdminCommand = command.type === "fetch_sessions" || command.type === "video_analysis";

        let result: { success: boolean; sid?: string; error?: { code?: number; message?: string; status?: number } } = { success: true };

        if (isWhatsApp && !isMultiStepAdminCommand) {
          // No REST API call needed; Twilio will deliver this response on the same channel.
          await supabase.from("coach_api_audit_log").insert({
            action: `admin_${command.type}`,
            phone: normalizedFrom,
            request_body: { command, response: responseText, delivery: "twiml" },
            response_status: 200,
          });

          return new Response(twimlMessage(responseText), {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }

        // Otherwise send admin response via REST (existing behavior)
        result = await sendMessage(from, responseText, isWhatsApp);
        
        // Log admin command
        await supabase.from("coach_api_audit_log").insert({
          action: `admin_${command.type}`,
          phone: normalizedFrom,
          request_body: { command, response: responseText },
          response_status: result.success ? 200 : 500,
        });

        // If WhatsApp REST send fails, fall back to TwiML so the user still gets a reply in sandbox.
        if (isWhatsApp && !result.success) {
          return new Response(twimlMessage(responseText), {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }

        return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }
      
      // If no command detected, admin can still chat with Coach Rick
      console.log("[Twilio Webhook] Admin chatting (no command detected)");
    }

    // ============================================================
    // REGULAR MESSAGE HANDLING
    // ============================================================
    
    // Check for opt-out
    if (isOptOut(messageBody)) {
      console.log("[Twilio Webhook] Player opted out:", from);
      
      if (playerId) {
        await supabase
          .from("players")
          .update({ sms_opt_in: false })
          .eq("id", playerId);
      }
      
      await supabase.from("messages").insert({
        player_id: playerId,
        session_id: session?.id || null,
        phone_number: from,
        direction: "inbound",
        body: messageBody,
        twilio_sid: messageSid,
        status: "received",
        trigger_type: "opt_out",
      });

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You've been unsubscribed from Coach Rick messages. Reply START to resubscribe.</Message></Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Check for opt-in
    if (messageBody.toLowerCase().trim() === "start") {
      console.log("[Twilio Webhook] Player opted in:", from);
      
      if (playerId) {
        await supabase
          .from("players")
          .update({ sms_opt_in: true })
          .eq("id", playerId);
      }
      
      await supabase.from("messages").insert({
        player_id: playerId,
        session_id: session?.id || null,
        phone_number: from,
        direction: "inbound",
        body: messageBody,
        twilio_sid: messageSid,
        status: "received",
        trigger_type: "opt_in",
      });

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Welcome back! You're now subscribed to Coach Rick messages. 💪</Message></Response>`;
      return new Response(twiml, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // ============================================================
    // PLAYER VIDEO SUBMISSION (Level 1 + Level 2 Analysis)
    // ============================================================
    
    // Check if player sent a video - handle before regular message flow
    if (numMedia > 0 && mediaUrl0 && mediaContentType0?.startsWith("video/")) {
      console.log("[Twilio Webhook] Player video submission detected");
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        console.error("[Twilio Webhook] Missing LOVABLE_API_KEY for video analysis");
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Thanks for the video! Our analysis system is being updated. Try again soon! 🎥</Message></Response>`;
        return new Response(twiml, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Send immediate acknowledgment
      const ackMessage = "🎥 Got your swing video! Analyzing now...";
      await sendMessage(from, ackMessage, isWhatsApp);

      // Log the video submission
      await supabase.from("messages").insert({
        player_id: playerId,
        session_id: session?.id || null,
        phone_number: from,
        direction: "inbound",
        body: messageBody || "[Swing video]",
        twilio_sid: messageSid,
        status: "received",
        trigger_type: "video_submission",
      });

      // Process video with Level 1 instant + Level 2 deep (if available)
      const videoResponse = await handlePlayerVideoSubmission(
        supabase,
        mediaUrl0,
        mediaContentType0,
        LOVABLE_API_KEY,
        playerId,
        from,
        isWhatsApp
      );

      // Send the analysis
      const result = await sendMessage(from, videoResponse, isWhatsApp);

      if (result.success) {
        await supabase.from("messages").insert({
          player_id: playerId,
          session_id: session?.id || null,
          phone_number: normalizedFrom,
          direction: "outbound",
          body: videoResponse,
          twilio_sid: result.sid,
          status: "sent",
          trigger_type: "video_analysis",
          ai_generated: true,
        });
      } else if (isWhatsApp) {
        // Fallback to TwiML
        return new Response(twimlMessage(videoResponse), {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
        status: 200,
      });
    }

    // Save inbound message
    await supabase.from("messages").insert({
      player_id: playerId,
      session_id: session?.id || null,
      phone_number: from,
      direction: "inbound",
      body: messageBody,
      twilio_sid: messageSid,
      status: "received",
      trigger_type: "reply",
    });

    // Generate AI reply if we have a player (or admin chatting)
    if (playerId || adminMode) {
      console.log("[Twilio Webhook] Generating AI reply");
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        console.error("[Twilio Webhook] Missing LOVABLE_API_KEY");
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Get player info (or create minimal context for admin)
      let player: any = null;
      
      if (playerId) {
        const { data } = await supabase
          .from("players")
          .select("id, name, phone, motor_profile_sensor, coaching_notes, latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score, latest_composite_score, membership_tier, has_sensor, sensor_connected")
          .eq("id", playerId)
          .single();
        player = data;
      }
      
      if (!player && adminMode) {
        // Admin without player profile - minimal context
        player = {
          name: "Admin",
          motor_profile_sensor: null,
          coaching_notes: [],
          latest_brain_score: null,
          latest_body_score: null,
          latest_bat_score: null,
          latest_ball_score: null,
          latest_composite_score: null,
        };
      }

      if (!player) {
        console.error("[Twilio Webhook] No player context available");
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }

      // Get conversation history
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("direction, body")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(10);

      const conversationHistory = (recentMessages || [])
        .reverse()
        .map(msg => ({
          role: msg.direction === "inbound" ? "user" : "assistant",
          content: msg.body || "",
        }));

      // Generate AI response with full context
      const aiReply = await generateAIResponse(
        supabase,
        player,
        messageBody,
        conversationHistory,
        LOVABLE_API_KEY
      );

      console.log("[Twilio Webhook] AI reply:", aiReply.slice(0, 50) + "...");

      // Send via Twilio (use correct channel based on original message)
      const result = await sendMessage(from, aiReply, isWhatsApp);

      if (result.success) {
        console.log("[Twilio Webhook] AI reply sent:", result.sid);

        await supabase.from("messages").insert({
          player_id: playerId,
          session_id: session?.id || null,
          phone_number: normalizedFrom,
          direction: "outbound",
          body: aiReply,
          twilio_sid: result.sid,
          status: "sent",
          trigger_type: "ai_reply",
          ai_generated: true,
        });

        await supabase.from("sms_logs").insert({
          session_id: session?.id || null,
          phone_number: normalizedFrom,
          trigger_name: "ai_conversation",
          message_sent: aiReply,
          twilio_sid: result.sid,
          status: "sent",
        });
      } else if (isWhatsApp) {
        // WhatsApp sandbox may fail REST sends (e.g., 63007) depending on Twilio account/channel config.
        // Return TwiML as a fallback so Twilio replies on the same WhatsApp thread.
        return new Response(twimlMessage(aiReply), {
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
          status: 200,
        });
      }
    } else {
      // ============================================================
      // NEW PLAYER ONBOARDING - Ask ClawdBot for their name
      // ============================================================
      console.log("[Twilio Webhook] New phone number detected:", from);
      
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (LOVABLE_API_KEY) {
        // Use ClawdBot to greet and ask for their name
        const onboardingReply = await generateOnboardingResponse(
          messageBody,
          LOVABLE_API_KEY
        );
        
        const result = await sendMessage(from, onboardingReply, isWhatsApp);
        
        if (result.success) {
          // Store the message temporarily to track onboarding state
          await supabase.from("messages").insert({
            player_id: null,
            phone_number: normalizedFrom,
            direction: "outbound",
            body: onboardingReply,
            twilio_sid: result.sid,
            status: "sent",
            trigger_type: "onboarding",
            ai_generated: true,
          });
        } else if (isWhatsApp) {
          return new Response(twimlMessage(onboardingReply), {
            headers: { ...corsHeaders, "Content-Type": "text/xml" },
            status: 200,
          });
        }
        
        // Check if we can extract a name from their message
        const extractedName = await extractPlayerNameFromMessage(messageBody, LOVABLE_API_KEY);
        
        if (extractedName) {
          console.log("[Twilio Webhook] Extracted name from message:", extractedName);
          
          // Create new player record
          const { data: newPlayer, error: createError } = await supabase
            .from("players")
            .insert({
              name: extractedName,
              phone: normalizedFrom,
              account_status: "active",
              can_login: false,
              is_public: false,
              sms_opt_in: true,
              notes: `Auto-created from ${isWhatsApp ? "WhatsApp" : "SMS"} onboarding`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select("id, name")
            .single();
          
          if (!createError && newPlayer) {
            console.log("[Twilio Webhook] Created new player:", newPlayer.id);
            
            // Log activity
            await supabase.from("activity_log").insert({
              action: "player_created_from_sms",
              description: `New player ${extractedName} created from ${isWhatsApp ? "WhatsApp" : "SMS"}`,
              player_id: newPlayer.id,
              metadata: { phone: normalizedFrom, extracted_name: extractedName },
            });
            
            // Send welcome message
            const welcomeMsg = `Welcome to Barrel Coach, ${extractedName.split(" ")[0]}! 💪 I'm Coach Rick - your AI hitting coach. Send me a swing video anytime and I'll break it down for you!`;
            await sendMessage(from, welcomeMsg, isWhatsApp);
          }
        }
      }
    }

    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  } catch (error) {
    console.error("[Twilio Webhook] Error:", error);
    
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  }
});
