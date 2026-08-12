import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentManagement } from "@/components/account/incident-management";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const incident = {
  id: "85000000-0000-4000-8000-000000000001",
  alertKey: "tool_failure_rate" as const,
  severity: "warning" as const,
  status: "open" as const,
  title: "工具失败率",
  metricValue: 12.5,
  thresholdValue: 5,
  sampleCount: 24,
  detail: "3 / 24 次工具失败",
  openedAt: "2026-08-12T00:00:00.000Z",
  lastSeenAt: "2026-08-12T00:01:00.000Z",
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolutionNote: null,
  eventCount: 1,
  updatedAt: "2026-08-12T00:01:00.000Z",
};

beforeEach(() => {
  refresh.mockReset();
  vi.unstubAllGlobals();
});

describe("IncidentManagement", () => {
  it("does not invent incidents in Demo mode", () => {
    render(<IncidentManagement incidents={null} status="demo" />);
    expect(screen.getByText(/Demo 不创建持久化事故/)).toBeInTheDocument();
  });

  it("acknowledges an open incident with a safe API write", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ incident: { ...incident, status: "acknowledged" } }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<IncidentManagement incidents={[incident]} status="ready" />);

    fireEvent.change(screen.getByLabelText("工具失败率处理说明"), {
      target: { value: "开始排查" },
    });
    fireEvent.click(screen.getByRole("button", { name: "认领事故" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith(
      "/api/knowledge/incidents",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          incidentId: incident.id,
          action: "acknowledge",
          note: "开始排查",
        }),
      }),
    );
  });

  it("keeps resolve disabled until a resolution note exists", () => {
    render(
      <IncidentManagement
        status="ready"
        incidents={[
          {
            ...incident,
            status: "acknowledged",
            acknowledgedAt: "2026-08-12T00:02:00.000Z",
            acknowledgedBy: "portfolio_admin",
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "标记已解决" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("工具失败率处理说明"), {
      target: { value: "已修复并回归" },
    });
    expect(button).toBeEnabled();
  });

  it("announces a failed transition as an error without refreshing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { message: "事故状态已变化，请刷新后重试" } },
          { status: 409 },
        ),
      ),
    );
    render(<IncidentManagement incidents={[incident]} status="ready" />);

    fireEvent.click(screen.getByRole("button", { name: "认领事故" }));

    expect(
      await screen.findByRole("alert", {
        name: "事故状态已变化，请刷新后重试",
      }),
    ).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });
});
