// 4B Composite Score Calculator

/**
 * Get grade label for a 20-80 score
 */
export function getGrade(score: number): string {
  if (score >= 70) return "Plus-Plus";
  if (score >= 60) return "Plus";
  if (score >= 55) return "Above Avg";
  if (score >= 45) return "Average";
  if (score >= 40) return "Below Avg";
  if (score >= 30) return "Fringe";
  return "Poor";
}

/**
 * Get the weakest link from 4B scores
 */
export function getWeakestLink(
  brainScore: number | null,
  bodyScore: number | null,
  batScore: number | null,
  ballScore: number | null
): 'brain' | 'body' | 'bat' | 'ball' | null {
  const scores: { key: 'brain' | 'body' | 'bat' | 'ball'; value: number }[] = [];
  
  if (brainScore !== null) scores.push({ key: 'brain', value: brainScore });
  if (bodyScore !== null) scores.push({ key: 'body', value: bodyScore });
  if (batScore !== null) scores.push({ key: 'bat', value: batScore });
  if (ballScore !== null) scores.push({ key: 'ball', value: ballScore });
  
  if (scores.length === 0) return null;
  
  return scores.reduce((min, curr) => curr.value < min.value ? curr : min).key;
}

/**
 * Calculate combined 4B composite score
 * 
 * Weights when all 4 scores present:
 * - Brain: 15%
 * - Body: 40%
 * - Bat: 20%
 * - Ball: 25%
 */
export function calculateComposite4B(
  brainScore: number | null,
  bodyScore: number | null,
  batScore: number | null,
  ballScore: number | null
): { composite: number; grade: string; hasAllScores: boolean } {
  
  const scores = [brainScore, bodyScore, batScore, ballScore].filter(s => s !== null) as number[];
  
  if (scores.length === 0) {
    return { composite: 0, grade: 'No Data', hasAllScores: false };
  }
  
  // If we have all 4 scores, use weighted average
  if (brainScore !== null && bodyScore !== null && batScore !== null && ballScore !== null) {
    const composite = Math.round(
      brainScore * 0.15 +
      bodyScore * 0.40 +
      batScore * 0.20 +
      ballScore * 0.25
    );
    return { composite, grade: getGrade(composite), hasAllScores: true };
  }
  
  // Otherwise, average what we have
  const composite = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { composite, grade: getGrade(composite), hasAllScores: false };
}

/**
 * Get color class for a 20-80 score
 */
export function getScoreColorClass(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 70) return 'text-green-600';
  if (score >= 60) return 'text-green-500';
  if (score >= 55) return 'text-blue-500';
  if (score >= 45) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

/**
 * Get background color class for a 20-80 score
 */
export function getScoreBgClass(score: number | null): string {
  if (score === null) return 'bg-muted';
  if (score >= 70) return 'bg-green-600';
  if (score >= 60) return 'bg-green-500';
  if (score >= 55) return 'bg-blue-500';
  if (score >= 45) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}
