import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// DK CSV column → internal field mapping
const COLUMN_MAP: Record<string, string> = {
  speedbarrelmax: "bat_speed_mph",
  controlapproachangleimpact: "attack_angle_deg",
  speedhandsmax: "hand_speed_mph",
  quicknesstriggerimpact: "trigger_to_impact_ms",
  percentageonswingplane: "on_plane_pct",
  controlhandcastmax: "hand_cast",
  controlbatverticalangleimpact: "vertical_bat_angle",
  swingplanesteepnessangle: "swing_plane_steepness",
};

function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

function mapRow(raw: Record<string, string>) {
  const mapped: Record<string, number | null> = {};
  for (const [csvCol, internalField] of Object.entries(COLUMN_MAP)) {
    const key = Object.keys(raw).find((k) => k.toLowerCase() === csvCol);
    if (key && raw[key] !== "") {
      mapped[internalField] = parseFloat(raw[key]);
      if (isNaN(mapped[internalField] as number)) mapped[internalField] = null;
    }
  }
  return mapped;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create user-scoped client to get user info
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for inserts (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Find player by email
    const { data: player, error: playerError } = await adminClient
      .from("players")
      .select("id")
      .eq("email", user.email)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: "No player profile found for this account" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No CSV file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvText = await file.text();
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "CSV has no data rows" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sensor session
    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await adminClient
      .from("sensor_sessions")
      .insert({
        player_id: player.id,
        session_date: now.split("T")[0],
        environment: "manual_upload",
        status: "complete",
        total_swings: rows.length,
        synced_at: now,
      })
      .select("id")
      .single();

    if (sessionError) {
      console.error("Session insert error:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert swings
    const swingInserts = rows.map((raw, i) => {
      const mapped = mapRow(raw);
      return {
        session_id: session.id,
        player_id: player.id,
        swing_number: i + 1,
        occurred_at: now,
        bat_speed_mph: mapped.bat_speed_mph ?? null,
        attack_angle_deg: mapped.attack_angle_deg ?? null,
        hand_speed_mph: mapped.hand_speed_mph ?? null,
        trigger_to_impact_ms: mapped.trigger_to_impact_ms ?? null,
        is_valid: true,
        raw_dk_data: raw,
      };
    });

    const { error: swingsError } = await adminClient
      .from("sensor_swings")
      .insert(swingInserts);

    if (swingsError) {
      console.error("Swings insert error:", swingsError);
      return new Response(
        JSON.stringify({ error: "Failed to insert swings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session aggregates
    const batSpeeds = swingInserts
      .map((s) => s.bat_speed_mph)
      .filter((v): v is number => v !== null);
    const handSpeeds = swingInserts
      .map((s) => s.hand_speed_mph)
      .filter((v): v is number => v !== null);

    if (batSpeeds.length > 0) {
      await adminClient
        .from("sensor_sessions")
        .update({
          bat_speed_avg: batSpeeds.reduce((a, b) => a + b, 0) / batSpeeds.length,
          bat_speed_max: Math.max(...batSpeeds),
          hand_speed_max: handSpeeds.length > 0 ? Math.max(...handSpeeds) : null,
          attack_angle_avg:
            swingInserts
              .map((s) => s.attack_angle_deg)
              .filter((v): v is number => v !== null)
              .reduce((a, b) => a + b, 0) /
              (swingInserts.filter((s) => s.attack_angle_deg !== null).length || 1),
        })
        .eq("id", session.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        swings_count: rows.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
