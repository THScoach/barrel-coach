/**
 * Player Scorecard Data Service
 * ==============================
 * Fetches and aggregates all 4B data for ESPN-style scorecard display.
 */

import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface FourBScores {
  composite: number | null;
  brain: number | null;
  body: number | null;
  bat: number | null;
  ball: number | null;
  prevComposite: number | null;
  prevBrain: number | null;
  prevBody: number | null;
  prevBat: number | null;
  prevBall: number | null;
  weakestLink: string | null;
  grade: string | null;
}

export interface VideoSequenceData {
  latestSequenceScore: number | null;
  latestBarrelQuality: number | null;
  latestContactOptimization: number | null;
  sequenceMatch: boolean | null;
  recentSessions: Array<{
    id: string;
    sessionDate: string;
    context: string;
    sequenceScore: number | null;
    barrelQualityScore: number | null;
    contactOptimizationScore: number | null;
    status: string;
  }>;
}

export interface LaunchMonitorStats {
  avgEV: number | null;
  maxEV: number | null;
  avgLaunchAngle: number | null;
  barrelPct: number | null;
  hardHitPct: number | null;
  sweetSpotPct: number | null;
  groundBallPct: number | null;
  lineDrivePct: number | null;
  flyBallPct: number | null;
  popUpPct: number | null;
  totalSwings: number;
  sessionCount: number;
}

export interface GameStats {
  hasData: boolean;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  hr: number | null;
  kPct: number | null;
  bbPct: number | null;
  source: string | null;
}

export interface WeeklyCheckinStatus {
  completed: boolean;
  weekStart: string | null;
  weekEnd: string | null;
}

export interface PlayerScorecardData {
  playerId: string;
  playerName: string;
  team: string | null;
  handedness: string | null;
  level: string | null;
  isInSeason: boolean;
  periodLabel: string;
  
  fourBScores: FourBScores;
  videoSequence: VideoSequenceData;
  launchMonitor: LaunchMonitorStats;
  gameStats: GameStats;
  weeklyCheckin: WeeklyCheckinStatus;
}

export type TimeWindow = '30' | '60' | '90' | 'all';

export async function getPlayerScorecard(
  playerId: string,
  timeWindow: TimeWindow = '30'
): Promise<PlayerScorecardData | null> {
  // Calculate date range
  const now = new Date();
  const daysBack = timeWindow === 'all' ? 365 : parseInt(timeWindow);
  const cutoffDate = subDays(now, daysBack).toISOString().split('T')[0];
  
  // Fetch all data in parallel
  const [
    playerRes,
    fourbRes,
    playerSessionsRes,
    rebootUploadsRes,
    videoScoresRes,
    videoSessionsRes,
    launchRes,
    weeklyRes,
    gameStatsRes,
  ] = await Promise.all([
    // Player info
    supabase
      .from('players')
      .select('id, name, team, handedness, level, is_in_season, latest_composite_score, latest_brain_score, latest_body_score, latest_bat_score, latest_ball_score')
      .eq('id', playerId)
      .single(),
    
    // 4B historical scores from swing_4b_scores
    supabase
      .from('swing_4b_scores')
      .select('composite_score, brain_score, body_score, bat_score, ball_score, weakest_link, grade, created_at')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(10),
    
    // 4B scores from player_sessions (alternative source)
    supabase
      .from('player_sessions')
      .select('brain_score, body_score, bat_score, ball_score, overall_score, brain_grade, body_grade, bat_grade, ball_grade, overall_grade, leak_type, created_at')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(5),
    
    // 4B scores from reboot_uploads (another alternative)
    supabase
      .from('reboot_uploads')
      .select('brain_score, body_score, bat_score, composite_score, grade, weakest_link, created_at')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(5),
    
    // Video swing scores (latest)
    supabase
      .from('video_swing_scores')
      .select('*, video_swing_sessions!inner(id, session_date, context, status, player_id)')
      .eq('video_swing_sessions.player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(1),
    
    // Recent video sessions for the list
    supabase
      .from('video_swing_sessions')
      .select('id, session_date, context, status')
      .eq('player_id', playerId)
      .eq('status', 'analyzed')
      .gte('session_date', cutoffDate)
      .order('session_date', { ascending: false })
      .limit(5),
    
    // Launch monitor sessions
    supabase
      .from('launch_monitor_sessions')
      .select('*')
      .eq('player_id', playerId)
      .gte('session_date', cutoffDate)
      .order('session_date', { ascending: false }),
    
    // Weekly check-in status
    supabase
      .from('game_weekly_reports')
      .select('id, week_start, week_end, status, completed_at')
      .eq('player_id', playerId)
      .order('week_start', { ascending: false })
      .limit(1),
    
    // External profile for game stats (Statcast-like)
    supabase
      .from('player_external_profiles')
      .select('parsed_json, source')
      .eq('player_id', playerId)
      .limit(1),
  ]);

  if (playerRes.error || !playerRes.data) {
    console.error('Error fetching player:', playerRes.error);
    return null;
  }

  const player = playerRes.data;
  const fourbScores = fourbRes.data || [];
  const playerSessions = playerSessionsRes.data || [];
  const rebootUploads = rebootUploadsRes.data || [];
  const latestFourb = fourbScores[0];
  const prevFourb = fourbScores[1];
  const launchSessions = launchRes.data || [];
  const videoScores = videoScoresRes.data?.[0];
  const videoSessions = videoSessionsRes.data || [];
  const weeklyReport = weeklyRes.data?.[0];
  const externalProfile = gameStatsRes.data?.[0];

  // Get latest scores from any source (prioritize swing_4b_scores, then player_sessions, then reboot_uploads)
  const latestPlayerSession = playerSessions[0];
  const latestReboot = rebootUploads[0];

  // Determine best source for each score
  const getBestScore = (
    playerLatest: number | null,
    fourbLatest: number | null,
    sessionLatest: number | null,
    rebootLatest: number | null
  ): number | null => {
    return playerLatest ?? fourbLatest ?? sessionLatest ?? rebootLatest ?? null;
  };

  // Determine weakest link from available sources
  const getWeakestLink = (): string | null => {
    if (latestFourb?.weakest_link) return latestFourb.weakest_link;
    if (latestPlayerSession?.leak_type) return latestPlayerSession.leak_type;
    if (latestReboot?.weakest_link) return latestReboot.weakest_link;
    
    // Calculate from scores if no explicit weakest_link
    const scores = {
      brain: getBestScore(player.latest_brain_score, latestFourb?.brain_score, latestPlayerSession?.brain_score, latestReboot?.brain_score),
      body: getBestScore(player.latest_body_score, latestFourb?.body_score, latestPlayerSession?.body_score, latestReboot?.body_score),
      bat: getBestScore(player.latest_bat_score, latestFourb?.bat_score, latestPlayerSession?.bat_score, latestReboot?.bat_score),
      ball: getBestScore(player.latest_ball_score, latestFourb?.ball_score, latestPlayerSession?.ball_score, null),
    };
    
    const validScores = Object.entries(scores).filter(([, v]) => v != null) as [string, number][];
    if (validScores.length === 0) return null;
    
    const lowest = validScores.reduce((min, [key, val]) => val < min[1] ? [key, val] : min, validScores[0]);
    return lowest[0];
  };

  // Process 4B Scores with fallbacks
  const fourBScores: FourBScores = {
    composite: getBestScore(
      player.latest_composite_score,
      latestFourb?.composite_score,
      latestPlayerSession?.overall_score,
      latestReboot?.composite_score
    ),
    brain: getBestScore(
      player.latest_brain_score,
      latestFourb?.brain_score,
      latestPlayerSession?.brain_score,
      latestReboot?.brain_score
    ),
    body: getBestScore(
      player.latest_body_score,
      latestFourb?.body_score,
      latestPlayerSession?.body_score,
      latestReboot?.body_score
    ),
    bat: getBestScore(
      player.latest_bat_score,
      latestFourb?.bat_score,
      latestPlayerSession?.bat_score,
      latestReboot?.bat_score
    ),
    ball: getBestScore(
      player.latest_ball_score,
      latestFourb?.ball_score,
      latestPlayerSession?.ball_score,
      null // reboot_uploads doesn't have ball_score
    ),
    prevComposite: prevFourb?.composite_score ?? playerSessions[1]?.overall_score ?? rebootUploads[1]?.composite_score ?? null,
    prevBrain: prevFourb?.brain_score ?? playerSessions[1]?.brain_score ?? rebootUploads[1]?.brain_score ?? null,
    prevBody: prevFourb?.body_score ?? playerSessions[1]?.body_score ?? rebootUploads[1]?.body_score ?? null,
    prevBat: prevFourb?.bat_score ?? playerSessions[1]?.bat_score ?? rebootUploads[1]?.bat_score ?? null,
    prevBall: prevFourb?.ball_score ?? playerSessions[1]?.ball_score ?? null,
    weakestLink: getWeakestLink(),
    grade: latestFourb?.grade ?? latestPlayerSession?.overall_grade ?? latestReboot?.grade ?? null,
  };

  // Process Video Sequence Data
  const videoSequence: VideoSequenceData = {
    latestSequenceScore: videoScores?.sequence_score ?? null,
    latestBarrelQuality: videoScores?.barrel_quality_score ?? null,
    latestContactOptimization: videoScores?.contact_optimization_score ?? null,
    sequenceMatch: videoScores?.sequence_match ?? null,
    recentSessions: await Promise.all(
      videoSessions.map(async (session) => {
        // Get scores for each session
        const { data: scores } = await supabase
          .from('video_swing_scores')
          .select('sequence_score, barrel_quality_score, contact_optimization_score')
          .eq('swing_session_id', session.id)
          .maybeSingle();
        
        return {
          id: session.id,
          sessionDate: session.session_date,
          context: session.context || 'practice',
          sequenceScore: scores?.sequence_score ?? null,
          barrelQualityScore: scores?.barrel_quality_score ?? null,
          contactOptimizationScore: scores?.contact_optimization_score ?? null,
          status: session.status || 'pending',
        };
      })
    ),
  };

  // Process Launch Monitor Stats (aggregate across sessions)
  const launchMonitor: LaunchMonitorStats = calculateLaunchMonitorStats(launchSessions);

  // Process Game Stats from external profile
  const gameStats: GameStats = parseGameStats(externalProfile);

  // Process Weekly Check-in Status
  const currentWeekStart = getWeekStart(now);
  const weeklyCheckin: WeeklyCheckinStatus = {
    completed: weeklyReport?.status === 'completed' && 
               weeklyReport?.week_start === currentWeekStart,
    weekStart: weeklyReport?.week_start ?? null,
    weekEnd: weeklyReport?.week_end ?? null,
  };

  // Build period label
  const periodLabel = timeWindow === 'all' 
    ? 'All Time' 
    : `Last ${timeWindow} Days`;

  return {
    playerId,
    playerName: player.name || '',
    team: player.team,
    handedness: player.handedness,
    level: player.level,
    isInSeason: player.is_in_season ?? false,
    periodLabel,
    fourBScores,
    videoSequence,
    launchMonitor,
    gameStats,
    weeklyCheckin,
  };
}

function calculateLaunchMonitorStats(sessions: any[]): LaunchMonitorStats {
  if (sessions.length === 0) {
    return {
      avgEV: null,
      maxEV: null,
      avgLaunchAngle: null,
      barrelPct: null,
      hardHitPct: null,
      sweetSpotPct: null,
      groundBallPct: null,
      lineDrivePct: null,
      flyBallPct: null,
      popUpPct: null,
      totalSwings: 0,
      sessionCount: 0,
    };
  }

  // Aggregate metrics
  let totalSwings = 0;
  let evSum = 0, evCount = 0;
  let maxEV = 0;
  let laSum = 0, laCount = 0;
  let barrelSum = 0, barrelCount = 0;
  let hardHitSwings = 0, ballsInPlay = 0;
  let gbCount = 0, ldCount = 0, fbCount = 0, puCount = 0;

  sessions.forEach(s => {
    totalSwings += s.total_swings || 0;
    
    if (s.avg_exit_velo != null) {
      evSum += s.avg_exit_velo * (s.balls_in_play || 1);
      evCount += s.balls_in_play || 1;
    }
    if (s.max_exit_velo != null && s.max_exit_velo > maxEV) {
      maxEV = s.max_exit_velo;
    }
    if (s.avg_launch_angle != null) {
      laSum += s.avg_launch_angle * (s.balls_in_play || 1);
      laCount += s.balls_in_play || 1;
    }
    if (s.barrel_pct != null) {
      barrelSum += s.barrel_pct;
      barrelCount++;
    }
    if (s.velo_95_plus != null) {
      hardHitSwings += s.velo_95_plus;
    }
    ballsInPlay += s.balls_in_play || 0;
    gbCount += s.ground_ball_count || 0;
    fbCount += s.fly_ball_count || 0;
  });

  const totalBatted = gbCount + ldCount + fbCount + puCount || ballsInPlay;

  return {
    avgEV: evCount > 0 ? Math.round(evSum / evCount * 10) / 10 : null,
    maxEV: maxEV > 0 ? maxEV : null,
    avgLaunchAngle: laCount > 0 ? Math.round(laSum / laCount * 10) / 10 : null,
    barrelPct: barrelCount > 0 ? Math.round(barrelSum / barrelCount * 10) / 10 : null,
    hardHitPct: ballsInPlay > 0 ? Math.round((hardHitSwings / ballsInPlay) * 1000) / 10 : null,
    sweetSpotPct: null, // Would need to calculate from LA distribution
    groundBallPct: totalBatted > 0 ? Math.round((gbCount / totalBatted) * 1000) / 10 : null,
    lineDrivePct: totalBatted > 0 ? Math.round((ldCount / totalBatted) * 1000) / 10 : null,
    flyBallPct: totalBatted > 0 ? Math.round((fbCount / totalBatted) * 1000) / 10 : null,
    popUpPct: totalBatted > 0 ? Math.round((puCount / totalBatted) * 1000) / 10 : null,
    totalSwings,
    sessionCount: sessions.length,
  };
}

function parseGameStats(externalProfile: any): GameStats {
  if (!externalProfile?.parsed_json) {
    return {
      hasData: false,
      avg: null,
      obp: null,
      slg: null,
      hr: null,
      kPct: null,
      bbPct: null,
      source: null,
    };
  }

  const stats = externalProfile.parsed_json;
  
  return {
    hasData: true,
    avg: stats.avg ?? stats.batting_average ?? null,
    obp: stats.obp ?? stats.on_base_pct ?? null,
    slg: stats.slg ?? stats.slugging_pct ?? null,
    hr: stats.hr ?? stats.home_runs ?? null,
    kPct: stats.k_pct ?? stats.strikeout_pct ?? null,
    bbPct: stats.bb_pct ?? stats.walk_pct ?? null,
    source: externalProfile.source ?? null,
  };
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}
