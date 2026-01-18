// ============================================================================
// KWON ANALYSIS MODULE
// Re-exports and extensions for the main analysis flow
// ============================================================================

import type { 
  KwonAnalysis, 
  AnalysisOptions,
  SensorFacts,
  PossibleLeak,
  DrillRecommendation,
} from './types';
import type { CanonicalSwing } from '@/lib/integrations/diamond-kinetics/types';
import { performKwonAnalysis, classifyMotorProfile } from './kwon-engine';
import { getDrillsForLeaks } from './drills';
import { getAllPercentiles } from './benchmarks';

// Re-export the main analysis function
export { performKwonAnalysis };

/**
 * Extended analysis result with additional computed fields
 */
export interface ExtendedKwonAnalysis extends KwonAnalysis {
  drillRecommendations: DrillRecommendation[];
  percentileScores: {
    batSpeedPercentile: number;
    handSpeedPercentile: number;
    ratioPercentile: number;
    timingPercentile: number;
    compositePercentile: number;
  };
  summaryText: string;
}

/**
 * Perform extended Kwon analysis with drills and percentiles
 */
export function performExtendedKwonAnalysis(
  sessionId: string,
  playerId: string,
  swings: CanonicalSwing[],
  options: AnalysisOptions = {}
): ExtendedKwonAnalysis {
  // Run base analysis
  const analysis = performKwonAnalysis(sessionId, playerId, swings, options);
  
  // Get drill recommendations
  const drillRecommendations = getDrillsForLeaks(analysis.possibleLeaks);
  
  // Calculate percentiles
  const level = options.level || 'high_school';
  const percentileScores = getAllPercentiles(
    analysis.sensorFacts.batSpeedMax,
    analysis.sensorFacts.handSpeedMax,
    analysis.sensorFacts.handToBatRatio,
    analysis.sensorFacts.timingCV,
    level
  );
  
  // Generate summary text
  const summaryText = generateSummaryText(analysis, drillRecommendations);
  
  return {
    ...analysis,
    drillRecommendations,
    percentileScores,
    summaryText,
  };
}

/**
 * Generate human-readable summary of analysis
 */
function generateSummaryText(analysis: KwonAnalysis, drills: DrillRecommendation[]): string {
  const parts: string[] = [];
  
  // Motor profile intro
  if (analysis.motorProfile !== 'Unknown') {
    parts.push(`Motor Profile: ${analysis.motorProfile}`);
  }
  
  // Key metrics
  parts.push(`Max Bat Speed: ${analysis.sensorFacts.batSpeedMax} mph`);
  parts.push(`Hand-to-Bat Ratio: ${analysis.sensorFacts.handToBatRatio}`);
  
  // Kinetic potential
  if (analysis.kineticPotential.totalUnlock > 0) {
    parts.push(`Kinetic Potential: +${analysis.kineticPotential.totalUnlock} mph available`);
  }
  
  // Top leak
  if (analysis.possibleLeaks.length > 0) {
    const topLeak = analysis.possibleLeaks[0];
    parts.push(`Priority Focus: ${topLeak.description} (+${topLeak.potentialGain} mph gain)`);
  }
  
  // Top drill
  if (drills.length > 0) {
    parts.push(`Recommended Drill: ${drills[0].name}`);
  }
  
  // Composite score
  parts.push(`4B Composite: ${analysis.fourBScores.compositeScore}`);
  
  return parts.join(' | ');
}

/**
 * Compare two analyses to track progress
 */
export function compareAnalyses(
  current: KwonAnalysis,
  previous: KwonAnalysis
): {
  batSpeedChange: number;
  compositeChange: number;
  leaksImproved: string[];
  leaksWorsened: string[];
  newLeaks: string[];
} {
  const batSpeedChange = current.sensorFacts.batSpeedMax - previous.sensorFacts.batSpeedMax;
  const compositeChange = current.fourBScores.compositeScore - previous.fourBScores.compositeScore;
  
  const previousLeakTypes = new Set(previous.possibleLeaks.map(l => l.leakType));
  const currentLeakTypes = new Set(current.possibleLeaks.map(l => l.leakType));
  
  const leaksImproved = previous.possibleLeaks
    .filter(l => !currentLeakTypes.has(l.leakType))
    .map(l => l.leakType);
    
  const newLeaks = current.possibleLeaks
    .filter(l => !previousLeakTypes.has(l.leakType))
    .map(l => l.leakType);
  
  // Find leaks that got worse (higher potential gain now)
  const leaksWorsened: string[] = [];
  current.possibleLeaks.forEach(currLeak => {
    const prevLeak = previous.possibleLeaks.find(p => p.leakType === currLeak.leakType);
    if (prevLeak && currLeak.potentialGain > prevLeak.potentialGain * 1.2) {
      leaksWorsened.push(currLeak.leakType);
    }
  });
  
  return {
    batSpeedChange,
    compositeChange,
    leaksImproved,
    leaksWorsened,
    newLeaks,
  };
}

/**
 * Get focus areas for training based on analysis
 */
export function getFocusAreas(analysis: KwonAnalysis): {
  primary: { category: string; description: string; priority: number };
  secondary: { category: string; description: string; priority: number } | null;
  tertiary: { category: string; description: string; priority: number } | null;
} {
  const sorted = [...analysis.possibleLeaks].sort((a, b) => b.potentialGain - a.potentialGain);
  
  const primary = sorted[0] 
    ? { category: sorted[0].category, description: sorted[0].description, priority: 1 }
    : { category: 'general', description: 'Maintain current mechanics', priority: 1 };
    
  const secondary = sorted[1]
    ? { category: sorted[1].category, description: sorted[1].description, priority: 2 }
    : null;
    
  const tertiary = sorted[2]
    ? { category: sorted[2].category, description: sorted[2].description, priority: 3 }
    : null;
  
  return { primary, secondary, tertiary };
}
