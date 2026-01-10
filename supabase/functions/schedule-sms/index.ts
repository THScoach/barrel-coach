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
    const { sessionId, triggerName, delayMinutes } = await req.json();

    if (!sessionId || !triggerName) {
      throw new Error("Missing sessionId or triggerName");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the template to find default delay
    let delay = delayMinutes;
    if (delay === undefined) {
      const { data: template } = await supabase
        .from("sms_templates")
        .select("delay_minutes")
        .eq("trigger_name", triggerName)
        .single();
      
      delay = template?.delay_minutes || 0;
    }

    // Calculate scheduled time
    const scheduledFor = new Date(Date.now() + delay * 60 * 1000);

    // Create scheduled message
    const { data, error } = await supabase
      .from("sms_scheduled")
      .insert({
        session_id: sessionId,
        trigger_name: triggerName,
        scheduled_for: scheduledFor.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`Scheduled ${triggerName} for session ${sessionId} at ${scheduledFor}`);

    return new Response(
      JSON.stringify({ success: true, scheduled: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Schedule SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
