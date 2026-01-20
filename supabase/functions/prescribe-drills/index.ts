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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { player_id, session_id, leak_type, motor_profile, scores } = await req.json();

    if (!player_id || !scores) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find weakest B
    const bScores = [
      { b: 'brain', score: scores.brain },
      { b: 'body', score: scores.body },
      { b: 'bat', score: scores.bat },
      { b: 'ball', score: scores.ball },
    ];
    const weakest = bScores.reduce((min, curr) => 
      (curr.score ?? 100) < (min.score ?? 100) ? curr : min
    );

    const conditions: string[] = [];
    if (leak_type && leak_type !== 'clean_transfer') conditions.push(`leak_type.eq.${leak_type}`);
    if (motor_profile) conditions.push(`motor_profile.eq.${motor_profile}`);
    if (weakest.b) conditions.push(`four_b_weakness.eq.${weakest.b}`);

    if (conditions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, drills_assigned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: prescriptions } = await supabase
      .from('drill_prescriptions')
      .select('drill_id, prescription_reason')
      .eq('is_active', true)
      .or(conditions.join(','))
      .order('priority')
      .limit(3);

    if (!prescriptions?.length) {
      return new Response(
        JSON.stringify({ success: true, drills_assigned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const assignments = prescriptions.map(p => ({
      player_id,
      drill_id: p.drill_id,
      session_id: session_id || null,
      assigned_reason: p.prescription_reason,
      leak_type_at_assignment: leak_type,
      score_at_assignment: weakest.score,
    }));

    await supabase
      .from('player_drill_assignments')
      .upsert(assignments, { onConflict: 'player_id,drill_id,session_id', ignoreDuplicates: true });

    return new Response(
      JSON.stringify({ success: true, drills_assigned: prescriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});