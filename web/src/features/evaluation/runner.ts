import { calculateEvaluationMetrics } from "@/features/evaluation/metrics";

export interface EvaluationCase {
  id: string;
  category: string;
  input: string;
  expected: Readonly<Record<string, unknown>>;
}

export interface EvaluationCaseResult {
  caseId: string;
  category: string;
  passed: boolean;
  score: number;
  notes: string;
}

export async function runEvaluationSuite(
  cases: readonly EvaluationCase[],
  execute: (
    evaluationCase: EvaluationCase,
  ) => Promise<Omit<EvaluationCaseResult, "caseId" | "category">>,
) {
  const results: EvaluationCaseResult[] = [];
  for (const evaluationCase of cases) {
    const result = await execute(evaluationCase);
    results.push({
      caseId: evaluationCase.id,
      category: evaluationCase.category,
      ...result,
    });
  }
  return { ...calculateEvaluationMetrics(results), results };
}
