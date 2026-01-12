import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const ghlWebhookUrl = Deno.env.get("GHL_WEBHOOK_URL");
    
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
      // Validate required fields
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
          delivery_method: "ghl", // Mark as handled by GoHighLevel
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

    // Prepare contact data for GoHighLevel
    const contactData = {
      event: "contact_invite",
      invite_id: invite.id,
      invite_token: invite.invite_token,
      invite_type: invite.invite_type,
      invite_url: inviteUrl,
      is_resend: isResend,
      contact: {
        name: invite.player_name || null,
        first_name: invite.player_name?.split(" ")[0] || null,
        last_name: invite.player_name?.split(" ").slice(1).join(" ") || null,
        email: invite.email || null,
        phone: invite.phone || null,
      },
      created_at: invite.created_at,
      expires_at: invite.expires_at,
    };

    let ghlSent = false;
    let ghlError: string | null = null;

    // Send contact data to GoHighLevel webhook
    if (ghlWebhookUrl) {
      try {
        console.log("Sending contact to GoHighLevel:", contactData);
        
        const ghlResponse = await fetch(ghlWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(contactData),
        });

        if (!ghlResponse.ok) {
          const errorText = await ghlResponse.text();
          console.error("GHL webhook error:", errorText);
          ghlError = `GHL webhook returned ${ghlResponse.status}`;
        } else {
          console.log("Contact sent to GoHighLevel successfully");
          ghlSent = true;
        }
      } catch (webhookError) {
        console.error("Failed to send to GoHighLevel:", webhookError);
        ghlError = webhookError instanceof Error ? webhookError.message : "Unknown webhook error";
      }
    } else {
      console.warn("GHL_WEBHOOK_URL not configured - invite created but not sent to GHL");
      ghlError = "GHL_WEBHOOK_URL not configured";
    }

    // Log the webhook attempt to ghl_webhook_logs
    await supabase.from("ghl_webhook_logs").insert({
      event_type: "contact_invite",
      player_id: null,
      session_id: null,
      payload: contactData,
      status: ghlSent ? "sent" : "error",
      error_message: ghlError,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        invite_id: invite.id,
        invite_url: inviteUrl,
        ghl_sent: ghlSent,
        ghl_error: ghlError,
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
