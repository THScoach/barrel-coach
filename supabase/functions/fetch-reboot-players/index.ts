import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Cache for access token
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get OAuth access token from Reboot
async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  console.log("[Auth] Fetching new Reboot access token");
  
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${error}`);
  }

  const data: RebootTokenResponse = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5 min buffer
  };

  return data.access_token;
}

// Get auth headers for Reboot API calls
async function getRebootHeaders(): Promise<Record<string, string>> {
  const token = await getRebootAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Verify admin user
async function verifyAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  
  if (claimsError || !claimsData?.user) {
    throw new Error("Unauthorized");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return claimsData.user.id;
}

// Fetch players from Reboot Motion API with pagination
async function fetchRebootPlayers(): Promise<any[]> {
  const allPlayers: any[] = [];
  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  const headers = await getRebootHeaders();

  while (hasMore) {
    console.log(`[Fetch Reboot Players] Fetching page ${page}...`);
    
    const url = new URL(`${REBOOT_API_BASE}/players`);
    url.searchParams.set("page", page.toString());
    url.searchParams.set("page_size", pageSize.toString());
    url.searchParams.set("limit", pageSize.toString());
    url.searchParams.set("offset", ((page - 1) * pageSize).toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Reboot API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    
    // Log first response to debug field names
    if (page === 1) {
      console.log("[Fetch Reboot Players] Sample response:", JSON.stringify(data).substring(0, 1000));
    }
    
    // Handle different response formats
    let players: any[] = [];
    if (Array.isArray(data)) {
      players = data;
    } else if (data.players && Array.isArray(data.players)) {
      players = data.players;
    } else if (data.data && Array.isArray(data.data)) {
      players = data.data;
    } else if (data.results && Array.isArray(data.results)) {
      players = data.results;
    } else if (data.items && Array.isArray(data.items)) {
      players = data.items;
    } else {
      console.log("[Fetch Reboot Players] Unexpected response format:", JSON.stringify(data).substring(0, 500));
      break;
    }

    console.log(`[Fetch Reboot Players] Page ${page} returned ${players.length} players`);
    
    if (players.length === 0) {
      hasMore = false;
    } else {
      allPlayers.push(...players);
      
      // Check if we got a full page (might have more)
      if (players.length < pageSize) {
        hasMore = false;
      } else {
        page++;
        // Safety limit to prevent infinite loops
        if (page > 100) {
          console.log("[Fetch Reboot Players] Reached page limit of 100");
          hasMore = false;
        }
      }
    }
  }

  console.log(`[Fetch Reboot Players] Total players fetched: ${allPlayers.length}`);
  return allPlayers;
}

// Convert height string to inches (e.g., "6 ft 0 in" -> 72)
function parseHeight(heightStr: string | null | undefined): number | null {
  if (!heightStr) return null;
  
  const match = heightStr.match(/(\d+)\s*ft\s*(\d+)\s*in/i);
  if (match) {
    return parseInt(match[1]) * 12 + parseInt(match[2]);
  }
  
  // Try just feet
  const feetMatch = heightStr.match(/(\d+)\s*ft/i);
  if (feetMatch) {
    return parseInt(feetMatch[1]) * 12;
  }
  
  return null;
}

// Convert weight string to number (e.g., "205 lbs" -> 205)
function parseWeight(weightStr: string | null | undefined): number | null {
  if (!weightStr) return null;
  
  const match = weightStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  
  return null;
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    await verifyAdmin(req);

    // Parse request body for options
    let previewOnly = false;
    let selectedPlayerIds: string[] = [];
    
    try {
      const body = await req.json();
      previewOnly = body?.preview_only === true;
      selectedPlayerIds = body?.player_ids || [];
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log(`[Fetch Reboot Players] Mode: ${previewOnly ? 'preview' : 'sync'}, Selected IDs: ${selectedPlayerIds.length}`);

    // 1. Fetch players from Reboot Motion
    const rebootPlayers = await fetchRebootPlayers();
    console.log(`[Fetch Reboot Players] Found ${rebootPlayers.length} players in Reboot Motion`);

    if (rebootPlayers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No players found in Reboot Motion",
          players: [],
          synced: 0,
          created: 0,
          updated: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If preview_only, return the list without syncing
    if (previewOnly) {
      // Normalize player data for frontend consumption - handle many field variations
      const normalizedPlayers = rebootPlayers.map(player => {
        // Try multiple possible ID fields
        const rebootId = player.org_player_id || player.orgPlayerId || player.id || player.player_id || player.playerId || player._id;
        
        // Try multiple possible name fields
        const firstName = player.first_name || player.firstName || player.given_name || player.givenName || "";
        const lastName = player.last_name || player.lastName || player.family_name || player.familyName || player.surname || "";
        const fullName = player.name || player.full_name || player.fullName || player.display_name || player.displayName || `${firstName} ${lastName}`.trim();
        
        // Try multiple possible throws/bats fields
        const bats = player.bats || player.hitting_hand || player.hittingHand || player.hits || player.bat_side || player.batSide || null;
        const throws = player.throws || player.throwing_hand || player.throwingHand || player.throw_side || player.throwSide || null;
        
        // Log players with potentially unusual field names
        if (!rebootId || !fullName) {
          console.log("[Fetch Reboot Players] Player with missing ID or name:", JSON.stringify(player).substring(0, 500));
        }
        
        return {
          reboot_id: rebootId,
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          height: player.height || player.height_display || null,
          weight: player.weight || player.weight_display || null,
          bats: bats,
          throws: throws,
          level: player.level || player.skill_level || player.skillLevel || null,
          team: player.team || player.organization || player.org_name || player.orgName || null,
          birth_date: player.birth_date || player.birthDate || player.dob || player.date_of_birth || null,
          raw: player, // Include raw data for debugging
        };
      });
      
      // Log counts before/after filtering
      const withId = normalizedPlayers.filter(p => p.reboot_id);
      const withName = normalizedPlayers.filter(p => p.name);
      const valid = normalizedPlayers.filter(p => p.reboot_id && p.name);
      
      console.log(`[Fetch Reboot Players] Normalization: ${normalizedPlayers.length} total, ${withId.length} with ID, ${withName.length} with name, ${valid.length} valid`);
      
      // Remove raw field before returning (was just for debugging)
      const cleanPlayers = valid.map(({ raw, ...rest }) => rest);

      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          players: cleanPlayers,
          total: cleanPlayers.length,
          debug: {
            total_from_api: rebootPlayers.length,
            with_id: withId.length,
            with_name: withName.length,
            valid: valid.length,
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to selected players if specific IDs were provided
    let playersToSync = rebootPlayers;
    if (selectedPlayerIds.length > 0) {
      playersToSync = rebootPlayers.filter(player => {
        const rebootId = player.org_player_id || player.orgPlayerId || player.id || player.player_id || player.playerId || player._id;
        return selectedPlayerIds.includes(rebootId);
      });
      console.log(`[Fetch Reboot Players] Filtered to ${playersToSync.length} selected players`);
    }

    // 2. Connect to Supabase with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors: string[] = [];

    // 3. Sync each player
    for (const player of playersToSync) {
      try {
        // Get the Reboot player ID - try multiple possible field names
        const rebootId = player.org_player_id || player.orgPlayerId || player.id || player.player_id || player.playerId || player._id;
        
        if (!rebootId) {
          console.log("[Fetch Reboot Players] Skipping player with no ID:", JSON.stringify(player).substring(0, 300));
          skipped++;
          continue;
        }

        // Build player name - try multiple possible field names
        const firstName = player.first_name || player.firstName || player.given_name || player.givenName || "";
        const lastName = player.last_name || player.lastName || player.family_name || player.familyName || player.surname || "";
        const fullName = player.name || player.full_name || player.fullName || player.display_name || player.displayName || `${firstName} ${lastName}`.trim();

        if (!fullName) {
          console.log("[Fetch Reboot Players] Skipping player with no name:", JSON.stringify(player).substring(0, 300));
          skipped++;
          continue;
        }

        // Check if player already exists by reboot_athlete_id OR reboot_id
        const { data: existingPlayer } = await supabase
          .from("players")
          .select("id")
          .or(`reboot_athlete_id.eq.${rebootId},reboot_id.eq.${rebootId}`)
          .maybeSingle();

        // Extract handedness/bats - try multiple field names
        const bats = player.bats || player.hitting_hand || player.hittingHand || player.hits || player.bat_side || player.batSide || null;
        
        const playerData = {
          name: fullName,
          reboot_athlete_id: rebootId,
          reboot_id: rebootId, // Also set reboot_id for compatibility
          // Optional fields - map from Reboot if available
          height_inches: parseHeight(player.height || player.height_display),
          weight_lbs: parseWeight(player.weight || player.weight_display),
          handedness: bats,
          level: player.level || player.skill_level || player.skillLevel || null,
          team: player.team || player.organization || player.org_name || player.orgName || null,
        };

        if (existingPlayer) {
          // Update existing player
          const { error: updateError } = await supabase
            .from("players")
            .update(playerData)
            .eq("id", existingPlayer.id);

          if (updateError) {
            errors.push(`Failed to update ${fullName}: ${updateError.message}`);
          } else {
            updated++;
          }
        } else {
          // Create new player
          const { error: insertError } = await supabase
            .from("players")
            .insert(playerData);

          if (insertError) {
            errors.push(`Failed to create ${fullName}: ${insertError.message}`);
          } else {
            created++;
          }
        }
      } catch (playerError: any) {
        errors.push(`Error processing player: ${playerError.message}`);
      }
    }

    // 4. Log activity
    await supabase.from("activity_log").insert({
      action: "reboot_players_synced",
      description: `Synced ${created + updated} players from Reboot Motion (${created} new, ${updated} updated, ${skipped} skipped)`,
      metadata: { 
        total_from_reboot: rebootPlayers.length,
        created,
        updated,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      },
    });

    // 5. Return results
    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${created + updated} players from Reboot Motion`,
        synced: created + updated,
        created,
        updated,
        skipped,
        total_in_reboot: rebootPlayers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Fetch Reboot Players] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
