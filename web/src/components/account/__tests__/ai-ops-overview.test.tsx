import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AIOpsOverview,
  RAGOpsTrend,
} from "@/components/account/ai-ops-overview";
import type {
  AIOpsDashboard,
  RAGOpsTrendPoint,
} from "@/features/ai-ops/dashboard";
import type { AIModelCostEstimate } from "@/features/ai-ops/pricing";

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

  it("renders an auditable list-price estimate with explicit exclusions", () => {
    const costEstimate: AIModelCostEstimate = {
      status: "partial",
      estimatedCostCny: 0.5072,
      coveredRequests: 3,
      totalRequests: 4,
      unpricedRequests: 1,
      pricing: {
        model: "qwen-plus",
        modeLabel: "非思考模式",
        effectiveFrom: "2026-08-12",
        sourceUrl: "https://help.aliyun.com/zh/model-studio/qwen-plus",
        tiers: [],
      },
    };

    render(
      <AIOpsOverview
        dashboard={dashboard}
        status="ready"
        costEstimate={costEstimate}
      />,
    );

    expect(screen.getByText("¥0.5072")).toBeInTheDocument();
    expect(screen.getByText("部分覆盖 · 覆盖 3/4 次请求")).toBeInTheDocument();
    expect(screen.getByText(/不含免费额度、优惠/)).toBeInTheDocument();
    expect(screen.getByText(/Embedding 与 Rerank/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "官方价格来源" })).toHaveAttribute(
      "href",
      costEstimate.pricing.sourceUrl,
    );
  });

  it("states why central metrics are absent in Demo mode", () => {
    render(<AIOpsOverview dashboard={null} status="demo" />);

    expect(
      screen.getByText(/Demo 不读取集中式 AI Ops 数据/),
    ).toBeInTheDocument();
  });
});

const trend: readonly RAGOpsTrendPoint[] = [
  {
    date: "2026-08-10",
    knowledgeSearches: 0,
    knowledgeSuccesses: 0,
    noResultSearches: 0,
    averageDurationMs: null,
    feedbackUp: 0,
    feedbackDown: 0,
    evalRuns: 0,
    evalPassed: 0,
    candidatesCreated: 0,
  },
  {
    date: "2026-08-11",
    knowledgeSearches: 4,
    knowledgeSuccesses: 3,
    noResultSearches: 1,
    averageDurationMs: 220,
    feedbackUp: 2,
    feedbackDown: 1,
    evalRuns: 3,
    evalPassed: 2,
    candidatesCreated: 1,
  },
];

describe("RAGOpsTrend", () => {
  it("renders an accessible real-data daily trend", () => {
    render(<RAGOpsTrend trend={trend} status="ready" />);

    expect(
      screen.getByRole("region", { name: "RAG 近 7 天趋势" }),
    ).toBeInTheDocument();
    const latest = screen.getByRole("listitem", { name: "2026-08-11" });
    expect(latest).toHaveTextContent("成功率 75.0%");
    expect(latest).toHaveTextContent("零结果 1");
    expect(
      screen.getByText(/按北京时间汇总真实终态工具记录/),
    ).toBeInTheDocument();
  });

  it("does not invent trend data in Demo mode", () => {
    render(<RAGOpsTrend trend={null} status="demo" />);

    expect(screen.getByText(/Demo 不生成生产 RAG 趋势/)).toBeInTheDocument();
  });
});
