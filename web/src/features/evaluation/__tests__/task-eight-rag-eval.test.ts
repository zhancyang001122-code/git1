import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import { DemoToolCallingProvider } from "@/features/agent/demo-tool-provider";
import { runAgentToolLoop } from "@/features/agent/tool-loop";
import { ToolExecutor } from "@/features/agent/tools/executor";

import { createToolTestContext } from "../../agent/tools/__tests__/helpers";

interface RagEvaluationCase {
  id: string;
  input: string;
  expected: {
    requiredTools?: string[];
    citationRequired?: boolean;
    requiredConcepts?: string[];
    mustDeclineUnsupportedTimeline?: boolean;
    mustDeclineCertainty?: boolean;
    mustNotContain?: string[];
  };
}

const allCases = (
  JSON.parse(
    readFileSync(
      path.resolve(process.cwd(), "../qa/evaluation-cases.json"),
      "utf8",
    ),
  ) as { cases: RagEvaluationCase[] }
).cases;

const selectedIds = [
  "rag-refund-001",
  "rag-pet-001",
  "rag-version-001",
  "rag-gap-001",
  "rag-refund-redeemed-001",
  "rag-deposit-contract-001",
  "rag-pet-permission-001",
  "rag-delivery-timeout-001",
  "rag-privacy-delete-001",
  "rag-gap-unknown-001",
] as const;

async function run(input: string): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const event of runAgentToolLoop({
    provider: new DemoToolCallingProvider(),
    messages: [{ role: "user", content: input }],
    signal: new AbortController().signal,
    executor: new ToolExecutor(),
    toolContext: createToolTestContext(),
    debug: true,
  })) {
    events.push(event);
  }
  return events;
}

describe("Task 8 RAG evaluation", () => {
  it("contains at least ten executable RAG evaluation cases", () => {
    expect(selectedIds.length).toBeGreaterThanOrEqual(10);
  });

  for (const id of selectedIds) {
    const evaluation = allCases.find((candidate) => candidate.id === id);
    if (!evaluation) throw new Error(`Missing evaluation case: ${id}`);

    it(id, async () => {
      const events = await run(evaluation.input);
      const tools = events.flatMap((event) =>
        event.type === "debug_tool_run" ? [event.run.toolName] : [],
      );
      const citations = events.flatMap((event) =>
        event.type === "citations" ? event.citations : [],
      );
      const answer = events
        .flatMap((event) =>
          event.type === "assistant_delta" ? [event.delta] : [],
        )
        .join("");
      const evidence = citations.map((citation) => citation.excerpt).join("\n");

      for (const tool of evaluation.expected.requiredTools ?? [])
        expect(tools, `${id} missing ${tool}`).toContain(tool);
      if (evaluation.expected.citationRequired)
        expect(citations.length, `${id} missing citations`).toBeGreaterThan(0);
      for (const concept of evaluation.expected.requiredConcepts ?? [])
        expect(evidence, `${id} missing evidence concept ${concept}`).toContain(
          concept,
        );
      if (evaluation.expected.mustDeclineUnsupportedTimeline)
        expect(answer).toMatch(/不能承诺|没有提供固定|无法确认/);
      if (evaluation.expected.mustDeclineCertainty)
        expect(answer).toMatch(/不能|无法|不足|没有找到/);
      for (const forbidden of evaluation.expected.mustNotContain ?? [])
        expect(answer).not.toContain(forbidden);
    });
  }
});
