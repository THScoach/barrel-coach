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

    const { action, id, updates } = await req.json();

    switch (action) {
      case "getTemplates": {
        const { data, error } = await supabase
          .from("sms_templates")
          .select("*")
          .order("created_at", { ascending: true });
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ templates: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "getLogs": {
        const { data, error } = await supabase
          .from("sms_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ logs: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "getScheduled": {
        const { data, error } = await supabase
          .from("sms_scheduled")
          .select("*")
          .order("scheduled_for", { ascending: false })
          .limit(100);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ scheduled: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "updateTemplate": {
        if (!id || !updates) {
          throw new Error("Missing id or updates");
        }
        
        const { data, error } = await supabase
          .from("sms_templates")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ template: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Admin SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
