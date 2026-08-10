import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import { DemoToolCallingProvider } from "@/features/agent/demo-tool-provider";
import { runAgentToolLoop } from "@/features/agent/tool-loop";
import { ToolExecutor } from "@/features/agent/tools/executor";
import { createDemoRepository } from "@/features/business/demo-repository";

import { createToolTestContext } from "../../agent/tools/__tests__/helpers";

interface EvaluationCase {
  id: string;
  input: string;
  expected: {
    requiredTools?: string[];
    forbiddenTools?: string[];
    mustReturnKinds?: string[];
    emptyResult?: boolean;
    mustSuggestRelaxingOneFilter?: boolean;
    mustNotContain?: string[];
    mustReturnBusinessResults?: boolean;
    mustStateUnverifiedNearby?: boolean;
    mustNotInventDistance?: boolean;
  };
}

const allCases = (
  JSON.parse(
    readFileSync(
      path.resolve(process.cwd(), "../qa/evaluation-cases.json"),
      "utf8",
    ),
  ) as { cases: EvaluationCase[] }
).cases;

const selectedIds = [
  "routing-house-001",
  "business-stock-001",
  "business-no-result-001",
  "memory-consent-001",
  "memory-no-inference-001",
  "safety-secret-001",
  "safety-prompt-001",
  "degradation-amap-001",
] as const;

async function run(input: string) {
  const events: ChatStreamEvent[] = [];
  for await (const event of runAgentToolLoop({
    provider: new DemoToolCallingProvider(),
    messages: [{ role: "user", content: input }],
    signal: new AbortController().signal,
    executor: new ToolExecutor(),
    toolContext: createToolTestContext({ business: createDemoRepository() }),
    debug: true,
  })) {
    events.push(event);
  }
  return events;
}

describe("Task 6 routing evaluation subset", () => {
  for (const id of selectedIds) {
    const evaluation = allCases.find((candidate) => candidate.id === id);
    if (!evaluation) throw new Error(`Missing evaluation case: ${id}`);

    it(id, async () => {
      const events = await run(evaluation.input);
      const tools = events.flatMap((event) =>
        event.type === "debug_tool_run" ? [event.run.toolName] : [],
      );
      const kinds = events.flatMap((event) =>
        event.type === "result_cards"
          ? event.cards.map((card) => card.kind)
          : [],
      );
      const answer = events
        .filter((event) => event.type === "assistant_delta")
        .map((event) => (event.type === "assistant_delta" ? event.delta : ""))
        .join("");

      for (const required of evaluation.expected.requiredTools ?? [])
        expect(tools, `${id} missing ${required}`).toContain(required);
      for (const forbidden of evaluation.expected.forbiddenTools ?? [])
        expect(tools, `${id} unexpectedly called ${forbidden}`).not.toContain(
          forbidden,
        );
      for (const kind of evaluation.expected.mustReturnKinds ?? [])
        expect(kinds, `${id} missing ${kind} card`).toContain(kind);
      for (const forbiddenText of evaluation.expected.mustNotContain ?? [])
        expect(answer).not.toContain(forbiddenText);
      if (evaluation.expected.emptyResult) expect(kinds).toHaveLength(0);
      if (evaluation.expected.mustSuggestRelaxingOneFilter)
        expect(answer).toContain("放宽一个条件");
      if (evaluation.expected.mustReturnBusinessResults)
        expect(kinds).toContain("house");
      if (evaluation.expected.mustStateUnverifiedNearby)
        expect(answer).toContain("周边条件尚未通过高德核验");
      if (evaluation.expected.mustNotInventDistance)
        expect(answer).not.toMatch(/\d+(?:\.\d+)?\s*(?:米|公里|分钟)/);
      expect(events.at(-1)).toMatchObject({ type: "done" });
    });
  }
});
