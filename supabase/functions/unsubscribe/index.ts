import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get player_id from query params (GET request from email link)
    const url = new URL(req.url);
    const playerId = url.searchParams.get("player_id");
    const token = url.searchParams.get("token");

    if (!playerId) {
      return new Response(renderHtml("Missing player ID", false), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Simple token validation (base64 of player_id for basic protection)
    const expectedToken = btoa(playerId).replace(/=/g, "");
    if (token !== expectedToken) {
      return new Response(renderHtml("Invalid unsubscribe link", false), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Update the player's email_opt_in status
    const { data: player, error: updateError } = await supabase
      .from("players")
      .update({ email_opt_in: false })
      .eq("id", playerId)
      .select("name, email")
      .single();

    if (updateError) {
      console.error("[Unsubscribe] Error updating player:", updateError);
      return new Response(renderHtml("Failed to unsubscribe. Please try again.", false), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    console.log(`[Unsubscribe] Player ${playerId} (${player?.email}) unsubscribed from emails`);

    // Log the unsubscribe event
    await supabase.from("activity_log").insert({
      player_id: playerId,
      action: "email_unsubscribe",
      description: "Player unsubscribed from email communications",
    });

    return new Response(renderHtml("You have been unsubscribed", true, player?.name), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("[Unsubscribe] Error:", error);
    return new Response(renderHtml("An error occurred", false), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }
});

function renderHtml(message: string, success: boolean, playerName?: string): string {
  const firstName = playerName?.split(" ")[0] || "there";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? "Unsubscribed" : "Error"} - Catching Barrels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0A0A0B;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 480px;
      text-align: center;
    }
    .logo {
      display: inline-block;
      background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);
      padding: 12px 24px;
      border-radius: 8px;
      margin-bottom: 32px;
    }
    .logo h1 {
      color: white;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .logo p {
      color: rgba(255,255,255,0.8);
      font-size: 10px;
      margin-top: 4px;
      letter-spacing: 2px;
    }
    .card {
      background-color: #1a1a1b;
      border: 1px solid #2d2d2d;
      border-radius: 12px;
      padding: 40px 32px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 24px;
    }
    .message {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      color: ${success ? "#22c55e" : "#ef4444"};
    }
    .description {
      color: #a3a3a3;
      font-size: 15px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 32px;
      color: #525252;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>CATCHING BARRELS</h1>
      <p>DIAGNOSTIC LABORATORY</p>
    </div>
    <div class="card">
      <div class="icon">${success ? "✅" : "❌"}</div>
      <div class="message">${message}</div>
      <p class="description">
        ${success 
          ? `Hey ${firstName}, you've been removed from our email list. You won't receive any more emails from Catching Barrels. If you change your mind, just let Coach Rick know!`
          : "Something went wrong. Please contact support if this continues."
        }
      </p>
    </div>
    <p class="footer">Catching Barrels Laboratory • 4B Diagnostic System</p>
  </div>
</body>
</html>
  `;
}
