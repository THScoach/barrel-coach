import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  player_id: string;
  trigger?: string; // Optional: what triggered this sync (e.g., "session_complete", "score_update")
}

interface GHLContact {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  customField?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GHL_API_KEY = Deno.env.get("GHL_API_KEY");
    const GHL_WEBHOOK_URL = Deno.env.get("GHL_WEBHOOK_URL");

    if (!GHL_API_KEY && !GHL_WEBHOOK_URL) {
      console.error("[sync-to-ghl] Neither GHL_API_KEY nor GHL_WEBHOOK_URL configured");
      return new Response(
        JSON.stringify({ success: false, error: "GHL not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { player_id, trigger = "manual" }: SyncRequest = await req.json();

    if (!player_id) {
      throw new Error("player_id is required");
    }

    console.log(`[sync-to-ghl] Syncing player ${player_id}, trigger: ${trigger}`);

    // Fetch player data with latest scores
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select(`
        id,
        name,
        email,
        phone,
        level,
        team,
        position,
        handedness,
        account_status,
        latest_brain_score,
        latest_body_score,
        latest_bat_score,
        latest_ball_score,
        motor_profile_sensor
      `)
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      console.error("[sync-to-ghl] Player not found:", playerError);
      throw new Error(`Player not found: ${player_id}`);
    }

    // Parse name into first/last
    const nameParts = (player.name || "").trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Generate locker room URL
    const baseUrl = supabaseUrl?.replace('.supabase.co', '').replace('https://', '');
    const appUrl = `https://${baseUrl}.lovableproject.com`;
    const lockerUrl = `${appUrl}/player/home`;

    // Prepare GHL payload with custom fields
    const ghlPayload = {
      // Standard contact fields
      email: player.email || undefined,
      phone: player.phone || undefined,
      firstName,
      lastName,
      
      // Custom fields for 4B scores (these need to match custom field IDs in GHL)
      customField: {
        cb_player_id: player.id,
        cb_brain_score: player.latest_brain_score?.toString() || "0",
        cb_body_score: player.latest_body_score?.toString() || "0",
        cb_bat_score: player.latest_bat_score?.toString() || "0",
        cb_ball_score: player.latest_ball_score?.toString() || "0",
        cb_archetype: player.motor_profile_sensor || "unknown",
        cb_locker_url: lockerUrl,
        cb_level: player.level || "",
        cb_team: player.team || "",
        cb_position: player.position || "",
        cb_handedness: player.handedness || "",
        cb_account_status: player.account_status || "",
        cb_sync_trigger: trigger,
        cb_last_sync: new Date().toISOString(),
      },
    };

    console.log("[sync-to-ghl] Sending to GHL:", JSON.stringify(ghlPayload, null, 2));

    let ghlSuccess = false;
    let ghlError: string | null = null;
    let ghlResponse: unknown = null;

    // Try webhook first (simpler, more reliable)
    if (GHL_WEBHOOK_URL) {
      try {
        const webhookResponse = await fetch(GHL_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "player_sync",
            trigger,
            player: ghlPayload,
            timestamp: new Date().toISOString(),
          }),
        });

        if (webhookResponse.ok) {
          ghlSuccess = true;
          ghlResponse = await webhookResponse.text();
          console.log("[sync-to-ghl] Webhook success:", ghlResponse);
        } else {
          ghlError = `Webhook failed: ${webhookResponse.status}`;
          console.error("[sync-to-ghl] Webhook error:", ghlError);
        }
      } catch (webhookErr) {
        ghlError = webhookErr instanceof Error ? webhookErr.message : "Webhook failed";
        console.error("[sync-to-ghl] Webhook exception:", webhookErr);
      }
    }

    // If webhook failed or not configured, try API
    if (!ghlSuccess && GHL_API_KEY) {
      try {
        // GHL API v2 endpoint for creating/updating contacts
        const apiResponse = await fetch("https://rest.gohighlevel.com/v1/contacts/", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GHL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(ghlPayload),
        });

        const apiResult = await apiResponse.json();

        if (apiResponse.ok) {
          ghlSuccess = true;
          ghlResponse = apiResult;
          console.log("[sync-to-ghl] API success:", apiResult);
        } else {
          ghlError = `API failed: ${apiResult.message || apiResponse.status}`;
          console.error("[sync-to-ghl] API error:", apiResult);
        }
      } catch (apiErr) {
        ghlError = apiErr instanceof Error ? apiErr.message : "API failed";
        console.error("[sync-to-ghl] API exception:", apiErr);
      }
    }

    // Log the sync attempt
    await supabase.from("communication_logs").insert({
      player_id: player.id,
      event_type: "ghl_sync",
      payload: ghlPayload,
      status: ghlSuccess ? "success" : "failed",
      error_message: ghlError,
    });

    // Log to activity
    await supabase.from("activity_log").insert({
      player_id: player.id,
      action: "ghl_sync",
      description: ghlSuccess 
        ? `Synced player data to GHL (${trigger})` 
        : `Failed to sync to GHL: ${ghlError}`,
      metadata: {
        trigger,
        success: ghlSuccess,
        scores: {
          brain: player.latest_brain_score,
          body: player.latest_body_score,
          bat: player.latest_bat_score,
          ball: player.latest_ball_score,
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: ghlSuccess,
        player_id,
        synced_fields: Object.keys(ghlPayload.customField),
        error: ghlError,
        response: ghlResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[sync-to-ghl] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
