import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getRebootAccessToken,
  corsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/rebootAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REBOOT_API_BASE = "https://api.rebootmotion.com";

/** Verify the caller is an admin */
async function verifyAdmin(req: Request): Promise<void> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error("Unauthorized");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Admin access required");
}

serve(async (req) => {
  // CORS preflight
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    await verifyAdmin(req);

    const { name, handedness, height_inches, weight_lbs, level } = await req.json();

    if (!name || typeof name !== "string" || !name.trim()) {
      return errorResponse("Name is required", 400);
    }

    // Parse name into first / last
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Build Reboot attributes
    const attributes: { key: string; value: string }[] = [];

    if (height_inches) {
      const heightFeet = Number(height_inches) / 12;
      attributes.push({ key: "height_ft", value: heightFeet.toFixed(3) });
    }

    if (weight_lbs) {
      attributes.push({ key: "weight_lbs", value: String(weight_lbs) });
    }

    if (handedness) {
      const rebootHand =
        handedness === "left" ? "LHA" : handedness === "switch" ? "SHA" : "RHA";
      attributes.push({ key: "dom_hand_hitting", value: rebootHand });
    }

    // Create athlete via Reboot Motion API
    const token = await getRebootAccessToken();

    const body: Record<string, unknown> = {
      first_name: firstName,
      last_name: lastName,
    };
    if (attributes.length > 0) body.attributes = attributes;

    console.log(`[Create Athlete] Creating in Reboot: ${firstName} ${lastName}`);

    const response = await fetch(`${REBOOT_API_BASE}/players`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Create Athlete] Reboot error (${response.status}):`, errText);
      throw new Error(`Reboot API error (${response.status}): ${errText}`);
    }

    const athlete = await response.json();

    console.log(
      `[Create Athlete] ✅ Created — id: ${athlete.id}, org_player_id: ${athlete.org_player_id}`
    );

    return jsonResponse({
      success: true,
      athlete_id: athlete.id || athlete.org_player_id,
      org_player_id: athlete.org_player_id,
      name: `${firstName} ${lastName}`.trim(),
    });
  } catch (error: any) {
    console.error("[Create Athlete] Error:", error);
    return errorResponse(error.message || "Failed to create athlete", 500);
  }
});
