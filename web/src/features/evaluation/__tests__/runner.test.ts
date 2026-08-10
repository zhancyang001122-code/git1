import { describe, expect, it } from "vitest";

import { runEvaluationSuite } from "@/features/evaluation/runner";

describe("runEvaluationSuite", () => {
  it("calculates deterministic pass metrics across evaluation categories", async () => {
    const result = await runEvaluationSuite(
      [
        { id: "case-1", category: "citation", input: "退款", expected: {} },
        { id: "case-2", category: "refusal", input: "未知", expected: {} },
      ],
      async (evaluationCase) => ({
        passed: evaluationCase.id === "case-1",
        score: evaluationCase.id === "case-1" ? 1 : 0,
        notes: evaluationCase.id,
      }),
    );

    expect(result).toMatchObject({
      total: 2,
      passedCount: 1,
      score: 0.5,
      passed: false,
    });
    expect(result.results).toHaveLength(2);
  });
});
