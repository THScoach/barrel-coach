import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME")!;
const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Types
interface UploadRequest {
  player_id: string;
  video_url: string;
  filename: string;
  session_type?: 'practice' | 'game';
  frame_rate?: number;
  upload_source?: string;
}

interface RebootPlayer {
  org_player_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
}

interface RebootMocapSession {
  id: string;
  session_id: string;
  status: string;
  org_id?: string;
}

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Player data type for DB response
interface PlayerData {
  id: string;
  name: string;
  reboot_player_id: string | null;
  reboot_athlete_id: string | null;
  height_inches: number | null;
  weight_lbs: number | null;
  handedness: string | null;
}

// Cache for access token (valid for 24h per Reboot docs)
let cachedToken: { token: string; expiresAt: number } | null = null;

// Get OAuth access token from Reboot
async function getRebootAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  console.log("[Auth] Fetching new Reboot access token");
  
  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot OAuth error (${response.status}): ${error}`);
  }

  const data: RebootTokenResponse = await response.json();
  
  // Cache the token (expire 1 hour early to be safe)
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

// Get auth headers for Reboot API calls
async function getRebootHeaders(): Promise<Record<string, string>> {
  const token = await getRebootAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Verify authenticated user
async function verifyUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);

  if (claimsError || !claimsData?.user) {
    throw new Error("Unauthorized");
  }

  return claimsData.user.id;
}

// Fetch all players from Reboot Motion API
async function fetchRebootPlayers(): Promise<RebootPlayer[]> {
  const headers = await getRebootHeaders();
  
  const response = await fetch(`${REBOOT_API_BASE}/players`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot API error fetching players (${response.status}): ${error}`);
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    return data;
  } else if (data.players && Array.isArray(data.players)) {
    return data.players;
  }

  return [];
}

// Create a new player in Reboot Motion
async function createRebootPlayer(player: {
  name: string;
  height_inches?: number | null;
  weight_lbs?: number | null;
  throws?: string | null;
  bats?: string | null;
}): Promise<string> {
  const headers = await getRebootHeaders();
  
  const response = await fetch(`${REBOOT_API_BASE}/players`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: player.name,
      height_in: player.height_inches,
      weight_lb: player.weight_lbs,
      throws: player.throws,
      bats: player.bats,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot API error creating player (${response.status}): ${error}`);
  }

  const newPlayer = await response.json();
  return newPlayer.org_player_id || newPlayer.id;
}

// Get or create Reboot player ID for a Catching Barrels player
async function getOrCreateRebootPlayer(
  supabase: any,
  catchingBarrelsPlayerId: string
): Promise<string> {
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, name, reboot_player_id, reboot_athlete_id, height_inches, weight_lbs, handedness")
    .eq("id", catchingBarrelsPlayerId)
    .single() as { data: PlayerData | null; error: any };

  if (playerError || !player) {
    throw new Error(`Player not found: ${catchingBarrelsPlayerId}`);
  }

  if (player.reboot_player_id) {
    console.log(`[Upload] Player ${player.name} already has reboot_player_id: ${player.reboot_player_id}`);
    return player.reboot_player_id;
  }

  if (player.reboot_athlete_id) {
    await supabase
      .from("players")
      .update({ reboot_player_id: player.reboot_athlete_id } as any)
      .eq("id", catchingBarrelsPlayerId);

    console.log(`[Upload] Using existing reboot_athlete_id as reboot_player_id: ${player.reboot_athlete_id}`);
    return player.reboot_athlete_id;
  }

  const rebootPlayers = await fetchRebootPlayers();
  const match = rebootPlayers.find(
    (p: RebootPlayer) => {
      const rebootName = p.name?.toLowerCase() ||
        `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase();
      return rebootName === player.name.toLowerCase();
    }
  );

  if (match) {
    const rebootId = match.org_player_id;
    await supabase
      .from("players")
      .update({ reboot_player_id: rebootId, reboot_athlete_id: rebootId } as any)
      .eq("id", catchingBarrelsPlayerId);

    console.log(`[Upload] Found existing Reboot player by name: ${rebootId}`);
    return rebootId;
  }

  console.log(`[Upload] Creating new player in Reboot: ${player.name}`);
  const newRebootId = await createRebootPlayer({
    name: player.name,
    height_inches: player.height_inches,
    weight_lbs: player.weight_lbs,
    bats: player.handedness,
  });

  await supabase
    .from("players")
    .update({ reboot_player_id: newRebootId, reboot_athlete_id: newRebootId } as any)
    .eq("id", catchingBarrelsPlayerId);

  console.log(`[Upload] Created new Reboot player: ${newRebootId}`);
  return newRebootId;
}

// Create a mocap session in Reboot
async function createMocapSession(sessionDate: string, sessionTypeId: number = 1): Promise<RebootMocapSession> {
  const headers = await getRebootHeaders();
  
  const response = await fetch(`${REBOOT_API_BASE}/mocap_session`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      mocap_type_id: 2,
      session_date: sessionDate,
      session_type_id: sessionTypeId
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot API error creating mocap session (${response.status}): ${error}`);
  }

  return await response.json();
}

// Get pre-signed upload URL for video
async function getUploadUrl(sessionId: string, filename: string, frameRate: number): Promise<string> {
  const headers = await getRebootHeaders();
  
  const response = await fetch(`${REBOOT_API_BASE}/mocap_session_file`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      session_id: sessionId,
      filenames: [filename],
      video_framerate: frameRate,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reboot API error getting upload URL (${response.status}): ${error}`);
  }

  const data = await response.json();
  const uploadUrl = data[filename];
  if (!uploadUrl) {
    throw new Error(`No upload URL returned for ${filename}`);
  }

  return uploadUrl;
}

// Stream video from source URL to S3 pre-signed URL
async function uploadVideoToS3(videoUrl: string, presignedUrl: string): Promise<void> {
  console.log(`[Upload] Fetching video from: ${videoUrl}`);

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch video from source (${videoResponse.status})`);
  }

  const contentType = videoResponse.headers.get("content-type") || "video/mp4";
  const videoBlob = await videoResponse.blob();

  console.log(`[Upload] Uploading ${videoBlob.size} bytes to S3`);

  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: videoBlob,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload video to S3 (${uploadResponse.status}): ${error}`);
  }

  console.log(`[Upload] Video uploaded successfully`);
}

// Main handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await verifyUser(req);

    const body: UploadRequest = await req.json();
    const {
      player_id,
      video_url,
      filename,
      session_type = 'practice',
      frame_rate = 240,
      upload_source = 'direct_upload'
    } = body;

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!video_url) {
      return new Response(
        JSON.stringify({ error: "video_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!filename) {
      return new Response(
        JSON.stringify({ error: "filename is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validFrameRates = [120, 240, 480, 600];
    if (!validFrameRates.includes(frame_rate)) {
      return new Response(
        JSON.stringify({ error: `Invalid frame_rate. Must be one of: ${validFrameRates.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Upload] Starting upload for player ${player_id}, file: ${filename}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const rebootPlayerId = await getOrCreateRebootPlayer(supabase, player_id);

    const sessionDate = new Date().toISOString().split('T')[0];
    const { data: uploadRecord, error: insertError } = await supabase
      .from("reboot_uploads")
      .insert({
        player_id,
        session_date: sessionDate,
        upload_source,
        processing_status: 'uploading',
        frame_rate,
        video_filename: filename,
        video_url,
        uploaded_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create upload record: ${insertError.message}`);
    }

    const uploadId = uploadRecord.id;
    console.log(`[Upload] Created upload record: ${uploadId}`);

    try {
      const videoCheckResponse = await fetch(video_url, { method: 'HEAD' });
      if (!videoCheckResponse.ok) {
        throw new Error(`Video not accessible at URL: ${videoCheckResponse.status}`);
      }

      const sessionTypeId = session_type === 'game' ? 2 : 1;
      const mocapSession = await createMocapSession(sessionDate, sessionTypeId);
      const rebootSessionId = mocapSession.session_id || mocapSession.id;

      console.log(`[Upload] Created Reboot session: ${rebootSessionId}`);

      await supabase
        .from("reboot_uploads")
        .update({ reboot_session_id: rebootSessionId })
        .eq("id", uploadId);

      const presignedUrl = await getUploadUrl(rebootSessionId, filename, frame_rate);

      await uploadVideoToS3(video_url, presignedUrl);

      await supabase
        .from("reboot_uploads")
        .update({ processing_status: 'processing' })
        .eq("id", uploadId);

      await supabase.from("activity_log").insert({
        action: "reboot_video_uploaded",
        description: `Video uploaded to Reboot: ${filename}`,
        player_id,
        metadata: {
          upload_id: uploadId,
          reboot_session_id: rebootSessionId,
          frame_rate,
          upload_source,
          uploaded_by: userId,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          upload_id: uploadId,
          reboot_session_id: rebootSessionId,
          reboot_player_id: rebootPlayerId,
          status: 'processing',
          message: 'Video uploaded successfully. Processing will complete in a few minutes.',
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } catch (uploadError) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
      await supabase
        .from("reboot_uploads")
        .update({
          processing_status: 'failed',
          error_message: errorMessage,
        })
        .eq("id", uploadId);

      throw uploadError;
    }

  } catch (error) {
    console.error("[Upload] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
