import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  player_id: string;
  subject?: string;
  message: string;
  template?: "custom" | "lab_report" | "session_complete";
}

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

    const { player_id, subject, message, template = "custom" }: SendEmailRequest = await req.json();

    if (!player_id) {
      throw new Error("player_id is required");
    }

    if (!message) {
      throw new Error("message is required");
    }

    console.log(`[Send Player Email] Processing for player ${player_id}`);

    // Get player email
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, email")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${player_id}`);
    }

    if (!player.email) {
      console.log(`[Send Player Email] Player ${player_id} has no email`);
      return new Response(
        JSON.stringify({ success: false, reason: "no_email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailSubject = subject || "Message from Catching Barrels Laboratory";
    
    // Build HTML email with branding
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
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
        Hey ${player.name?.split(' ')[0] || 'there'},
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

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px;">
      <p style="color: #525252; font-size: 12px; margin: 0;">
        Catching Barrels Laboratory • 4B Diagnostic System
      </p>
      <p style="color: #404040; font-size: 11px; margin: 8px 0 0 0;">
        You're receiving this because you're part of the Catching Barrels program.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "Catching Barrels <onboarding@resend.dev>",
      to: [player.email],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log(`[Send Player Email] Sent to ${player.email}:`, emailResponse);
    
    const emailId = emailResponse.data?.id || "unknown";

    // Log to activity_log
    await supabase.from("activity_log").insert({
      player_id: player_id,
      action: "email_sent",
      description: `Email sent: ${emailSubject}`,
      metadata: {
        email_id: emailId,
        subject: emailSubject,
        template,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: emailId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Send Player Email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
