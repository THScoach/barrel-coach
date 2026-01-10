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

    const { action, phoneNumber } = await req.json();

    switch (action) {
      case "getMessages": {
        if (!phoneNumber) {
          throw new Error("phoneNumber is required");
        }
        
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("phone_number", phoneNumber)
          .order("created_at", { ascending: true });
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ messages: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "getUnreadCounts": {
        // Get count of unread inbound messages grouped by phone
        const { data, error } = await supabase
          .from("messages")
          .select("phone_number")
          .eq("direction", "inbound")
          .is("read_at", null);
        
        if (error) throw error;
        
        // Count by phone number
        const counts: Record<string, number> = {};
        data?.forEach((msg: { phone_number: string }) => {
          counts[msg.phone_number] = (counts[msg.phone_number] || 0) + 1;
        });
        
        const countsArray = Object.entries(counts).map(([phone_number, count]) => ({
          phone_number,
          count
        }));
        
        return new Response(
          JSON.stringify({ counts: countsArray }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      case "markAsRead": {
        if (!phoneNumber) {
          throw new Error("phoneNumber is required");
        }
        
        const { error } = await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("phone_number", phoneNumber)
          .eq("direction", "inbound")
          .is("read_at", null);
        
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Admin messages error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
