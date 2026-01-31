/**
 * Prescribe Drills Edge Function — v2.0
 * 
 * Flag-based drill prescription with profile contraindications
 * Philosophy: "We don't change, we unlock."
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type DrillFlag =
  | 'flag_weak_brace' | 'flag_over_spinning' | 'flag_late_timing' | 'flag_no_decel'
  | 'flag_weak_load' | 'flag_early_fire' | 'flag_no_coil' | 'flag_slide' | 'flag_shallow_xfactor'
  | 'flag_weak_transfer' | 'flag_low_torso_velo' | 'flag_poor_transfer'
  | 'flag_late_whip' | 'flag_hands_late' | 'flag_arm_dominant'
  | 'flag_drift' | 'flag_head_movement'
  | 'flag_simultaneous' | 'flag_no_sequence'
  | 'flag_casting' | 'flag_arm_bar' | 'flag_disconnected'
  | 'flag_balance_asymmetry';

type MotorProfile = 'SPINNER' | 'WHIPPER' | 'SLINGSHOTTER' | 'TITAN';

// ============================================================================
// FLAG → DRILL MAPPING
// ============================================================================

const FLAG_TO_DRILLS: Record<DrillFlag, string[]> = {
  // Deceleration flags
  flag_weak_brace: ['box-step-down-front', 'violent-brake', 'wall-drill'],
  flag_over_spinning: ['box-step-down-front', 'violent-brake'],
  flag_late_timing: ['box-step-down-front', 'violent-brake', 'freeman-pendulum'],
  flag_no_decel: ['violent-brake'],
  
  // Loading flags
  flag_weak_load: ['box-step-down-back', 'back-hip-load'],
  flag_early_fire: ['box-step-down-back', 'back-hip-load'],
  flag_no_coil: ['box-step-down-back', 'back-hip-load'],
  flag_slide: ['box-step-down-back', 'wall-drill'],
  flag_shallow_xfactor: ['back-hip-load'],
  
  // Transfer flags
  flag_weak_transfer: ['resistance-band-rotations', 'violent-brake'],
  flag_low_torso_velo: ['resistance-band-rotations'],
  flag_poor_transfer: ['step-and-turn-sop', 'resistance-band-rotations'],
  
  // Timing/Release flags
  flag_late_whip: ['freeman-pendulum'],
  flag_hands_late: ['freeman-pendulum'],
  flag_arm_dominant: ['freeman-pendulum'],
  
  // Drift flags
  flag_drift: ['wall-drill', 'box-step-down-front'],
  flag_head_movement: ['wall-drill'],
  
  // Sequence flags
  flag_simultaneous: ['step-and-turn-sop'],
  flag_no_sequence: ['step-and-turn-sop'],
  
  // Connection flags
  flag_casting: ['constraint-rope-drill'],
  flag_arm_bar: ['constraint-rope-drill'],
  flag_disconnected: ['constraint-rope-drill'],
  
  // Foundation flags
  flag_balance_asymmetry: ['single-leg-stability']
};

// Drills that are restricted for certain profiles
const PROFILE_DRILL_RESTRICTIONS: Record<MotorProfile, string[]> = {
  SPINNER: [],
  WHIPPER: ['constraint-rope-drill'],
  SLINGSHOTTER: ['box-step-down-front'],
  TITAN: []
};

// Drills that require caution for certain profiles
const PROFILE_DRILL_CAUTIONS: Record<MotorProfile, string[]> = {
  SPINNER: ['box-step-down-back', 'step-and-turn-sop', 'back-hip-load'],
  WHIPPER: [],
  SLINGSHOTTER: ['wall-drill', 'resistance-band-rotations'],
  TITAN: []
};

// Drill priority order (lower = higher priority)
const DRILL_PRIORITY: Record<string, number> = {
  'box-step-down-front': 1,
  'violent-brake': 2,
  'box-step-down-back': 3,
  'freeman-pendulum': 4,
  'wall-drill': 5,
  'back-hip-load': 6,
  'step-and-turn-sop': 7,
  'resistance-band-rotations': 8,
  'constraint-rope-drill': 9,
  'single-leg-stability': 10
};

// Prescription reasons by drill
const DRILL_REASONS: Record<string, string> = {
  'box-step-down-front': 'Teaches front-side brace and deceleration through gravity constraint',
  'violent-brake': 'Forces active hip deceleration to create the whip effect',
  'box-step-down-back': 'Builds deep load position using gravity to force back hip engagement',
  'freeman-pendulum': 'Creates early release feel — let the bat fall, don\'t push it',
  'wall-drill': 'Instant feedback on drift — rotate around axis, don\'t slide through it',
  'back-hip-load': 'Isolates the load pattern to build back hip awareness',
  'step-and-turn-sop': 'Breaks simultaneous firing by creating feel for sequence',
  'resistance-band-rotations': 'Builds torso acceleration strength for better transfer ratio',
  'constraint-rope-drill': 'Physical constraint prevents casting — hands in, barrel out',
  'single-leg-stability': 'Foundation work to fix balance asymmetry'
};

// ============================================================================
// PRESCRIPTION LOGIC
// ============================================================================

function prescribeDrills(flags: DrillFlag[], motorProfile: MotorProfile | null): string[] {
  // Step 1: Collect all drills triggered by flags
  const drillCounts = new Map<string, number>();
  
  for (const flag of flags) {
    const drills = FLAG_TO_DRILLS[flag] || [];
    for (const drill of drills) {
      drillCounts.set(drill, (drillCounts.get(drill) || 0) + 1);
    }
  }
  
  // Step 2: Filter by profile restrictions
  const restricted = motorProfile ? (PROFILE_DRILL_RESTRICTIONS[motorProfile] || []) : [];
  const filtered = Array.from(drillCounts.entries())
    .filter(([drill]) => !restricted.includes(drill));
  
  // Step 3: Sort by frequency (more flags = higher priority), then by drill priority
  filtered.sort((a, b) => {
    // First by count (descending)
    if (b[1] !== a[1]) return b[1] - a[1];
    // Then by priority (ascending)
    return (DRILL_PRIORITY[a[0]] || 99) - (DRILL_PRIORITY[b[0]] || 99);
  });
  
  // Step 4: Return top 3
  return filtered.slice(0, 3).map(([drill]) => drill);
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { 
      player_id, 
      session_id, 
      flags = [], 
      motor_profile = null,
      // Legacy support
      leak_type,
      scores 
    } = await req.json();

    if (!player_id) {
      return new Response(
        JSON.stringify({ error: "Missing player_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert legacy leak_type to flags if flags not provided
    let effectiveFlags: DrillFlag[] = flags;
    if (effectiveFlags.length === 0 && leak_type) {
      // Map old leak types to new flags
      const leakToFlags: Record<string, DrillFlag[]> = {
        'early_arms': ['flag_arm_dominant', 'flag_casting'],
        'late_legs': ['flag_weak_load', 'flag_early_fire'],
        'torso_bypass': ['flag_weak_transfer', 'flag_poor_transfer'],
        'over_rotation': ['flag_over_spinning', 'flag_no_decel'],
        'drift': ['flag_drift', 'flag_weak_brace'],
        'cast': ['flag_casting', 'flag_arm_bar'],
        'simultaneous': ['flag_simultaneous', 'flag_no_sequence']
      };
      effectiveFlags = leakToFlags[leak_type] || [];
    }

    if (effectiveFlags.length === 0) {
      return new Response(
        JSON.stringify({ success: true, drills_assigned: 0, message: "No flags provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get prescribed drill slugs
    const drillSlugs = prescribeDrills(effectiveFlags, motor_profile as MotorProfile | null);

    if (drillSlugs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, drills_assigned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up drills by slug
    const { data: drills } = await supabase
      .from('drills')
      .select('id, slug, name')
      .in('slug', drillSlugs);

    if (!drills?.length) {
      // Drills not in DB yet - return the slugs for manual lookup
      return new Response(
        JSON.stringify({ 
          success: true, 
          drills_assigned: 0, 
          recommended_drills: drillSlugs,
          message: "Drills not found in database. Recommended drills returned as slugs."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create assignments
    const assignments = drills.map(drill => ({
      player_id,
      drill_id: drill.id,
      session_id: session_id || null,
      assigned_reason: DRILL_REASONS[drill.slug] || `Prescribed for ${motor_profile || 'general'} profile`,
      leak_type_at_assignment: effectiveFlags[0] || null,
      score_at_assignment: scores?.composite || null,
    }));

    // Upsert assignments
    const { error: upsertError } = await supabase
      .from('player_drill_assignments')
      .upsert(assignments, { 
        onConflict: 'player_id,drill_id,session_id', 
        ignoreDuplicates: true 
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
    }

    // Get cautions for response
    const cautions = motor_profile 
      ? drillSlugs.filter(slug => (PROFILE_DRILL_CAUTIONS[motor_profile as MotorProfile] || []).includes(slug))
      : [];

    return new Response(
      JSON.stringify({ 
        success: true, 
        drills_assigned: drills.length,
        drills: drills.map(d => ({ id: d.id, slug: d.slug, name: d.name, reason: DRILL_REASONS[d.slug] })),
        cautions: cautions.length > 0 ? `Use with care for ${motor_profile}: ${cautions.join(', ')}` : null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('prescribe-drills error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
