/**
 * Reboot Create Player Edge Function
 * Creates a player in Reboot Motion and saves the reboot_player_id to our database
 *
 * POST /functions/v1/reboot-create-player
 * Body: {
 *   player_id: string,        // Our internal player ID (from players table)
 *   player_name: string,      // Full name
 *   birth_date?: string,      // YYYY-MM-DD format
 *   height_inches?: number,   // Height in inches (e.g., 72 for 6')
 *   weight_lbs?: number,      // Weight in pounds
 *   bats?: "R" | "L" | "S",   // Batting hand
 *   throws?: "R" | "L"        // Throwing hand
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  rebootFetch,
  handleCors,
  jsonResponse,
  errorResponse,
  corsHeaders
} from "../_shared/rebootAuth.ts";

interface CreatePlayerRequest {
  player_id: string;
  player_name: string;
  birth_date?: string;
  height_inches?: number;
  weight_lbs?: number;
  bats?: "R" | "L" | "S";
  throws?: "R" | "L";
}

interface RebootPlayerResponse {
  id: string;
  org_player_id?: string;
  name: string;
  organization_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request
    const body: CreatePlayerRequest = await req.json();

    // Validate required fields
    if (!body.player_id) {
      return errorResponse("player_id is required", 400);
    }
    if (!body.player_name) {
      return errorResponse("player_name is required", 400);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if player already has a reboot_player_id
    const { data: existingPlayer, error: fetchError } = await supabase
      .from("players")
      .select("reboot_player_id, reboot_athlete_id")
      .eq("id", body.player_id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Failed to fetch player: ${fetchError.message}`);
    }

    // Check existing IDs
    const existingId = existingPlayer?.reboot_player_id || existingPlayer?.reboot_athlete_id;
    if (existingId) {
      return jsonResponse({
        success: true,
        reboot_player_id: existingId,
        message: "Player already exists in Reboot Motion",
        already_existed: true
      });
    }

    // Build Reboot player payload
    const rebootPayload: Record<string, unknown> = {
      name: body.player_name,
    };

    if (body.birth_date) {
      rebootPayload.birth_date = body.birth_date;
    }
    if (body.height_inches) {
      rebootPayload.height_in = body.height_inches;
    }
    if (body.weight_lbs) {
      rebootPayload.weight_lb = body.weight_lbs;
    }
    if (body.bats) {
      rebootPayload.bats = body.bats;
    }
    if (body.throws) {
      rebootPayload.throws = body.throws;
    }

    // Create player in Reboot Motion
    console.log("[reboot-create-player] Creating player:", rebootPayload);

    const response = await rebootFetch("/players", {
      method: "POST",
      body: JSON.stringify(rebootPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Reboot API error (${response.status}): ${errorText}`);
    }

    const rebootPlayer: RebootPlayerResponse = await response.json();
    const rebootPlayerId = rebootPlayer.org_player_id || rebootPlayer.id;
    console.log("[reboot-create-player] Created:", rebootPlayerId);

    // Save reboot_player_id to our players table
    const { error: updateError } = await supabase
      .from("players")
      .update({
        reboot_player_id: rebootPlayerId,
        reboot_athlete_id: rebootPlayerId,
        updated_at: new Date().toISOString()
      })
      .eq("id", body.player_id);

    if (updateError) {
      console.error("[reboot-create-player] Failed to update player record:", updateError);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "reboot_player_created",
      description: `Created Reboot Motion account for ${body.player_name}`,
      player_id: body.player_id,
      metadata: { reboot_player_id: rebootPlayerId },
    });

    return jsonResponse({
      success: true,
      reboot_player_id: rebootPlayerId,
      player_id: body.player_id,
      player_name: body.player_name,
      message: "Player created in Reboot Motion"
    });

  } catch (error) {
    console.error("[reboot-create-player] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
