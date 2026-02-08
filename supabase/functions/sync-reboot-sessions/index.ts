import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  console.log("[sync-reboot-sessions] Fetching Reboot access token");
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: REBOOT_USERNAME, password: REBOOT_PASSWORD }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${error}`);
  }
  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };
  return data.access_token;
}

async function verifyAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.error("[sync-reboot-sessions] No Authorization header found");
    throw new Error("Unauthorized");
  }

  console.log("[sync-reboot-sessions] Auth header present, verifying user...");

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    console.error("[sync-reboot-sessions] getUser failed:", userError?.message);
    throw new Error("Unauthorized");
  }

  console.log("[sync-reboot-sessions] User verified:", userData.user.id);

  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
  console.log("[sync-reboot-sessions] is_admin result:", isAdmin, "error:", adminError?.message);
  if (!isAdmin) throw new Error("Admin access required");
  return userData.user.id;
}

/** Check if a session has data for a specific player using data_export endpoint */
async function checkSessionHasPlayerData(
  sessionId: string,
  orgPlayerId: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(`${REBOOT_API_BASE}/data_export`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        org_player_id: orgPlayerId,
        data_type: "momentum-energy",
        movement_type_id: 1,
      }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return !!(data.download_urls && data.download_urls.length > 0);
  } catch {
    return false;
  }
}

function normalizeSessionsResponse(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);

    const { player_id } = await req.json();

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get player's reboot IDs
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, reboot_athlete_id, reboot_player_id")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      console.error("[sync-reboot-sessions] Player lookup failed:", playerError?.message);
      return new Response(
        JSON.stringify({ error: "Player not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const orgPlayerId = player.reboot_player_id || player.reboot_athlete_id;
    if (!orgPlayerId) {
      return new Response(
        JSON.stringify({ error: `${player.name} is not linked to Reboot Motion` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[sync-reboot-sessions] Syncing sessions for ${player.name} (org_player_id: ${orgPlayerId})`);

    // Step 1: Fetch all sessions from the Reboot API
    const pageSize = 200;
    const allSessions: any[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= 25; page++) {
      const url = new URL(`${REBOOT_API_BASE}/sessions`);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("page_size", pageSize.toString());
      url.searchParams.set("limit", pageSize.toString());
      url.searchParams.set("offset", ((page - 1) * pageSize).toString());
      url.searchParams.set("org_player_id", orgPlayerId);

      console.log(`[sync-reboot-sessions] Fetching page ${page}`);

      const resp = await fetch(url.toString(), {
        headers: { "X-Api-Key": REBOOT_API_KEY, "Content-Type": "application/json" },
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Reboot API error (${resp.status}): ${err}`);
      }

      const raw = await resp.json();
      const pageSessions = normalizeSessionsResponse(raw);

      for (const s of pageSessions) {
        const id = s?.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        allSessions.push(s);
      }

      if (pageSessions.length === 0 || pageSessions.length < pageSize) break;
    }

    // Filter to processed sessions with movements
    const processedSessions = allSessions.filter(
      (s: any) => s?.status === "processed" && (s?.completed_movements ?? 0) > 0,
    );

    console.log(`[sync-reboot-sessions] Found ${allSessions.length} total, ${processedSessions.length} processed with movements`);

    // Step 2: Get existing session IDs from our database
    const { data: existingSessions } = await supabase
      .from("reboot_sessions")
      .select("reboot_session_id")
      .eq("player_id", player_id);

    const existingIds = new Set((existingSessions || []).map((s: any) => s.reboot_session_id));

    // Step 3: Get OAuth token for data_export checks
    const accessToken = await getRebootAccessToken();

    // Step 4: Check which processed sessions have data for this player (concurrently)
    const newCandidates = processedSessions.filter((s: any) => !existingIds.has(s.id));
    console.log(`[sync-reboot-sessions] ${newCandidates.length} candidates to check (${existingIds.size} already imported)`);

    if (newCandidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All sessions already synced",
          new_count: 0,
          total_in_reboot: processedSessions.length,
          already_imported: existingIds.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Concurrent data_export checks
    const MAX_CHECKS = 100;
    const toCheck = newCandidates.slice(0, MAX_CHECKS);
    const confirmedSessions: any[] = [];

    const CONCURRENCY = 6;
    let cursor = 0;

    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (cursor < toCheck.length) {
          const session = toCheck[cursor++];
          if (!session?.id) continue;
          const hasData = await checkSessionHasPlayerData(session.id, orgPlayerId, accessToken);
          if (hasData) {
            confirmedSessions.push(session);
            console.log(`[sync-reboot-sessions] ✅ Session ${session.id} confirmed for player`);
          }
        }
      }),
    );

    console.log(`[sync-reboot-sessions] ${confirmedSessions.length} sessions confirmed with player data`);

    if (confirmedSessions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No new sessions found with data for this player",
          new_count: 0,
          total_in_reboot: processedSessions.length,
          already_imported: existingIds.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 5: Insert new sessions into reboot_sessions
    const sessionsToInsert = confirmedSessions.map((s: any) => ({
      player_id,
      reboot_session_id: s.id,
      reboot_player_id: orgPlayerId,
      session_date: s.session_date ? s.session_date.split("T")[0] : null,
      status: "completed",
      movement_type: "hitting",
      notes: `Imported from Reboot. ${s.completed_movements || 0} movements.`,
    }));

    const { error: insertError } = await supabase
      .from("reboot_sessions")
      .insert(sessionsToInsert);

    if (insertError) {
      console.error("[sync-reboot-sessions] Insert error:", insertError);
      throw new Error(`Failed to insert sessions: ${insertError.message}`);
    }

    console.log(`[sync-reboot-sessions] ✅ Imported ${confirmedSessions.length} sessions`);

    // Step 6: Create placeholder reboot_uploads rows for each session
    // so they show swing counts on the athlete detail page
    const uploadsToInsert = confirmedSessions.map((s: any) => ({
      player_id,
      reboot_session_id: s.id,
      session_date: s.session_date ? s.session_date.split("T")[0] : new Date().toISOString().split("T")[0],
      processing_status: "pending",
      upload_source: "reboot_import",
    }));

    const { error: uploadInsertError } = await supabase
      .from("reboot_uploads")
      .insert(uploadsToInsert);

    if (uploadInsertError) {
      console.warn("[sync-reboot-sessions] Upload insert warning:", uploadInsertError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${confirmedSessions.length} new session${confirmedSessions.length !== 1 ? "s" : ""}`,
        new_count: confirmedSessions.length,
        total_in_reboot: processedSessions.length,
        already_imported: existingIds.size,
        sessions: confirmedSessions.map((s: any) => ({
          id: s.id,
          date: s.session_date,
          movements: s.completed_movements || 0,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[sync-reboot-sessions] Error:", error);
    const status = error.message === "Unauthorized" || error.message === "Admin access required" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: error.message || "Failed to sync sessions" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
