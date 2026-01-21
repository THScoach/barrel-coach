// =============================================================================
// SECURITY SELF-TEST CHECKLIST
// =============================================================================
// ✅ 1. Admin check via has_role() RPC happens BEFORE any database mutations
// ✅ 2. Returns 403 { error: "Admin access required" } if not admin (line 44-48)
// ✅ 3. User verified via auth.getUser() before role check (line 29-35)
// ✅ 4. Service_role client created at start but mutations only after admin check
// ✅ 5. No player updates occur before admin check completes (line 86+)
// ✅ 6. Request body parsed AFTER admin verification (line 51)
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("has_role", { 
      _user_id: user.id, 
      _role: "admin" 
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { playerId, betaDays = 30, customMessage } = await req.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: "playerId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, phone, email, is_beta_tester")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: "Player not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (!player.phone) {
      return new Response(
        JSON.stringify({ error: `No phone number on file for ${player.name}. Add a phone number first.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Calculate beta expiration
    const betaExpiresAt = new Date();
    betaExpiresAt.setDate(betaExpiresAt.getDate() + betaDays);

    // Update player with beta status
    const { error: updateError } = await supabase
      .from("players")
      .update({
        is_beta_tester: true,
        beta_expires_at: betaExpiresAt.toISOString(),
        beta_notes: `Invited on ${new Date().toLocaleDateString()} for ${betaDays} days`,
        can_login: true,
        account_status: "beta",
      })
      .eq("id", playerId);

    if (updateError) {
      throw updateError;
    }

    // Get first name from player name
    const firstName = player.name?.split(" ")[0] || "there";

    // Build the SMS message
    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app") 
      || "https://4bsystem.com";
    const betaLink = `${appUrl}/beta`;
    
    const smsMessage = customMessage || 
      `Hey ${firstName}! 🔥 You've been invited to beta test the 4B System. ` +
      `Jump in and let me know what you think: ${betaLink} - Coach Rick`;

    // Format phone number
    let formattedPhone = player.phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = `+1${formattedPhone}`;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = `+${formattedPhone}`;
    }

    // Send SMS via Twilio
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error("Twilio credentials not configured");
    }

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
      throw new Error(twilioData.message || "Failed to send SMS");
    }

    // Log the SMS
    await supabase.from("sms_logs").insert({
      phone_number: formattedPhone,
      trigger_name: "beta_invite",
      message_sent: smsMessage,
      status: "sent",
      twilio_sid: twilioData.sid,
    });

    // Also log to messages table for chat history
    await supabase.from("messages").insert({
      phone_number: formattedPhone,
      direction: "outbound",
      body: smsMessage,
      twilio_sid: twilioData.sid,
      status: "sent",
    });

    // Log activity
    await supabase.from("activity_log").insert({
      player_id: playerId,
      action: "beta_invite_sent",
      description: `Beta invite sent for ${betaDays} days`,
      metadata: { beta_expires_at: betaExpiresAt.toISOString() },
    });

    console.log(`Beta invite sent to ${player.name} (${formattedPhone})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Beta invite sent to ${player.name}`,
        betaExpiresAt: betaExpiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Send beta invite error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
