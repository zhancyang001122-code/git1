export interface EvaluationMetrics {
  total: number;
  passedCount: number;
  score: number;
  passed: boolean;
}

export function calculateEvaluationMetrics(
  results: readonly { passed: boolean; score: number }[],
): EvaluationMetrics {
  const total = results.length;
  const passedCount = results.filter((result) => result.passed).length;
  const score =
    total === 0
      ? 0
      : Number(
          (
            results.reduce((sum, result) => sum + result.score, 0) / total
          ).toFixed(4),
        );
  return {
    total,
    passedCount,
    score,
    passed: total > 0 && passedCount === total,
  };
}
