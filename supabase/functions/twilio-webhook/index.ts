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
    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    console.log("Received SMS from:", from, "Body:", body);

    if (!from || !body) {
      throw new Error("Missing required fields");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find session by phone number
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("player_phone", from)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Save inbound message
    const { error: dbError } = await supabase.from("messages").insert({
      session_id: session?.id || null,
      phone_number: from,
      direction: "inbound",
      body: body,
      twilio_sid: messageSid,
      status: "received",
    });

    if (dbError) {
      console.error("Database error:", dbError);
    }

    // Return TwiML response (empty - no auto-reply)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    
    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    
    // Return empty TwiML on error to prevent Twilio retries
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
      status: 200,
    });
  }
});
