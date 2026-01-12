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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { email, player_name, invite_type, resend_invite_id } = await req.json();

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
      if (!email || !invite_type) {
        throw new Error("Email and invite_type are required");
      }

      const { data: newInvite, error: insertError } = await supabase
        .from("invites")
        .insert({
          email,
          player_name: player_name || null,
          invite_type,
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

    // Send email via Resend
    if (resendApiKey) {
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
        }
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't throw - invite was created, email just failed
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invite_id: invite.id,
        invite_url: inviteUrl,
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
