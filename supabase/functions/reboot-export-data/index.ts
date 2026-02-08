/**
 * Reboot Export Data Edge Function
 * Requests data exports from Reboot Motion and triggers 4B/KRS calculations
 *
 * Strategy (metadata-first):
 * 1. Call /data_export with data_type: "metadata" to discover all org_movement_ids
 * 2. Parse the metadata CSV to extract each movement ID
 * 3. Call /data_export per movement ID for each data type (IK, momentum-energy)
 * 4. Pass all per-movement CSV URLs to the 4B engine
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  rebootFetch,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/rebootAuth.ts";

interface ExportDataRequest {
  session_id: string;
  player_id: string;
  data_types?: string[];
  trigger_analysis?: boolean;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: ExportDataRequest = await req.json();

    if (!body.session_id) return errorResponse("session_id is required", 400);
    if (!body.player_id) return errorResponse("player_id is required", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up org_player_id
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("reboot_player_id, reboot_athlete_id, name")
      .eq("id", body.player_id)
      .single();

    if (playerError || !player) {
      return errorResponse(`Player not found: ${body.player_id}`, 404);
    }

    const orgPlayerId = player.reboot_player_id || player.reboot_athlete_id;
    if (!orgPlayerId) {
      return errorResponse("Player has no Reboot org_player_id configured.", 400);
    }

    console.log(`[export] Player: ${player.name}, org_player_id: ${orgPlayerId}`);

    // Look up movement_type_id
    const movementTypeId = await discoverMovementTypeId();

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false;

    // ========================================================================
    // Step 1: Fetch metadata CSV to discover all org_movement_ids
    // ========================================================================
    const movementIds = await discoverMovementIds(body.session_id, orgPlayerId, movementTypeId);

    if (movementIds.length === 0) {
      return errorResponse("No movement IDs found in metadata CSV. Session may have no movements.", 400);
    }

    console.log(`[export] ✅ Discovered ${movementIds.length} movement(s): ${movementIds.join(", ")}`);

    // ========================================================================
    // Step 2: Export each data type for each movement individually
    // ========================================================================
    const exportUrls: Record<string, string[]> = {};

    for (const dataType of dataTypes) {
      const urls: string[] = [];

      for (const movementId of movementIds) {
        try {
          const payload = {
            session_id: body.session_id,
            movement_type_id: movementTypeId,
            org_player_id: orgPlayerId,
            org_movement_id: movementId,
            data_type: dataType,
            data_format: "csv",
            aggregate: false,
          };
          console.log(`[export] Per-movement export: ${dataType} / ${movementId}`);

          const res = await rebootFetch("/data_export", {
            method: "POST",
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            const d = await res.json();
            const dlUrls = d.download_urls || [];
            console.log(`[export] ✅ ${dataType}/${movementId}: ${dlUrls.length} URL(s)`);
            urls.push(...dlUrls);
          } else {
            const errText = await res.text();
            console.warn(`[export] ⚠️ ${dataType}/${movementId} failed (${res.status}): ${errText.substring(0, 300)}`);
          }
        } catch (err) {
          console.error(`[export] Error exporting ${dataType}/${movementId}:`, err);
        }
      }

      if (urls.length > 0) {
        exportUrls[dataType] = urls;
        console.log(`[export] ${dataType}: ${urls.length} total URL(s) across ${movementIds.length} movement(s)`);
      }
    }

    if (Object.keys(exportUrls).length === 0) {
      return errorResponse("No data types were successfully exported for any movement.", 400);
    }

    // ========================================================================
    // Step 3: Store export record & update session
    // ========================================================================
    const { error: insertError } = await supabase
      .from("reboot_exports")
      .insert({
        player_id: body.player_id,
        session_id: body.session_id,
        data_types: Object.keys(exportUrls),
        csv_data: {},
        raw_response: exportUrls,
        created_at: new Date().toISOString(),
      });
    if (insertError) {
      console.error("[export] Failed to save export record:", insertError);
    }

    // Ensure reboot_sessions record
    const { data: existingSession } = await supabase
      .from("reboot_sessions")
      .select("id")
      .eq("reboot_session_id", body.session_id)
      .eq("player_id", body.player_id)
      .maybeSingle();

    if (!existingSession) {
      await supabase.from("reboot_sessions").insert({
        reboot_session_id: body.session_id,
        player_id: body.player_id,
        status: "exported",
        movement_type: "baseball-hitting",
        session_date: new Date().toISOString().split("T")[0],
      });
    } else {
      await supabase
        .from("reboot_sessions")
        .update({ status: "exported" })
        .eq("reboot_session_id", body.session_id)
        .eq("player_id", body.player_id);
    }

    // ========================================================================
    // Step 4: Trigger 4B analysis with all per-movement URLs
    // ========================================================================
    let analysisResult = null;
    if (triggerAnalysis) {
      try {
        const totalUrls = Object.values(exportUrls).flat().length;
        console.log(`[export] Triggering 4B analysis with ${totalUrls} total URLs across ${movementIds.length} movements...`);

        const analysisUrl = `${supabaseUrl}/functions/v1/calculate-4b-scores`;
        const analysisResponse = await fetch(analysisUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            player_id: body.player_id,
            session_id: body.session_id,
            download_urls: exportUrls,
          }),
        });

        if (analysisResponse.ok) {
          analysisResult = await analysisResponse.json();
          console.log("[export] 4B analysis complete");
        } else {
          const errText = await analysisResponse.text();
          console.error("[export] Analysis failed:", errText);
        }
      } catch (err) {
        console.error("[export] Error during analysis:", err);
      }
    }

    // Activity log
    await supabase.from("activity_log").insert({
      action: "reboot_data_exported",
      description: `Exported ${Object.keys(exportUrls).length} data types × ${movementIds.length} movements from Reboot Motion`,
      player_id: body.player_id,
      metadata: {
        session_id: body.session_id,
        data_types: Object.keys(exportUrls),
        movement_ids: movementIds,
        url_counts: Object.fromEntries(Object.entries(exportUrls).map(([k, v]) => [k, v.length])),
        analysis_triggered: triggerAnalysis,
      },
    });

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      player_id: body.player_id,
      movement_ids: movementIds,
      data_types_exported: Object.keys(exportUrls),
      download_urls: exportUrls,
      url_counts: Object.fromEntries(Object.entries(exportUrls).map(([k, v]) => [k, v.length])),
      analysis_triggered: triggerAnalysis,
      analysis_result: analysisResult,
    });

  } catch (error) {
    console.error("[export] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Discover the movement_type_id for "hitting" from the Reboot API.
 * Falls back to 1 if the lookup fails.
 */
async function discoverMovementTypeId(): Promise<number> {
  try {
    const res = await rebootFetch("/movement_types");
    if (res.ok) {
      const types = await res.json();
      const hitting = types.find((mt: any) =>
        mt.name?.toLowerCase().includes("hitting") ||
        mt.slug?.toLowerCase().includes("hitting")
      );
      if (hitting?.id) return hitting.id;
    }
  } catch (_err) {
    console.warn("[export] Could not fetch movement types, using default");
  }
  return 1;
}

/**
 * Fetch the metadata CSV for a session and extract all unique org_movement_id values.
 */
async function discoverMovementIds(
  sessionId: string,
  orgPlayerId: string,
  movementTypeId: number
): Promise<string[]> {
  console.log(`[export] Step 1: Fetching metadata CSV for session ${sessionId}...`);

  const metadataPayload = {
    session_id: sessionId,
    org_player_id: orgPlayerId,
    movement_type_id: movementTypeId,
    data_type: "metadata",
    data_format: "csv",
    aggregate: true,
  };
  console.log(`[export] Metadata payload: ${JSON.stringify(metadataPayload)}`);

  const res = await rebootFetch("/data_export", {
    method: "POST",
    body: JSON.stringify(metadataPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[export] Metadata export failed (${res.status}): ${errText.substring(0, 500)}`);
    return [];
  }

  const data = await res.json();
  console.log(`[export] Metadata response keys: ${JSON.stringify(Object.keys(data))}`);

  const urls = data.download_urls || [];
  if (urls.length === 0) {
    console.error("[export] Metadata export returned no download URLs");
    return [];
  }

  console.log(`[export] Metadata CSV URL: ${urls[0].substring(0, 100)}...`);

  // Download and parse the metadata CSV (Reboot returns gzipped files)
  try {
    const csvResponse = await fetch(urls[0]);
    if (!csvResponse.ok) {
      console.error(`[export] Failed to download metadata CSV: ${csvResponse.status}`);
      return [];
    }

    const contentType = csvResponse.headers.get("content-type") || "";
    const contentEncoding = csvResponse.headers.get("content-encoding") || "";
    console.log(`[export] Metadata response content-type: ${contentType}, content-encoding: ${contentEncoding}`);

    let csvText: string;

    // Try to decompress if the response is gzipped
    const arrayBuffer = await csvResponse.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    console.log(`[export] Metadata raw bytes: ${bytes.length}, first 4: [${bytes[0]}, ${bytes[1]}, ${bytes[2]}, ${bytes[3]}]`);

    // Check for gzip magic bytes (0x1f, 0x8b)
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      console.log(`[export] Detected gzip compressed file, decompressing...`);
      const ds = new DecompressionStream("gzip");
      const decompressedStream = new Blob([bytes]).stream().pipeThrough(ds);
      const decompressedBlob = await new Response(decompressedStream).blob();
      csvText = await decompressedBlob.text();
    } else if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      // ZIP file (PK header) — not directly supported, log and bail
      console.error(`[export] Metadata file is a ZIP archive — not yet supported`);
      return [];
    } else {
      // Assume plain text
      csvText = new TextDecoder().decode(bytes);
    }

    console.log(`[export] Metadata CSV length: ${csvText.length} chars`);
    console.log(`[export] Metadata CSV first 500 chars: ${csvText.substring(0, 500)}`);

    // Handle both \r\n and \n line endings, filter out empty lines
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log(`[export] Metadata CSV: ${lines.length} non-empty line(s)`);

    if (lines.length < 2) {
      console.error("[export] Metadata CSV has no data rows after decompression");
      return [];
    }

    // Find org_movement_id column (handle quoted headers)
    const headers = lines[0].replace(/"/g, "").split(",").map(h => h.trim().toLowerCase());
    console.log(`[export] Metadata CSV headers: ${headers.join(", ")}`);

    const movIdIdx = headers.findIndex(h => h.includes("org_movement_id"));
    if (movIdIdx < 0) {
      console.error(`[export] No org_movement_id column found in metadata CSV`);
      return [];
    }

    // Extract unique movement IDs
    const movementIds = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const val = (cols[movIdIdx] || "").replace(/"/g, "").trim();
      if (val) movementIds.add(val);
    }

    console.log(`[export] Found ${movementIds.size} unique org_movement_id(s): ${[...movementIds].join(", ")}`);
    return [...movementIds];
  } catch (err) {
    console.error("[export] Error parsing metadata CSV:", err);
    return [];
  }
}
