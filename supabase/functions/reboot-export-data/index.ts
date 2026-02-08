/**
 * Reboot Export Data Edge Function
 * Requests data exports from Reboot Motion and triggers 4B/KRS calculations
 *
 * Strategy:
 * 1. Call GET /session/{session_id} to get session details + movement IDs
 * 2. For each movement: call /data_export with that specific org_movement_id
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
    let movementTypeId = 1;
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
    // Step 1: GET /session/{session_id} to discover movements
    // ========================================================================
    let sessionDetails: any = null;
    let movementIds: string[] = [];

    try {
      console.log(`[reboot-export-data] Fetching session details: GET /session/${body.session_id}`);
      const sessionResponse = await rebootFetch(`/session/${body.session_id}`);

      if (sessionResponse.ok) {
        sessionDetails = await sessionResponse.json();
        // Log the full response so we can see the structure
        console.log(`[reboot-export-data] Session details response: ${JSON.stringify(sessionDetails, null, 2)}`);

        // Try to extract movement IDs from various possible structures
        movementIds = extractMovementIds(sessionDetails);
        console.log(`[reboot-export-data] Extracted ${movementIds.length} movement IDs: ${movementIds.join(', ')}`);
      } else {
        const errText = await sessionResponse.text();
        console.error(`[reboot-export-data] GET /session/${body.session_id} failed (${sessionResponse.status}): ${errText}`);

        // Try alternate endpoint formats
        for (const altPath of [`/sessions/${body.session_id}`, `/mocap-sessions/${body.session_id}`]) {
          try {
            console.log(`[reboot-export-data] Trying alternate: GET ${altPath}`);
            const altResponse = await rebootFetch(altPath);
            if (altResponse.ok) {
              sessionDetails = await altResponse.json();
              console.log(`[reboot-export-data] Alt session response (${altPath}): ${JSON.stringify(sessionDetails, null, 2)}`);
              movementIds = extractMovementIds(sessionDetails);
              console.log(`[reboot-export-data] Extracted ${movementIds.length} movement IDs from ${altPath}`);
              break;
            } else {
              const altErr = await altResponse.text();
              console.warn(`[reboot-export-data] ${altPath} failed (${altResponse.status}): ${altErr}`);
            }
          } catch (altErr) {
            console.warn(`[reboot-export-data] ${altPath} error:`, altErr);
          }
        }
      }
    } catch (err) {
      console.error("[reboot-export-data] Error fetching session details:", err);
    }

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false;

    console.log(`[reboot-export-data] Exporting ${dataTypes.length} data types for ${movementIds.length} movements, movement_type_id: ${movementTypeId}`);

    // ========================================================================
    // Step 2: Export data — per-movement if we have IDs, else session-level
    // ========================================================================
    const exportUrls: Record<string, string[]> = {};

    if (movementIds.length > 0) {
      // Per-movement export: call /data_export for each movement individually
      for (const dataType of dataTypes) {
        const urls: string[] = [];

        for (const movementId of movementIds) {
          try {
            const exportPayload = {
              session_id: body.session_id,
              movement_type_id: movementTypeId,
              org_player_id: orgPlayerId,
              org_movement_id: movementId,
              data_type: dataType,
              data_format: "csv",
              aggregate: true,
            };

            console.log(`[reboot-export-data] Exporting ${dataType} for movement ${movementId}...`);
            const exportResponse = await rebootFetch("/data_export", {
              method: "POST",
              body: JSON.stringify(exportPayload),
            });

            if (exportResponse.ok) {
              const exportData = await exportResponse.json();
              const dlUrls = exportData.download_urls || [];
              if (dlUrls.length > 0) {
                urls.push(...dlUrls);
                console.log(`[reboot-export-data]   Movement ${movementId}: ${dlUrls.length} URL(s)`);
              } else {
                console.warn(`[reboot-export-data]   Movement ${movementId}: 0 URLs returned`);
              }
            } else {
              const errText = await exportResponse.text();
              console.error(`[reboot-export-data]   Movement ${movementId} export failed (${exportResponse.status}): ${errText}`);
            }
          } catch (err) {
            console.error(`[reboot-export-data]   Movement ${movementId} error:`, err);
          }
        }

        if (urls.length > 0) {
          exportUrls[dataType] = urls;
          console.log(`[reboot-export-data] ${dataType}: ${urls.length} total URL(s) from ${movementIds.length} movements`);
        }
      }
    } else {
      // Fallback: session-level export (no movement IDs discovered)
      console.log("[reboot-export-data] No movement IDs found, falling back to session-level export");

      for (const dataType of dataTypes) {
        try {
          const exportPayload = {
            session_id: body.session_id,
            movement_type_id: movementTypeId,
            org_player_id: orgPlayerId,
            data_type: dataType,
            data_format: "csv",
            aggregate: true,
          };

          console.log(`[reboot-export-data] Session-level export for ${dataType}...`);
          const exportResponse = await rebootFetch("/data_export", {
            method: "POST",
            body: JSON.stringify(exportPayload),
          });

          if (exportResponse.ok) {
            const exportData = await exportResponse.json();
            const urls: string[] = exportData.download_urls || [];
            if (urls.length > 0) {
              exportUrls[dataType] = urls;
              console.log(`[reboot-export-data] ${dataType}: ${urls.length} URL(s) from session-level export`);
            }
          } else {
            const errText = await exportResponse.text();
            console.error(`[reboot-export-data] Session-level export failed for ${dataType} (${exportResponse.status}): ${errText}`);
          }
        } catch (err) {
          console.error(`[reboot-export-data] Error requesting ${dataType}:`, err);
        }
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

    // Trigger analysis — pass all URLs to calculate-4b-scores
    let analysisResult = null;
    if (triggerAnalysis) {
      try {
        const totalUrls = Object.values(exportUrls).flat().length;
        console.log(`[reboot-export-data] Triggering 4B analysis with ${totalUrls} total download URLs...`);

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
      description: `Exported ${Object.keys(exportUrls).length} data types (${movementIds.length} movements) from Reboot Motion`,
      player_id: body.player_id,
      metadata: {
        session_id: body.session_id,
        data_types: Object.keys(exportUrls),
        movement_count: movementIds.length,
        movement_ids: movementIds,
        url_counts: Object.fromEntries(Object.entries(exportUrls).map(([k, v]) => [k, v.length])),
        analysis_triggered: triggerAnalysis,
      },
    });

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      player_id: body.player_id,
      movement_count: movementIds.length,
      movement_ids: movementIds,
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
 * Extract movement IDs from a Reboot session details response.
 * Tries multiple possible response structures since we're discovering the API shape.
 */
function extractMovementIds(sessionData: any): string[] {
  const ids: string[] = [];

  if (!sessionData) return ids;

  // Try: sessionData.movements (array of movement objects)
  if (Array.isArray(sessionData.movements)) {
    for (const m of sessionData.movements) {
      const id = m.org_movement_id || m.movement_id || m.id;
      if (id) ids.push(String(id));
    }
    if (ids.length > 0) {
      console.log(`[reboot-export-data] Found movement IDs in .movements array`);
      return ids;
    }
  }

  // Try: sessionData.players (array/object with movements nested)
  if (sessionData.players) {
    const players = Array.isArray(sessionData.players) ? sessionData.players : [sessionData.players];
    for (const p of players) {
      if (Array.isArray(p.movements)) {
        for (const m of p.movements) {
          const id = m.org_movement_id || m.movement_id || m.id;
          if (id) ids.push(String(id));
        }
      }
      // Also check for movement_ids as a flat array
      if (Array.isArray(p.movement_ids)) {
        ids.push(...p.movement_ids.map(String));
      }
    }
    if (ids.length > 0) {
      console.log(`[reboot-export-data] Found movement IDs in .players[].movements`);
      return ids;
    }
  }

  // Try: sessionData.movement_ids (flat array)
  if (Array.isArray(sessionData.movement_ids)) {
    ids.push(...sessionData.movement_ids.map(String));
    if (ids.length > 0) {
      console.log(`[reboot-export-data] Found movement IDs in .movement_ids array`);
      return ids;
    }
  }

  // Try: sessionData.org_movement_ids
  if (Array.isArray(sessionData.org_movement_ids)) {
    ids.push(...sessionData.org_movement_ids.map(String));
    if (ids.length > 0) {
      console.log(`[reboot-export-data] Found movement IDs in .org_movement_ids array`);
      return ids;
    }
  }

  // Try: recursively search for any key containing "movement" with array values
  for (const [key, value] of Object.entries(sessionData)) {
    if (key.toLowerCase().includes("movement") && Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" || typeof item === "number") {
          ids.push(String(item));
        } else if (typeof item === "object" && item !== null) {
          const id = (item as any).org_movement_id || (item as any).movement_id || (item as any).id;
          if (id) ids.push(String(id));
        }
      }
      if (ids.length > 0) {
        console.log(`[reboot-export-data] Found movement IDs in .${key}`);
        return ids;
      }
    }
  }

  console.warn("[reboot-export-data] Could not extract movement IDs from session response. Keys present:", Object.keys(sessionData).join(", "));
  return ids;
}
