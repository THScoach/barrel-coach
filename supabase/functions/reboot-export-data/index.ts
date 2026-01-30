/**
 * Reboot Export Data Edge Function
 * Exports session data (CSVs) from Reboot Motion and triggers 4B/KRS calculations
 *
 * POST /functions/v1/reboot-export-data
 * Body: {
 *   session_id: string,         // Reboot session ID
 *   player_id: string,          // Our internal player ID
 *   data_types?: string[],      // Types to export (default: inverse-kinematics, momentum-energy)
 *   trigger_analysis?: boolean  // Whether to trigger 4B/KRS calculations (default: true)
 * }
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

interface DataExportResponse {
  download_urls?: Record<string, string>;
  session_id: string;
  movement_type: string;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: ExportDataRequest = await req.json();

    // Validate required fields
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

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false; // default true

    console.log(`[reboot-export-data] Exporting data for session ${body.session_id}`);

    // Call Reboot data_export endpoint
    const exportResponse = await rebootFetch("/data_export", {
      method: "POST",
      body: JSON.stringify({
        session_id: body.session_id,
        movement_type: "baseball-hitting",
        data_types: dataTypes,
      }),
    });

    if (!exportResponse.ok) {
      const errorText = await exportResponse.text();
      throw new Error(`Data export failed (${exportResponse.status}): ${errorText}`);
    }

    const exportData: DataExportResponse = await exportResponse.json();
    console.log("[reboot-export-data] Export response:", Object.keys(exportData.download_urls || {}));

    // Download each CSV
    const csvData: Record<string, string> = {};
    const downloadUrls = exportData.download_urls || {};

    for (const [dataType, url] of Object.entries(downloadUrls)) {
      try {
        console.log(`[reboot-export-data] Downloading ${dataType}...`);
        const csvResponse = await fetch(url);
        if (csvResponse.ok) {
          csvData[dataType] = await csvResponse.text();
          console.log(`[reboot-export-data] Downloaded ${dataType}: ${csvData[dataType].length} chars`);
        } else {
          console.error(`[reboot-export-data] Failed to download ${dataType}: ${csvResponse.status}`);
        }
      } catch (err) {
        console.error(`[reboot-export-data] Error downloading ${dataType}:`, err);
      }
    }

    // Store raw CSV data in our database
    const { error: insertError } = await supabase
      .from("reboot_exports")
      .insert({
        player_id: body.player_id,
        session_id: body.session_id,
        data_types: dataTypes,
        csv_data: csvData,
        raw_response: exportData,
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

        // Call the calculate-4b-scores function
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
        analysis_triggered: triggerAnalysis 
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
