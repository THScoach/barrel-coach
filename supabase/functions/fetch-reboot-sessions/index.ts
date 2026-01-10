import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_KEY = Deno.env.get("REBOOT_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify admin user
async function verifyAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  
  if (claimsError || !claimsData?.user) {
    throw new Error("Unauthorized");
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return claimsData.user.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin access
    await verifyAdmin(req);

    const { org_player_id } = await req.json();

    if (!org_player_id) {
      return new Response(
        JSON.stringify({ error: "org_player_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching sessions for player ${org_player_id}`);

    const response = await fetch(
      `https://api.rebootmotion.com/sessions?org_player_id=${org_player_id}&limit=20`,
      {
        headers: {
          "X-Api-Key": REBOOT_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Reboot API error (${response.status}): ${error}`);
    }

    const sessions = await response.json();

    return new Response(
      JSON.stringify({ sessions }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
