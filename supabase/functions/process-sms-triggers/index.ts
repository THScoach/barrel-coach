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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find pending scheduled messages that are due
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("sms_scheduled")
      .select("*, sessions:session_id(*)")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error("Failed to fetch scheduled messages:", fetchError);
      throw new Error("Failed to fetch scheduled messages");
    }

    console.log(`Found ${pendingMessages?.length || 0} pending messages to process`);

    const results = [];

    for (const scheduled of pendingMessages || []) {
      try {
        // Call the send-sms function with template
        const sendSmsUrl = `${supabaseUrl}/functions/v1/send-sms`;
        const response = await fetch(sendSmsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            sessionId: scheduled.session_id,
            triggerName: scheduled.trigger_name,
            useTemplate: true,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Update scheduled message status to sent
          await supabase
            .from("sms_scheduled")
            .update({ status: "sent" })
            .eq("id", scheduled.id);

          results.push({ id: scheduled.id, status: "sent" });
          console.log(`Sent scheduled message ${scheduled.id}`);
        } else {
          // Update status to failed
          await supabase
            .from("sms_scheduled")
            .update({ status: "failed" })
            .eq("id", scheduled.id);

          results.push({ id: scheduled.id, status: "failed", error: result.error || result.message });
          console.error(`Failed to send scheduled message ${scheduled.id}:`, result);
        }
      } catch (sendError) {
        console.error(`Error processing message ${scheduled.id}:`, sendError);
        
        await supabase
          .from("sms_scheduled")
          .update({ status: "failed" })
          .eq("id", scheduled.id);

        results.push({ id: scheduled.id, status: "error", error: String(sendError) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Process SMS triggers error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
