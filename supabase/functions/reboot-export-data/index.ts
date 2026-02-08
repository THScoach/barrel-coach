/**
 * Reboot Export Data Edge Function
 * Requests data exports from Reboot Motion and triggers 4B/KRS calculations
 *
 * Strategy: Don't download massive CSVs in this function.
 * Instead, get the signed S3 URLs from Reboot, store them,
 * and pass them to the analysis function which can stream/sample the data.
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

    // Request export URLs from Reboot (no downloading yet)
    const exportUrls: Record<string, string[]> = {};

    for (const dataType of dataTypes) {
      try {
        const exportResponse = await rebootFetch("/data_export", {
          method: "POST",
          body: JSON.stringify({
            session_id: body.session_id,
            movement_type_id: movementTypeId,
            org_player_id: orgPlayerId,
            data_type: dataType,
            data_format: "csv",
            aggregate: true,
          }),
        });

        if (!exportResponse.ok) {
          const errorText = await exportResponse.text();
          console.error(`[reboot-export-data] Export failed for ${dataType} (${exportResponse.status}): ${errorText}`);
          continue;
        }

        const exportData = await exportResponse.json();
        const urls: string[] = exportData.download_urls || [];
        exportUrls[dataType] = urls;
        console.log(`[reboot-export-data] Got ${urls.length} download URL(s) for ${dataType}`);
      } catch (err) {
        console.error(`[reboot-export-data] Error requesting ${dataType}:`, err);
      }
    }

    if (Object.keys(exportUrls).length === 0) {
      return errorResponse("No data types were successfully exported.", 400);
    }

    // Store export URLs in our database (not the raw CSV data)
    const { error: insertError } = await supabase
      .from("reboot_exports")
      .insert({
        player_id: body.player_id,
        session_id: body.session_id,
        data_types: Object.keys(exportUrls),
        csv_data: {}, // Don't store 57MB of CSV inline
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

    // Trigger analysis by streaming only what we need (sample rows)
    let analysisResult = null;
    if (triggerAnalysis && exportUrls["momentum-energy"]?.length) {
      try {
        console.log("[reboot-export-data] Downloading sampled CSV for analysis...");

        // Download only the momentum-energy CSV, but cap at ~2MB to stay in memory
        const meUrl = exportUrls["momentum-energy"][0];
        const meResponse = await fetch(meUrl);
        if (!meResponse.ok) throw new Error(`Download failed: ${meResponse.status}`);

        // Read as text but cap size
        const reader = meResponse.body?.getReader();
        const decoder = new TextDecoder();
        let csvText = "";
        const MAX_CHARS = 2_000_000; // 2MB cap

        if (reader) {
          while (csvText.length < MAX_CHARS) {
            const { done, value } = await reader.read();
            if (done) break;
            csvText += decoder.decode(value, { stream: true });
          }
          reader.cancel(); // Stop reading if we hit cap
        }

        console.log(`[reboot-export-data] Downloaded ${csvText.length} chars of momentum-energy (capped at ${MAX_CHARS})`);

        // Optionally download IK data (also capped)
        let ikText = "";
        if (exportUrls["inverse-kinematics"]?.length) {
          const ikUrl = exportUrls["inverse-kinematics"][0];
          const ikResponse = await fetch(ikUrl);
          if (ikResponse.ok) {
            const ikReader = ikResponse.body?.getReader();
            if (ikReader) {
              while (ikText.length < MAX_CHARS) {
                const { done, value } = await ikReader.read();
                if (done) break;
                ikText += decoder.decode(value, { stream: true });
              }
              ikReader.cancel();
            }
          }
          console.log(`[reboot-export-data] Downloaded ${ikText.length} chars of inverse-kinematics`);
        }

        // Call 4B scoring
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
            momentum_csv: csvText,
            kinematics_csv: ikText || undefined,
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
        analysis_triggered: triggerAnalysis,
      },
    });

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      player_id: body.player_id,
      data_types_exported: Object.keys(exportUrls),
      download_urls: exportUrls,
      analysis_triggered: triggerAnalysis,
      analysis_result: analysisResult,
    });

  } catch (error) {
    console.error("[reboot-export-data] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
