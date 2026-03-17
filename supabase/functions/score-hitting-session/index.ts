import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Threshold Constants ─────────────────────────────────────────────────────
const THRESHOLDS = {
  momentum_transfer_ratio: 0.65,
  momentum_pelvis_angular: 300, // deg·s⁻¹
  plane_trunk_frontal: 15,      // degrees
  range_timing_gap_pct: 8,      // percent
  balance_com_drift: 3.5,       // inches
};

const EXPECTED_SEQUENCE = "pelvis-torso-arm-bat";

// ─── Flag Evaluation ─────────────────────────────────────────────────────────
function evaluateFlags(ps: any, rss: any) {
  const flags = {
    has_sequence_issue: false,
    has_momentum_issue: false,
    has_plane_issue: false,
    has_range_usage_issue: false,
    has_balance_stability_issue: false,
  };

  // Sequence
  if (ps.sequence_order && ps.sequence_order !== EXPECTED_SEQUENCE) {
    flags.has_sequence_issue = true;
  }

  // Momentum
  if (rss) {
    if (
      (rss.pelvis_angular_momentum != null && rss.pelvis_angular_momentum < THRESHOLDS.momentum_pelvis_angular) ||
      (ps.transfer_ratio != null && ps.transfer_ratio < THRESHOLDS.momentum_transfer_ratio)
    ) {
      flags.has_momentum_issue = true;
    }

    // Plane
    if (rss.trunk_frontal_change_deg != null && Math.abs(rss.trunk_frontal_change_deg) > THRESHOLDS.plane_trunk_frontal) {
      flags.has_plane_issue = true;
    }

    // Balance
    if (rss.com_drift_inches != null && rss.com_drift_inches > THRESHOLDS.balance_com_drift) {
      flags.has_balance_stability_issue = true;
    }
  }

  // Range/Timing
  if (ps.timing_gap_pct != null && ps.timing_gap_pct < THRESHOLDS.range_timing_gap_pct) {
    flags.has_range_usage_issue = true;
  }

  return flags;
}

function determineWeakestB(ps: any): string {
  const scores: [string, number][] = [
    ["body", ps.body_score ?? 100],
    ["brain", ps.brain_score ?? 100],
    ["bat", ps.bat_score ?? 100],
    ["ball", ps.ball_score ?? 100],
  ];
  scores.sort((a, b) => a[1] - b[1]);
  return scores[0][0];
}

function determineSecondaryConstraint(flags: any): string | null {
  const active = Object.entries(flags)
    .filter(([_, v]) => v === true)
    .map(([k]) => k.replace("has_", "").replace("_issue", "").replace(/_/g, " "));
  return active.length > 1 ? active[1] : null;
}

// ─── AI Narrative Generation ─────────────────────────────────────────────────
async function generateNarratives(
  ps: any,
  rss: any,
  flags: any,
  weakestB: string,
  mainConstraint: string | null,
  coachRules: string[],
  drillNames: string[],
): Promise<{ coachText: string; playerText: string; focusBP: string; cues: string[] }> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    return {
      coachText: `Session scored. Weakest pillar: ${weakestB}. Main constraint: ${mainConstraint || "none identified"}.`,
      playerText: `Your ${weakestB} score needs work. Focus on ${mainConstraint || "movement quality"} next session.`,
      focusBP: `Work on ${weakestB} drills.`,
      cues: ["Stay balanced", "Sequence your swing"],
    };
  }

  const systemPrompt = `You are Coach Rick, a biomechanics-informed hitting coach who uses the 4B Framework (Body, Brain, Bat, Ball) and KRS (Kinetic Readiness Score).
${coachRules.length > 0 ? "\nCoaching rules:\n" + coachRules.join("\n") : ""}

Given session data, produce:
1. summary_coach_text: Technical biomechanical analysis (2-3 sentences, coach language)
2. summary_player_text: Simple explanation for the hitter (2-3 sentences, 5th-8th grade reading level)
3. focus_next_bp: 1-2 specific focus points for next batting practice
4. recommended_cues: 2-3 short coaching cues (5 words max each)

Respond ONLY with valid JSON: {"summary_coach_text":"...","summary_player_text":"...","focus_next_bp":"...","recommended_cues":["...","..."]}`;

  const userContent = `Session Data:
- 4B Scores: Body=${ps.body_score}, Brain=${ps.brain_score}, Bat=${ps.bat_score}, Ball=${ps.ball_score}
- KRS: ${ps.score_4bkrs ?? ps.overall_score ?? "N/A"}
- Weakest B: ${weakestB}
- Main Constraint: ${mainConstraint || "none"}
- Transfer Ratio: ${ps.transfer_ratio ?? "N/A"}
- Timing Gap: ${ps.timing_gap_pct ?? "N/A"}%
- Sequence Order: ${ps.sequence_order || "unknown"}
${rss ? `- Pelvis Angular Momentum: ${rss.pelvis_angular_momentum ?? "N/A"}
- P→T Gap: ${rss.pelvis_torso_gap_ms ?? "N/A"}ms
- COM Drift: ${rss.com_drift_inches ?? "N/A"} inches
- Trunk Frontal Change: ${rss.trunk_frontal_change_deg ?? "N/A"}°
- Pelvis→Torso Gain: ${rss.pelvis_torso_gain ?? "N/A"}
- Torso→Arm Gain: ${rss.torso_arm_gain ?? "N/A"}
- Arm→Bat Gain: ${rss.arm_bat_gain ?? "N/A"}` : "No Reboot biomech data available."}
- Flags: sequence=${flags.has_sequence_issue}, momentum=${flags.has_momentum_issue}, plane=${flags.has_plane_issue}, range=${flags.has_range_usage_issue}, balance=${flags.has_balance_stability_issue}
${drillNames.length > 0 ? "- Available drills: " + drillNames.join(", ") : ""}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        coachText: parsed.summary_coach_text || "",
        playerText: parsed.summary_player_text || "",
        focusBP: parsed.focus_next_bp || "",
        cues: parsed.recommended_cues || [],
      };
    }
    throw new Error("Could not parse AI response");
  } catch (err) {
    console.error("[AI Narratives] Error:", err);
    return {
      coachText: `Session scored. Weakest pillar: ${weakestB}. Main constraint: ${mainConstraint || "none identified"}.`,
      playerText: `Your ${weakestB} score needs the most work. Focus on ${mainConstraint || "movement quality"} next BP.`,
      focusBP: `Work on ${weakestB} drills and ${mainConstraint || "overall mechanics"}.`,
      cues: ["Stay balanced", "Sequence your swing"],
    };
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { player_session_id } = await req.json();
    if (!player_session_id) {
      return new Response(JSON.stringify({ error: "player_session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Read player_sessions row
    const { data: ps, error: psErr } = await supabase
      .from("player_sessions")
      .select("*")
      .eq("id", player_session_id)
      .single();

    if (psErr || !ps) {
      return new Response(JSON.stringify({ error: "player_session not found", detail: psErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Read linked reboot_swing_sessions (by reboot_session_id or player + date)
    let rss: any = null;
    if (ps.reboot_session_id) {
      // Find via reboot_sessions → session_date
      const { data: rs } = await supabase
        .from("reboot_sessions")
        .select("session_date")
        .eq("reboot_session_id", ps.reboot_session_id)
        .single();

      if (rs) {
        const { data } = await supabase
          .from("reboot_swing_sessions")
          .select("*")
          .eq("player_id", ps.player_id)
          .eq("session_date", rs.session_date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        rss = data;
      }
    }

    // Fallback: match by player_id + session_date
    if (!rss) {
      const sessionDate = ps.session_date?.substring(0, 10);
      if (sessionDate) {
        const { data } = await supabase
          .from("reboot_swing_sessions")
          .select("*")
          .eq("player_id", ps.player_id)
          .eq("session_date", sessionDate)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        rss = data;
      }
    }

    // 3. Evaluate flags
    const flags = evaluateFlags(ps, rss);

    // 4. Determine weakest_b and constraints
    const weakestB = determineWeakestB(ps);
    const mainConstraint = ps.weakest_link || ps.leak_type || null;
    const secondaryConstraint = determineSecondaryConstraint(flags);

    // 5. Load coach rules + matching drills in parallel
    const [rulesRes, drillsRes] = await Promise.all([
      supabase
        .from("coach_rick_rules")
        .select("rule_text")
        .eq("active", true)
        .eq("rule_type", "biomech")
        .limit(10),
      supabase.rpc("get_prescribed_drills", {
        p_player_id: ps.player_id,
        p_leak_type: ps.leak_type || null,
        p_motor_profile: null,
        p_weakest_b: weakestB,
        p_weakest_score: Math.min(ps.body_score ?? 100, ps.brain_score ?? 100, ps.bat_score ?? 100, ps.ball_score ?? 100),
      }),
    ]);

    const coachRules = (rulesRes.data || []).map((r: any) => r.rule_text);
    const drills = drillsRes.data || [];
    const drillNames = drills.map((d: any) => d.drill_name);

    // 6. Build formula_inputs snapshot
    const formulaInputs: any = {
      transfer_ratio: ps.transfer_ratio,
      timing_gap_pct: ps.timing_gap_pct,
      x_factor_max: ps.x_factor_max,
      sequence_order: ps.sequence_order,
      weakest_link: ps.weakest_link,
      leak_type: ps.leak_type,
    };
    if (rss) {
      formulaInputs.pelvis_angular_momentum = rss.pelvis_angular_momentum;
      formulaInputs.pelvis_torso_gap_ms = rss.pelvis_torso_gap_ms;
      formulaInputs.com_drift_inches = rss.com_drift_inches;
      formulaInputs.trunk_frontal_change_deg = rss.trunk_frontal_change_deg;
      formulaInputs.pelvis_torso_gain = rss.pelvis_torso_gain;
      formulaInputs.torso_arm_gain = rss.torso_arm_gain;
      formulaInputs.arm_bat_gain = rss.arm_bat_gain;
    }

    // 7. Generate AI narratives
    const narratives = await generateNarratives(ps, rss, flags, weakestB, mainConstraint, coachRules, drillNames);

    // 8. Build recommended_drills JSONB
    const recommendedDrills = drills.slice(0, 5).map((d: any) => ({
      drill_id: d.drill_id,
      name: d.drill_name,
      reason: d.prescription_reason,
      cue: null,
    }));

    // 9. Insert into hitting_4b_krs_sessions
    const insertPayload = {
      player_id: ps.player_id,
      player_session_id: ps.id,
      reboot_session_id: ps.reboot_session_id || null,
      session_date: ps.session_date,
      formula_version: "4B-KRS-v1",
      body_score: ps.body_score,
      bat_score: ps.bat_score,
      brain_score: ps.brain_score,
      ball_score: ps.ball_score,
      krs_score: ps.score_4bkrs ?? ps.overall_score,
      ...flags,
      main_constraint: mainConstraint,
      secondary_constraint: secondaryConstraint,
      weakest_b: weakestB,
      summary_coach_text: narratives.coachText,
      summary_player_text: narratives.playerText,
      focus_next_bp: narratives.focusBP,
      recommended_drills: recommendedDrills,
      recommended_cues: narratives.cues,
      formula_inputs: formulaInputs,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("hitting_4b_krs_sessions")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[Insert] Error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to insert hitting_4b_krs_sessions", detail: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Post locker_room_messages
    const flagSummary = {
      weakest_b: weakestB,
      main_constraint: mainConstraint,
      krs_score: insertPayload.krs_score,
      has_sequence_issue: flags.has_sequence_issue,
      has_momentum_issue: flags.has_momentum_issue,
      has_plane_issue: flags.has_plane_issue,
      has_range_usage_issue: flags.has_range_usage_issue,
      has_balance_stability_issue: flags.has_balance_stability_issue,
    };

    await supabase.from("locker_room_messages").insert({
      player_id: ps.player_id,
      message_type: "biomech_report",
      content: narratives.playerText,
      four_b_context: flagSummary,
      drill_links: recommendedDrills,
      trigger_reason: "reboot_session_scored",
      session_id: null, // not linked to old sessions table
    });

    return new Response(JSON.stringify({
      success: true,
      hitting_session_id: inserted.id,
      weakest_b: weakestB,
      main_constraint: mainConstraint,
      flags,
      krs_score: insertPayload.krs_score,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[score-hitting-session] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
