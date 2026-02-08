/**
 * Reboot Export Data Edge Function
 * Requests data exports from Reboot Motion and triggers 4B/KRS calculations
 *
 * Strategy:
 * 1. GET /session/{session_id} to learn how many movements exist
 * 2. GET /movements?session_id={id} to get individual movement IDs
 * 3. For each movement: POST /data_export with org_movement_id
 * 4. Pass all download URLs to the 4B engine which concatenates them
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

    // ========================================================================
    // Step 1: Discover movements in this session
    // ========================================================================
    let movementIds: string[] = [];
    let expectedCount = 0;

    // 1a. GET /session/{id} to see how many movements exist
    try {
      const sessionRes = await rebootFetch(`/session/${body.session_id}`);
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        // total_movements: {"baseball-hitting": 3}
        if (sessionData.total_movements) {
          for (const [_type, count] of Object.entries(sessionData.total_movements)) {
            expectedCount += (count as number);
          }
        }
        console.log(`[export] Session has ${expectedCount} total movements (from /session)`);
      } else {
        console.warn(`[export] GET /session/${body.session_id} failed: ${sessionRes.status}`);
      }
    } catch (err) {
      console.warn("[export] Error getting session info:", err);
    }

    // 1b. Try multiple endpoints to discover individual movement IDs
    const movementEndpoints = [
      `/movements?session_id=${body.session_id}`,
      `/movements?session_id=${body.session_id}&org_player_id=${orgPlayerId}`,
      `/session/${body.session_id}/movements`,
      `/mocap-sessions/${body.session_id}/movements`,
      `/player/${orgPlayerId}/movements?session_id=${body.session_id}`,
    ];

    for (const endpoint of movementEndpoints) {
      if (movementIds.length > 0) break;
      try {
        console.log(`[export] Trying: GET ${endpoint}`);
        const res = await rebootFetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          console.log(`[export] ${endpoint} returned: ${JSON.stringify(data).substring(0, 500)}`);

          // Parse movements from response
          const items = Array.isArray(data) ? data : (data.movements || data.results || data.data || []);
          if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
              const id = item.org_movement_id || item.movement_id || item.id;
              if (id) movementIds.push(String(id));
            }
            console.log(`[export] Found ${movementIds.length} movement IDs from ${endpoint}`);
          }
        } else {
          const errText = await res.text();
          console.log(`[export] ${endpoint} → ${res.status}: ${errText.substring(0, 200)}`);
        }
      } catch (err) {
        console.log(`[export] ${endpoint} error: ${err}`);
      }
    }

    const dataTypes = body.data_types || ["inverse-kinematics", "momentum-energy"];
    const triggerAnalysis = body.trigger_analysis !== false;

    // ========================================================================
    // Step 2: Export data
    // ========================================================================
    const exportUrls: Record<string, string[]> = {};

    if (movementIds.length > 0) {
      // === Per-movement export ===
      console.log(`[export] Per-movement export: ${movementIds.length} movements × ${dataTypes.length} data types`);

      for (const dataType of dataTypes) {
        const urls: string[] = [];
        for (const movementId of movementIds) {
          try {
            const res = await rebootFetch("/data_export", {
              method: "POST",
              body: JSON.stringify({
                session_id: body.session_id,
                movement_type_id: movementTypeId,
                org_player_id: orgPlayerId,
                org_movement_id: movementId,
                data_type: dataType,
                data_format: "csv",
                aggregate: true,
              }),
            });

            if (res.ok) {
              const d = await res.json();
              const dlUrls = d.download_urls || [];
              urls.push(...dlUrls);
              console.log(`[export]   ${dataType} / ${movementId}: ${dlUrls.length} URL(s)`);
            } else {
              const errText = await res.text();
              console.error(`[export]   ${dataType} / ${movementId} failed (${res.status}): ${errText.substring(0, 200)}`);
            }
          } catch (err) {
            console.error(`[export]   ${dataType} / ${movementId} error:`, err);
          }
        }
        if (urls.length > 0) {
          exportUrls[dataType] = urls;
        }
      }
    } else {
      // === Session-level export (fallback) ===
      // Try both aggregate:true and aggregate:false to see which gives more data
      console.log(`[export] No movement IDs found. Trying session-level export...`);

      for (const dataType of dataTypes) {
        // First try aggregate:false — may return one URL per movement
        try {
          console.log(`[export] Trying ${dataType} with aggregate:false...`);
          const res = await rebootFetch("/data_export", {
            method: "POST",
            body: JSON.stringify({
              session_id: body.session_id,
              movement_type_id: movementTypeId,
              org_player_id: orgPlayerId,
              data_type: dataType,
              data_format: "csv",
              aggregate: false,
            }),
          });

          if (res.ok) {
            const d = await res.json();
            const urls = d.download_urls || [];
            console.log(`[export] ${dataType} aggregate:false → ${urls.length} URL(s)`);
            // Log full response structure for debugging
            console.log(`[export] ${dataType} response keys: ${JSON.stringify(Object.keys(d))}`);

            if (urls.length > 0) {
              exportUrls[dataType] = urls;
              // Sample first URL to count movements inside
              const movCount = await countMovementsInCsv(urls[0]);
              console.log(`[export] ${dataType} URL[0] contains ${movCount} unique movement(s)`);
              continue; // Got data, skip aggregate:true attempt
            }
          } else {
            const errText = await res.text();
            console.warn(`[export] ${dataType} aggregate:false failed (${res.status}): ${errText.substring(0, 200)}`);
          }
        } catch (err) {
          console.warn(`[export] ${dataType} aggregate:false error:`, err);
        }

        // Fallback: aggregate:true
        try {
          console.log(`[export] Trying ${dataType} with aggregate:true...`);
          const res = await rebootFetch("/data_export", {
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

          if (res.ok) {
            const d = await res.json();
            const urls = d.download_urls || [];
            console.log(`[export] ${dataType} aggregate:true → ${urls.length} URL(s)`);
            if (urls.length > 0) {
              exportUrls[dataType] = urls;
              const movCount = await countMovementsInCsv(urls[0]);
              console.log(`[export] ${dataType} URL[0] contains ${movCount} unique movement(s)`);
            }
          } else {
            const errText = await res.text();
            console.error(`[export] ${dataType} aggregate:true failed (${res.status}): ${errText.substring(0, 200)}`);
          }
        } catch (err) {
          console.error(`[export] ${dataType} aggregate:true error:`, err);
        }
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
      description: `Exported ${Object.keys(exportUrls).length} data types (${movementIds.length || expectedCount} movements) from Reboot Motion`,
      player_id: body.player_id,
      metadata: {
        session_id: body.session_id,
        data_types: Object.keys(exportUrls),
        movement_count: movementIds.length || expectedCount,
        movement_ids: movementIds,
        url_counts: Object.fromEntries(Object.entries(exportUrls).map(([k, v]) => [k, v.length])),
        analysis_triggered: triggerAnalysis,
      },
    });

    return jsonResponse({
      success: true,
      session_id: body.session_id,
      player_id: body.player_id,
      expected_movements: expectedCount,
      discovered_movement_ids: movementIds,
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
 * Sample the first ~20KB of a CSV to count unique org_movement_id values.
 */
async function countMovementsInCsv(url: string): Promise<number> {
  try {
    const response = await fetch(url, {
      headers: { "Range": "bytes=0-30000" },
    });
    if (!response.ok && response.status !== 206) return 0;

    const text = await response.text();
    const lines = text.split("\n");
    if (lines.length < 2) return 0;

    const headers = lines[0].toLowerCase().replace(/"/g, '').split(",");
    const movIdIdx = headers.findIndex(h => h.includes("org_movement_id"));
    if (movIdIdx < 0) return 0;

    const movIds = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const val = (cols[movIdIdx] || '').replace(/"/g, '').trim();
      if (val) movIds.add(val);
    }
    return movIds.size;
  } catch (err) {
    console.warn("[export] Could not sample CSV:", err);
    return 0;
  }
}
