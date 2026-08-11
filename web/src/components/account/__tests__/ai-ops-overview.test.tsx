import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AIOpsOverview } from "@/components/account/ai-ops-overview";
import type { AIOpsDashboard } from "@/features/ai-ops/dashboard";

const dashboard: AIOpsDashboard = {
  windowHours: 168,
  generatedAt: "2026-08-12T00:00:00.000Z",
  sessions: 3,
  assistantMessages: 5,
  inputTokens: 2000,
  outputTokens: 1000,
  toolRuns: 8,
  toolFailures: 2,
  knowledgeSearches: 4,
  knowledgeSearchFailures: 1,
  feedbackUp: 3,
  feedbackDown: 1,
  evalRuns: 10,
  evalPassed: 9,
  candidatesCreated: 2,
  publishedVersions: 4,
  demoPublishedVersions: 4,
  readyChunks: 24,
};

describe("AIOpsOverview", () => {
  it("renders labelled operational ratios and refuses to invent monetary cost", () => {
    render(<AIOpsOverview dashboard={dashboard} status="ready" />);

    expect(
      screen.getByRole("region", { name: "AI Ops 近 7 天概览" }),
    ).toBeInTheDocument();
    expect(screen.getByText("输入 2,000 / 输出 1,000")).toBeInTheDocument();
    expect(screen.getAllByText("75.0%", { exact: true })).toHaveLength(2);
    expect(
      screen.getByText(/未配置模型价格，不估算人民币成本/),
    ).toBeInTheDocument();
  });

  it("states why central metrics are absent in Demo mode", () => {
    render(<AIOpsOverview dashboard={null} status="demo" />);

    expect(
      screen.getByText(/Demo 不读取集中式 AI Ops 数据/),
    ).toBeInTheDocument();
  });
});
