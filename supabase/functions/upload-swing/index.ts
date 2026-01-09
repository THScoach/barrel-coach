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

    // Validate swing index
    if (swingIndex >= session.swings_required) {
      throw new Error(`Invalid swing index. Max is ${session.swings_required - 1}`);
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

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("swing-videos")
      .getPublicUrl(fileName);

    // Check if swing record already exists
    const { data: existingSwing } = await supabase
      .from("swings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("swing_index", swingIndex)
      .single();

    if (existingSwing) {
      // Update existing swing
      await supabase
        .from("swings")
        .update({
          video_url: urlData.publicUrl,
          video_storage_path: fileName,
          video_filename: file.name,
          video_size_bytes: file.size,
          validation_passed: true,
          uploaded_at: new Date().toISOString(),
        })
        .eq("id", existingSwing.id);
    } else {
      // Create new swing record
      await supabase.from("swings").insert({
        session_id: sessionId,
        swing_index: swingIndex,
        video_url: urlData.publicUrl,
        video_storage_path: fileName,
        video_filename: file.name,
        video_size_bytes: file.size,
        validation_passed: true,
        uploaded_at: new Date().toISOString(),
      });
    }

    // Update session status
    const { data: allSwings } = await supabase
      .from("swings")
      .select("id")
      .eq("session_id", sessionId);

    const swingsUploaded = allSwings?.length || 0;
    const readyForPayment = swingsUploaded >= session.swings_required;

    if (readyForPayment) {
      await supabase
        .from("sessions")
        .update({ status: "pending_payment" })
        .eq("id", sessionId);
    } else {
      await supabase
        .from("sessions")
        .update({ status: "uploading" })
        .eq("id", sessionId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        swingIndex,
        swingsUploaded,
        swingsRequired: session.swings_required,
        readyForPayment,
        videoUrl: urlData.publicUrl,
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
