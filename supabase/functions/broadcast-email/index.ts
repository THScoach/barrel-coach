import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { subject, message } = await req.json();

    if (!subject || !message) {
      throw new Error("subject and message are required");
    }

    console.log(`[Broadcast Email] Starting broadcast...`);

    // Fetch all players with email_opt_in = true and valid email
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, name, email")
      .eq("email_opt_in", true)
      .not("email", "is", null);

    if (playersError) {
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    const eligiblePlayers = players?.filter(p => p.email) || [];
    console.log(`[Broadcast Email] Found ${eligiblePlayers.length} eligible players`);

    if (eligiblePlayers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No eligible players found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send emails to each player
    for (const player of eligiblePlayers) {
      try {
        const firstName = player.name?.split(' ')[0] || 'there';
        
        // Generate unsubscribe link
        const unsubscribeToken = btoa(player.id).replace(/=/g, "");
        const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?player_id=${player.id}&token=${unsubscribeToken}`;
        
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #0A0A0B;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); padding: 12px 24px; border-radius: 8px;">
        <h1 style="color: white; font-size: 18px; font-weight: 700; margin: 0; letter-spacing: 1px;">
          CATCHING BARRELS
        </h1>
        <p style="color: rgba(255,255,255,0.8); font-size: 10px; margin: 4px 0 0 0; letter-spacing: 2px;">
          DIAGNOSTIC LABORATORY
        </p>
      </div>
    </div>

    <!-- Content Card -->
    <div style="background-color: #1a1a1b; border: 1px solid #2d2d2d; border-radius: 12px; padding: 32px; box-shadow: 0 0 30px rgba(220, 38, 38, 0.1);">
      <p style="color: #e5e5e5; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Hey ${firstName},
      </p>
      
      <div style="color: #d4d4d4; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">
${message}
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #2d2d2d;">
        <p style="color: #a3a3a3; font-size: 14px; margin: 0;">
          Keep swinging,<br>
          <strong style="color: #DC2626;">Coach Rick</strong>
        </p>
      </div>
    </div>

    <!-- Footer with Unsubscribe -->
    <div style="text-align: center; margin-top: 24px;">
      <p style="color: #525252; font-size: 12px; margin: 0;">
        Catching Barrels Laboratory • 4B Diagnostic System
      </p>
      <p style="color: #404040; font-size: 11px; margin: 8px 0 0 0;">
        You're receiving this because you opted in to email updates.
      </p>
      <p style="margin-top: 12px;">
        <a href="${unsubscribeUrl}" style="color: #525252; font-size: 11px; text-decoration: underline;">
          Unsubscribe from emails
        </a>
      </p>
    </div>
  </div>
</body>
</html>
        `;

        await resend.emails.send({
          from: "Catching Barrels <onboarding@resend.dev>",
          to: [player.email!],
          subject: subject,
          html: emailHtml,
        });

        // Log to activity_log
        await supabase.from("activity_log").insert({
          player_id: player.id,
          action: "broadcast_email_sent",
          description: `Broadcast email: ${subject}`,
          metadata: { subject },
        });

        results.sent++;
        console.log(`[Broadcast Email] Sent to ${player.email}`);
      } catch (emailError) {
        results.failed++;
        const errorMsg = emailError instanceof Error ? emailError.message : "Unknown error";
        results.errors.push(`${player.email}: ${errorMsg}`);
        console.error(`[Broadcast Email] Failed for ${player.email}:`, emailError);
      }
    }

    // Log the broadcast event
    await supabase.from("communication_logs").insert({
      event_type: "broadcast_email",
      payload: { subject, message, recipients: eligiblePlayers.length },
      status: results.failed === 0 ? "success" : "partial",
    });

    console.log(`[Broadcast Email] Complete: ${results.sent} sent, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: results.sent, 
        failed: results.failed,
        errors: results.errors.slice(0, 5), // Only return first 5 errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Broadcast Email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
