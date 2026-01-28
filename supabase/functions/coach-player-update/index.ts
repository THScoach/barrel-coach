/**
 * Coach Player Update API
 * ========================
 * Secure endpoint for Coach Rick AI to update player data and log conversations.
 * 
 * POST /coach-player-update
 * Authorization: Bearer <COACH_API_KEY>
 * 
 * Body (update player):
 * {
 *   "phone": "+1234567890",
 *   "motor_profile": "spinner",
 *   "notes": "Coach notes here",
 *   "last_contact_date": "2024-01-15T10:00:00Z",
 *   "tags": ["vip", "needs-followup"]
 * }
 * 
 * Body (log conversation):
 * {
 *   "phone": "+1234567890",
 *   "message_type": "inbound" | "outbound",
 *   "message_content": "The message text"
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiter for writes (stricter than reads)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50; // writes per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_WINDOW };
  }
  
  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetIn: record.resetTime - now };
}

// Cleanup old entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000);

interface UpdateRequest {
  phone: string;
  // Player update fields
  motor_profile?: string;
  notes?: string;
  last_contact_date?: string;
  tags?: string[];
  // Conversation logging
  message_type?: "inbound" | "outbound";
  message_content?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get client IP
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || req.headers.get("cf-connecting-ip") 
    || "unknown";

  let requestBody: UpdateRequest | null = null;
  let responseStatus = 500;

  try {
    // Rate limiting
    const rateCheck = checkRateLimit(clientIP);
    const rateLimitHeaders = {
      "X-RateLimit-Limit": RATE_LIMIT.toString(),
      "X-RateLimit-Remaining": rateCheck.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(rateCheck.resetIn / 1000).toString(),
    };

    if (!rateCheck.allowed) {
      responseStatus = 429;
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        { status: 429, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      responseStatus = 401;
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const expectedKey = Deno.env.get("COACH_API_KEY");

    if (!expectedKey || token !== expectedKey) {
      console.log("[CoachUpdate] Invalid API key attempt from:", clientIP);
      responseStatus = 401;
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check kill switch
    const { data: killSwitchSetting } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_name", "coach_api_enabled")
      .single();

    if (killSwitchSetting && killSwitchSetting.setting_value === false) {
      console.log("[CoachUpdate] Kill switch active - blocking request");
      
      // Log the blocked request
      await supabase.from("coach_api_audit_log").insert({
        action: "kill_switch_blocked",
        ip_address: clientIP,
        response_status: 503,
      });

      return new Response(
        JSON.stringify({ error: "Coach API temporarily disabled", code: "KILL_SWITCH_ACTIVE" }),
        { status: 503, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    requestBody = await req.json() as UpdateRequest;

    if (!requestBody.phone) {
      responseStatus = 400;
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone
    const phoneDigits = requestBody.phone.replace(/\D/g, "");
    const last10 = phoneDigits.slice(-10);
    const normalizedPhone = requestBody.phone.replace(/\s/g, "").replace(/^(\d)/, "+$1");

    console.log(`[CoachUpdate] Processing request for phone: ****${last10.slice(-4)}`);

    // Find player
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, motor_profile_sensor, notes, tags, last_contact_date")
      .or(`phone.eq.${normalizedPhone},phone.eq.${last10},phone.eq.+1${last10}`)
      .limit(1)
      .maybeSingle();

    if (playerError) {
      console.error("[CoachUpdate] Player lookup error:", playerError);
      responseStatus = 500;
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!player) {
      responseStatus = 404;
      return new Response(
        JSON.stringify({ error: "Player not found" }),
        { status: 404, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine action type
    const isConversationLog = requestBody.message_type && requestBody.message_content;
    let result: any;

    if (isConversationLog) {
      // Log conversation
      console.log(`[CoachUpdate] Logging ${requestBody.message_type} conversation for player ${player.id}`);

      const { data: conversation, error: convError } = await supabase
        .from("coach_conversations")
        .insert({
          player_id: player.id,
          phone: normalizedPhone,
          message_type: requestBody.message_type,
          message_content: requestBody.message_content,
          metadata: { source: "coach_api" },
        })
        .select("id, created_at")
        .single();

      if (convError) {
        console.error("[CoachUpdate] Conversation insert error:", convError);
        responseStatus = 500;
        return new Response(
          JSON.stringify({ error: "Failed to log conversation" }),
          { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also update last_contact_date
      await supabase
        .from("players")
        .update({ last_contact_date: new Date().toISOString() })
        .eq("id", player.id);

      result = {
        action: "conversation_logged",
        conversation_id: conversation.id,
        created_at: conversation.created_at,
        player_id: player.id,
      };
      responseStatus = 201;

    } else {
      // Update player fields
      const updateFields: Record<string, any> = {};

      if (requestBody.motor_profile !== undefined) {
        updateFields.motor_profile_sensor = requestBody.motor_profile;
      }
      if (requestBody.notes !== undefined) {
        updateFields.notes = requestBody.notes;
      }
      if (requestBody.last_contact_date !== undefined) {
        updateFields.last_contact_date = requestBody.last_contact_date;
      }
      if (requestBody.tags !== undefined) {
        updateFields.tags = requestBody.tags;
      }

      if (Object.keys(updateFields).length === 0) {
        responseStatus = 400;
        return new Response(
          JSON.stringify({ error: "No valid fields to update" }),
          { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      updateFields.updated_at = new Date().toISOString();

      console.log(`[CoachUpdate] Updating player ${player.id} with fields:`, Object.keys(updateFields));

      const { data: updatedPlayer, error: updateError } = await supabase
        .from("players")
        .update(updateFields)
        .eq("id", player.id)
        .select("id, name, motor_profile_sensor, notes, tags, last_contact_date, updated_at")
        .single();

      if (updateError) {
        console.error("[CoachUpdate] Update error:", updateError);
        responseStatus = 500;
        return new Response(
          JSON.stringify({ error: "Failed to update player" }),
          { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
        );
      }

      result = {
        action: "player_updated",
        player: {
          id: updatedPlayer.id,
          first_name: updatedPlayer.name?.split(" ")[0] || null,
          motor_profile: updatedPlayer.motor_profile_sensor,
          tags: updatedPlayer.tags,
          last_contact_date: updatedPlayer.last_contact_date,
          updated_at: updatedPlayer.updated_at,
        },
      };
      responseStatus = 200;
    }

    // Audit log
    await supabase.from("coach_api_audit_log").insert({
      action: isConversationLog ? "conversation_logged" : "player_updated",
      player_id: player.id,
      phone: normalizedPhone,
      request_body: requestBody,
      response_status: responseStatus,
      ip_address: clientIP,
    });

    console.log(`[CoachUpdate] Success: ${result.action} for player ${player.id}`);

    return new Response(
      JSON.stringify(result),
      { status: responseStatus, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CoachUpdate] Error:", error);

    // Attempt to log failed request
    try {
      await supabase.from("coach_api_audit_log").insert({
        action: "error",
        phone: requestBody?.phone || "unknown",
        request_body: requestBody,
        response_status: 500,
        ip_address: clientIP,
      });
    } catch (auditError) {
      console.error("[CoachUpdate] Audit log error:", auditError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
