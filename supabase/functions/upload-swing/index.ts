import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("sessionId") as string;
    const swingIndex = parseInt(formData.get("swingIndex") as string);

    if (!file || !sessionId || isNaN(swingIndex)) {
      throw new Error("Missing required fields: file, sessionId, swingIndex");
    }

    // Validate session exists
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    // Validate swing index against max allowed (default 15 if not set)
    const swingsMaxAllowed = session.swings_max_allowed ?? 15;
    if (swingIndex >= swingsMaxAllowed) {
      throw new Error(`Invalid swing index. Max allowed is ${swingsMaxAllowed - 1}`);
    }

    // Upload video to storage
    const fileName = `${sessionId}/${swingIndex}_${Date.now()}.${file.name.split('.').pop()}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("swing-videos")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload video");
    }

    // Generate a signed URL (valid for 1 hour) instead of public URL
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("swing-videos")
      .createSignedUrl(fileName, 3600); // 1 hour expiration

    if (signedUrlError) {
      console.error("Signed URL error:", signedUrlError);
      throw new Error("Failed to generate video URL");
    }

    // Check if swing record already exists
    const { data: existingSwing } = await supabase
      .from("swings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("swing_index", swingIndex)
      .single();

    if (existingSwing) {
      // Update existing swing - store path only, not public URL
      await supabase
        .from("swings")
        .update({
          video_storage_path: fileName,
          video_filename: file.name,
          video_size_bytes: file.size,
          validation_passed: true,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", existingSwing.id);
    } else {
      // Create new swing record - store path only, not public URL
      await supabase.from("swings").insert({
        session_id: sessionId,
        swing_index: swingIndex,
        video_storage_path: fileName,
        video_filename: file.name,
        video_size_bytes: file.size,
        validation_passed: true,
        uploaded_at: new Date().toISOString(),
      });
    }

    // Update session status based on swings_required (min) vs uploaded count
    const { data: allSwings } = await supabase
      .from("swings")
      .select("id")
      .eq("session_id", sessionId);

    const swingsUploaded = allSwings?.length || 0;
    const swingsRequired = session.swings_required ?? 5;
    const readyForPayment = swingsUploaded >= swingsRequired;

    // Update session with swing count and status
    await supabase
      .from("sessions")
      .update({ 
        status: readyForPayment ? "pending_payment" : "uploading",
        swing_count: swingsUploaded
      })
      .eq("id", sessionId);

    // === SMS WORKFLOW: VIDEO UPLOADED ===
    // Cancel the no_upload_reminder since they uploaded
    try {
      const cancelUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/cancel-sms`;
      await fetch(cancelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          sessionId,
          triggerName: "no_upload_reminder",
        }),
      });
      console.log("Cancelled no_upload_reminder for session:", sessionId);
    } catch (smsError) {
      console.error("Failed to cancel SMS (non-fatal):", smsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        swingIndex,
        swingsUploaded,
        swingsRequired: session.swings_required,
        readyForPayment,
        videoUrl: signedUrlData.signedUrl, // Return signed URL instead of public
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
