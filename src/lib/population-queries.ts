// ============================================================================
// Population Query Helpers
// Ensures reference athletes are NEVER mixed with population stats
// ============================================================================

import { supabase } from '@/integrations/supabase/client';

/**
 * Get population statistics for REGULAR players only.
 * Reference athletes are excluded by design (they're in separate tables).
 */
export async function getPopulationStats(options?: {
  level?: string;
  minSessions?: number;
}) {
  const query = supabase
    .from('players')
    .select(`
      id,
      name,
      level,
      latest_body_score,
      latest_brain_score,
      latest_bat_score,
      latest_ball_score,
      latest_composite_score
    `)
    .not('latest_composite_score', 'is', null);

  if (options?.level) {
    query.eq('level', options.level);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Compute aggregates
  const scores = data?.map((p: { latest_composite_score: number | null }) => p.latest_composite_score).filter(Boolean) as number[];
  
  if (!scores.length) {
    return {
      count: 0,
      avgComposite: 0,
      minComposite: 0,
      maxComposite: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 }
    };
  }

  scores.sort((a, b) => a - b);
  
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const percentile = (p: number) => scores[Math.floor(scores.length * p / 100)] || 0;

  return {
    count: scores.length,
    avgComposite: Math.round(avg * 10) / 10,
    minComposite: scores[0],
    maxComposite: scores[scores.length - 1],
    percentiles: {
      p25: percentile(25),
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90)
    }
  };
}

/**
 * Reference athlete type (for internal use)
 */
export interface ReferenceAthlete {
  id: string;
  display_name: string;
  level: string;
  handedness?: string | null;
  archetype?: string | null;
  notes?: string | null;
  visibility: string;
  reboot_athlete_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get reference athlete cohort stats (internal use only).
 * These are PRO/MLB athletes for validation and calibration.
 */
export async function getReferenceCohort(options?: {
  level?: 'MLB' | 'MiLB' | 'NCAA' | 'Indy' | 'International';
  archetype?: string;
}) {
  // Use direct REST call to avoid TS issues with ungenerated types
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  let url = `${(supabase as any).supabaseUrl}/rest/v1/reference_athletes?select=*`;
  if (options?.level) url += `&level=eq.${options.level}`;
  if (options?.archetype) url += `&archetype=eq.${options.archetype}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': (supabase as any).supabaseKey,
      'Authorization': `Bearer ${token}`,
    }
  });
  
  if (!response.ok) return [];
  return response.json();
}

/**
 * Create a new reference athlete.
 */
export async function createReferenceAthlete(athlete: {
  display_name: string;
  level: 'MLB' | 'MiLB' | 'NCAA' | 'Indy' | 'International';
  handedness?: 'R' | 'L' | 'S';
  archetype?: string;
  notes?: string;
  reboot_athlete_id?: string;
}): Promise<ReferenceAthlete> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  const insertData = {
    display_name: athlete.display_name,
    level: athlete.level,
    handedness: athlete.handedness,
    archetype: athlete.archetype,
    notes: athlete.notes,
    reboot_athlete_id: athlete.reboot_athlete_id,
    visibility: 'internal_only'
  };
  
  const response = await fetch(
    `${(supabase as any).supabaseUrl}/rest/v1/reference_athletes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': (supabase as any).supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(insertData)
    }
  );
  
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.message || 'Failed to create reference athlete');
  }
  
  const result = await response.json();
  return (Array.isArray(result) ? result[0] : result) as ReferenceAthlete;
}

/**
 * Create a reference session for a reference athlete.
 */
export async function createReferenceSession(session: {
  reference_athlete_id: string;
  reboot_session_id?: string;
  session_date?: string;
  body_score?: number;
  brain_score?: number;
  bat_score?: number;
  ball_score?: number;
  composite_score?: number;
  pelvis_velocity?: number;
  torso_velocity?: number;
  x_factor?: number;
  transfer_efficiency?: number;
  bat_ke?: number;
  ground_flow_score?: number;
  core_flow_score?: number;
  upper_flow_score?: number;
  consistency_cv?: number;
  consistency_grade?: string;
  weakest_link?: string;
  grade?: string;
}) {
  const authSession = await supabase.auth.getSession();
  const token = authSession.data.session?.access_token;
  
  const response = await fetch(
    `${(supabase as any).supabaseUrl}/rest/v1/reference_sessions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': (supabase as any).supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(session)
    }
  );
  
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.message || 'Failed to create reference session');
  }
  
  const result = await response.json();
  return Array.isArray(result) ? result[0] : result;
}
