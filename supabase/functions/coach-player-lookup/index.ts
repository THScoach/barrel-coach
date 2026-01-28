/**
 * Coach Player Lookup API
 * ========================
 * Secure endpoint for Coach Rick AI to look up player data by phone.
 * 
 * GET /coach-player-lookup?phone=+1234567890
 * Authorization: Bearer <COACH_API_KEY>
 * 
 * Returns: Limited player fields (no PII beyond first name)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  
  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_WINDOW };
  }
  
  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetIn: record.resetTime - now };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000); // Clean every minute

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("cf-connecting-ip") 
      || "unknown";
    
    // Check rate limit
    const rateCheck = checkRateLimit(clientIP);
    const rateLimitHeaders = {
      "X-RateLimit-Limit": RATE_LIMIT.toString(),
      "X-RateLimit-Remaining": rateCheck.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(rateCheck.resetIn / 1000).toString(),
    };
    
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
        { 
          status: 429, 
          headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate Authorization header
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
      console.log("[CoachLookup] Invalid API key attempt");
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check kill switch
    const { data: killSwitchSetting } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_name", "coach_api_enabled")
      .single();

    if (killSwitchSetting && killSwitchSetting.setting_value === false) {
      console.log("[CoachLookup] Kill switch active - blocking request");
      
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

    // Get phone from query params
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone");
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number
    const normalizedPhone = phone.replace(/\s/g, "").replace(/^(\d)/, "+$1");
    const phoneDigits = phone.replace(/\D/g, "");
    const last10 = phoneDigits.slice(-10);
    
    console.log(`[CoachLookup] Looking up player: ${last10.slice(-4)}****`);

    // Use existing supabase client from above

    // Find player by phone (try multiple formats)
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, motor_profile_sensor, membership_tier, account_status")
      .or(`phone.eq.${normalizedPhone},phone.eq.${last10},phone.eq.+1${last10}`)
      .limit(1)
      .maybeSingle();

    if (playerError) {
      console.error("[CoachLookup] Database error:", playerError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!player) {
      return new Response(
        JSON.stringify({ error: "Player not found" }),
        { status: 404, headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get last swing date from sessions or swings
    const { data: lastSession } = await supabase
      .from("sessions")
      .select("created_at")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get current KRS score from latest 4B scores
    const { data: latestScore } = await supabase
      .from("swing_4b_scores")
      .select("composite_score")
      .eq("player_id", player.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Extract first name only (no full name PII)
    const firstName = player.name?.split(" ")[0] || null;

    // Build response with only allowed fields
    const response = {
      id: player.id,
      first_name: firstName,
      motor_profile: player.motor_profile_sensor || null,
      membership_tier: player.membership_tier || "Free",
      account_status: player.account_status || "active",
      last_swing_date: lastSession?.created_at || null,
      current_krs_score: latestScore?.composite_score || null,
    };

    console.log(`[CoachLookup] Found player: ${player.id}, Motor: ${response.motor_profile}, Tier: ${response.membership_tier}`);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("[CoachLookup] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
