/**
 * Queue Deep Analysis - Level 2 RickBot Video Processing
 * ============================================================================
 * Handles the deep analysis workflow:
 * 1. Uploads video to Reboot Motion for 3D biomechanics processing
 * 2. Polls for completion
 * 3. Pulls kinematic data and generates full Lab Report
 * 4. Sends results back to player via ClawdBot/SMS
 * 
 * POST /queue-deep-analysis
 * Body: {
 *   player_id: string,
 *   video_url: string,          // Public URL to the swing video
 *   video_storage_path: string, // Path in swing-videos bucket
 *   phone: string,              // Player's phone for result delivery
 *   is_whatsapp?: boolean,      // Whether to reply via WhatsApp
 *   instant_feedback?: string,  // Already-sent Level 1 feedback
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REBOOT_API_BASE = "https://api.rebootmotion.com";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface DeepAnalysisRequest {
  player_id: string;
  video_url: string;
  video_storage_path: string;
  phone: string;
  is_whatsapp?: boolean;
  instant_feedback?: string;
}

interface RebootTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRebootAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const REBOOT_USERNAME = Deno.env.get("REBOOT_USERNAME");
  const REBOOT_PASSWORD = Deno.env.get("REBOOT_PASSWORD");

  if (!REBOOT_USERNAME || !REBOOT_PASSWORD) {
    throw new Error("Reboot credentials not configured");
  }

  const response = await fetch(`${REBOOT_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: REBOOT_USERNAME,
      password: REBOOT_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Reboot OAuth error: ${response.status}`);
  }

  const data: RebootTokenResponse = await response.json();
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

async function getRebootHeaders(): Promise<Record<string, string>> {
  const token = await getRebootAccessToken();
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Create mocap session in Reboot
async function createMocapSession(
  orgPlayerId: string,
  sessionDate: string
): Promise<{ id: string; session_id: string }> {
  const headers = await getRebootHeaders();

  const response = await fetch(`${REBOOT_API_BASE}/mocap_session`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      org_player_id: orgPlayerId,
      mocap_type_id: 67, // Video upload type
      session_date: sessionDate,
      session_type_id: 1, // Practice
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Reboot session: ${error}`);
  }

  return await response.json();
}

// Get presigned upload URL
async function getUploadUrl(
  sessionId: string,
  filename: string,
  frameRate: number
): Promise<string> {
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
    throw new Error(`Failed to get upload URL: ${response.status}`);
  }

  const data = await response.json();
  return data[filename];
}

// Upload video to Reboot's S3
async function uploadVideoToReboot(
  videoUrl: string,
  presignedUrl: string
): Promise<void> {
  console.log("[DeepAnalysis] Downloading video from:", videoUrl);

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch video: ${videoResponse.status}`);
  }

  const contentType = videoResponse.headers.get("content-type") || "video/mp4";
  const videoBlob = await videoResponse.blob();

  console.log(`[DeepAnalysis] Uploading ${videoBlob.size} bytes to Reboot`);

  const uploadResponse = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: videoBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed: ${uploadResponse.status}`);
  }

  console.log("[DeepAnalysis] Upload successful");
}

// Poll for session processing completion
async function pollForCompletion(
  sessionId: string,
  maxWaitMs: number = 300000 // 5 minutes
): Promise<boolean> {
  const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY");
  if (!REBOOT_API_KEY) {
    throw new Error("REBOOT_API_KEY not configured");
  }

  const startTime = Date.now();
  const pollIntervalMs = 15000; // 15 seconds

  while (Date.now() - startTime < maxWaitMs) {
    console.log(`[DeepAnalysis] Polling session ${sessionId}...`);

    const response = await fetch(`${REBOOT_API_BASE}/sessions/${sessionId}`, {
      headers: {
        "X-Api-Key": REBOOT_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const session = await response.json();
      
      if (session.status === "processed" && (session.completed_movements ?? 0) > 0) {
        console.log("[DeepAnalysis] Session processed successfully");
        return true;
      }

      if (session.status === "failed" || session.status === "error") {
        console.error("[DeepAnalysis] Session processing failed");
        return false;
      }
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.log("[DeepAnalysis] Polling timeout");
  return false;
}

// Send message via Twilio
async function sendMessage(
  phone: string,
  message: string,
  isWhatsApp: boolean
): Promise<boolean> {
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
  const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || TWILIO_PHONE_NUMBER;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error("[DeepAnalysis] Missing Twilio credentials");
    return false;
  }

  // Normalize phone
  let normalized = phone.replace(/\D/g, "");
  if (normalized.length === 10) {
    normalized = "+1" + normalized;
  } else if (!normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }

  const toAddress = isWhatsApp ? `whatsapp:${normalized}` : normalized;
  const fromAddress = isWhatsApp ? `whatsapp:${TWILIO_WHATSAPP_NUMBER}` : TWILIO_PHONE_NUMBER;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const response = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: toAddress,
      From: fromAddress,
      Body: message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("[DeepAnalysis] Twilio error:", error);
    return false;
  }

  return true;
}

// Generate Lab Report summary using AI
async function generateLabReport(
  supabase: any,
  playerId: string,
  rebootSessionId: string,
  apiKey: string
): Promise<string> {
  // Fetch the processed session data
  const { data: rebootUpload } = await supabase
    .from("reboot_uploads")
    .select("*")
    .eq("reboot_session_id", rebootSessionId)
    .single();

  if (!rebootUpload) {
    return "⚠️ Analysis complete but data unavailable. Check your dashboard for results.";
  }

  const { data: player } = await supabase
    .from("players")
    .select("name, motor_profile_sensor")
    .eq("id", playerId)
    .single();

  const firstName = player?.name?.split(" ")[0] || "there";
  const profile = player?.motor_profile_sensor || "Unknown";

  // Build report summary
  const scores = {
    composite: rebootUpload.composite_score ?? "N/A",
    brain: rebootUpload.four_b_brain ?? "N/A",
    body: rebootUpload.four_b_body ?? "N/A",
    bat: rebootUpload.four_b_bat ?? "N/A",
    ball: rebootUpload.four_b_ball ?? "N/A",
  };

  const weakest = rebootUpload.weakest_category || "body";
  const leak = rebootUpload.primary_leak || null;

  // Generate personalized summary
  const prompt = `You are Coach Rick. Generate a SHORT (3-4 sentences) Lab Report summary for ${firstName} based on their 3D biomechanics analysis.

Motor Profile: ${profile}
Composite Score: ${scores.composite}/80
Brain: ${scores.brain} | Body: ${scores.body} | Bat: ${scores.bat} | Ball: ${scores.ball}
Weakest Area: ${weakest}
Primary Leak: ${leak || "None detected"}

Focus on:
1. Overall grade/level
2. One strength to keep
3. One priority to improve
4. One drill recommendation

Keep it SHORT - this is for SMS. Use baseball slang naturally.`;

  try {
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are Coach Rick, a direct and encouraging hitting coach. Keep responses under 400 characters for SMS." },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    return `🔬 LAB REPORT - ${firstName}\n\n${summary}\n\n📊 Full report: catchingbarrels.com/my-data`;
  } catch (error) {
    console.error("[DeepAnalysis] AI error:", error);
    
    // Fallback to static summary
    return `🔬 LAB REPORT - ${firstName}\n\nComposite: ${scores.composite}/80\nBody: ${scores.body} | Brain: ${scores.brain}\nBat: ${scores.bat} | Ball: ${scores.ball}\n\nFocus: ${weakest.toUpperCase()}\n\n📊 Full report: catchingbarrels.com/my-data`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: DeepAnalysisRequest = await req.json();
    const {
      player_id,
      video_url,
      video_storage_path,
      phone,
      is_whatsapp = false,
    } = body;

    if (!player_id || !video_url || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[DeepAnalysis] Starting deep analysis for player ${player_id}`);

    // Get player's Reboot ID
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, reboot_player_id, reboot_athlete_id")
      .eq("id", player_id)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${player_id}`);
    }

    const rebootPlayerId = player.reboot_player_id || player.reboot_athlete_id;

    if (!rebootPlayerId) {
      // Player not set up for Reboot - send helpful message
      await sendMessage(
        phone,
        "🔬 To get full 3D analysis, we need to set up your biomechanics profile. DM Coach Rick to get started!",
        is_whatsapp
      );

      return new Response(
        JSON.stringify({ success: false, reason: "no_reboot_profile" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Reboot session
    const sessionDate = new Date().toISOString().split("T")[0];
    const filename = video_storage_path.split("/").pop() || `swing_${Date.now()}.mp4`;

    console.log(`[DeepAnalysis] Creating Reboot session for ${player.name}`);

    const mocapSession = await createMocapSession(rebootPlayerId, sessionDate);
    const rebootSessionId = mocapSession.session_id || mocapSession.id;

    console.log(`[DeepAnalysis] Created session: ${rebootSessionId}`);

    // Create reboot_uploads record
    const { data: uploadRecord, error: insertError } = await supabase
      .from("reboot_uploads")
      .insert({
        player_id,
        reboot_session_id: rebootSessionId,
        session_date: sessionDate,
        upload_source: "whatsapp_video",
        processing_status: "uploading",
        video_filename: filename,
        video_url,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create upload record: ${insertError.message}`);
    }

    const uploadId = uploadRecord.id;

    // Get presigned URL and upload video
    const presignedUrl = await getUploadUrl(rebootSessionId, filename, 240);
    await uploadVideoToReboot(video_url, presignedUrl);

    // Update status
    await supabase
      .from("reboot_uploads")
      .update({ processing_status: "processing" })
      .eq("id", uploadId);

    // Notify player that deep analysis is in progress
    await sendMessage(
      phone,
      "🔬 Deep analysis started! I'm running your swing through our 3D biomechanics engine. You'll get your full Lab Report in a few minutes. ⚾️",
      is_whatsapp
    );

    // Poll for completion (this can take a while)
    const success = await pollForCompletion(rebootSessionId);

    if (!success) {
      await supabase
        .from("reboot_uploads")
        .update({ processing_status: "failed" })
        .eq("id", uploadId);

      await sendMessage(
        phone,
        "⚠️ 3D analysis took longer than expected. We'll send your report when it's ready. Check your dashboard later!",
        is_whatsapp
      );

      return new Response(
        JSON.stringify({ success: false, reason: "processing_timeout" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process the completed session
    console.log("[DeepAnalysis] Processing completed session...");

    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-reboot-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: rebootSessionId,
        org_player_id: rebootPlayerId,
        player_id,
      }),
    });

    if (!processResponse.ok) {
      console.error("[DeepAnalysis] Failed to process session");
    }

    // Generate and send Lab Report
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      const labReport = await generateLabReport(supabase, player_id, rebootSessionId, LOVABLE_API_KEY);
      await sendMessage(phone, labReport, is_whatsapp);
    }

    // Update status
    await supabase
      .from("reboot_uploads")
      .update({ processing_status: "complete" })
      .eq("id", uploadId);

    // Log activity
    await supabase.from("activity_log").insert({
      action: "deep_analysis_complete",
      description: `WhatsApp video analyzed via Reboot: ${filename}`,
      player_id,
      metadata: {
        upload_id: uploadId,
        reboot_session_id: rebootSessionId,
        delivery_channel: is_whatsapp ? "whatsapp" : "sms",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        upload_id: uploadId,
        reboot_session_id: rebootSessionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[DeepAnalysis] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
