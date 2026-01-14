// ============================================================================
// Population Query Helpers
// READ-ONLY: Ensures reference athletes are NEVER mixed with population stats
// All writes must go through admin edge functions
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
 * Reference session type
 */
export interface ReferenceSession {
  id: string;
  reference_athlete_id: string;
  reboot_session_id?: string | null;
  session_date?: string | null;
  body_score?: number | null;
  brain_score?: number | null;
  bat_score?: number | null;
  ball_score?: number | null;
  composite_score?: number | null;
  grade?: string | null;
  created_at?: string;
}

/**
 * Get reference athlete cohort (READ-ONLY).
 * These are PRO/MLB athletes for validation and calibration.
 * Uses typed Supabase client.
 */
export async function getReferenceCohort(options?: {
  level?: 'MLB' | 'MiLB' | 'NCAA' | 'Indy' | 'International';
  archetype?: string;
}): Promise<ReferenceAthlete[]> {
  let query = supabase
    .from('reference_athletes')
    .select('*');
  
  if (options?.level) {
    query = query.eq('level', options.level);
  }
  if (options?.archetype) {
    query = query.eq('archetype', options.archetype);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching reference cohort:', error);
    return [];
  }
  
  return (data || []) as ReferenceAthlete[];
}

/**
 * Get reference sessions for a specific athlete (READ-ONLY).
 */
export async function getReferenceSessionsForAthlete(
  athleteId: string
): Promise<ReferenceSession[]> {
  const { data, error } = await supabase
    .from('reference_sessions')
    .select('*')
    .eq('reference_athlete_id', athleteId)
    .order('session_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching reference sessions:', error);
    return [];
  }
  
  return (data || []) as ReferenceSession[];
}

/**
 * Get all reference sessions (READ-ONLY).
 */
export async function getAllReferenceSessions(options?: {
  level?: string;
  limit?: number;
}): Promise<(ReferenceSession & { athlete?: ReferenceAthlete })[]> {
  let query = supabase
    .from('reference_sessions')
    .select(`
      *,
      reference_athletes (*)
    `)
    .order('created_at', { ascending: false });
  
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching all reference sessions:', error);
    return [];
  }
  
  return (data || []).map((row: any) => ({
    ...row,
    athlete: row.reference_athletes
  }));
}
