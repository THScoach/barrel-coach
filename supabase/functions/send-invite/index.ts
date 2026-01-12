import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INVITE_TYPE_SUBJECTS: Record<string, string> = {
  diagnostic: "Your Free Swing Diagnostic from Catching Barrels",
  assessment: "Complete Your KRS Assessment - Catching Barrels",
  membership: "Welcome to Catching Barrels Membership",
  beta: "You're Invited to Beta Test Catching Barrels",
};

const INVITE_TYPE_PATHS: Record<string, string> = {
  diagnostic: "/diagnostic",
  assessment: "/assessment",
  membership: "/pricing",
  beta: "/beta",
};

const INVITE_SMS_MESSAGES: Record<string, (name: string, url: string) => string> = {
  diagnostic: (name, url) => `Hey ${name}! 🔥 You're invited to get a free swing diagnostic from Coach Rick. Upload your swing here: ${url}`,
  assessment: (name, url) => `Hey ${name}! Ready to find out what's really happening in your swing? Complete your KRS Assessment: ${url} - Coach Rick`,
  membership: (name, url) => `Hey ${name}! You're invited to join Catching Barrels. Get access to all drills, videos, and coaching: ${url} - Coach Rick`,
  beta: (name, url) => `Hey ${name}! 🔥 You've been invited to beta test Catching Barrels. Jump in and let me know what you think: ${url} - Coach Rick`,
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { email, player_name, phone, invite_type, delivery_method = "email", resend_invite_id } = await req.json();

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
      const method = delivery_method || "email";
      
      // Validate required fields based on delivery method
      if ((method === "email" || method === "both") && !email) {
        throw new Error("Email is required for email delivery");
      }
      if ((method === "sms" || method === "both") && !phone) {
        throw new Error("Phone number is required for SMS delivery");
      }
      if (!invite_type) {
        throw new Error("invite_type is required");
      }

      const { data: newInvite, error: insertError } = await supabase
        .from("invites")
        .insert({
          email: email || null,
          phone: phone || null,
          player_name: player_name || null,
          invite_type,
          delivery_method: method,
          invited_by: user?.id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      invite = newInvite;
    }

    // Generate invite URL
    const origin = req.headers.get("origin") || "https://catchingbarrels.com";
    const invitePath = INVITE_TYPE_PATHS[invite.invite_type] || "/";
    const inviteUrl = `${origin}${invitePath}?invite=${invite.invite_token}`;

    const deliveryMethod = invite.delivery_method || "email";
    const firstName = invite.player_name?.split(" ")[0] || "there";
    let smsSent = false;
    let emailSent = false;

    // Send SMS via Twilio
    if ((deliveryMethod === "sms" || deliveryMethod === "both") && invite.phone) {
      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.error("Twilio credentials not configured");
      } else {
        try {
          const formattedPhone = formatPhoneNumber(invite.phone);
          const smsMessage = INVITE_SMS_MESSAGES[invite.invite_type]?.(firstName, inviteUrl) 
            || `Hey ${firstName}! You're invited to Catching Barrels: ${inviteUrl} - Coach Rick`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const twilioResponse = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: twilioPhoneNumber,
              To: formattedPhone,
              Body: smsMessage,
            }),
          });

          const twilioData = await twilioResponse.json();

          if (!twilioResponse.ok) {
            console.error("Twilio error:", twilioData);
          } else {
            console.log("SMS sent successfully to:", formattedPhone);
            smsSent = true;

            // Log to messages table
            await supabase.from("messages").insert({
              phone_number: formattedPhone,
              direction: "outbound",
              body: smsMessage,
              twilio_sid: twilioData.sid,
              status: "sent",
            });

            // Log to sms_logs
            await supabase.from("sms_logs").insert({
              phone_number: formattedPhone,
              trigger_name: `invite_${invite.invite_type}`,
              message_sent: smsMessage,
              status: "sent",
              twilio_sid: twilioData.sid,
            });
          }
        } catch (smsError) {
          console.error("Failed to send SMS:", smsError);
        }
      }
    }

    // Send email via Resend
    if ((deliveryMethod === "email" || deliveryMethod === "both") && invite.email && resendApiKey) {
      const subject = INVITE_TYPE_SUBJECTS[invite.invite_type] || "You're Invited to Catching Barrels";
      const playerGreeting = invite.player_name ? `Hi ${invite.player_name.split(" ")[0]},` : "Hi there,";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #dc2626; }
            .content { background: #f8f9fa; border-radius: 12px; padding: 30px; margin-bottom: 20px; }
            .button { display: inline-block; background: linear-gradient(to right, #dc2626, #ea580c); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">⚾ Catching Barrels</div>
            </div>
            <div class="content">
              <p>${playerGreeting}</p>
              ${invite.invite_type === 'diagnostic' ? `
                <p>You've been invited to get a <strong>free swing diagnostic</strong> from Coach Rick at Catching Barrels.</p>
                <p>Upload your swing video and get personalized feedback on what's holding you back.</p>
              ` : invite.invite_type === 'assessment' ? `
                <p>You're invited to complete your <strong>KRS Assessment</strong> with Catching Barrels.</p>
                <p>This comprehensive swing analysis will identify your biggest opportunities for improvement.</p>
              ` : invite.invite_type === 'membership' ? `
                <p>You've been invited to join the <strong>Catching Barrels Membership</strong>.</p>
                <p>Get ongoing coaching, drills, and personalized training to take your swing to the next level.</p>
              ` : `
                <p>You've been invited to <strong>beta test</strong> Catching Barrels!</p>
                <p>Get early access to all features and help shape the future of hitting development.</p>
              `}
              <p style="text-align: center; margin-top: 25px;">
                <a href="${inviteUrl}" class="button">Get Started →</a>
              </p>
            </div>
            <div class="footer">
              <p>Questions? Reply to this email or text Coach Rick.</p>
              <p>© ${new Date().getFullYear()} Catching Barrels. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Catching Barrels <invites@catchingbarrels.com>",
            to: [invite.email],
            subject: isResend ? `[Reminder] ${subject}` : subject,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.text();
          console.error("Resend API error:", errorData);
        } else {
          console.log("Email sent successfully to:", invite.email);
          emailSent = true;
        }
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't throw - invite was created, email just failed
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invite_id: invite.id,
        invite_url: inviteUrl,
        sms_sent: smsSent,
        email_sent: emailSent,
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
