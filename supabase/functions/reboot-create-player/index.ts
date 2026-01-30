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

interface RebootPlayerListItem {
  id: string;
  org_player_id?: string;
  name: string;
}

/**
 * Search Reboot Motion API for existing players by name
 * Returns the first matching player or null
 */
async function searchRebootPlayers(playerName: string): Promise<RebootPlayerListItem | null> {
  try {
    console.log("[reboot-create-player] Searching Reboot for:", playerName);
    
    // Get list of all players in our org
    const response = await rebootFetch("/players", {
      method: "GET",
    });

    if (!response.ok) {
      console.error("[reboot-create-player] Failed to list Reboot players:", response.status);
      return null;
    }

    const players: RebootPlayerListItem[] = await response.json();
    
    // Normalize names for comparison
    const searchName = playerName.toLowerCase().trim();
    const searchParts = searchName.split(/\s+/);
    
    // Look for exact match first
    const exactMatch = players.find(p => 
      p.name?.toLowerCase().trim() === searchName
    );
    
    if (exactMatch) {
      console.log("[reboot-create-player] Found exact match:", exactMatch.id);
      return exactMatch;
    }
    
    // Look for partial match (first name + last name anywhere in name)
    if (searchParts.length >= 2) {
      const firstName = searchParts[0];
      const lastName = searchParts[searchParts.length - 1];
      
      const partialMatch = players.find(p => {
        const name = p.name?.toLowerCase() || "";
        return name.includes(firstName) && name.includes(lastName);
      });
      
      if (partialMatch) {
        console.log("[reboot-create-player] Found partial match:", partialMatch.id);
        return partialMatch;
      }
    }
    
    // Look for first name only match (less strict)
    const firstNameMatch = players.find(p => {
      const nameParts = p.name?.toLowerCase().split(/\s+/) || [];
      return nameParts[0] === searchParts[0];
    });
    
    if (firstNameMatch && searchParts.length === 1) {
      console.log("[reboot-create-player] Found first name match:", firstNameMatch.id);
      return firstNameMatch;
    }
    
    console.log("[reboot-create-player] No match found among", players.length, "players");
    return null;
  } catch (error) {
    console.error("[reboot-create-player] Search error:", error);
    return null;
  }
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

    // ============================================================
    // STEP 1: Check if player already has a reboot_player_id in our DB
    // ============================================================
    const { data: existingPlayer, error: fetchError } = await supabase
      .from("players")
      .select("reboot_player_id, reboot_athlete_id")
      .eq("id", body.player_id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Failed to fetch player: ${fetchError.message}`);
    }

    const existingId = existingPlayer?.reboot_player_id || existingPlayer?.reboot_athlete_id;
    if (existingId) {
      return jsonResponse({
        success: true,
        reboot_player_id: existingId,
        message: "Player already exists in Reboot Motion",
        already_existed: true,
        source: "database"
      });
    }

    // ============================================================
    // STEP 2: Search Reboot API for existing player with same name
    // ============================================================
    const existingRebootPlayer = await searchRebootPlayers(body.player_name);
    
    if (existingRebootPlayer) {
      const rebootPlayerId = existingRebootPlayer.org_player_id || existingRebootPlayer.id;
      
      // Link the existing Reboot player to our DB record
      const { error: updateError } = await supabase
        .from("players")
        .update({
          reboot_player_id: rebootPlayerId,
          reboot_athlete_id: rebootPlayerId,
          updated_at: new Date().toISOString()
        })
        .eq("id", body.player_id);

      if (updateError) {
        console.error("[reboot-create-player] Failed to link existing player:", updateError);
      }

      // Log activity
      await supabase.from("activity_log").insert({
        action: "reboot_player_linked",
        description: `Linked existing Reboot account for ${body.player_name}`,
        player_id: body.player_id,
        metadata: { 
          reboot_player_id: rebootPlayerId,
          matched_name: existingRebootPlayer.name
        },
      });

      return jsonResponse({
        success: true,
        reboot_player_id: rebootPlayerId,
        player_id: body.player_id,
        player_name: body.player_name,
        message: "Linked to existing Reboot Motion player",
        already_existed: true,
        source: "reboot_api_search"
      });
    }

    // ============================================================
    // STEP 3: Create new player in Reboot Motion
    // ============================================================
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

    console.log("[reboot-create-player] Creating new player:", rebootPayload);

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
      message: "Player created in Reboot Motion",
      already_existed: false,
      source: "created_new"
    });

  } catch (error) {
    console.error("[reboot-create-player] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
