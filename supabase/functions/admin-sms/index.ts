import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify the caller is an admin user
async function verifyAdmin(req: Request): Promise<{ isAdmin: boolean; error?: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'Missing authorization header' }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getUser(token)
  
  if (error || !data.user) {
    return { isAdmin: false, error: 'Invalid token' }
  }

  // Check admin role using the is_admin function
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')
  
  if (roleError || isAdmin !== true) {
    return { isAdmin: false, error: 'Unauthorized: Admin access required' }
  }

  return { isAdmin: true }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify admin access for all requests
  const { isAdmin, error: authError } = await verifyAdmin(req)
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: authError }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
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
