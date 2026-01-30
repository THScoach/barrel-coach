/**
 * Reboot Upload Video Edge Function
 * Uploads a video to Reboot Motion for processing
 *
 * Flow:
 * 1. Create mocap_session in Reboot
 * 2. Get pre-signed S3 URL via mocap_session_file
 * 3. Download video from our storage
 * 4. Upload video to Reboot's S3
 * 5. Save session_id to our database
 * 6. Queue status polling
 *
 * POST /functions/v1/reboot-upload-video
 * Body: {
 *   player_id: string,          // Our internal player ID
 *   video_url: string,          // URL to video in our Supabase storage
 *   video_filename?: string,    // Original filename (optional)
 *   movement_type?: string,     // Default: "baseball-hitting"
 *   frame_rate?: number         // Video frame rate (default: 240)
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

interface UploadVideoRequest {
  player_id: string;
  video_url: string;
  video_filename?: string;
  movement_type?: string;
  frame_rate?: number;
}

interface MocapSessionResponse {
  id: string;
  session_id?: string;
  session_date: string;
  movement_type: string;
  organization_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body: UploadVideoRequest = await req.json();

    // Validate required fields
    if (!body.player_id) {
      return errorResponse("player_id is required", 400);
    }
    if (!body.video_url) {
      return errorResponse("video_url is required", 400);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get player's reboot_player_id
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, reboot_player_id, reboot_athlete_id, name")
      .eq("id", body.player_id)
      .single();

    if (playerError || !player) {
      return errorResponse(`Player not found: ${body.player_id}`, 404);
    }

    const rebootPlayerId = player.reboot_player_id || player.reboot_athlete_id;
    if (!rebootPlayerId) {
      return errorResponse(
        "Player doesn't have a Reboot account. Call reboot-create-player first.",
        400
      );
    }

    const movementType = body.movement_type || "baseball-hitting";
    const filename = body.video_filename || `swing_${Date.now()}.mp4`;
    const frameRate = body.frame_rate || 240;

    console.log(`[reboot-upload-video] Creating mocap session for player ${rebootPlayerId}`);

    // Step 1: Create mocap_session
    const sessionResponse = await rebootFetch("/mocap_session", {
      method: "POST",
      body: JSON.stringify({
        org_player_id: rebootPlayerId,
        mocap_type_id: 67, // video upload type
        session_date: new Date().toISOString().split("T")[0],
        session_type_id: 1, // practice
      }),
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      throw new Error(`Failed to create mocap session: ${errorText}`);
    }

    const session: MocapSessionResponse = await sessionResponse.json();
    const sessionId = session.session_id || session.id;
    console.log(`[reboot-upload-video] Mocap session created: ${sessionId}`);

    // Step 2: Get pre-signed URL for upload
    const fileResponse = await rebootFetch("/mocap_session_file", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        filenames: [filename],
        video_framerate: frameRate,
      }),
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      throw new Error(`Failed to get upload URL: ${errorText}`);
    }

    const fileData = await fileResponse.json();
    const uploadUrl = fileData[filename];

    if (!uploadUrl) {
      throw new Error("No presigned URL returned from Reboot");
    }

    console.log(`[reboot-upload-video] Got presigned URL, downloading video from: ${body.video_url}`);

    // Step 3: Download video from our storage
    const videoResponse = await fetch(body.video_url);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    console.log(`[reboot-upload-video] Video downloaded: ${videoBlob.size} bytes`);

    // Step 4: Upload to Reboot's S3
    const contentType = videoResponse.headers.get("content-type") || "video/mp4";
    const s3Response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: videoBlob,
    });

    if (!s3Response.ok) {
      const errorText = await s3Response.text();
      throw new Error(`Failed to upload to S3: ${s3Response.status} - ${errorText}`);
    }

    console.log(`[reboot-upload-video] Video uploaded to Reboot S3`);

    // Step 5: Save session to our database
    const { error: insertError } = await supabase
      .from("reboot_sessions")
      .insert({
        player_id: body.player_id,
        reboot_session_id: sessionId,
        reboot_player_id: rebootPlayerId,
        movement_type: movementType,
        status: "processing",
        video_url: body.video_url,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("[reboot-upload-video] Failed to save session record:", insertError);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "reboot_video_uploaded",
      description: `Video uploaded to Reboot Motion for 3D analysis`,
      player_id: body.player_id,
      metadata: { 
        session_id: sessionId, 
        filename,
        frame_rate: frameRate 
      },
    });

    // Step 6: Queue status polling (fire and forget)
    const pollUrl = `${supabaseUrl}/functions/v1/reboot-poll-status`;

    fetch(pollUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        player_id: body.player_id,
        attempt: 1,
      }),
    }).catch(err => console.error("[reboot-upload-video] Failed to start polling:", err));

    return jsonResponse({
      success: true,
      session_id: sessionId,
      player_id: body.player_id,
      reboot_player_id: rebootPlayerId,
      status: "processing",
      message: "Video uploaded to Reboot Motion. Processing will take 30-60 minutes.",
    });

  } catch (error) {
    console.error("[reboot-upload-video] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unknown error");
  }
});
