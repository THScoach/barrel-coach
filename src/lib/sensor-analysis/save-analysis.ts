// ============================================================================
// SAVE ANALYSIS MODULE
// Persist Kwon analysis results to Supabase
// ============================================================================

import type { 
  KwonAnalysis, 
  SensorFacts, 
  ReleasePrediction, 
  TimingPrediction, 
  UpstreamPrediction, 
  KineticPotential, 
  PossibleLeak, 
  FourBScores,
  KineticFingerprint,
} from './types';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Save Kwon analysis to the database
 */
export async function saveKwonAnalysis(analysis: KwonAnalysis): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('kwon_analyses')
      .insert({
        session_id: analysis.sessionId,
        player_id: analysis.playerId,
        analysis_date: analysis.analysisDate,
        swings_analyzed: analysis.swingsAnalyzed,
        data_quality: analysis.dataQuality,
        motor_profile: analysis.motorProfile,
        sensor_facts: analysis.sensorFacts as unknown as Json,
        release_prediction: analysis.releasePrediction as unknown as Json,
        timing_prediction: analysis.timingPrediction as unknown as Json,
        upstream_prediction: analysis.upstreamPrediction as unknown as Json,
        kinetic_potential: analysis.kineticPotential as unknown as Json,
        possible_leaks: analysis.possibleLeaks as unknown as Json,
        four_b_scores: analysis.fourBScores as unknown as Json,
        priority_focus: analysis.priorityFocus,
        secondary_focus: analysis.secondaryFocus,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving Kwon analysis:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error('Exception saving Kwon analysis:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Load Kwon analysis from the database
 */
export async function loadKwonAnalysis(sessionId: string): Promise<KwonAnalysis | null> {
  try {
    const { data, error } = await supabase
      .from('kwon_analyses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    // Reconstruct the KwonAnalysis object with proper type assertions
    return {
      sessionId: data.session_id,
      playerId: data.player_id,
      analysisDate: data.analysis_date,
      swingsAnalyzed: data.swings_analyzed,
      dataQuality: data.data_quality as KwonAnalysis['dataQuality'],
      motorProfile: data.motor_profile as KwonAnalysis['motorProfile'],
      sensorFacts: data.sensor_facts as unknown as SensorFacts,
      releasePrediction: data.release_prediction as unknown as ReleasePrediction,
      timingPrediction: data.timing_prediction as unknown as TimingPrediction,
      upstreamPrediction: data.upstream_prediction as unknown as UpstreamPrediction,
      kineticPotential: data.kinetic_potential as unknown as KineticPotential,
      possibleLeaks: (data.possible_leaks as unknown as PossibleLeak[]) || [],
      fourBScores: data.four_b_scores as unknown as FourBScores,
      priorityFocus: data.priority_focus,
      secondaryFocus: data.secondary_focus,
      fingerprint: createEmptyFingerprint(), // Not stored, recalculate if needed
    };
  } catch (err) {
    console.error('Exception loading Kwon analysis:', err);
    return null;
  }
}

/**
 * Get latest analysis for a player
 */
export async function getLatestPlayerAnalysis(playerId: string): Promise<KwonAnalysis | null> {
  try {
    const { data, error } = await supabase
      .from('kwon_analyses')
      .select('*')
      .eq('player_id', playerId)
      .order('analysis_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      sessionId: data.session_id,
      playerId: data.player_id,
      analysisDate: data.analysis_date,
      swingsAnalyzed: data.swings_analyzed,
      dataQuality: data.data_quality as KwonAnalysis['dataQuality'],
      motorProfile: data.motor_profile as KwonAnalysis['motorProfile'],
      sensorFacts: data.sensor_facts as unknown as SensorFacts,
      releasePrediction: data.release_prediction as unknown as ReleasePrediction,
      timingPrediction: data.timing_prediction as unknown as TimingPrediction,
      upstreamPrediction: data.upstream_prediction as unknown as UpstreamPrediction,
      kineticPotential: data.kinetic_potential as unknown as KineticPotential,
      possibleLeaks: (data.possible_leaks as unknown as PossibleLeak[]) || [],
      fourBScores: data.four_b_scores as unknown as FourBScores,
      priorityFocus: data.priority_focus,
      secondaryFocus: data.secondary_focus,
      fingerprint: createEmptyFingerprint(),
    };
  } catch (err) {
    console.error('Exception getting latest analysis:', err);
    return null;
  }
}

/**
 * Get analysis history for a player
 */
export async function getPlayerAnalysisHistory(
  playerId: string,
  limit = 10
): Promise<Pick<KwonAnalysis, 'sessionId' | 'analysisDate' | 'swingsAnalyzed' | 'motorProfile' | 'fourBScores'>[]> {
  try {
    const { data, error } = await supabase
      .from('kwon_analyses')
      .select('session_id, analysis_date, swings_analyzed, motor_profile, four_b_scores')
      .eq('player_id', playerId)
      .order('analysis_date', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(row => ({
      sessionId: row.session_id,
      analysisDate: row.analysis_date,
      swingsAnalyzed: row.swings_analyzed,
      motorProfile: row.motor_profile as KwonAnalysis['motorProfile'],
      fourBScores: row.four_b_scores as unknown as FourBScores,
    }));
  } catch (err) {
    console.error('Exception getting analysis history:', err);
    return [];
  }
}

/**
 * Update player scores based on latest analysis
 */
export async function updatePlayerScoresFromAnalysis(
  playerId: string,
  analysis: KwonAnalysis
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('players')
      .update({
        latest_bat_score: analysis.fourBScores.bat.overall,
        latest_brain_score: analysis.fourBScores.brain.overall,
        latest_body_score: analysis.fourBScores.body.overall,
        latest_ball_score: analysis.fourBScores.ball.overall,
        latest_composite_score: analysis.fourBScores.compositeScore,
        motor_profile_sensor: analysis.motorProfile,
        current_bat_speed: analysis.sensorFacts.batSpeedMax,
        last_sensor_session_date: analysis.analysisDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', playerId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Create empty fingerprint placeholder
 */
function createEmptyFingerprint(): KineticFingerprint {
  return {
    intentMap: {
      horizontalMean: 0,
      horizontalStdDev: 0,
      verticalMean: 0,
      verticalStdDev: 0,
      depthIndex: 0,
      depthConsistency: 0,
    },
    timingSignature: {
      triggerToImpactMs: 0,
      timingVariance: 0,
      tempoCategory: 'moderate',
    },
    patternMetrics: {
      tightness: 0,
      pullBias: 0,
      zoneBias: 'middle',
      comfortZone: {
        horizontal: [0, 0],
        vertical: [0, 0],
      },
    },
  };
}
