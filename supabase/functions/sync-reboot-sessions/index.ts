import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeSessionsResponse(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sessions)) return payload.sessions;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function verifyAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) throw new Error("Unauthorized");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Admin access required");
  return userData.user.id;
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

    for (let page = 1; page <= 50; page++) {
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

    // Accept all sessions that have been processed (no movement count filter)
    const importableSessions = allSessions.filter(
      (s: any) => s?.status === "processed",
    );

    console.log(`[sync-reboot-sessions] Found ${allSessions.length} total, ${importableSessions.length} processed`);

    // Step 2: Get existing session IDs from our database
    const { data: existingSessions } = await supabase
      .from("reboot_sessions")
      .select("reboot_session_id")
      .eq("player_id", player_id);

    const existingIds = new Set((existingSessions || []).map((s: any) => s.reboot_session_id));

    // Step 3: Filter to only new sessions
    const newSessions = importableSessions.filter((s: any) => !existingIds.has(s.id));
    console.log(`[sync-reboot-sessions] ${newSessions.length} new sessions to import (${existingIds.size} already imported)`);

    if (newSessions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All sessions already synced",
          new_count: 0,
          total_in_reboot: importableSessions.length,
          already_imported: existingIds.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 4: Insert new sessions into reboot_sessions
    const sessionsToInsert = newSessions.map((s: any) => ({
      player_id,
      reboot_session_id: s.id,
      reboot_player_id: orgPlayerId,
      session_date: s.session_date ? s.session_date.split("T")[0] : null,
      status: "completed",
      movement_type: "hitting",
      notes: `Imported from Reboot. ${s.completed_movements || 0} movements.`,
    }));

    // Insert in batches of 100 to avoid payload limits
    let insertedCount = 0;
    for (let i = 0; i < sessionsToInsert.length; i += 100) {
      const batch = sessionsToInsert.slice(i, i + 100);
      const { error: insertError } = await supabase
        .from("reboot_sessions")
        .insert(batch);

      if (insertError) {
        console.error(`[sync-reboot-sessions] Insert error on batch ${i}:`, insertError);
        throw new Error(`Failed to insert sessions: ${insertError.message}`);
      }
      insertedCount += batch.length;
    }

    console.log(`[sync-reboot-sessions] ✅ Imported ${insertedCount} sessions`);

    // Step 5: Create placeholder reboot_uploads rows
    const uploadsToInsert = newSessions.map((s: any) => ({
      player_id,
      reboot_session_id: s.id,
      session_date: s.session_date ? s.session_date.split("T")[0] : new Date().toISOString().split("T")[0],
      processing_status: "pending",
      upload_source: "reboot_import",
    }));

    for (let i = 0; i < uploadsToInsert.length; i += 100) {
      const batch = uploadsToInsert.slice(i, i + 100);
      const { error: uploadInsertError } = await supabase
        .from("reboot_uploads")
        .insert(batch);

      if (uploadInsertError) {
        console.warn("[sync-reboot-sessions] Upload insert warning:", uploadInsertError.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${insertedCount} new session${insertedCount !== 1 ? "s" : ""}`,
        new_count: insertedCount,
        total_in_reboot: importableSessions.length,
        already_imported: existingIds.size,
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
