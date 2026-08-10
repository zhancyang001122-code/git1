import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentProgressList } from "@/components/chat/agent-progress-list";
import type { PublicToolProgress } from "@/features/agent/chat-events";

const startedAt = "2026-08-11T10:00:00.000+08:00";

function progress(overrides: Partial<PublicToolProgress>): PublicToolProgress {
  return {
    id: "step-1",
    label: "正在查询房源",
    status: "succeeded",
    source: "housing_history_2024",
    startedAt,
    completedAt: "2026-08-11T10:00:01.000+08:00",
    ...overrides,
  };
}

describe("AgentProgressList", () => {
  it("keeps completed public steps visible without exposing tool names", () => {
    render(
      <AgentProgressList
        items={[
          progress({}),
          progress({
            id: "step-2",
            label: "正在核对商品库存",
            status: "running",
            source: "supabase_mock",
            completedAt: null,
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("region", { name: "处理进度" }),
    ).toBeInTheDocument();
    expect(screen.getByText("正在查询房源")).toBeInTheDocument();
    expect(screen.getByText("正在核对商品库存")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("处理中")).toBeInTheDocument();
    expect(screen.queryByText("search_houses")).not.toBeInTheDocument();
  });

  it("renders nothing when no tool step exists", () => {
    const { container } = render(<AgentProgressList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
