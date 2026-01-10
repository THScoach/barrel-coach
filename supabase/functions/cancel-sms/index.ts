import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, triggerName } = await req.json();

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    let query = supabase
      .from("sms_scheduled")
      .update({ status: "cancelled" })
      .eq("session_id", sessionId)
      .eq("status", "pending");

    // Optionally filter by trigger name
    if (triggerName) {
      query = query.eq("trigger_name", triggerName);
    }

    const { data, error } = await query.select();

    if (error) {
      throw error;
    }

    console.log(`Cancelled ${data?.length || 0} scheduled messages for session ${sessionId}`);

    return new Response(
      JSON.stringify({ success: true, cancelled: data?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Cancel SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
