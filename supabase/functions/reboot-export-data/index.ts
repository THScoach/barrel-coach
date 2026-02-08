/**
 * Reboot Export Data Edge Function
 * Requests data exports from Reboot Motion and triggers 4B/KRS calculations
 *
 * Strategy:
 * 1. Call /data_export with session_id + org_player_id + aggregate:true
 *    This returns CSV data for ALL movements in the session
 * 2. Pass download URLs to the 4B engine for scoring
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

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false;

    console.log(`[reboot-export-data] Exporting ${dataTypes.length} data types, movement_type_id: ${movementTypeId}`);

    // ========================================================================
    // Export data: session_id + org_player_id + aggregate:true
    // This returns CSV containing ALL movements in the session
    // ========================================================================
    const exportUrls: Record<string, string[]> = {};

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

        console.log(`[reboot-export-data] Requesting ${dataType} export...`, JSON.stringify(exportPayload));
        const exportResponse = await rebootFetch("/data_export", {
          method: "POST",
          body: JSON.stringify(exportPayload),
        });

        if (!exportResponse.ok) {
          const errorText = await exportResponse.text();
          console.error(`[reboot-export-data] Export failed for ${dataType} (${exportResponse.status}): ${errorText}`);
          continue;
        }

        const exportData = await exportResponse.json();
        const urls: string[] = exportData.download_urls || [];
        console.log(`[reboot-export-data] ${dataType}: ${urls.length} download URL(s)`);

        if (urls.length > 0) {
          exportUrls[dataType] = urls;

          // Sample CSV to count unique movements for logging
          const movementCount = await countMovementsInCsv(urls[0]);
          console.log(`[reboot-export-data] ${dataType}: CSV contains ${movementCount} unique movement(s)`);
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
      description: `Exported ${Object.keys(exportUrls).length} data types from Reboot Motion`,
      player_id: body.player_id,
      metadata: {
        session_id: body.session_id,
        data_types: Object.keys(exportUrls),
        url_counts: Object.fromEntries(Object.entries(exportUrls).map(([k, v]) => [k, v.length])),
        analysis_triggered: triggerAnalysis,
      },
    });

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      player_id: body.player_id,
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
 * Sample the first ~20KB of a CSV to count unique org_movement_id values.
 * Used for logging/diagnostics only.
 */
async function countMovementsInCsv(url: string): Promise<number> {
  try {
    const response = await fetch(url, {
      headers: { "Range": "bytes=0-20000" },
    });

    if (!response.ok && response.status !== 206) return 0;

    const text = await response.text();
    const lines = text.split("\n");
    if (lines.length < 2) return 0;

    const headers = lines[0].toLowerCase().replace(/"/g, '').split(",");
    const movIdIdx = headers.findIndex(h => h.includes("org_movement_id"));
    if (movIdIdx < 0) return 0;

    const movIds = new Set<string>();
    for (let i = 1; i < Math.min(lines.length, 200); i++) {
      const cols = lines[i].split(",");
      const val = (cols[movIdIdx] || '').replace(/"/g, '').trim();
      if (val) movIds.add(val);
    }

    return movIds.size;
  } catch (err) {
    console.warn("[reboot-export-data] Could not sample CSV:", err);
    return 0;
  }
}
