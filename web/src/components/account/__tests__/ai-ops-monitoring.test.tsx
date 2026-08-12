import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ApiRouteLog,
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
            key: "first_token_p95",
            severity: "warning",
            state: "ok",
            title: "首 Token P95",
            metricValue: 1250,
            thresholdValue: 6000,
            sampleCount: 24,
            detail: "服务端从收到请求到首个可见回答文本的 P95 为 1250 ms",
            measuredAt: "2026-08-12T00:00:00.000Z",
          },
          {
            key: "session_cost",
            severity: "warning",
            state: "ok",
            title: "单会话成本估算",
            metricValue: 0.03,
            thresholdValue: 0.1,
            sampleCount: 5,
            detail: "完整计价会话中的最高模型成本估算为 0.03 元",
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
    expect(screen.getByText(/当前 1250ms · 阈值 6000ms/)).toBeInTheDocument();
    expect(screen.getByText(/当前 0.03 元 · 阈值 0.1 元/)).toBeInTheDocument();
    expect(screen.getByText(/成本是带价格版本的估算/)).toBeInTheDocument();
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

describe("ApiRouteLog", () => {
  it("renders safe cross-instance route metadata", () => {
    render(
      <ApiRouteLog
        status="ready"
        filters={{ method: "POST", statusClass: 5 }}
        entries={[
          {
            id: "75000000-0000-4000-8000-000000000001",
            routeKey: "/api/maps/nearby",
            method: "POST",
            statusCode: 502,
            durationMs: 320,
            requestId: "76000000-0000-4000-8000-000000000001",
            errorCode: "AMAP_UPSTREAM_FAILED",
            createdAt: "2026-08-12T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("form", { name: "API 日志筛选" }),
    ).toBeInTheDocument();
    expect(screen.getByText("/api/maps/nearby")).toBeInTheDocument();
    expect(screen.getByText(/AMAP_UPSTREAM_FAILED/)).toBeInTheDocument();
    expect(
      screen.queryByText(/request_body|cookie|authorization/),
    ).not.toBeInTheDocument();
  });

  it("does not invent centralized API logs in Demo mode", () => {
    render(<ApiRouteLog status="demo" entries={null} filters={{}} />);
    expect(screen.getByText(/Demo 不读取集中式API 日志/)).toBeInTheDocument();
  });
});
