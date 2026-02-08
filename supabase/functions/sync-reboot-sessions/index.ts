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

/**
 * Extract the player identifier from a Reboot session object.
 * The API may use different field names, so we check several.
 */
function getSessionPlayerId(session: any): string | null {
  return (
    session.org_player_id ||
    session.player_id ||
    session.athlete_id ||
    session.org_athlete_id ||
    null
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);

    const body = await req.json();
    const { player_id, sync_all } = body;

    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Step 1: Fetch ALL sessions from the Reboot API (org-wide)
    const pageSize = 200;
    const allSessions: any[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= 50; page++) {
      const url = new URL(`${REBOOT_API_BASE}/sessions`);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("page_size", pageSize.toString());
      url.searchParams.set("limit", pageSize.toString());
      url.searchParams.set("offset", ((page - 1) * pageSize).toString());
      // Don't filter by org_player_id — fetch all org sessions

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

      // Log first session structure for debugging
      if (page === 1 && pageSessions.length > 0) {
        console.log("[sync-reboot-sessions] Sample session keys:", Object.keys(pageSessions[0]).join(", "));
        console.log("[sync-reboot-sessions] Sample session:", JSON.stringify(pageSessions[0]).substring(0, 500));
      }

      for (const s of pageSessions) {
        const id = s?.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        allSessions.push(s);
      }

      if (pageSessions.length === 0 || pageSessions.length < pageSize) break;
    }

    // Only import processed sessions
    const processedSessions = allSessions.filter((s: any) => s?.status === "processed");
    console.log(`[sync-reboot-sessions] Found ${allSessions.length} total, ${processedSessions.length} processed`);

    // Step 2: Build a lookup map from reboot_athlete_id → local player
    const { data: allPlayers } = await supabase
      .from("players")
      .select("id, name, reboot_athlete_id, reboot_player_id")
      .not("reboot_athlete_id", "is", null);

    // Map: reboot ID → local player record
    const rebootIdToPlayer = new Map<string, { id: string; name: string }>();
    for (const p of allPlayers || []) {
      if (p.reboot_athlete_id) {
        rebootIdToPlayer.set(p.reboot_athlete_id, { id: p.id, name: p.name });
      }
      if (p.reboot_player_id) {
        rebootIdToPlayer.set(p.reboot_player_id, { id: p.id, name: p.name });
      }
    }
    console.log(`[sync-reboot-sessions] ${rebootIdToPlayer.size} reboot IDs mapped to local players`);

    // Step 3: Get ALL existing reboot_session_ids to avoid duplicates
    const { data: existingSessions } = await supabase
      .from("reboot_sessions")
      .select("reboot_session_id");

    const existingIds = new Set((existingSessions || []).map((s: any) => s.reboot_session_id));
    console.log(`[sync-reboot-sessions] ${existingIds.size} sessions already in database`);

    // Step 4: Match each session to the correct player
    const sessionsToInsert: any[] = [];
    const uploadsToInsert: any[] = [];
    const unmatchedPlayerIds = new Set<string>();
    let skippedExisting = 0;
    let skippedNoPlayer = 0;

    for (const session of processedSessions) {
      // Skip already imported
      if (existingIds.has(session.id)) {
        skippedExisting++;
        continue;
      }

      // If filtering by a specific player, only import their sessions
      const sessionRebootPlayerId = getSessionPlayerId(session);

      if (!sessionRebootPlayerId) {
        skippedNoPlayer++;
        continue;
      }

      const localPlayer = rebootIdToPlayer.get(sessionRebootPlayerId);
      if (!localPlayer) {
        unmatchedPlayerIds.add(sessionRebootPlayerId);
        continue;
      }

      // If player_id filter is provided, only import for that player
      if (player_id && localPlayer.id !== player_id) {
        continue;
      }

      sessionsToInsert.push({
        player_id: localPlayer.id,
        reboot_session_id: session.id,
        reboot_player_id: sessionRebootPlayerId,
        session_date: session.session_date ? session.session_date.split("T")[0] : null,
        status: "completed",
        movement_type: "hitting",
        notes: `Imported from Reboot. ${session.completed_movements || 0} movements.`,
      });

      uploadsToInsert.push({
        player_id: localPlayer.id,
        reboot_session_id: session.id,
        session_date: session.session_date ? session.session_date.split("T")[0] : new Date().toISOString().split("T")[0],
        processing_status: "pending",
        upload_source: "reboot_import",
      });
    }

    console.log(`[sync-reboot-sessions] Matched ${sessionsToInsert.length} sessions to import`);
    console.log(`[sync-reboot-sessions] Skipped: ${skippedExisting} existing, ${skippedNoPlayer} no player ID in session`);
    console.log(`[sync-reboot-sessions] ${unmatchedPlayerIds.size} unmatched reboot player IDs`);
    if (unmatchedPlayerIds.size > 0 && unmatchedPlayerIds.size <= 10) {
      console.log(`[sync-reboot-sessions] Unmatched IDs: ${[...unmatchedPlayerIds].join(", ")}`);
    }

    if (sessionsToInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: skippedExisting > 0 
            ? "All matching sessions already synced" 
            : "No sessions found matching known players",
          new_count: 0,
          total_in_reboot: processedSessions.length,
          already_imported: skippedExisting,
          unmatched_player_ids: unmatchedPlayerIds.size,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 5: Insert in batches
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

    // Insert upload records
    for (let i = 0; i < uploadsToInsert.length; i += 100) {
      const batch = uploadsToInsert.slice(i, i + 100);
      const { error: uploadError } = await supabase
        .from("reboot_uploads")
        .insert(batch);

      if (uploadError) {
        console.warn("[sync-reboot-sessions] Upload insert warning:", uploadError.message);
      }
    }

    // Count per player for summary
    const perPlayer = new Map<string, number>();
    for (const s of sessionsToInsert) {
      const name = rebootIdToPlayer.get(s.reboot_player_id)?.name || "Unknown";
      perPlayer.set(name, (perPlayer.get(name) || 0) + 1);
    }

    console.log(`[sync-reboot-sessions] ✅ Imported ${insertedCount} sessions across ${perPlayer.size} players`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${insertedCount} session${insertedCount !== 1 ? "s" : ""} across ${perPlayer.size} player${perPlayer.size !== 1 ? "s" : ""}`,
        new_count: insertedCount,
        total_in_reboot: processedSessions.length,
        already_imported: skippedExisting,
        per_player: Object.fromEntries(perPlayer),
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
