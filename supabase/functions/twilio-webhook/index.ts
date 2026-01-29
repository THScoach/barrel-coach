/**
 * Twilio Webhook Handler - Admin Mode Enabled
 * 
 * Receives inbound SMS from players and admins:
 * 1. Handles opt-out/opt-in keywords (STOP/START)
 * 2. Detects admin commands for memory management
 * 3. Logs messages to database
 * 4. Triggers AI-powered Coach Rick responses with full context
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

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, "");
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
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `***-***-${digits.slice(-4)}`;
  }
  return phone;
}

// ============================================================
// ADMIN COMMAND PARSER
// ============================================================

interface AdminCommand {
  type: "remember" | "motor_profile" | "lookup" | "last_messages" | "global_rule" | "status" | "block" | "unblock" | "none";
  playerName?: string;
  note?: string;
  motorProfile?: string;
  query?: string;
  count?: number;
  ruleType?: "always" | "never" | "global";
  ruleText?: string;
  phone?: string;
}

function parseAdminCommand(message: string): AdminCommand {
  const lower = message.toLowerCase().trim();
  
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
    .update({ motor_profile: motorProfile })
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
  const profile = player.motor_profile || "Not assessed";
  
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
  
  const systemPrompt = `You are Coach Rick, the "Swing Rehab Coach" at Catching Barrels. You're having an SMS conversation with ${firstName}.

Their current 4B scores (20-80 MLB Scout Scale):
- BRAIN: ${player.latest_brain_score ?? "Not measured"} (decision-making, timing)
- BODY: ${player.latest_body_score ?? "Not measured"} (mechanics, rotation)
- BAT: ${player.latest_bat_score ?? "Not measured"} (bat speed, path)
- BALL: ${player.latest_ball_score ?? "Not measured"} (exit velo, contact)
- COMPOSITE: ${player.latest_composite_score ?? "Not measured"}
- MOTOR PROFILE: ${player.motor_profile || "Not assessed"}

Score Context:
- 70+: Plus-Plus (elite)
- 60-69: Plus (above avg)
- 50-59: Average
- 40-49: Below average
- Below 40: Needs work

Coaching Notes (from Coach Rick):
${notesText}
${globalRules}

Conversation Rules:
1. Keep responses SHORT - this is texting, not email (2-3 sentences max)
2. Be encouraging but real - reference their actual scores when relevant
3. Use baseball slang naturally (barrel, rip, zone, oppo, etc.)
4. Sound like a cool older brother who played college ball
5. If they mention a problem, relate it to their 4B scores and suggest specific fixes
6. Don't be preachy - be conversational and supportive
7. Use emojis sparingly but naturally 💪
8. If they ask about drills, tell them to check their "locker" in the app
9. Reference their motor profile when giving swing advice if known

Remember: You're their coach via text. Keep it short, personal, and actionable.`;

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
// SEND SMS VIA TWILIO
// ============================================================

async function sendSMS(to: string, message: string): Promise<{ success: boolean; sid?: string }> {
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
  
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error("[Twilio Webhook] Missing Twilio credentials");
    return { success: false };
  }
  
  const formattedPhone = normalizePhone(to);
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  const response = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: formattedPhone,
      From: TWILIO_PHONE_NUMBER,
      Body: message,
    }),
  });
  
  const data = await response.json();
  
  if (response.ok) {
    return { success: true, sid: data.sid };
  } else {
    console.error("[Twilio Webhook] Failed to send SMS:", data);
    return { success: false };
  }
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
    const body = formData.get("Body") as string;

    console.log("[Twilio Webhook] Received SMS from:", from, "Body:", body?.slice(0, 50));

    if (!from || !body) {
      throw new Error("Missing required fields");
    }

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
      const command = parseAdminCommand(body);
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
        }
        
        // Send admin response via Twilio (not TwiML)
        const result = await sendSMS(from, responseText);
        
        // Log admin command
        await supabase.from("coach_api_audit_log").insert({
          action: `admin_${command.type}`,
          phone: normalizedFrom,
          request_body: { command, response: responseText },
          response_status: result.success ? 200 : 500,
        });
        
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
    if (isOptOut(body)) {
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
        body: body,
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
    if (body.toLowerCase().trim() === "start") {
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
        body: body,
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

    // Save inbound message
    await supabase.from("messages").insert({
      player_id: playerId,
      session_id: session?.id || null,
      phone_number: from,
      direction: "inbound",
      body: body,
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
          .select("id, name, phone, motor_profile, coaching_notes, latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score, latest_composite_score, membership_tier, has_sensor, sensor_connected")
          .eq("id", playerId)
          .single();
        player = data;
      }
      
      if (!player && adminMode) {
        // Admin without player profile - minimal context
        player = {
          name: "Admin",
          motor_profile: null,
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
        body,
        conversationHistory,
        LOVABLE_API_KEY
      );

      console.log("[Twilio Webhook] AI reply:", aiReply.slice(0, 50) + "...");

      // Send via Twilio
      const result = await sendSMS(from, aiReply);

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
      }
    } else {
      console.log("[Twilio Webhook] No player found for phone:", from);
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
