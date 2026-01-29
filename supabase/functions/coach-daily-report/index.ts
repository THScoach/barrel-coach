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
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Kill switch blocks
    const killSwitchBlocks = auditLogs.filter(l => l.action === "kill_switch_blocked").length;

    // Build WhatsApp-friendly plain text message (no markdown)
    let lines: string[] = [];
    
    lines.push("🔐 COACH RICK DAILY REPORT");
    lines.push(`📅 ${reportDate}`);
    lines.push("");
    lines.push("📊 API Activity (24h)");
    lines.push(`Total calls: ${totalCalls}`);
    lines.push(`Reads: ${reads} | Writes: ${writes}`);
    lines.push(`Unique players: ${uniquePlayers}`);
    
    if (errors > 0) {
      lines.push(`Errors: ${errors}`);
    }

    lines.push("");
    lines.push("⚠️ Security");
    lines.push(`Failed auths: ${failedAuth}`);
    lines.push(`Rate limits hit: ${rateLimitHits}`);
    if (killSwitchBlocks > 0) {
      lines.push(`Kill switch blocks: ${killSwitchBlocks}`);
    }

    // Top IPs
    if (topIPs.length > 0) {
      lines.push("");
      lines.push("🌐 Top IPs");
      topIPs.forEach(([ip, count], idx) => {
        lines.push(`${idx + 1}. ${ip} (${count} calls)`);
      });
    }

    // Anomalies section
    const anomalies: string[] = [];
    
    if (failedAuth >= 5) {
      anomalies.push(`🚨 ${failedAuth} failed auth attempts detected`);
    }
    
    if (frequentlyAccessed.length > 0) {
      frequentlyAccessed.slice(0, 3).forEach(([_, data]) => {
        const phoneHint = data.phone ? `****${data.phone.slice(-4)}` : "unknown";
        anomalies.push(`🔍 Player ${phoneHint} accessed ${data.count}x`);
      });
    }

    if (rateLimitHits >= 5) {
      anomalies.push(`🚨 ${rateLimitHits} rate limit hits - possible abuse`);
    }

    lines.push("");
    if (anomalies.length > 0) {
      lines.push("🚨 Anomalies Detected");
      anomalies.forEach(a => lines.push(a));
    } else {
      lines.push("✅ No anomalies detected");
    }

    // Handle no activity case
    if (totalCalls === 0) {
      lines = [
        "🔐 COACH RICK DAILY REPORT",
        `📅 ${reportDate}`,
        "",
        "😴 No API activity in the last 24 hours."
      ];
    }

    // Query pending sensor connections for follow-up section
    const { data: pendingSensors } = await supabase
      .from("players")
      .select("phone, name, membership_tier, created_at, sensor_reminder_sent_at")
      .eq("has_sensor", true)
      .or("sensor_connected.is.null,sensor_connected.eq.false")
      .order("created_at", { ascending: true })
      .limit(10);

    if (pendingSensors && pendingSensors.length > 0) {
      lines.push("");
      lines.push("🔔 Sensor Connection Follow-ups");
      lines.push(`${pendingSensors.length} player(s) need DK setup:`);
      
      pendingSensors.slice(0, 5).forEach((p, idx) => {
        const createdAt = new Date(p.created_at);
        const daysWaiting = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const phoneHint = p.phone ? `****${p.phone.replace(/\D/g, "").slice(-4)}` : "no phone";
        const firstName = p.name?.split(" ")[0] || "Unknown";
        lines.push(`${idx + 1}. ${firstName} (${phoneHint}) - ${daysWaiting}d waiting`);
      });
      
      if (pendingSensors.length > 5) {
        lines.push(`... and ${pendingSensors.length - 5} more`);
      }
    }

    const report = lines.join("\n");

    console.log(`[DailyReport] Generated report: ${totalCalls} calls, ${uniquePlayers} players`);

    return new Response(
      JSON.stringify({
        report,
        metrics: {
          total_calls: totalCalls,
          reads,
          writes,
          errors,
          unique_players: uniquePlayers,
          failed_auth: failedAuth,
          rate_limit_hits: rateLimitHits,
          kill_switch_blocks: killSwitchBlocks,
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
