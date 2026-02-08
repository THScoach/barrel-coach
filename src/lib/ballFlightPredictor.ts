/**
 * Ball Flight Predictor
 *
 * Predicts exit velocity and launch angle from biomechanics data.
 * No Trackman / HitTrax needed – pure kinetic-chain physics.
 */

export interface BiomechanicsInput {
  bat_ke: number | null;              // Joules
  pelvis_velocity: number | null;     // deg/s
  torso_velocity: number | null;      // deg/s
  transfer_efficiency: number | null; // percentage
  x_factor: number | null;            // degrees
  brain_score: number | null;         // 20-80 scale
  body_score: number | null;          // 20-80 scale
  motor_profile: string | null;       // "Spinner", "Slingshotter", etc.
}

export interface BallFlightPrediction {
  exit_velocity: number | null;     // mph
  launch_angle: number | null;      // degrees
  kinetic_potential: number | null;  // 20-80 scale
  confidence: "high" | "medium" | "low";
}

const BALL_MASS_KG = 0.145; // 5.125 oz regulation baseball
const MS_TO_MPH = 2.237;

/**
 * Predict exit velocity from bat kinetic energy
 */
function predictExitVelocity(input: BiomechanicsInput): number | null {
  if (input.bat_ke == null || input.bat_ke <= 0) return null;

  // Base collision efficiency: 0.20 (20%)
  let collisionEfficiency = 0.20;

  // Higher transfer efficiency → better collision efficiency
  // Range: 0.18 (poor) to 0.25 (elite)
  if (input.transfer_efficiency != null) {
    const efficiencyBonus = ((input.transfer_efficiency - 70) / 100) * 0.05;
    collisionEfficiency = Math.max(0.18, Math.min(0.25, 0.20 + efficiencyBonus));
  }

  // Good sequencing → more consistent contact
  if (input.brain_score != null && input.brain_score > 60) {
    collisionEfficiency += 0.01;
  }

  // Physics: v = sqrt(2 × KE × efficiency / mass)
  const velocityMS = Math.sqrt(
    (2 * input.bat_ke * collisionEfficiency) / BALL_MASS_KG
  );

  return Math.round(velocityMS * MS_TO_MPH * 10) / 10;
}

/**
 * Predict launch angle from swing characteristics
 */
function predictLaunchAngle(input: BiomechanicsInput): number | null {
  let baseAngle = 18; // Default optimal launch angle

  // Adjust by motor profile
  const profile = input.motor_profile?.toLowerCase();
  if (profile?.includes("spinner")) {
    baseAngle = 17;
  } else if (profile?.includes("slingshotter")) {
    baseAngle = 21;
  } else if (profile?.includes("whipper")) {
    baseAngle = 15;
  } else if (profile?.includes("titan")) {
    baseAngle = 24;
  }

  // Higher torso rotation → slight upward tendency
  if (input.torso_velocity != null) {
    const torsoFactor = (input.torso_velocity - 1000) / 200;
    baseAngle += Math.max(-3, Math.min(3, torsoFactor));
  }

  // X-factor separation enables lift
  if (input.x_factor != null) {
    const xFactorBonus = (input.x_factor - 50) / 20;
    baseAngle += Math.max(-2, Math.min(2, xFactorBonus));
  }

  return Math.round(baseAngle);
}

/**
 * Calculate kinetic potential score (20-80 scale)
 *
 * Reference values (bat KE in joules):
 *   Elite MLB  200+   →  80
 *   Plus MLB   180    →  70
 *   Avg MLB    160    →  60
 *   Fringe MLB 140    →  50
 *   Top college 120   →  45
 *   College    100    →  40
 *   HS          80    →  35
 *   Youth       <80   →  30
 */
function calculateKineticPotential(input: BiomechanicsInput): number | null {
  if (input.bat_ke == null) return null;

  const batKE = input.bat_ke;
  let score: number;

  if (batKE >= 200) score = 80;
  else if (batKE >= 180) score = 70;
  else if (batKE >= 160) score = 60;
  else if (batKE >= 140) score = 50;
  else if (batKE >= 120) score = 45;
  else if (batKE >= 100) score = 40;
  else if (batKE >= 80) score = 35;
  else score = 30;

  // Adjust for efficiency
  if (input.transfer_efficiency != null) {
    const efficiencyBonus = (input.transfer_efficiency - 70) / 10;
    score += Math.max(-5, Math.min(5, efficiencyBonus));
  }

  return Math.round(Math.max(20, Math.min(80, score)));
}

/**
 * Calculate prediction confidence based on available data points
 */
function calculateConfidence(input: BiomechanicsInput): "high" | "medium" | "low" {
  let dataPoints = 0;
  if (input.bat_ke != null) dataPoints++;
  if (input.transfer_efficiency != null) dataPoints++;
  if (input.brain_score != null) dataPoints++;
  if (input.body_score != null) dataPoints++;
  if (input.motor_profile != null) dataPoints++;
  if (input.torso_velocity != null) dataPoints++;
  if (input.x_factor != null) dataPoints++;

  if (dataPoints >= 5) return "high";
  if (dataPoints >= 3) return "medium";
  return "low";
}

/**
 * Main prediction function
 */
export function predictBallFlight(input: BiomechanicsInput): BallFlightPrediction {
  return {
    exit_velocity: predictExitVelocity(input),
    launch_angle: predictLaunchAngle(input),
    kinetic_potential: calculateKineticPotential(input),
    confidence: calculateConfidence(input),
  };
}

/**
 * Human-readable confidence label
 */
export function confidenceLabel(c: BallFlightPrediction["confidence"]): string {
  switch (c) {
    case "high":
      return "High ✓";
    case "medium":
      return "Medium ~";
    case "low":
      return "Low ?";
  }
}
