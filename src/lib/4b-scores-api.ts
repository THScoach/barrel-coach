/**
 * 4B Scores API Client
 * 
 * Frontend client for calling the backend scoring function.
 * This client only receives final scores - no formulas are exposed.
 */

import { supabase } from "@/integrations/supabase/client";

export interface SessionScores {
  brain: number;
  body: number;
  bat: number;
  ball: number;
  overall: number;
}

export interface SessionGrades {
  brain: string;
  body: string;
  bat: string;
  ball: string;
  overall: string;
}

export interface LeakDetection {
  leak_type: string;
  leak_caption: string;
  leak_training: string;
}

export interface Calculate4BResponse {
  success: boolean;
  session_id: string;
  scores: SessionScores;
  grades: SessionGrades;
  leak: LeakDetection;
}

export interface Calculate4BRequest {
  player_id: string;
  session_data?: {
    brain_score?: number;
    body_score?: number;
    bat_score?: number;
    ball_score?: number;
    ground_flow?: number;
    core_flow?: number;
    upper_flow?: number;
    swing_count?: number;
  };
}

/**
 * Calculate 4B scores for a player session
 * Calls the backend edge function which handles all scoring logic
 */
export async function calculate4BScores(
  request: Calculate4BRequest
): Promise<Calculate4BResponse> {
  const { data, error } = await supabase.functions.invoke('calculate-4b-scores', {
    body: request
  });

  if (error) {
    console.error('[4b-scores-api] Error:', error);
    throw new Error(error.message || 'Failed to calculate scores');
  }

  if (!data.success) {
    throw new Error(data.error || 'Score calculation failed');
  }

  return data as Calculate4BResponse;
}

/**
 * Get grade label for a 20-80 score (display only)
 */
export function getGradeLabel(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 50) return "Average";
  if (score >= 45) return "Below Avg";
  if (score >= 40) return "Fringe Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

/**
 * Get color class for a score (for UI display)
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 60) return "text-green-400";
  if (score >= 55) return "text-yellow-500";
  if (score >= 50) return "text-gray-400";
  if (score >= 45) return "text-orange-500";
  return "text-red-500";
}

/**
 * Get background color class for a score
 */
export function getScoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 60) return "bg-green-400";
  if (score >= 55) return "bg-yellow-500";
  if (score >= 50) return "bg-gray-400";
  if (score >= 45) return "bg-orange-500";
  return "bg-red-500";
}

/**
 * Fetch the latest session for a player from the dashboard
 */
export async function getLatestPlayerSession(playerId: string): Promise<any | null> {
  const authSession = await supabase.auth.getSession();
  const token = authSession.data.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/player_sessions?player_id=eq.${playerId}&order=session_date.desc&limit=1`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

/**
 * Fetch session history for a player
 */
export async function getPlayerSessionHistory(
  playerId: string,
  limit: number = 10
): Promise<any[]> {
  const authSession = await supabase.auth.getSession();
  const token = authSession.data.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/player_sessions?player_id=eq.${playerId}&order=session_date.desc&limit=${limit}`,
    {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
      }
    }
  );

  if (!response.ok) {
    return [];
  }

  return response.json();
}
