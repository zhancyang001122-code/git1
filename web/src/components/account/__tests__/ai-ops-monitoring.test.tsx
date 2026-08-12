import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OperationalAlerts,
  ToolRunLog,
} from "@/components/account/ai-ops-monitoring";

describe("OperationalAlerts", () => {
  it("separates active, healthy and insufficient-sample states", () => {
    render(
      <OperationalAlerts
        status="ready"
        alerts={[
          {
            key: "tool_failure_rate",
            severity: "warning",
            state: "alert",
            title: "工具失败率",
            metricValue: 12.5,
            thresholdValue: 5,
            sampleCount: 24,
            detail: "3 / 24 次终态工具调用失败或超时",
            measuredAt: "2026-08-12T00:00:00.000Z",
          },
          {
            key: "rag_no_result_rate",
            severity: "warning",
            state: "insufficient_data",
            title: "RAG 零结果率",
            metricValue: 0,
            thresholdValue: 20,
            sampleCount: 2,
            detail: "样本不足，至少需要 10 次检索",
            measuredAt: "2026-08-12T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("1 个站内告警")).toBeInTheDocument();
    expect(screen.getByText("告警中")).toBeInTheDocument();
    expect(screen.getByText("样本不足")).toBeInTheDocument();
    expect(screen.getByText(/不包含外部通知/)).toBeInTheDocument();
  });

  it("does not invent centralized alerts in Demo mode", () => {
    render(<OperationalAlerts status="demo" alerts={null} />);

    expect(screen.getByText(/Demo 不读取集中式告警状态/)).toBeInTheDocument();
  });
});

describe("ToolRunLog", () => {
  it("renders searchable safe metadata and no raw payload fields", () => {
    render(
      <ToolRunLog
        status="ready"
        filters={{ status: "failed", toolName: "search_knowledge" }}
        entries={[
          {
            id: "73000000-0000-4000-8000-000000000001",
            toolName: "search_knowledge",
            status: "failed",
            sourceLabel: "知识库",
            durationMs: 250,
            errorCode: "KNOWLEDGE_TIMEOUT",
            requestId: "74000000-0000-4000-8000-000000000001",
            createdAt: "2026-08-12T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("form", { name: "工具审计筛选" }),
    ).toBeInTheDocument();
    expect(screen.getByText("search_knowledge")).toBeInTheDocument();
    expect(screen.getByText(/KNOWLEDGE_TIMEOUT/)).toBeInTheDocument();
    expect(
      screen.queryByText(/input_json|output_summary/),
    ).not.toBeInTheDocument();
  });

  it("reports an unavailable central audit instead of fake entries", () => {
    render(<ToolRunLog status="unavailable" entries={null} filters={{}} />);

    expect(screen.getByText(/工具审计暂时不可用/)).toBeInTheDocument();
  });
});
