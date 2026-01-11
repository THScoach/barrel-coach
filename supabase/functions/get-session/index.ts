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
    // ============================================================
    // SECURITY: Verify JWT authentication before returning session data
    // ============================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - missing auth token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Create authenticated client to verify token
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the JWT token and get user info
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;

    // Check if user is admin
    const { data: isAdminData } = await supabaseAuth.rpc("is_admin");
    const isAdmin = isAdminData === true;

    // Service role client for data access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    // ============================================================
    // SECURITY LOCK 4: Only allow access if user is admin OR owns the session
    // Primary: Check user_id match
    // Fallback: Check email match (for legacy sessions without user_id)
    // ============================================================
    const isOwnerByUserId = session.user_id && session.user_id === userId;
    const isOwnerByEmail = userEmail && session.player_email && 
      (session.player_email as string).toLowerCase() === (userEmail as string).toLowerCase();
    
    if (!isAdmin && !isOwnerByUserId && !isOwnerByEmail) {
      return new Response(
        JSON.stringify({ error: "Forbidden - you don't own this session" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }
    
    // If session doesn't have user_id yet but email matches, claim it
    if (!session.user_id && isOwnerByEmail) {
      await supabase
        .from("sessions")
        .update({ user_id: userId })
        .eq("id", sessionId);
      session.user_id = userId; // Update local copy
    }

    // Fetch swings
    const { data: swings, error: swingsError } = await supabase
      .from("swings")
      .select("*")
      .eq("session_id", sessionId)
      .order("swing_index");

    if (swingsError) {
      console.error("Swings fetch error:", swingsError);
    }

    // Generate signed URLs for each swing video
    const swingsWithSignedUrls = await Promise.all(
      (swings || []).map(async (swing) => {
        if (swing.video_storage_path) {
          const { data: signedUrl } = await supabase.storage
            .from("swing-videos")
            .createSignedUrl(swing.video_storage_path, 3600); // 1 hour expiration
          
          return { ...swing, video_url: signedUrl?.signedUrl || null };
        }
        return swing;
      })
    );

    // For admins, return full session data
    // For session owners, also return full data (they own it)
    return new Response(
      JSON.stringify({
        session,
        swings: swingsWithSignedUrls,
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
