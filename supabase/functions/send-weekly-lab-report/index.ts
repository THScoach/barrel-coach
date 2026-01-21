/**
 * Weekly Lab Report Email
 * =======================
 * Sends branded HTML email with 4B scores on 20-80 scale
 * Uses Resend for delivery with #DC2626 red branding
 * 
 * Branding: Catching Barrels Laboratory
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklyReportPayload {
  player_id: string;
}

function getGradeLabel(score: number | null): string {
  if (score === null) return "N/A";
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 45) return "Average";
  if (score >= 40) return "Below Avg";
  if (score >= 30) return "Fringe";
  return "Needs Work";
}

function getScoreColor(score: number | null): string {
  if (score === null) return "#64748b";
  if (score >= 70) return "#22c55e";
  if (score >= 60) return "#22c55e";
  if (score >= 55) return "#3b82f6";
  if (score >= 45) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function buildEmailHtml(data: {
  playerName: string;
  brainScore: number | null;
  bodyScore: number | null;
  batScore: number | null;
  ballScore: number | null;
  compositeScore: number | null;
  grade: string | null;
  leakDetected: string | null;
  priorityDrill: string | null;
  motorProfile: string | null;
  weekStart: string;
  weekEnd: string;
}): string {
  const { 
    playerName, brainScore, bodyScore, batScore, ballScore, 
    compositeScore, grade, leakDetected, priorityDrill, motorProfile,
    weekStart, weekEnd
  } = data;

  const firstName = playerName?.split(" ")[0] || "Athlete";

  const scoreCard = (label: string, score: number | null, emoji: string) => `
    <td style="text-align: center; padding: 16px; background-color: #1a1a1a; border-radius: 8px; width: 25%;">
      <div style="font-size: 24px; margin-bottom: 8px;">${emoji}</div>
      <div style="font-size: 32px; font-weight: 900; color: ${getScoreColor(score)};">${score ?? "--"}</div>
      <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">${label}</div>
      <div style="font-size: 11px; color: ${getScoreColor(score)}; margin-top: 4px;">${getGradeLabel(score)}</div>
    </td>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Lab Report - Catching Barrels</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0b; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px; background: linear-gradient(135deg, #DC2626 0%, #991b1b 100%); border-radius: 12px 12px 0 0; text-align: center;">
              <div style="font-size: 12px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">🔬 CATCHING BARRELS</div>
              <div style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">WEEKLY LAB REPORT</div>
              <div style="font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 8px;">${weekStart} - ${weekEnd}</div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 24px 16px; background-color: #111113;">
              <div style="font-size: 18px; color: #f1f5f9;">Hey ${firstName},</div>
              <div style="font-size: 14px; color: #94a3b8; margin-top: 8px; line-height: 1.6;">
                Here's your weekly swing analysis from the lab. Your 4B scores on the 20-80 MLB Scout Scale:
              </div>
            </td>
          </tr>

          <!-- 4B Scores Grid -->
          <tr>
            <td style="padding: 0 24px; background-color: #111113;">
              <table width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  ${scoreCard("BRAIN", brainScore, "🧠")}
                  ${scoreCard("BODY", bodyScore, "💪")}
                </tr>
                <tr>
                  ${scoreCard("BAT", batScore, "🦇")}
                  ${scoreCard("BALL", ballScore, "⚾")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Composite Score -->
          <tr>
            <td style="padding: 24px; background-color: #111113;">
              <div style="background: linear-gradient(135deg, #DC262620 0%, #DC262610 100%); border: 2px solid #DC262680; border-radius: 12px; padding: 24px; text-align: center;">
                <div style="font-size: 11px; color: #DC2626; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">COMPOSITE SCORE</div>
                <div style="font-size: 48px; font-weight: 900; color: #ffffff;">${compositeScore ?? "--"}</div>
                <div style="font-size: 14px; color: #94a3b8;">${grade || ""} ${motorProfile ? `• ${motorProfile} Profile` : ""}</div>
              </div>
            </td>
          </tr>

          ${leakDetected || priorityDrill ? `
          <!-- Training Focus -->
          <tr>
            <td style="padding: 0 24px 24px; background-color: #111113;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${leakDetected ? `
                <tr>
                  <td style="padding: 16px; background-color: #DC262610; border-left: 4px solid #DC2626; border-radius: 0 8px 8px 0; margin-bottom: 12px;">
                    <div style="font-size: 11px; color: #DC2626; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">⚠️ KINETIC LEAK DETECTED</div>
                    <div style="font-size: 16px; color: #f1f5f9; font-weight: 600;">${leakDetected}</div>
                  </td>
                </tr>
                ` : ""}
                ${priorityDrill ? `
                <tr>
                  <td style="padding: 16px; background-color: #22c55e10; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; margin-top: 12px;">
                    <div style="font-size: 11px; color: #22c55e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">🎯 PRIORITY DRILL</div>
                    <div style="font-size: 16px; color: #f1f5f9; font-weight: 600;">${priorityDrill}</div>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- CTA -->
          <tr>
            <td style="padding: 0 24px 32px; background-color: #111113;">
              <a href="https://barrel-coach.lovable.app/player" style="display: block; padding: 16px 32px; background: linear-gradient(135deg, #DC2626 0%, #f97316 100%); color: #ffffff; font-weight: 700; text-align: center; text-decoration: none; border-radius: 8px; font-size: 16px;">
                View Full Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #0a0a0b; border-top: 1px solid #1e293b; text-align: center; border-radius: 0 0 12px 12px;">
              <div style="font-size: 12px; color: #64748b;">Train smarter. Swing harder.</div>
              <div style="font-size: 11px; color: #475569; margin-top: 8px;">© Catching Barrels Laboratory</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(RESEND_API_KEY);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { player_id }: WeeklyReportPayload = await req.json();

    console.log(`[Weekly Lab Report] Generating for player: ${player_id}`);

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, email")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${player_id}`);
    }

    if (!player.email) {
      return new Response(
        JSON.stringify({ success: false, reason: "no_email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get latest reboot upload for this player
    const { data: latestUpload, error: uploadError } = await supabase
      .from("reboot_uploads")
      .select("*")
      .eq("player_id", player_id)
      .order("session_date", { ascending: false })
      .limit(1)
      .single();

    if (uploadError || !latestUpload) {
      console.log("[Weekly Lab Report] No uploads found for player");
      return new Response(
        JSON.stringify({ success: false, reason: "no_data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate week range
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const weekStartStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const weekEndStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    // Build email
    const html = buildEmailHtml({
      playerName: player.name || "Athlete",
      brainScore: latestUpload.brain_score,
      bodyScore: latestUpload.body_score,
      batScore: latestUpload.bat_score,
      ballScore: null, // Not in reboot_uploads, could be from launch monitor
      compositeScore: latestUpload.composite_score ? Math.round(Number(latestUpload.composite_score)) : null,
      grade: latestUpload.grade,
      leakDetected: latestUpload.leak_detected,
      priorityDrill: latestUpload.priority_drill,
      motorProfile: latestUpload.motor_profile,
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
    });

    // Send email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Catching Barrels Lab <lab@catchingbarrels.com>",
      to: [player.email],
      subject: `🔬 Your Weekly Lab Report - Score: ${latestUpload.composite_score ? Math.round(Number(latestUpload.composite_score)) : "--"}/80`,
      html,
    });

    if (emailError) {
      console.error("[Weekly Lab Report] Email error:", emailError);
      throw new Error(emailError.message);
    }

    console.log(`[Weekly Lab Report] Sent to ${player.email}`);

    // Log activity
    await supabase.from("activity_log").insert({
      action: "email_sent",
      description: `Weekly Lab Report sent`,
      player_id: player.id,
      metadata: {
        email_id: emailResult?.id,
        composite_score: latestUpload.composite_score,
      },
    });

    return new Response(
      JSON.stringify({ success: true, email_id: emailResult?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Weekly Lab Report] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
