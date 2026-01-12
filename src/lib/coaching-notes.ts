/**
 * Rule-based coaching note generator for 4B categories
 * Provides plain-language explanations based on KRS thresholds
 */

import type { FourBCategory } from "@/components/player/dashboard/FourBNavStrip";

interface SessionMetrics {
  // Brain metrics
  consistencyCV?: number | null;
  timingScore?: number | null;
  
  // Body metrics
  legsKEPeak?: number | null;
  torsoKEPeak?: number | null;
  transferPct?: number | null;
  groundFlowScore?: number | null;
  coreFlowScore?: number | null;
  
  // Bat metrics
  armsKEPeak?: number | null;
  batKE?: number | null;
  upperFlowScore?: number | null;
  transferEfficiency?: number | null;
  kineticPotentialEV?: number | null;
  
  // Ball metrics (HitTrax)
  avgExitVelo?: number | null;
  maxExitVelo?: number | null;
  hardHitPct?: number | null;
  barrelPct?: number | null;
  sweetSpotPct?: number | null;
  
  // General
  primaryLeak?: string | null;
  score?: number | null;
  previousScore?: number | null;
}

interface CoachingNote {
  summary: string;
  focus: string;
}

// Thresholds for different levels
const THRESHOLDS = {
  brain: {
    good_cv: 8,       // Below 8% CV is consistent
    avg_cv: 12,       // 8-12% is average
    poor_cv: 15,      // Above 15% needs work
  },
  body: {
    good_transfer: 75,
    avg_transfer: 60,
    poor_transfer: 45,
    good_legs_ke: 150,
    good_torso_ke: 200,
  },
  bat: {
    good_efficiency: 80,
    avg_efficiency: 65,
    poor_efficiency: 50,
    good_arms_ke: 100,
  },
  ball: {
    hs_good_ev: 85,
    hs_avg_ev: 78,
    college_good_ev: 95,
    college_avg_ev: 88,
    good_barrel: 8,
    good_hard_hit: 35,
  },
};

/**
 * Generate Brain coaching note
 */
function generateBrainNote(metrics: SessionMetrics): CoachingNote {
  const score = metrics.score ?? 0;
  const cv = metrics.consistencyCV;
  const delta = metrics.previousScore ? score - metrics.previousScore : null;
  
  // Build summary based on CV and score
  let summary = "";
  let focus = "";
  
  if (cv !== null && cv !== undefined) {
    if (cv < THRESHOLDS.brain.good_cv) {
      summary = `Your timing is locked in with ${cv.toFixed(1)}% variation. This consistency creates a reliable swing foundation.`;
      focus = "Maintain your routine and keep building reps with this same tempo.";
    } else if (cv < THRESHOLDS.brain.avg_cv) {
      summary = `Your timing shows moderate consistency (${cv.toFixed(1)}% CV). There's room to tighten up your swing-to-swing repeatability.`;
      focus = "Focus on rhythm drills and pre-swing routine to reduce timing variation.";
    } else {
      summary = `Your timing varies significantly (${cv.toFixed(1)}% CV), which can make it harder to barrel the ball consistently.`;
      focus = "Slow everything down. Work on tempo drills and building a consistent load timing.";
    }
  } else if (score >= 60) {
    summary = "Your timing and mental approach are working well this session.";
    focus = "Stay mentally locked in and trust your preparation.";
  } else if (score >= 45) {
    summary = "Your timing shows average consistency. Focus on developing a repeatable pre-swing routine.";
    focus = "Work on visualization and consistent load timing.";
  } else {
    summary = "Timing and consistency need attention. Inconsistent timing leads to mis-hits.";
    focus = "Simplify your approach. Focus on one consistent timing cue.";
  }
  
  if (delta !== null && delta > 5) {
    summary = `Great improvement! ${summary}`;
  }
  
  return { summary, focus };
}

/**
 * Generate Body coaching note
 */
function generateBodyNote(metrics: SessionMetrics): CoachingNote {
  const score = metrics.score ?? 0;
  const transferPct = metrics.transferPct;
  const leak = metrics.primaryLeak;
  const delta = metrics.previousScore ? score - metrics.previousScore : null;
  
  let summary = "";
  let focus = "";
  
  // Check for specific leaks
  if (leak) {
    const leakMap: Record<string, { summary: string; focus: string }> = {
      'early_extension': {
        summary: "Your body is extending too early, causing energy to leak before contact.",
        focus: "Work on staying connected through rotation. Feel the back hip drive forward, not up."
      },
      'torso_bypass': {
        summary: "Energy is jumping from your legs directly to your arms, bypassing your torso rotation.",
        focus: "Focus on the hip-to-torso connection. Let your hips lead, then feel the torso follow."
      },
      'lateral_sway': {
        summary: "Too much lateral movement is causing energy loss in your lower half.",
        focus: "Work on rotational drills. Think 'rotate around a pole' not 'shift to the ball.'"
      },
      'early_arms': {
        summary: "Your arms are firing before your body is fully loaded.",
        focus: "Feel the stretch in your torso before the arms release. Patience with the hands."
      },
    };
    
    const leakInfo = leakMap[leak];
    if (leakInfo) {
      return leakInfo;
    }
  }
  
  // Fallback to transfer percentage analysis
  if (transferPct !== null && transferPct !== undefined) {
    if (transferPct >= THRESHOLDS.body.good_transfer) {
      summary = `Excellent energy transfer (${transferPct.toFixed(0)}%). Your ground-to-torso sequencing is efficient.`;
      focus = "Keep building this movement pattern with game-speed reps.";
    } else if (transferPct >= THRESHOLDS.body.avg_transfer) {
      summary = `Good energy transfer (${transferPct.toFixed(0)}%), but there's room to improve your sequencing.`;
      focus = "Focus on feeling the legs drive into the torso rotation, not bypassing it.";
    } else {
      summary = `Energy transfer is low (${transferPct.toFixed(0)}%). Power is leaking before it reaches the barrel.`;
      focus = "Work on ground-up sequencing. Legs → hips → torso → arms, in that order.";
    }
  } else if (score >= 60) {
    summary = "Your movement and sequencing are efficient this session.";
    focus = "Continue reinforcing this pattern with intent.";
  } else if (score >= 45) {
    summary = "Movement is average. Some energy may be leaking in the kinetic chain.";
    focus = "Focus on ground-up sequencing drills.";
  } else {
    summary = "Sequencing needs work. Energy isn't flowing efficiently through your body.";
    focus = "Start with ground drills focusing on legs → hips connection.";
  }
  
  if (delta !== null && delta > 5) {
    summary = `Nice progress! ${summary}`;
  }
  
  return { summary, focus };
}

/**
 * Generate Bat coaching note
 */
function generateBatNote(metrics: SessionMetrics): CoachingNote {
  const score = metrics.score ?? 0;
  const efficiency = metrics.transferEfficiency;
  const batKE = metrics.batKE;
  const kineticEV = metrics.kineticPotentialEV;
  const delta = metrics.previousScore ? score - metrics.previousScore : null;
  
  let summary = "";
  let focus = "";
  
  if (batKE === null || batKE === undefined || batKE === 0) {
    // No bat sensor data
    if (efficiency !== null && efficiency !== undefined) {
      if (efficiency >= THRESHOLDS.bat.good_efficiency) {
        summary = `Your arms are efficiently delivering energy (${efficiency.toFixed(0)}% transfer). This translates to bat speed potential.`;
        focus = "Keep the barrel on plane through the zone for max contact time.";
      } else if (efficiency >= THRESHOLDS.bat.avg_efficiency) {
        summary = `Energy transfer to your arms is moderate (${efficiency.toFixed(0)}%). More power could reach the barrel.`;
        focus = "Work on staying connected—let the body pull the hands, not the other way around.";
      } else {
        summary = `Significant energy is lost before reaching your arms (${efficiency.toFixed(0)}% transfer).`;
        focus = "Focus on the torso-to-arms connection. Keep hands quiet until the body fires.";
      }
    } else if (score >= 55) {
      summary = "Your energy transfer to the bat looks efficient based on your swing pattern.";
      focus = "Continue working on staying connected through contact.";
    } else {
      summary = "Energy may be leaking before reaching the barrel.";
      focus = "Focus on letting the body deliver the hands, not leading with the arms.";
    }
  } else {
    summary = `Bat kinetic energy measured at ${batKE.toFixed(0)}J, translating to potential exit velocity.`;
    if (kineticEV) {
      summary += ` Your kinetic potential exit velo is ${kineticEV.toFixed(0)} mph.`;
    }
    focus = "Work on maintaining barrel efficiency through contact.";
  }
  
  if (delta !== null && delta > 5) {
    summary = `Solid improvement! ${summary}`;
  }
  
  return { summary, focus };
}

/**
 * Generate Ball coaching note
 */
function generateBallNote(metrics: SessionMetrics): CoachingNote {
  const score = metrics.score ?? 0;
  const avgEV = metrics.avgExitVelo;
  const maxEV = metrics.maxExitVelo;
  const hardHit = metrics.hardHitPct;
  const barrel = metrics.barrelPct;
  const kineticEV = metrics.kineticPotentialEV;
  const delta = metrics.previousScore ? score - metrics.previousScore : null;
  
  let summary = "";
  let focus = "";
  
  const hasHitTrax = avgEV !== null && avgEV !== undefined && avgEV > 0;
  const hasKinetic = kineticEV !== null && kineticEV !== undefined && kineticEV > 0;
  
  if (hasHitTrax && hasKinetic) {
    // We have both - show the gap analysis
    const gap = kineticEV! - avgEV!;
    
    if (gap <= 3) {
      summary = `Excellent! You're realizing ${avgEV!.toFixed(0)} mph avg exit velo against a ${kineticEV!.toFixed(0)} mph potential. That's elite efficiency.`;
      focus = "Maintain this barrel quality. Focus on pitch selection to maximize hard contact.";
    } else if (gap <= 8) {
      summary = `You're averaging ${avgEV!.toFixed(0)} mph with a kinetic potential of ${kineticEV!.toFixed(0)} mph. There's ${gap.toFixed(0)} mph upside to unlock.`;
      focus = "Work on centering the ball on the barrel. Small adjustments yield big gains.";
    } else {
      summary = `Your kinetic potential is ${kineticEV!.toFixed(0)} mph, but actual exit velo is ${avgEV!.toFixed(0)} mph. You're leaving ${gap.toFixed(0)} mph on the table.`;
      focus = "Focus on contact quality. Center more balls on the sweet spot to close this gap.";
    }
  } else if (hasHitTrax) {
    // Only HitTrax data
    if (avgEV! >= THRESHOLDS.ball.hs_good_ev) {
      summary = `Strong contact quality with ${avgEV!.toFixed(0)} mph average exit velocity.`;
      if (barrel && barrel >= THRESHOLDS.ball.good_barrel) {
        summary += ` ${barrel.toFixed(1)}% barrel rate is excellent.`;
      }
      focus = "Keep hunting pitches in your zone to maximize hard contact.";
    } else if (avgEV! >= THRESHOLDS.ball.hs_avg_ev) {
      summary = `Average exit velocity of ${avgEV!.toFixed(0)} mph. Room to improve contact quality.`;
      focus = "Work on centering the ball. Think about hitting the inside of the ball.";
    } else {
      summary = `Exit velocity averaging ${avgEV!.toFixed(0)} mph. Let's work on putting more energy into the ball.`;
      focus = "Focus on sequencing and barrel path. Better body mechanics will boost exit velo.";
    }
  } else if (hasKinetic) {
    // Only kinetic data
    summary = `Your kinetic potential exit velocity is ${kineticEV!.toFixed(0)} mph based on your swing mechanics.`;
    focus = "Add HitTrax data to see how much of this potential you're realizing on contact.";
  } else {
    // No Ball data
    if (score >= 55) {
      summary = "Ball metrics indicate solid contact quality this session.";
      focus = "Add launch monitor data to get detailed exit velocity and barrel analysis.";
    } else {
      summary = "No batted ball data available for this session.";
      focus = "Upload HitTrax or launch monitor data to see your actual exit velocity.";
    }
  }
  
  if (delta !== null && delta > 5) {
    summary = `Great improvement! ${summary}`;
  }
  
  return { summary, focus };
}

/**
 * Main function to generate coaching note for any B category
 */
export function generateCoachingNote(
  category: FourBCategory,
  metrics: SessionMetrics
): CoachingNote {
  switch (category) {
    case 'brain':
      return generateBrainNote(metrics);
    case 'body':
      return generateBodyNote(metrics);
    case 'bat':
      return generateBatNote(metrics);
    case 'ball':
      return generateBallNote(metrics);
  }
}

/**
 * Get display value for a metric - returns "Not measured" if missing
 */
export function getMetricDisplay(
  value: number | null | undefined,
  unit: string = '',
  decimals: number = 0
): { value: string; isMeasured: boolean } {
  if (value === null || value === undefined) {
    return { value: 'Not measured', isMeasured: false };
  }
  return { 
    value: `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`, 
    isMeasured: true 
  };
}
