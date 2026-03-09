import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DK_AUTH_URL = "https://diamondkinetics.us.auth0.com/oauth/token";
const DK_API_BASE = "https://api.diamondkinetics.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require admin JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr) throw new Error("Unauthorized");

    const userId = claims.claims.sub;
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: corsHeaders });
    }

    console.log("[dk-link-players] Authenticated admin, starting link process");

    // Get DK token
    const accessToken = await getDKToken(supabaseAdmin);

    // Get unlinked players with emails
    const { data: players, error: playersErr } = await supabaseAdmin
      .from("players")
      .select("id, name, email")
      .is("dk_user_uuid", null)
      .not("email", "is", null);

    if (playersErr) throw playersErr;
    console.log(`[dk-link-players] Found ${players?.length || 0} unlinked players with emails`);

    let matched = 0;
    let unmatched = 0;
    const errors: string[] = [];
    const matches: Array<{ name: string; email: string; dk_uuid: string }> = [];

    for (const player of players || []) {
      if (!player.email) { unmatched++; continue; }

      try {
        const res = await fetch(`${DK_API_BASE}/v6/users?email=${encodeURIComponent(player.email)}`, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 404) { unmatched++; continue; }
          throw new Error(`DK API ${res.status}: ${text}`);
        }

        const data = await res.json();
        const users = Array.isArray(data) ? data : data.users ? data.users : [data];
        
        if (users.length > 0 && users[0]?.uuid) {
          const dkUuid = users[0].uuid;
          await supabaseAdmin
            .from("players")
            .update({ dk_user_uuid: dkUuid })
            .eq("id", player.id);

          matched++;
          matches.push({ name: player.name || "", email: player.email, dk_uuid: dkUuid });
          console.log(`[dk-link-players] Matched: ${player.name} → ${dkUuid}`);
        } else {
          unmatched++;
        }
      } catch (e: any) {
        errors.push(`${player.name}: ${e.message}`);
        console.error(`[dk-link-players] Error for ${player.name}:`, e.message);
      }
    }

    const result = { success: true, matched, unmatched, errors, matches };
    console.log("[dk-link-players] Complete:", JSON.stringify({ matched, unmatched, errors: errors.length }));

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[dk-link-players] Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

async function getDKToken(supabase: any): Promise<string> {
  const { data: cached } = await supabase
    .from("dk_token_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return cached.access_token;
  }

  const res = await fetch(DK_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("DK_CLIENT_ID"),
      client_secret: Deno.env.get("DK_CLIENT_SECRET"),
      audience: "https://api.diamondkinetics.com/",
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth0 error ${res.status}: ${text}`);
  }

  const tokenData = await res.json();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in - 3600) * 1000).toISOString();

  await supabase.from("dk_token_cache").upsert({ id: 1, access_token: tokenData.access_token, expires_at: expiresAt });
  return tokenData.access_token;
}
