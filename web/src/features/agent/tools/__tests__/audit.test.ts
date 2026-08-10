import { describe, expect, it, vi } from "vitest";

import type { AIOpsRepository } from "@/features/ai-ops/repository";
import { createAIOpsToolAudit } from "@/features/agent/tools/audit";

describe("AIOps tool audit adapter", () => {
  it("writes sanitized append-only state transitions with shared identifiers", async () => {
    const repository = {
      recordToolRun: vi.fn(async () => ({ id: "ignored" })),
      upsertFeedback: vi.fn(),
    } as unknown as AIOpsRepository;
    const audit = createAIOpsToolAudit(repository);

    await audit.record({
      runId: "run-1",
      sessionId: "71000000-0000-0000-0000-000000000001",
      messageId: "72000000-0000-0000-0000-000000000001",
      requestId: "73000000-0000-0000-0000-000000000001",
      toolName: "search_houses",
      status: "succeeded",
      inputSummary: { max_price: 3_500 },
      outputSummary: { ok: true, resultCount: 2 },
      source: "housing_history_2024",
      durationMs: 18,
      startedAt: "2026-08-11T00:00:00.000Z",
      completedAt: "2026-08-11T00:00:00.018Z",
    });

    expect(repository.recordToolRun).toHaveBeenCalledWith({
      sessionId: "71000000-0000-0000-0000-000000000001",
      messageId: "72000000-0000-0000-0000-000000000001",
      toolName: "search_houses",
      status: "succeeded",
      input: { runId: "run-1", arguments: { max_price: 3_500 } },
      outputSummary: { ok: true, resultCount: 2 },
      sourceLabel: "2024 历史房源数据",
      durationMs: 18,
      errorCode: null,
      requestId: "73000000-0000-0000-0000-000000000001",
      startedAt: "2026-08-11T00:00:00.000Z",
      completedAt: "2026-08-11T00:00:00.018Z",
    });
  });
});
