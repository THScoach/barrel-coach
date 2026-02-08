/**
 * Reboot Export Data Edge Function
 * Requests data exports from Reboot Motion and triggers 4B/KRS calculations
 *
 * Strategy:
 * 1. Try /data_export WITHOUT org_player_id (session-wide, all movements)
 * 2. If that fails (422), retry WITH org_player_id
 * 3. Pass download URLs to the 4B engine
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

    // Look up org_player_id (needed as fallback)
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
      console.warn("[export] Could not fetch movement types, using default");
    }

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false;

    // ========================================================================
    // Export: Try WITHOUT org_player_id first, then WITH as fallback
    // ========================================================================
    const exportUrls: Record<string, string[]> = {};

    for (const dataType of dataTypes) {
      let gotData = false;

      // --- Attempt 1: WITHOUT org_player_id ---
      try {
        const payload1 = {
          session_id: body.session_id,
          movement_type_id: movementTypeId,
          data_type: dataType,
          data_format: "csv",
          aggregate: true,
        };
        console.log(`[export] Attempt 1 (no org_player_id) for ${dataType}: ${JSON.stringify(payload1)}`);

        const res1 = await rebootFetch("/data_export", {
          method: "POST",
          body: JSON.stringify(payload1),
        });

        if (res1.ok) {
          const d = await res1.json();
          const urls = d.download_urls || [];
          console.log(`[export] Attempt 1 success: ${urls.length} URL(s) for ${dataType}`);
          console.log(`[export] Response keys: ${JSON.stringify(Object.keys(d))}`);

          if (urls.length > 0) {
            const movCount = await countMovementsInCsv(urls[0]);
            console.log(`[export] ✅ Attempt 1: CSV contains ${movCount} unique movement(s) for ${dataType}`);
            exportUrls[dataType] = urls;
            gotData = true;
          }
        } else {
          const errText = await res1.text();
          console.log(`[export] Attempt 1 failed (${res1.status}) for ${dataType}: ${errText.substring(0, 300)}`);
        }
      } catch (err) {
        console.error(`[export] Attempt 1 error for ${dataType}:`, err);
      }

      if (gotData) continue;

      // --- Attempt 2: WITH org_player_id ---
      try {
        const payload2 = {
          session_id: body.session_id,
          movement_type_id: movementTypeId,
          org_player_id: orgPlayerId,
          data_type: dataType,
          data_format: "csv",
          aggregate: true,
        };
        console.log(`[export] Attempt 2 (with org_player_id) for ${dataType}: ${JSON.stringify(payload2)}`);

        const res2 = await rebootFetch("/data_export", {
          method: "POST",
          body: JSON.stringify(payload2),
        });

        if (res2.ok) {
          const d = await res2.json();
          const urls = d.download_urls || [];
          console.log(`[export] Attempt 2 success: ${urls.length} URL(s) for ${dataType}`);

          if (urls.length > 0) {
            const movCount = await countMovementsInCsv(urls[0]);
            console.log(`[export] Attempt 2: CSV contains ${movCount} unique movement(s) for ${dataType}`);
            exportUrls[dataType] = urls;
          }
        } else {
          const errText = await res2.text();
          console.error(`[export] Attempt 2 failed (${res2.status}) for ${dataType}: ${errText.substring(0, 300)}`);
        }
      } catch (err) {
        console.error(`[export] Attempt 2 error for ${dataType}:`, err);
      }
    }

    if (Object.keys(exportUrls).length === 0) {
      return errorResponse("No data types were successfully exported.", 400);
    }

    for (const [dt, urls] of Object.entries(exportUrls)) {
      console.log(`[export] Final: ${dt} → ${urls.length} download URL(s)`);
    }

    // Store export record
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

    // Trigger 4B analysis
    let analysisResult = null;
    if (triggerAnalysis) {
      try {
        const totalUrls = Object.values(exportUrls).flat().length;
        console.log(`[export] Triggering 4B analysis with ${totalUrls} total URLs...`);

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
    console.error("[export] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});

// ============================================================================
// HELPERS
// ============================================================================

async function countMovementsInCsv(url: string): Promise<number> {
  try {
    const response = await fetch(url, {
      headers: { "Range": "bytes=0-50000" },
    });
    if (!response.ok && response.status !== 206) return 0;

    const text = await response.text();
    const lines = text.split("\n");
    if (lines.length < 2) return 0;

    const headers = lines[0].toLowerCase().replace(/"/g, '').split(",");
    const movIdIdx = headers.findIndex(h => h.includes("org_movement_id"));
    if (movIdIdx < 0) {
      console.log(`[export] CSV headers (no org_movement_id found): ${headers.join(', ')}`);
      return 0;
    }

    const movIds = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const val = (cols[movIdIdx] || '').replace(/"/g, '').trim();
      if (val) movIds.add(val);
    }

    console.log(`[export] CSV movement IDs found: ${[...movIds].join(', ')}`);
    return movIds.size;
  } catch (err) {
    console.warn("[export] Could not sample CSV:", err);
    return 0;
  }
}
