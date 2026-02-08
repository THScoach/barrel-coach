/**
 * Reboot Export Data Edge Function
 * Requests data exports from Reboot Motion and triggers 4B/KRS calculations
 *
 * Strategy:
 * 1. List all movements in the session via /mocap-sessions/{id}/movements
 * 2. Export each movement individually (aggregate:true only works per-movement)
 * 3. Pass all download URLs to the 4B engine which concatenates them
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

    console.log(`[reboot-export-data] Player: ${player.name}, org_player_id: ${orgPlayerId}`);

    // Look up movement_type_id
    let movementTypeId = 1; // baseball-hitting default
    try {
      const mtResponse = await rebootFetch("/movement_types");
      if (mtResponse.ok) {
        const movementTypes = await mtResponse.json();
        const hittingType = movementTypes.find((mt: any) =>
          mt.name?.toLowerCase().includes("hitting") ||
          mt.slug?.toLowerCase().includes("hitting")
        );
        if (hittingType?.id) {
          movementTypeId = hittingType.id;
        }
      }
    } catch (_err) {
      console.warn("[reboot-export-data] Could not fetch movement types, using default");
    }

    // ========================================================================
    // Step 1: List all movements in this session
    // ========================================================================
    let movements: any[] = [];
    try {
      const movResponse = await rebootFetch(`/mocap-sessions/${body.session_id}/movements`);
      if (movResponse.ok) {
        movements = await movResponse.json();
        console.log(`[reboot-export-data] Session has ${movements.length} movements`);
        if (movements.length > 0) {
          // Log the movement IDs for debugging
          const movIds = movements.map((m: any) => m.org_movement_id || m.id).join(', ');
          console.log(`[reboot-export-data] Movement IDs: ${movIds}`);
        }
      } else {
        const errText = await movResponse.text();
        console.warn(`[reboot-export-data] Failed to list movements (${movResponse.status}): ${errText}`);
      }
    } catch (err) {
      console.warn("[reboot-export-data] Error listing movements:", err);
    }

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false;

    console.log(`[reboot-export-data] Exporting ${dataTypes.length} data types for ${movements.length || '?'} movements, movement_type_id: ${movementTypeId}`);

    // ========================================================================
    // Step 2: Export data — try session-level first, fall back to per-movement
    // ========================================================================
    const exportUrls: Record<string, string[]> = {};

    for (const dataType of dataTypes) {
      try {
        // First attempt: session-level export WITHOUT org_player_id
        // (org_player_id may filter to a single movement)
        const exportPayload: Record<string, any> = {
          session_id: body.session_id,
          movement_type_id: movementTypeId,
          data_type: dataType,
          data_format: "csv",
          aggregate: true,
        };

        console.log(`[reboot-export-data] Trying session-level export for ${dataType}...`);
        const exportResponse = await rebootFetch("/data_export", {
          method: "POST",
          body: JSON.stringify(exportPayload),
        });

        if (!exportResponse.ok) {
          const errorText = await exportResponse.text();
          console.error(`[reboot-export-data] Session-level export failed for ${dataType} (${exportResponse.status}): ${errorText}`);

          // Fall back to per-movement exports
          if (movements.length > 0) {
            console.log(`[reboot-export-data] Falling back to per-movement export for ${dataType}...`);
            const perMovementUrls = await exportPerMovement(
              movements, body.session_id, movementTypeId, orgPlayerId, dataType
            );
            if (perMovementUrls.length > 0) {
              exportUrls[dataType] = perMovementUrls;
              console.log(`[reboot-export-data] Got ${perMovementUrls.length} per-movement URL(s) for ${dataType}`);
            }
          }
          continue;
        }

        const exportData = await exportResponse.json();
        const urls: string[] = exportData.download_urls || [];
        console.log(`[reboot-export-data] Session-level export returned ${urls.length} URL(s) for ${dataType}`);

        if (urls.length > 0) {
          // Quick check: does the CSV contain multiple movement IDs?
          // Download just the first few KB to verify
          const hasMultiple = await checkMultipleMovements(urls[0], movements.length);

          if (hasMultiple) {
            exportUrls[dataType] = urls;
            console.log(`[reboot-export-data] ✅ Session-level CSV contains multiple movements for ${dataType}`);
          } else {
            // Session-level only returned 1 movement — try per-movement
            console.log(`[reboot-export-data] Session-level CSV has only 1 movement, trying per-movement for ${dataType}...`);

            if (movements.length > 1) {
              const perMovementUrls = await exportPerMovement(
                movements, body.session_id, movementTypeId, orgPlayerId, dataType
              );
              if (perMovementUrls.length > 1) {
                exportUrls[dataType] = perMovementUrls;
                console.log(`[reboot-export-data] Got ${perMovementUrls.length} per-movement URL(s) for ${dataType}`);
              } else {
                // Per-movement also didn't help, use what we have
                exportUrls[dataType] = urls;
              }
            } else {
              exportUrls[dataType] = urls;
            }
          }
        }
      } catch (err) {
        console.error(`[reboot-export-data] Error requesting ${dataType}:`, err);
      }
    }

    if (Object.keys(exportUrls).length === 0) {
      return errorResponse("No data types were successfully exported.", 400);
    }

    // Log final URL counts
    for (const [dt, urls] of Object.entries(exportUrls)) {
      console.log(`[reboot-export-data] Final: ${dt} → ${urls.length} download URL(s)`);
    }

    // Store export URLs in our database
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
      console.error("[reboot-export-data] Failed to save export record:", insertError);
    }

    // Ensure a reboot_sessions record exists
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

    // Trigger analysis — pass all URLs, let calculate-4b-scores concatenate
    let analysisResult = null;
    if (triggerAnalysis) {
      try {
        console.log(`[reboot-export-data] Triggering 4B analysis with ${Object.values(exportUrls).flat().length} total download URLs...`);

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
          console.log("[reboot-export-data] 4B analysis complete");
        } else {
          const errText = await analysisResponse.text();
          console.error("[reboot-export-data] Analysis failed:", errText);
        }
      } catch (err) {
        console.error("[reboot-export-data] Error during analysis:", err);
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "reboot_data_exported",
      description: `Exported ${Object.keys(exportUrls).length} data types (${movements.length} movements) from Reboot Motion`,
      player_id: body.player_id,
      metadata: {
        session_id: body.session_id,
        data_types: Object.keys(exportUrls),
        movement_count: movements.length,
        url_counts: Object.fromEntries(Object.entries(exportUrls).map(([k, v]) => [k, v.length])),
        analysis_triggered: triggerAnalysis,
      },
    });

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      player_id: body.player_id,
      movement_count: movements.length,
      data_types_exported: Object.keys(exportUrls),
      download_urls: exportUrls,
      url_counts: Object.fromEntries(Object.entries(exportUrls).map(([k, v]) => [k, v.length])),
      analysis_triggered: triggerAnalysis,
      analysis_result: analysisResult,
    });

  } catch (error) {
    console.error("[reboot-export-data] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Export data per-movement by calling /data_export for each movement individually.
 * Returns an array of download URLs (one per movement that had data).
 */
async function exportPerMovement(
  movements: any[],
  sessionId: string,
  movementTypeId: number,
  orgPlayerId: string,
  dataType: string,
): Promise<string[]> {
  const urls: string[] = [];

  for (const movement of movements) {
    const movementId = movement.org_movement_id || movement.id;
    try {
      const exportResponse = await rebootFetch("/data_export", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          movement_type_id: movementTypeId,
          org_player_id: orgPlayerId,
          org_movement_id: movementId,
          data_type: dataType,
          data_format: "csv",
          aggregate: false,
        }),
      });

      if (exportResponse.ok) {
        const exportData = await exportResponse.json();
        const dlUrls = exportData.download_urls || [];
        if (dlUrls.length > 0) {
          urls.push(...dlUrls);
          console.log(`[reboot-export-data]   Movement ${movementId}: ${dlUrls.length} URL(s)`);
        }
      } else {
        const errText = await exportResponse.text();
        console.warn(`[reboot-export-data]   Movement ${movementId} export failed: ${errText}`);
      }
    } catch (err) {
      console.warn(`[reboot-export-data]   Movement ${movementId} error:`, err);
    }
  }

  return urls;
}

/**
 * Quick check if a CSV URL contains data for more than one movement.
 * Downloads just the first ~20KB to check.
 */
async function checkMultipleMovements(url: string, expectedCount: number): Promise<boolean> {
  if (expectedCount <= 1) return true; // Only 1 movement expected anyway

  try {
    const response = await fetch(url, {
      headers: { "Range": "bytes=0-20000" },
    });

    if (!response.ok && response.status !== 206) return false;

    const text = await response.text();
    const lines = text.split("\n");
    if (lines.length < 2) return false;

    // Find org_movement_id column
    const headers = lines[0].toLowerCase().replace(/"/g, '').split(",");
    const movIdIdx = headers.findIndex(h => h.includes("org_movement_id"));
    if (movIdIdx < 0) return false;

    // Check unique movement IDs in the sample
    const movIds = new Set<string>();
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const cols = lines[i].split(",");
      const val = (cols[movIdIdx] || '').replace(/"/g, '').trim();
      if (val) movIds.add(val);
    }

    console.log(`[reboot-export-data] Quick CSV check: found ${movIds.size} unique movement ID(s) in sample`);
    return movIds.size > 1;
  } catch (err) {
    console.warn("[reboot-export-data] Could not sample CSV:", err);
    return false; // Assume single movement to trigger per-movement fallback
  }
}
