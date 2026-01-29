/**
 * Coach Set DK Email API
 * =======================
 * Sets a player's Diamond Kinetics email when they message Coach Rick.
 * 
 * POST /coach-set-dk-email
 * Authorization: Bearer <COACH_API_KEY>
 * 
 * Body:
 * {
 *   "phone": "+15551234567",
 *   "dk_email": "player@email.com"
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
const RATE_LIMIT = 30;
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

interface SetDKEmailRequest {
  phone: string;
  dk_email: string;
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

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
    || req.headers.get("cf-connecting-ip") 
    || "unknown";

  let requestBody: SetDKEmailRequest | null = null;
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
        JSON.stringify({ error: "Rate limit exceeded" }),
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
      console.log("[SetDKEmail] Invalid API key attempt from:", clientIP);
      responseStatus = 401;
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    requestBody = await req.json() as SetDKEmailRequest;

    if (!requestBody.phone) {
      responseStatus = 400;
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!requestBody.dk_email) {
      responseStatus = 400;
      return new Response(
        JSON.stringify({ error: "DK email is required" }),
        { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requestBody.dk_email)) {
      responseStatus = 400;
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone
    const phoneDigits = requestBody.phone.replace(/\D/g, "");
    const last10 = phoneDigits.slice(-10);
    const normalizedPhone = requestBody.phone.replace(/\s/g, "").replace(/^(\d)/, "+$1");

    console.log(`[SetDKEmail] Setting DK email for phone: ****${last10.slice(-4)}`);

    // Find player
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, has_sensor, sensor_connected, dk_email")
      .or(`phone.eq.${normalizedPhone},phone.eq.${last10},phone.eq.+1${last10}`)
      .limit(1)
      .maybeSingle();

    if (playerError) {
      console.error("[SetDKEmail] Player lookup error:", playerError);
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

    // Check if already connected
    if (player.sensor_connected) {
      responseStatus = 200;
      
      // Log the attempt
      await supabase.from("coach_api_audit_log").insert({
        action: "dk_email_already_connected",
        player_id: player.id,
        phone: normalizedPhone,
        request_body: requestBody,
        response_status: 200,
        ip_address: clientIP,
      });

      return new Response(
        JSON.stringify({
          success: true,
          player_id: player.id,
          next_step: "already_connected",
          message: "Player is already connected to DK group"
        }),
        { status: 200, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update player with DK email
    const { error: updateError } = await supabase
      .from("players")
      .update({
        dk_email: requestBody.dk_email.toLowerCase().trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", player.id);

    if (updateError) {
      console.error("[SetDKEmail] Update error:", updateError);
      responseStatus = 500;
      return new Response(
        JSON.stringify({ error: "Failed to update player" }),
        { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine next step
    const nextStep = player.has_sensor ? "send_dk_invite" : "waiting_for_sensor";

    // Log the successful update
    await supabase.from("coach_api_audit_log").insert({
      action: "dk_email_set",
      player_id: player.id,
      phone: normalizedPhone,
      request_body: { ...requestBody, dk_email: "***@***.***" }, // Mask email in log
      response_status: 200,
      ip_address: clientIP,
    });

    console.log(`[SetDKEmail] Successfully set DK email for player ${player.id}, next_step: ${nextStep}`);

    responseStatus = 200;
    return new Response(
      JSON.stringify({
        success: true,
        player_id: player.id,
        next_step: nextStep,
        has_sensor: player.has_sensor || false,
      }),
      { status: 200, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SetDKEmail] Error:", error);

    try {
      await supabase.from("coach_api_audit_log").insert({
        action: "error",
        phone: requestBody?.phone || "unknown",
        request_body: requestBody,
        response_status: 500,
        ip_address: clientIP,
      });
    } catch (auditError) {
      console.error("[SetDKEmail] Audit log error:", auditError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
