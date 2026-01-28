/**
 * Coach Daily Report API
 * =======================
 * Generates a 24-hour summary of Coach API activity for WhatsApp delivery.
 * 
 * GET /coach-daily-report
 * Authorization: Bearer <COACH_API_KEY>
 * 
 * Returns: Text summary suitable for WhatsApp
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuditLogEntry {
  id: string;
  action: string;
  player_id: string | null;
  phone: string | null;
  request_body: Record<string, unknown> | null;
  response_status: number | null;
  ip_address: string | null;
  created_at: string;
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

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const expectedKey = Deno.env.get("COACH_API_KEY");

    if (!expectedKey || token !== expectedKey) {
      console.log("[DailyReport] Invalid API key attempt");
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get logs from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error: logsError } = await supabase
      .from("coach_api_audit_log")
      .select("*")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });

    if (logsError) {
      console.error("[DailyReport] Error fetching logs:", logsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch audit logs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auditLogs = (logs || []) as AuditLogEntry[];

    // Calculate metrics
    const totalCalls = auditLogs.length;
    
    // Reads vs Writes (lookup = read, update/conversation = write)
    const reads = auditLogs.filter(l => l.action === "lookup" || l.action === "player_lookup").length;
    const writes = auditLogs.filter(l => 
      l.action === "player_updated" || 
      l.action === "conversation_logged" ||
      l.action === "update"
    ).length;
    const errors = auditLogs.filter(l => l.action === "error").length;

    // Unique players
    const uniquePlayers = new Set(
      auditLogs.filter(l => l.player_id).map(l => l.player_id)
    ).size;

    // Failed auth (401s)
    const failedAuth = auditLogs.filter(l => l.response_status === 401).length;

    // Rate limit hits (429s)
    const rateLimitHits = auditLogs.filter(l => l.response_status === 429).length;

    // Top 5 IPs
    const ipCounts: Record<string, number> = {};
    auditLogs.forEach(l => {
      if (l.ip_address) {
        ipCounts[l.ip_address] = (ipCounts[l.ip_address] || 0) + 1;
      }
    });
    const topIPs = Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Unusual patterns: players accessed 10+ times
    const playerAccessCounts: Record<string, { count: number; phone?: string }> = {};
    auditLogs.forEach(l => {
      if (l.player_id) {
        if (!playerAccessCounts[l.player_id]) {
          playerAccessCounts[l.player_id] = { count: 0, phone: l.phone || undefined };
        }
        playerAccessCounts[l.player_id].count++;
      }
    });
    const frequentlyAccessed = Object.entries(playerAccessCounts)
      .filter(([_, data]) => data.count >= 10)
      .sort((a, b) => b[1].count - a[1].count);

    // Format date for report header
    const now = new Date();
    const reportDate = now.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    // Build WhatsApp-friendly message
    let message = `📊 *Coach API Report*\n`;
    message += `${reportDate} (Last 24h)\n\n`;

    message += `📈 *Activity Summary*\n`;
    message += `• Total calls: ${totalCalls}\n`;
    message += `• Reads: ${reads} | Writes: ${writes}\n`;
    message += `• Unique players: ${uniquePlayers}\n`;
    if (errors > 0) {
      message += `• Errors: ${errors}\n`;
    }

    // Security section
    if (failedAuth > 0 || rateLimitHits > 0) {
      message += `\n🔐 *Security Events*\n`;
      if (failedAuth > 0) {
        message += `• ⚠️ Failed auth attempts: ${failedAuth}\n`;
      }
      if (rateLimitHits > 0) {
        message += `• ⚠️ Rate limit hits: ${rateLimitHits}\n`;
      }
    }

    // Top IPs
    if (topIPs.length > 0) {
      message += `\n🌐 *Top IPs*\n`;
      topIPs.forEach(([ip, count], idx) => {
        // Mask middle of IP for privacy
        const maskedIP = ip.includes(".")
          ? ip.split(".").map((p, i) => (i === 1 || i === 2) ? "***" : p).join(".")
          : ip;
        message += `${idx + 1}. ${maskedIP}: ${count} calls\n`;
      });
    }

    // Unusual patterns
    if (frequentlyAccessed.length > 0) {
      message += `\n🔍 *High Activity Players*\n`;
      frequentlyAccessed.slice(0, 5).forEach(([playerId, data]) => {
        const phoneHint = data.phone ? `****${data.phone.slice(-4)}` : "N/A";
        message += `• ${phoneHint}: ${data.count} accesses\n`;
      });
    }

    // All clear message if nothing unusual
    if (totalCalls === 0) {
      message = `📊 *Coach API Report*\n${reportDate}\n\n😴 No API activity in the last 24 hours.`;
    } else if (failedAuth === 0 && rateLimitHits === 0 && frequentlyAccessed.length === 0) {
      message += `\n✅ All systems normal`;
    }

    console.log(`[DailyReport] Generated report: ${totalCalls} calls, ${uniquePlayers} players`);

    return new Response(
      JSON.stringify({
        report: message,
        metrics: {
          total_calls: totalCalls,
          reads,
          writes,
          errors,
          unique_players: uniquePlayers,
          failed_auth: failedAuth,
          rate_limit_hits: rateLimitHits,
          top_ips: topIPs.map(([ip, count]) => ({ ip, count })),
          high_activity_players: frequentlyAccessed.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DailyReport] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
