import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getExt(file: File) {
  // Prefer mime-type mapping when possible
  const nameExt = file.name?.split(".").pop()?.toLowerCase();
  if (nameExt && nameExt.length <= 5) return nameExt;

  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/quicktime") return "mov";
  return "mp4";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) {
      throw new Error("Missing server env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization bearer token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // 1) Verify user with anon client (never trust the browser)
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await authClient.auth.getUser();
    const user = userData?.user;

    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // 2) Use service role only after auth passes
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;
    const swingIndexRaw = formData.get("swingIndex") as string | null;
    const swingIndex = swingIndexRaw ? parseInt(swingIndexRaw, 10) : NaN;

    if (!file || !sessionId || Number.isNaN(swingIndex)) {
      throw new Error("Missing required fields: file, sessionId, swingIndex");
    }
    if (swingIndex < 0) {
      throw new Error("Invalid swingIndex (must be >= 0)");
    }

    // Validate session exists
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, player_email, swings_max_allowed, swings_required")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    // ✅ Ownership check (basic + strong)
    // If your app uses shared links, you can loosen this later.
    if ((session.player_email || "").toLowerCase() !== user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const swingsMaxAllowed = session.swings_max_allowed ?? 15;
    if (swingIndex >= swingsMaxAllowed) {
      throw new Error(`Invalid swing index. Max allowed is ${swingsMaxAllowed - 1}`);
    }

    // Upload video to storage using stable filename (no Date.now)
    const ext = getExt(file);
    const storagePath = `${sessionId}/${swingIndex}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("swing-videos")
      .upload(storagePath, file, {
        contentType: file.type || "video/mp4",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload video");
    }

    // Upsert swing row
    const { data: existingSwing } = await admin
      .from("swings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("swing_index", swingIndex)
      .maybeSingle();

    if (existingSwing?.id) {
      const { error } = await admin
        .from("swings")
        .update({
          video_storage_path: storagePath,
          video_filename: file.name,
          video_size_bytes: file.size,
          validation_passed: true,
          uploaded_at: new Date().toISOString(),
          status: "complete",
        })
        .eq("id", existingSwing.id);

      if (error) throw new Error("Failed to update swing record");
    } else {
      const { error } = await admin.from("swings").insert({
        session_id: sessionId,
        swing_index: swingIndex,
        video_storage_path: storagePath,
        video_filename: file.name,
        video_size_bytes: file.size,
        validation_passed: true,
        uploaded_at: new Date().toISOString(),
        status: "complete",
      });

      if (error) throw new Error("Failed to insert swing record");
    }

    // Compute swingsUploaded count
    const { data: allSwings, error: swingsErr } = await admin
      .from("swings")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "complete");

    if (swingsErr) throw new Error("Failed to count swings");

    const swingsUploaded = allSwings?.length || 0;
    const swingsRequired = session.swings_required ?? 5;
    const readyForPayment = swingsUploaded >= swingsRequired;

    await admin
      .from("sessions")
      .update({
        status: readyForPayment ? "pending_payment" : "uploading",
        swing_count: swingsUploaded,
      })
      .eq("id", sessionId);

    // Optional: return signed URL for immediate preview (DO NOT STORE IT)
    const { data: signedUrlData } = await admin.storage
      .from("swing-videos")
      .createSignedUrl(storagePath, 3600);

    // SMS cancel (non-fatal)
    try {
      const cancelUrl = `${SUPABASE_URL}/functions/v1/cancel-sms`;
      await fetch(cancelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          sessionId,
          triggerName: "no_upload_reminder",
        }),
      });
    } catch (smsError) {
      console.error("Failed to cancel SMS (non-fatal):", smsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        swingIndex,
        swingsUploaded,
        swingsRequired,
        readyForPayment,
        videoStoragePath: storagePath,
        // Use for immediate preview only. Expires.
        videoUrl: signedUrlData?.signedUrl ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
