/**
 * Reboot Export Data Edge Function
 * Exports session data (CSVs) from Reboot Motion and triggers 4B/KRS calculations
 *
 * POST /functions/v1/reboot-export-data
 * Body: {
 *   session_id: string,         // Reboot session UUID
 *   player_id: string,          // Our internal player ID (used to look up org_player_id)
 *   data_types?: string[],      // Types to export (default: inverse-kinematics, momentum-energy)
 *   trigger_analysis?: boolean  // Whether to trigger 4B/KRS calculations (default: true)
 * }
 *
 * Reboot API contract for POST /data_export:
 *   session_id: string (UUID)
 *   movement_type_id: integer (required)
 *   org_player_id: string (required)
 *   data_type: string (singular, required) — one of:
 *     hitting-processed-metrics, hitting-processed-series,
 *     hitting-lite-processed-metrics, hitting-lite-processed-series,
 *     inverse-kinematics, metadata, metrics, momentum-energy
 *   data_format: string (default: csv)
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

    if (!body.session_id) {
      return errorResponse("session_id is required", 400);
    }
    if (!body.player_id) {
      return errorResponse("player_id is required", 400);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the player's org_player_id (reboot_player_id) from our database
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("reboot_player_id, reboot_athlete_id, name")
      .eq("id", body.player_id)
      .single();

    if (playerError || !player) {
      console.error("[reboot-export-data] Player lookup failed:", playerError);
      return errorResponse(`Player not found: ${body.player_id}`, 404);
    }

    const orgPlayerId = player.reboot_player_id || player.reboot_athlete_id;
    if (!orgPlayerId) {
      return errorResponse("Player has no Reboot org_player_id configured. Please link this athlete to Reboot first.", 400);
    }

    console.log(`[reboot-export-data] Player: ${player.name}, org_player_id: ${orgPlayerId}`);

    // Look up the correct movement_type_id for baseball-hitting
    // First try to fetch from Reboot's movement_types endpoint
    let movementTypeId = 2; // default fallback
    try {
      const mtResponse = await rebootFetch("/movement_types");
      if (mtResponse.ok) {
        const movementTypes = await mtResponse.json();
        console.log("[reboot-export-data] Available movement types:", JSON.stringify(movementTypes));
        // Find baseball-hitting type
        const hittingType = movementTypes.find((mt: any) =>
          mt.name?.toLowerCase().includes("hitting") ||
          mt.slug?.toLowerCase().includes("hitting")
        );
        if (hittingType?.id) {
          movementTypeId = hittingType.id;
          console.log(`[reboot-export-data] Using movement_type_id: ${movementTypeId} (${hittingType.name})`);
        }
      }
    } catch (err) {
      console.warn("[reboot-export-data] Could not fetch movement types, using default:", err);
    }

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false;

    console.log(`[reboot-export-data] Exporting ${dataTypes.length} data types for session ${body.session_id}`);

    // Make one API call per data_type (Reboot requires singular data_type)
    const csvData: Record<string, string> = {};
    const allDownloadUrls: Record<string, string[]> = {};

    for (const dataType of dataTypes) {
      try {
        console.log(`[reboot-export-data] Requesting export for data_type: ${dataType}`);

        const exportPayload = {
          session_id: body.session_id,
          movement_type_id: movementTypeId,
          org_player_id: orgPlayerId,
          data_type: dataType,
          data_format: "csv",
          aggregate: true,
        };

        console.log(`[reboot-export-data] Export payload:`, JSON.stringify(exportPayload));

        const exportResponse = await rebootFetch("/data_export", {
          method: "POST",
          body: JSON.stringify(exportPayload),
        });

        if (!exportResponse.ok) {
          const errorText = await exportResponse.text();
          console.error(`[reboot-export-data] Export failed for ${dataType} (${exportResponse.status}): ${errorText}`);
          continue; // Skip this type but continue with others
        }

        const exportData = await exportResponse.json();
        console.log(`[reboot-export-data] Export response for ${dataType}:`, JSON.stringify(exportData));

        // download_urls is an array of strings
        const downloadUrls: string[] = exportData.download_urls || [];
        allDownloadUrls[dataType] = downloadUrls;

        // Download each CSV URL
        for (const url of downloadUrls) {
          try {
            console.log(`[reboot-export-data] Downloading CSV for ${dataType}...`);
            const csvResponse = await fetch(url);
            if (csvResponse.ok) {
              const text = await csvResponse.text();
              // Append if multiple files for same type
              csvData[dataType] = (csvData[dataType] || "") + text;
              console.log(`[reboot-export-data] Downloaded ${dataType}: ${text.length} chars`);
            } else {
              console.error(`[reboot-export-data] Failed to download ${dataType}: ${csvResponse.status}`);
            }
          } catch (dlErr) {
            console.error(`[reboot-export-data] Error downloading ${dataType}:`, dlErr);
          }
        }
      } catch (err) {
        console.error(`[reboot-export-data] Error exporting ${dataType}:`, err);
      }
    }

    if (Object.keys(csvData).length === 0) {
      return errorResponse("No data types were successfully exported. Check that the session has processed data.", 400);
    }

    // Store raw CSV data in our database
    const { error: insertError } = await supabase
      .from("reboot_exports")
      .insert({
        player_id: body.player_id,
        session_id: body.session_id,
        data_types: Object.keys(csvData),
        csv_data: csvData,
        raw_response: allDownloadUrls,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[reboot-export-data] Failed to save export data:", insertError);
    }

    // Update session status
    await supabase
      .from("reboot_sessions")
      .update({
        status: "exported",
        exported_at: new Date().toISOString(),
      })
      .eq("reboot_session_id", body.session_id);

    // Trigger 4B/KRS analysis if requested
    let analysisResult = null;
    if (triggerAnalysis && csvData["momentum-energy"]) {
      try {
        console.log("[reboot-export-data] Triggering 4B/KRS analysis...");

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
            momentum_csv: csvData["momentum-energy"],
            kinematics_csv: csvData["inverse-kinematics"],
          }),
        });

        if (analysisResponse.ok) {
          analysisResult = await analysisResponse.json();
          console.log("[reboot-export-data] 4B/KRS analysis complete");
        } else {
          console.error("[reboot-export-data] Analysis failed:", await analysisResponse.text());
        }
      } catch (err) {
        console.error("[reboot-export-data] Error triggering analysis:", err);
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "reboot_data_exported",
      description: `Exported ${Object.keys(csvData).length} data types from Reboot Motion`,
      player_id: body.player_id,
      metadata: {
        session_id: body.session_id,
        data_types: Object.keys(csvData),
        analysis_triggered: triggerAnalysis,
      },
    });

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      player_id: body.player_id,
      data_types_exported: Object.keys(csvData),
      csv_row_counts: Object.fromEntries(
        Object.entries(csvData).map(([k, v]) => [k, v.split("\n").length - 1])
      ),
      analysis_triggered: triggerAnalysis,
      analysis_result: analysisResult,
    });

  } catch (error) {
    console.error("[reboot-export-data] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
