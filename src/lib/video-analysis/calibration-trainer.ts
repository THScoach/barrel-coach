/**
 * Calibration Trainer
 * ============================================================================
 * Learns mapping from MediaPipe 2D estimates to Reboot 3D ground truth
 * 
 * Training Process:
 * 1. Collect paired sessions (same swing captured by both MediaPipe and Reboot)
 * 2. Extract features from MediaPipe
 * 3. Extract ground truth from Reboot
 * 4. Learn linear regression coefficients
 * 5. Export calibration for production use
 * 
 * This allows us to "teach" MediaPipe to predict Reboot-quality metrics
 */

import type { FourBBodyInputs, CalibrationCoefficients } from './mediapipe-body-tracker';

// ============================================================================
// TYPES
// ============================================================================

export interface TrainingPair {
  // Session identifiers
  sessionId: string;
  playerId: string;
  timestamp: Date;
  
  // MediaPipe estimates (2D video)
  mediapipe: FourBBodyInputs;
  
  // Reboot ground truth (3D capture)
  reboot: {
    pelvis_velocity: number;
    torso_velocity: number;
    x_factor: number;
    stretch_rate: number;
    tp_ratio: number;
    at_ratio: number;
    legs_ke: number;
    bat_ke: number;
    transfer_efficiency: number;
  };
}

export interface TrainingDataset {
  pairs: TrainingPair[];
  metadata: {
    createdAt: Date;
    pairCount: number;
    playerIds: string[];
  };
}

export interface RegressionResult {
  // Linear regression: y = ax + b
  scale: number;   // a
  offset: number;  // b
  
  // Quality metrics
  r2: number;      // R-squared (explained variance)
  mae: number;     // Mean absolute error
  mape: number;    // Mean absolute percentage error
  n: number;       // Sample count
}

export interface CalibrationModel {
  version: string;
  trainedAt: Date;
  sampleCount: number;
  
  // Per-metric regression results
  pelvisVelocity: RegressionResult;
  torsoVelocity: RegressionResult;
  xFactor: RegressionResult;
  stretchRate: RegressionResult;
  
  // Overall model quality
  overallR2: number;
  overallMAE: number;
  
  // Coefficients ready for production
  coefficients: CalibrationCoefficients;
}

// ============================================================================
// REGRESSION UTILITIES
// ============================================================================

/**
 * Simple linear regression: y = ax + b
 */
function linearRegression(
  x: number[],
  y: number[]
): { scale: number; offset: number; r2: number } {
  const n = x.length;
  if (n !== y.length || n < 3) {
    throw new Error('Need at least 3 paired samples');
  }
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);
  
  const meanX = sumX / n;
  const meanY = sumY / n;
  
  // Calculate slope (a) and intercept (b)
  const denominator = sumX2 - (sumX * sumX) / n;
  const scale = denominator !== 0 ? (sumXY - (sumX * sumY) / n) / denominator : 1;
  const offset = meanY - scale * meanX;
  
  // Calculate R-squared
  const ssRes = x.reduce((acc, xi, i) => {
    const predicted = scale * xi + offset;
    return acc + Math.pow(y[i] - predicted, 2);
  }, 0);
  
  const ssTot = y.reduce((acc, yi) => acc + Math.pow(yi - meanY, 2), 0);
  
  const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
  
  return { scale, offset, r2 };
}

/**
 * Calculate mean absolute error
 */
function calculateMAE(
  predicted: number[],
  actual: number[]
): number {
  const errors = predicted.map((p, i) => Math.abs(p - actual[i]));
  return errors.reduce((a, b) => a + b, 0) / errors.length;
}

/**
 * Calculate mean absolute percentage error
 */
function calculateMAPE(
  predicted: number[],
  actual: number[]
): number {
  const errors = predicted.map((p, i) => {
    if (actual[i] === 0) return 0;
    return Math.abs((actual[i] - p) / actual[i]) * 100;
  });
  return errors.reduce((a, b) => a + b, 0) / errors.length;
}

/**
 * Run regression on a single metric
 */
function trainMetric(
  mediapipeValues: number[],
  rebootValues: number[]
): RegressionResult {
  // Filter out invalid pairs
  const validPairs: { mp: number; rb: number }[] = [];
  for (let i = 0; i < mediapipeValues.length; i++) {
    if (mediapipeValues[i] > 0 && rebootValues[i] > 0) {
      validPairs.push({ mp: mediapipeValues[i], rb: rebootValues[i] });
    }
  }
  
  if (validPairs.length < 3) {
    return {
      scale: 1.0,
      offset: 0,
      r2: 0,
      mae: Infinity,
      mape: 100,
      n: validPairs.length,
    };
  }
  
  const mpValues = validPairs.map(p => p.mp);
  const rbValues = validPairs.map(p => p.rb);
  
  const regression = linearRegression(mpValues, rbValues);
  
  // Calculate predicted values
  const predicted = mpValues.map(x => regression.scale * x + regression.offset);
  
  return {
    scale: regression.scale,
    offset: regression.offset,
    r2: regression.r2,
    mae: calculateMAE(predicted, rbValues),
    mape: calculateMAPE(predicted, rbValues),
    n: validPairs.length,
  };
}

// ============================================================================
// MAIN TRAINING FUNCTION
// ============================================================================

/**
 * Train calibration model from paired MediaPipe + Reboot sessions
 */
export function trainCalibrationModel(
  dataset: TrainingDataset
): CalibrationModel {
  const { pairs } = dataset;
  
  if (pairs.length < 10) {
    console.warn(`[Calibration] Low sample count (${pairs.length}), results may be unreliable`);
  }
  
  // Extract metric arrays
  const mp = {
    pelvisVelocity: pairs.map(p => p.mediapipe.pelvis_velocity),
    torsoVelocity: pairs.map(p => p.mediapipe.torso_velocity),
    xFactor: pairs.map(p => p.mediapipe.x_factor),
    stretchRate: pairs.map(p => p.mediapipe.stretch_rate),
  };
  
  const rb = {
    pelvisVelocity: pairs.map(p => p.reboot.pelvis_velocity),
    torsoVelocity: pairs.map(p => p.reboot.torso_velocity),
    xFactor: pairs.map(p => p.reboot.x_factor),
    stretchRate: pairs.map(p => p.reboot.stretch_rate),
  };
  
  // Train each metric
  const pelvisVelocity = trainMetric(mp.pelvisVelocity, rb.pelvisVelocity);
  const torsoVelocity = trainMetric(mp.torsoVelocity, rb.torsoVelocity);
  const xFactor = trainMetric(mp.xFactor, rb.xFactor);
  const stretchRate = trainMetric(mp.stretchRate, rb.stretchRate);
  
  // Calculate overall metrics (weighted by sample count)
  const totalN = pelvisVelocity.n + torsoVelocity.n + xFactor.n + stretchRate.n;
  const overallR2 = (
    pelvisVelocity.r2 * pelvisVelocity.n +
    torsoVelocity.r2 * torsoVelocity.n +
    xFactor.r2 * xFactor.n +
    stretchRate.r2 * stretchRate.n
  ) / totalN;
  
  const overallMAE = (
    pelvisVelocity.mae * pelvisVelocity.n +
    torsoVelocity.mae * torsoVelocity.n +
    xFactor.mae * xFactor.n +
    stretchRate.mae * stretchRate.n
  ) / totalN;
  
  // Build coefficients for production
  const coefficients: CalibrationCoefficients = {
    pelvisVelocityScale: pelvisVelocity.scale,
    pelvisVelocityOffset: pelvisVelocity.offset,
    torsoVelocityScale: torsoVelocity.scale,
    torsoVelocityOffset: torsoVelocity.offset,
    xFactorScale: xFactor.scale,
    xFactorOffset: xFactor.offset,
    stretchRateScale: stretchRate.scale,
    stretchRateOffset: stretchRate.offset,
  };
  
  return {
    version: '1.0.0',
    trainedAt: new Date(),
    sampleCount: pairs.length,
    pelvisVelocity,
    torsoVelocity,
    xFactor,
    stretchRate,
    overallR2,
    overallMAE,
    coefficients,
  };
}

// ============================================================================
// DATA COLLECTION HELPERS
// ============================================================================

/**
 * Create a training pair from matched sessions
 * Call this when you have both MediaPipe and Reboot data for the same swing
 */
export function createTrainingPair(
  sessionId: string,
  playerId: string,
  mediapipeResult: FourBBodyInputs,
  rebootData: {
    pelvis_velocity: number;
    torso_velocity: number;
    x_factor: number;
    stretch_rate: number;
    tp_ratio: number;
    at_ratio: number;
    legs_ke: number;
    bat_ke: number;
    transfer_efficiency: number;
  }
): TrainingPair {
  return {
    sessionId,
    playerId,
    timestamp: new Date(),
    mediapipe: mediapipeResult,
    reboot: rebootData,
  };
}

/**
 * Validate a training dataset
 */
export function validateDataset(
  dataset: TrainingDataset
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (dataset.pairs.length < 10) {
    issues.push(`Low sample count (${dataset.pairs.length}), recommend at least 30 pairs`);
  }
  
  // Check for outliers
  const pelvisVelocities = dataset.pairs.map(p => p.mediapipe.pelvis_velocity);
  const mean = pelvisVelocities.reduce((a, b) => a + b, 0) / pelvisVelocities.length;
  const std = Math.sqrt(
    pelvisVelocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / pelvisVelocities.length
  );
  
  const outliers = dataset.pairs.filter(p => 
    Math.abs(p.mediapipe.pelvis_velocity - mean) > 3 * std
  );
  
  if (outliers.length > 0) {
    issues.push(`Found ${outliers.length} potential outliers (>3 std from mean)`);
  }
  
  // Check for player diversity
  const uniquePlayers = new Set(dataset.pairs.map(p => p.playerId));
  if (uniquePlayers.size < 3) {
    issues.push(`Low player diversity (${uniquePlayers.size}), may overfit to specific movement patterns`);
  }
  
  return {
    isValid: issues.length === 0 || dataset.pairs.length >= 30,
    issues,
  };
}

// ============================================================================
// EXPORT/IMPORT
// ============================================================================

/**
 * Serialize calibration model for storage
 */
export function serializeModel(model: CalibrationModel): string {
  return JSON.stringify(model, null, 2);
}

/**
 * Deserialize calibration model
 */
export function deserializeModel(json: string): CalibrationModel {
  const parsed = JSON.parse(json);
  parsed.trainedAt = new Date(parsed.trainedAt);
  return parsed;
}

/**
 * Export just the coefficients for lightweight production use
 */
export function exportCoefficients(model: CalibrationModel): CalibrationCoefficients {
  return model.coefficients;
}

// ============================================================================
// EVALUATION
// ============================================================================

/**
 * Evaluate calibration model on held-out test data
 */
export function evaluateModel(
  model: CalibrationModel,
  testPairs: TrainingPair[]
): {
  pelvisR2: number;
  torsoR2: number;
  xFactorR2: number;
  stretchRateR2: number;
  overallR2: number;
  sampleCount: number;
} {
  const { coefficients } = model;
  
  // Apply calibration and compare to ground truth
  const predictions = testPairs.map(pair => ({
    pelvis: pair.mediapipe.pelvis_velocity * coefficients.pelvisVelocityScale + coefficients.pelvisVelocityOffset,
    torso: pair.mediapipe.torso_velocity * coefficients.torsoVelocityScale + coefficients.torsoVelocityOffset,
    xFactor: pair.mediapipe.x_factor * coefficients.xFactorScale + coefficients.xFactorOffset,
    stretchRate: pair.mediapipe.stretch_rate * coefficients.stretchRateScale + coefficients.stretchRateOffset,
  }));
  
  const actuals = testPairs.map(pair => ({
    pelvis: pair.reboot.pelvis_velocity,
    torso: pair.reboot.torso_velocity,
    xFactor: pair.reboot.x_factor,
    stretchRate: pair.reboot.stretch_rate,
  }));
  
  // Calculate R2 for each metric
  const calcR2 = (pred: number[], actual: number[]): number => {
    const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
    const ssTot = actual.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0);
    const ssRes = pred.reduce((sum, p, i) => sum + Math.pow(actual[i] - p, 2), 0);
    return ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  };
  
  const pelvisR2 = calcR2(predictions.map(p => p.pelvis), actuals.map(a => a.pelvis));
  const torsoR2 = calcR2(predictions.map(p => p.torso), actuals.map(a => a.torso));
  const xFactorR2 = calcR2(predictions.map(p => p.xFactor), actuals.map(a => a.xFactor));
  const stretchRateR2 = calcR2(predictions.map(p => p.stretchRate), actuals.map(a => a.stretchRate));
  
  const overallR2 = (pelvisR2 + torsoR2 + xFactorR2 + stretchRateR2) / 4;
  
  return {
    pelvisR2,
    torsoR2,
    xFactorR2,
    stretchRateR2,
    overallR2,
    sampleCount: testPairs.length,
  };
}
