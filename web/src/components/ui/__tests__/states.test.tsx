import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DemoNotice } from "@/components/ui/demo-notice";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

describe("shared UI states", () => {
  it("shows an honest demo notice", () => {
    render(<DemoNotice>当前内容为演示数据</DemoNotice>);

    expect(screen.getByRole("status")).toHaveTextContent("当前内容为演示数据");
  });

  it("announces loading without pretending content exists", () => {
    render(<LoadingState message="正在加载演示内容" />);

    expect(screen.getByRole("status")).toHaveTextContent("正在加载演示内容");
  });

  it("renders an empty state action", () => {
    render(
      <EmptyState
        title="暂时没有内容"
        message="换个条件试试"
        action={<button type="button">重新筛选</button>}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "暂时没有内容" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新筛选" }),
    ).toBeInTheDocument();
  });

  it("shows a safe request id and supports retry", () => {
    const onRetry = vi.fn();

    render(
      <ErrorState
        title="暂时无法加载"
        message="请稍后重试"
        requestId="request-123"
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(screen.getByText(/request-123/)).toBeInTheDocument();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
