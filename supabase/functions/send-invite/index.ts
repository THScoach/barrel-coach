import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INVITE_TYPE_PATHS: Record<string, string> = {
  diagnostic: "/diagnostic",
  assessment: "/assessment",
  membership: "/pricing",
  beta: "/beta",
};

const INVITE_TYPE_LABELS: Record<string, string> = {
  diagnostic: "Free Swing Diagnostic",
  assessment: "The Academy",
  membership: "Private Coaching",
  beta: "Beta Access",
};

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  let formatted = phone.replace(/\D/g, "");
  if (formatted.length === 10) {
    formatted = `+1${formatted}`;
  } else if (!formatted.startsWith("+")) {
    formatted = `+${formatted}`;
  }
  return formatted;
}

// Send SMS via Twilio
async function sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string; sid?: string }> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!twilioSid || !twilioToken || !twilioPhone) {
    console.error("Twilio credentials not configured");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioSid}:${twilioToken}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioPhone,
        Body: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", result);
      return { success: false, error: result.message || "Twilio send failed" };
    }

    console.log("SMS sent successfully:", result.sid);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Send Email via Resend
async function sendEmail(email: string, subject: string, html: string): Promise<{ success: boolean; error?: string; id?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    console.error("Resend API key not configured");
    return { success: false, error: "Email not configured" };
  }

  try {
    const resend = new Resend(resendApiKey);

    const result = await resend.emails.send({
      from: "Catching Barrels Lab <lab@catchingbarrels.com>",
      to: [email],
      subject,
      html,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return { success: false, error: result.error.message };
    }

    console.log("Email sent successfully:", result.data?.id);
    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Generate invite message for SMS
function generateSMSMessage(playerName: string | null, inviteType: string, inviteUrl: string): string {
  const firstName = playerName?.split(" ")[0] || "there";
  const typeLabel = INVITE_TYPE_LABELS[inviteType] || inviteType;

  return `Hey ${firstName}! 🎯\n\nCoach Rick here from Catching Barrels. You're invited to check out our ${typeLabel}.\n\nTap here to get started:\n${inviteUrl}\n\nLet's get to work! 💪`;
}

// Generate invite email HTML
function generateEmailHTML(playerName: string | null, inviteType: string, inviteUrl: string): string {
  const firstName = playerName?.split(" ")[0] || "there";
  const typeLabel = INVITE_TYPE_LABELS[inviteType] || inviteType;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited - Catching Barrels</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #DC2626; font-size: 28px; font-weight: 700;">⚾ CATCHING BARRELS</h1>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">The Laboratory</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px; background-color: #1e293b;">
              <h2 style="margin: 0 0 20px; color: #f8fafc; font-size: 24px;">Hey ${firstName}! 🎯</h2>
              
              <p style="margin: 0 0 20px; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                Coach Rick here. You've been personally invited to check out our <strong style="color: #f8fafc;">${typeLabel}</strong>.
              </p>
              
              <p style="margin: 0 0 30px; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                We use pro-level technology to analyze your swing and give you a clear path to improvement. No guessing, no fluff—just real data and actionable drills.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" style="display: inline-block; padding: 16px 40px; background-color: #DC2626; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Get Started →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #64748b; font-size: 14px; text-align: center;">
                Questions? Just reply to this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0f172a; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0; color: #475569; font-size: 12px;">
                Catching Barrels Laboratory<br>
                Pro-level swing analysis for every player
              </p>
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { email, player_name, phone, invite_type, resend_invite_id } = await req.json();

    // Get the user making the request
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    let invite;
    let isResend = false;

    if (resend_invite_id) {
      // Resending an existing invite
      isResend = true;
      const { data: existingInvite, error: fetchError } = await supabase
        .from("invites")
        .select("*")
        .eq("id", resend_invite_id)
        .single();

      if (fetchError || !existingInvite) {
        throw new Error("Invite not found");
      }

      // Update the last_sent_at
      const { data: updatedInvite, error: updateError } = await supabase
        .from("invites")
        .update({ 
          last_sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", resend_invite_id)
        .select()
        .single();

      if (updateError) throw updateError;
      invite = updatedInvite;
    } else {
      // Creating a new invite
      if (!email && !phone) {
        throw new Error("Either email or phone is required");
      }
      if (!invite_type) {
        throw new Error("invite_type is required");
      }

      const { data: newInvite, error: insertError } = await supabase
        .from("invites")
        .insert({
          email: email || null,
          phone: phone ? formatPhoneNumber(phone) : null,
          player_name: player_name || null,
          invite_type,
          delivery_method: phone ? "sms" : "email",
          invited_by: user?.id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      invite = newInvite;
    }

    // Generate invite URL
    const origin = "https://catchingbarrels.com";
    const invitePath = INVITE_TYPE_PATHS[invite.invite_type] || "/";
    const inviteUrl = `${origin}${invitePath}?invite=${invite.invite_token}`;

    // Track delivery results
    let smsSent = false;
    let smsError: string | null = null;
    let emailSent = false;
    let emailError: string | null = null;

    // Send SMS if phone is available (preferred channel)
    if (invite.phone) {
      const smsMessage = generateSMSMessage(invite.player_name, invite.invite_type, inviteUrl);
      const smsResult = await sendSMS(invite.phone, smsMessage);
      smsSent = smsResult.success;
      smsError = smsResult.error || null;

      // Log SMS attempt
      await supabase.from("sms_logs").insert({
        phone_number: invite.phone,
        trigger_name: isResend ? "invite_resend" : "invite_new",
        message_sent: smsMessage,
        status: smsSent ? "sent" : "failed",
        error_message: smsError,
      });
    }

    // Send email if available (send BOTH SMS and email when both are available)
    if (invite.email) {
      const emailSubject = `You're Invited: ${INVITE_TYPE_LABELS[invite.invite_type] || invite.invite_type}`;
      const emailHtml = generateEmailHTML(invite.player_name, invite.invite_type, inviteUrl);
      const emailResult = await sendEmail(invite.email, emailSubject, emailHtml);
      emailSent = emailResult.success;
      emailError = emailResult.error || null;
    }

    // Update invite with delivery status - track if both channels were used
    const deliveryMethod = smsSent && emailSent ? "sms" : smsSent ? "sms" : emailSent ? "email" : "failed";
    await supabase
      .from("invites")
      .update({
        delivery_method: deliveryMethod,
      })
      .eq("id", invite.id);
    
    // Log to communication_logs for tracking
    await supabase.from("communication_logs").insert({
      event_type: isResend ? "invite_resend" : "invite_new",
      payload: {
        invite_id: invite.id,
        invite_type: invite.invite_type,
        sms_sent: smsSent,
        email_sent: emailSent,
        sms_error: smsError,
        email_error: emailError,
      },
      status: smsSent || emailSent ? "sent" : "failed",
      error_message: smsError || emailError,
    });

    // Log to activity
    await supabase.from("activity_log").insert({
      event_type: isResend ? "invite_resent" : "invite_sent",
      entity_type: "invite",
      entity_id: invite.id,
      user_id: user?.id || null,
      metadata: {
        invite_type: invite.invite_type,
        sms_sent: smsSent,
        email_sent: emailSent,
        player_name: invite.player_name,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: smsSent || emailSent,
        invite_id: invite.id,
        invite_url: inviteUrl,
        sms_sent: smsSent,
        sms_error: smsError,
        email_sent: emailSent,
        email_error: emailError,
        delivery_method: smsSent ? "sms" : emailSent ? "email" : "none",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Send invite error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
