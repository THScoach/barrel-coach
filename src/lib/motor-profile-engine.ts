/**
 * Motor Profile Classification Engine
 * =====================================
 * Human 3.0 Philosophy: Every athlete has a unique kinetic fingerprint.
 */

import { MOTOR_PROFILE_INFO, MotorProfile } from "@/components/ui/MotorProfileBadge";

export type MotorProfileType = MotorProfile;

export interface MotorProfileMetrics {
  pelvis_velocity: number | null;
  torso_velocity: number | null;
  transfer_efficiency: number | null;
  bat_ke: number | null;
  composite_score: number | null;
  timing_gap_pct?: number | null;
  ground_flow_score?: number | null;
}

export interface MotorProfileResult {
  profile: MotorProfileType;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  characteristics: string[];
  trainingFocus: string;
}

/**
 * Classifies a player's motor profile based on biomechanics data
 */
export function classifyMotorProfile(metrics: MotorProfileMetrics): MotorProfileResult {
  const { pelvis_velocity, torso_velocity, transfer_efficiency, bat_ke, composite_score, timing_gap_pct, ground_flow_score } = metrics;

  if (pelvis_velocity === null && torso_velocity === null && transfer_efficiency === null) {
    return { profile: 'UNKNOWN', confidence: 'low', reasoning: 'Insufficient data.', characteristics: [], trainingFocus: '' };
  }

  let scores = { SPINNER: 0, WHIPPER: 0, SLINGSHOTTER: 0, TITAN: 0 };

  // SPINNER: High pelvis-to-torso ratio
  if (pelvis_velocity !== null && torso_velocity !== null && torso_velocity > 0) {
    const ptRatio = pelvis_velocity / torso_velocity;
    if (ptRatio > 0.85) scores.SPINNER += 40;
    else if (ptRatio < 0.7) { scores.WHIPPER += 15; scores.SLINGSHOTTER += 15; }
  }

  // WHIPPER: High transfer efficiency
  if (transfer_efficiency !== null) {
    if (transfer_efficiency >= 55) scores.WHIPPER += 45;
    else if (transfer_efficiency < 45) scores.TITAN += 20;
  }

  // SLINGSHOTTER: Deep load / late peak
  if (timing_gap_pct !== null && timing_gap_pct >= 20) scores.SLINGSHOTTER += 40;
  if (ground_flow_score !== null && ground_flow_score >= 65) scores.SLINGSHOTTER += 20;

  // TITAN: Elite power, average efficiency
  if (composite_score !== null && composite_score >= 60 && transfer_efficiency !== null && transfer_efficiency < 50) {
    scores.TITAN += 50;
  }

  const entries = Object.entries(scores) as [keyof typeof scores, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [topProfile, topScore] = entries[0];

  if (topScore < 20) {
    return { profile: 'UNKNOWN', confidence: 'low', reasoning: 'No clear pattern.', characteristics: [], trainingFocus: '' };
  }

  const info = MOTOR_PROFILE_INFO[topProfile];
  return {
    profile: topProfile,
    confidence: topScore >= 50 ? 'high' : 'medium',
    reasoning: `Classified as ${topProfile} based on biomechanics analysis.`,
    characteristics: info?.characteristics || [],
    trainingFocus: info?.trainingFocus || ''
  };
}
