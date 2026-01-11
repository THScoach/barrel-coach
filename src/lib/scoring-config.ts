/**
 * Scoring Configuration System
 * 
 * DATA GOVERNANCE:
 * - NO proprietary MLB or team-internal datasets used for training
 * - Parameters are manually configurable based on coaching judgment
 * - All thresholds reflect public StatCast definitions or coach experience
 * - Configuration changes are versioned for A/B testing
 * 
 * This module supports:
 * - Human-informed parameter tuning
 * - Separation of data vs logic
 * - Configuration versioning
 */

// ================================
// CONFIGURATION VERSION
// ================================

export interface ScoringConfigVersion {
  id: string;
  version: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
  isDefault: boolean;
  config: ScoringConfig;
}

// ================================
// SCORING CONFIGURATION
// ================================

export interface ScoringConfig {
  // StatCast thresholds (public definitions)
  hardHit: {
    evThreshold: number;  // Default: 95 mph
  };
  
  sweetSpot: {
    laMin: number;        // Default: 8°
    laMax: number;        // Default: 32°
  };
  
  barrel: {
    evMin: number;        // Default: 98 mph
    evCap: number;        // Default: 116 mph
    baseLAMin: number;    // Default: 26°
    baseLAMax: number;    // Default: 30°
    cappedLAMin: number;  // Default: 8°
    cappedLAMax: number;  // Default: 50°
  };
  
  battedBallTypes: {
    gbMax: number;        // Default: 10°
    ldMin: number;        // Default: 10°
    ldMax: number;        // Default: 25°
    fbMax: number;        // Default: 50°
  };
  
  contactScore: {
    // EV normalization range
    evMin: number;        // Default: 60 mph
    evMax: number;        // Default: 115 mph
    evMaxPoints: number;  // Default: 70 points
    
    // LA bonuses/penalties
    optimalLAMin: number; // Default: 18°
    optimalLAMax: number; // Default: 22°
    optimalBonus: number; // Default: 15
    
    veryGoodLAMin: number;   // Default: 12°
    veryGoodLAMax: number;   // Default: 28°
    veryGoodBonus: number;   // Default: 10
    
    sweetSpotBonus: number;  // Default: 5 (when in sweet spot but not optimal)
    
    flatPenalty: number;     // Default: -5 (LA 0-8°)
    highPenalty: number;     // Default: -5 (LA 32-50°)
    popUpPenalty: number;    // Default: -15 (LA > 50°)
    negativeLAPenalty: number; // Default: -10
    
    // Quality bonuses
    hardHitBonus: number;    // Default: 10
    sweetSpotBonus2: number; // Default: 10
    barrelBonus: number;     // Default: 15
  };
  
  // Trend analysis
  trendAnalysis: {
    stableThreshold: number; // Default: 3 points
  };
  
  // 20-80 scale mapping (for 4B scores)
  gradeScale: {
    eliteMin: number;        // Default: 70
    plusMin: number;         // Default: 60
    aboveAvgMin: number;     // Default: 55
    averageMin: number;      // Default: 45
    belowAvgMin: number;     // Default: 40
    fringeMin: number;       // Default: 30
  };
}

// ================================
// DEFAULT CONFIGURATION
// ================================

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  hardHit: {
    evThreshold: 95,
  },
  
  sweetSpot: {
    laMin: 8,
    laMax: 32,
  },
  
  barrel: {
    evMin: 98,
    evCap: 116,
    baseLAMin: 26,
    baseLAMax: 30,
    cappedLAMin: 8,
    cappedLAMax: 50,
  },
  
  battedBallTypes: {
    gbMax: 10,
    ldMin: 10,
    ldMax: 25,
    fbMax: 50,
  },
  
  contactScore: {
    evMin: 60,
    evMax: 115,
    evMaxPoints: 70,
    
    optimalLAMin: 18,
    optimalLAMax: 22,
    optimalBonus: 15,
    
    veryGoodLAMin: 12,
    veryGoodLAMax: 28,
    veryGoodBonus: 10,
    
    sweetSpotBonus: 5,
    flatPenalty: -5,
    highPenalty: -5,
    popUpPenalty: -15,
    negativeLAPenalty: -10,
    
    hardHitBonus: 10,
    sweetSpotBonus2: 10,
    barrelBonus: 15,
  },
  
  trendAnalysis: {
    stableThreshold: 3,
  },
  
  gradeScale: {
    eliteMin: 70,
    plusMin: 60,
    aboveAvgMin: 55,
    averageMin: 45,
    belowAvgMin: 40,
    fringeMin: 30,
  },
};

// ================================
// CONFIGURATION MANAGER
// ================================

let activeConfig: ScoringConfig = { ...DEFAULT_SCORING_CONFIG };

/**
 * Get current active configuration
 */
export function getActiveConfig(): ScoringConfig {
  return activeConfig;
}

/**
 * Set active configuration (for A/B testing or updates)
 */
export function setActiveConfig(config: ScoringConfig): void {
  activeConfig = { ...config };
}

/**
 * Reset to default configuration
 */
export function resetToDefaultConfig(): void {
  activeConfig = { ...DEFAULT_SCORING_CONFIG };
}

/**
 * Create a new config version with changes
 */
export function createConfigVersion(
  name: string,
  description: string,
  changes: Partial<ScoringConfig>,
  createdBy: string = 'coach'
): ScoringConfigVersion {
  const version = `${Date.now()}`;
  const newConfig = mergeConfigs(DEFAULT_SCORING_CONFIG, changes);
  
  return {
    id: `config_${version}`,
    version,
    name,
    description,
    createdAt: new Date().toISOString(),
    createdBy,
    isActive: false,
    isDefault: false,
    config: newConfig,
  };
}

/**
 * Deep merge two configs
 */
function mergeConfigs(
  base: ScoringConfig,
  changes: Partial<ScoringConfig>
): ScoringConfig {
  return {
    hardHit: { ...base.hardHit, ...changes.hardHit },
    sweetSpot: { ...base.sweetSpot, ...changes.sweetSpot },
    barrel: { ...base.barrel, ...changes.barrel },
    battedBallTypes: { ...base.battedBallTypes, ...changes.battedBallTypes },
    contactScore: { ...base.contactScore, ...changes.contactScore },
    trendAnalysis: { ...base.trendAnalysis, ...changes.trendAnalysis },
    gradeScale: { ...base.gradeScale, ...changes.gradeScale },
  };
}

// ================================
// CONFIG-AWARE SCORING FUNCTIONS
// ================================

/**
 * Check if hard hit using active config
 */
export function isHardHitConfigured(exitVelocity: number): boolean {
  const config = getActiveConfig();
  return exitVelocity >= config.hardHit.evThreshold;
}

/**
 * Check if sweet spot using active config
 */
export function isSweetSpotConfigured(launchAngle: number): boolean {
  const config = getActiveConfig();
  return launchAngle >= config.sweetSpot.laMin && launchAngle <= config.sweetSpot.laMax;
}

/**
 * Check if barrel using active config
 */
export function isBarrelConfigured(exitVelocity: number, launchAngle: number): boolean {
  const config = getActiveConfig();
  const { evMin, evCap, baseLAMin, baseLAMax, cappedLAMin, cappedLAMax } = config.barrel;
  
  if (exitVelocity < evMin) return false;
  
  const evAboveMin = Math.min(exitVelocity - evMin, evCap - evMin);
  const expansionRange = evCap - evMin;
  
  const lowLA = Math.max(cappedLAMin, baseLAMin - evAboveMin);
  const highLA = Math.min(cappedLAMax, baseLAMax + evAboveMin * ((cappedLAMax - baseLAMax) / expansionRange));
  
  return launchAngle >= lowLA && launchAngle <= highLA;
}

/**
 * Get batted ball type using active config
 */
export function getBattedBallTypeConfigured(launchAngle: number): 'GB' | 'LD' | 'FB' | 'PU' | 'UNK' {
  const config = getActiveConfig();
  const { gbMax, ldMin, ldMax, fbMax } = config.battedBallTypes;
  
  if (launchAngle < gbMax) return 'GB';
  if (launchAngle >= ldMin && launchAngle < ldMax) return 'LD';
  if (launchAngle >= ldMax && launchAngle < fbMax) return 'FB';
  if (launchAngle >= fbMax) return 'PU';
  return 'UNK';
}

/**
 * Calculate contact score using active config
 */
export function calculateContactScoreConfigured(
  exitVelocity: number,
  launchAngle: number
): { finalScore: number; breakdown: Record<string, number> } {
  const config = getActiveConfig();
  const cs = config.contactScore;
  const ss = config.sweetSpot;
  
  if (exitVelocity <= 0) {
    return { finalScore: 0, breakdown: {} };
  }
  
  // Base score from EV normalization
  const evNormalized = Math.max(0, Math.min(1, (exitVelocity - cs.evMin) / (cs.evMax - cs.evMin)));
  const baseScore = evNormalized * cs.evMaxPoints;
  
  // LA bonus/penalty
  let laBonus = 0;
  if (launchAngle >= cs.optimalLAMin && launchAngle <= cs.optimalLAMax) {
    laBonus = cs.optimalBonus;
  } else if (launchAngle >= cs.veryGoodLAMin && launchAngle <= cs.veryGoodLAMax) {
    laBonus = cs.veryGoodBonus;
  } else if (launchAngle >= ss.laMin && launchAngle <= ss.laMax) {
    laBonus = cs.sweetSpotBonus;
  } else if (launchAngle >= 0 && launchAngle < ss.laMin) {
    laBonus = cs.flatPenalty;
  } else if (launchAngle > ss.laMax && launchAngle <= 50) {
    laBonus = cs.highPenalty;
  } else if (launchAngle > 50) {
    laBonus = cs.popUpPenalty;
  } else if (launchAngle < 0) {
    laBonus = cs.negativeLAPenalty;
  }
  
  // Quality bonuses
  const hardHit = isHardHitConfigured(exitVelocity);
  const sweetSpot = isSweetSpotConfigured(launchAngle);
  const barrel = isBarrelConfigured(exitVelocity, launchAngle);
  
  const hardHitBonus = hardHit ? cs.hardHitBonus : 0;
  const sweetSpotBonus = barrel ? 0 : (sweetSpot ? cs.sweetSpotBonus2 : 0);
  const barrelBonus = barrel ? cs.barrelBonus : 0;
  
  const rawScore = baseScore + laBonus + hardHitBonus + sweetSpotBonus + barrelBonus;
  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));
  
  return {
    finalScore,
    breakdown: {
      baseScore: Math.round(baseScore * 10) / 10,
      laBonus,
      hardHitBonus,
      sweetSpotBonus,
      barrelBonus,
      rawScore: Math.round(rawScore * 10) / 10,
    },
  };
}

// ================================
// GRADE CONVERSION
// ================================

/**
 * Get 20-80 grade label using active config
 */
export function getGradeLabel(score: number): string {
  const config = getActiveConfig();
  const gs = config.gradeScale;
  
  if (score >= gs.eliteMin) return "Plus-Plus";
  if (score >= gs.plusMin) return "Plus";
  if (score >= gs.aboveAvgMin) return "Above Avg";
  if (score >= gs.averageMin) return "Average";
  if (score >= gs.belowAvgMin) return "Below Avg";
  if (score >= gs.fringeMin) return "Fringe";
  return "Poor";
}

// ================================
// CONFIG DIFF UTILITY
// ================================

/**
 * Get human-readable differences between two configs
 */
export function getConfigDiff(
  configA: ScoringConfig,
  configB: ScoringConfig
): { path: string; oldValue: number; newValue: number }[] {
  const diffs: { path: string; oldValue: number; newValue: number }[] = [];
  
  function compare(objA: Record<string, unknown>, objB: Record<string, unknown>, path: string = '') {
    for (const key of Object.keys(objA)) {
      const newPath = path ? `${path}.${key}` : key;
      const valA = objA[key];
      const valB = objB[key];
      
      if (typeof valA === 'object' && valA !== null) {
        compare(valA as Record<string, unknown>, valB as Record<string, unknown>, newPath);
      } else if (typeof valA === 'number' && valA !== valB) {
        diffs.push({ path: newPath, oldValue: valA as number, newValue: valB as number });
      }
    }
  }
  
  compare(configA as unknown as Record<string, unknown>, configB as unknown as Record<string, unknown>);
  return diffs;
}
