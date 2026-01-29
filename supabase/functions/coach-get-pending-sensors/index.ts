/**
 * Coach Get Pending Sensors API
 * ==============================
 * Get list of players who have sensors but haven't connected to DK group.
 * 
 * GET /coach-get-pending-sensors
 * Authorization: Bearer <COACH_API_KEY>
 * 
 * Response:
 * {
 *   "pending": [...],
 *   "count": 5
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || req.headers.get("cf-connecting-ip") 
    || "unknown";

  try {
    // Rate limiting
    const rateCheck = checkRateLimit(clientIP);
    const rateLimitHeaders = {
      "X-RateLimit-Limit": RATE_LIMIT.toString(),
      "X-RateLimit-Remaining": rateCheck.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(rateCheck.resetIn / 1000).toString(),
    };

    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const expectedKey = Deno.env.get("COACH_API_KEY");

    if (!expectedKey || token !== expectedKey) {
      console.log("[GetPendingSensors] Invalid API key attempt from:", clientIP);
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[GetPendingSensors] Fetching pending sensor connections");

    // Query players with sensors who haven't connected
    const { data: pendingPlayers, error: queryError } = await supabase
      .from("players")
      .select("id, phone, name, membership_tier, has_sensor, dk_email, sensor_connected, sensor_reminder_sent_at, created_at")
      .eq("has_sensor", true)
      .or("sensor_connected.is.null,sensor_connected.eq.false")
      .order("created_at", { ascending: true });

    if (queryError) {
      console.error("[GetPendingSensors] Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate days since signup and format response
    const now = new Date();
    const pending = (pendingPlayers || []).map(player => {
      const createdAt = new Date(player.created_at);
      const daysSinceSignup = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Mask phone for response
      const phoneDigits = (player.phone || "").replace(/\D/g, "");
      const maskedPhone = phoneDigits.length >= 4 
        ? `****${phoneDigits.slice(-4)}`
        : "****";

      // Calculate days since last reminder
      let daysSinceReminder: number | null = null;
      if (player.sensor_reminder_sent_at) {
        const reminderDate = new Date(player.sensor_reminder_sent_at);
        daysSinceReminder = Math.floor((now.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        player_id: player.id,
        phone: player.phone, // Full phone for Coach Rick to use
        phone_masked: maskedPhone,
        name: player.name?.split(" ")[0] || "Unknown", // First name only
        tier: player.membership_tier || "Unknown",
        has_sensor: true,
        dk_email: player.dk_email || null,
        has_dk_email: !!player.dk_email,
        days_since_signup: daysSinceSignup,
        days_since_reminder: daysSinceReminder,
        needs_followup: !player.dk_email || !player.sensor_connected,
        status: !player.dk_email 
          ? "awaiting_dk_email" 
          : !player.sensor_connected 
            ? "awaiting_dk_invite" 
            : "pending_verification",
      };
    });

    // Categorize pending players
    const awaitingEmail = pending.filter(p => p.status === "awaiting_dk_email");
    const awaitingInvite = pending.filter(p => p.status === "awaiting_dk_invite");

    // Log the request
    await supabase.from("coach_api_audit_log").insert({
      action: "get_pending_sensors",
      request_body: { count: pending.length },
      response_status: 200,
      ip_address: clientIP,
    });

    console.log(`[GetPendingSensors] Found ${pending.length} pending sensor connections`);

    return new Response(
      JSON.stringify({
        pending,
        count: pending.length,
        summary: {
          awaiting_dk_email: awaitingEmail.length,
          awaiting_dk_invite: awaitingInvite.length,
          oldest_pending_days: pending.length > 0 ? Math.max(...pending.map(p => p.days_since_signup)) : 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[GetPendingSensors] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
