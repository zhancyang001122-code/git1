import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiscoverPage } from "@/components/pages/discover-page";
import { MePage } from "@/components/pages/me-page";
import { MessagesPage } from "@/components/pages/messages-page";
import { XiaozhiWelcomePage } from "@/components/pages/xiaozhi-welcome-page";

describe("primary product pages", () => {
  it("renders and filters the complete community feed", () => {
    render(<DiscoverPage />);

    expect(screen.getAllByRole("article")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "租房避坑" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "带猫租房前我会确认的 6 件事" }),
    ).toBeInTheDocument();
  });

  it("offers Xiaozhi tasks without claiming a model request was sent", () => {
    render(<XiaozhiWelcomePage />);

    expect(
      screen.getByRole("heading", { name: "你好，我是小智" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/当前为前端演示/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /找宠物友好房源/ }),
    ).toHaveAttribute("href", expect.stringContaining("/xiaozhi/chat"));
  });

  it("filters messages by category", () => {
    render(<MessagesPage />);

    expect(screen.getAllByRole("article")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "系统" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("你收藏的房源价格已变动")).toBeInTheDocument();
  });

  it("links the profile hub to every secondary account destination", () => {
    render(<MePage />);

    expect(screen.getByRole("link", { name: /我的收藏/ })).toHaveAttribute(
      "href",
      "/me/favorites",
    );
    expect(screen.getByRole("link", { name: /演示订单/ })).toHaveAttribute(
      "href",
      "/me/orders",
    );
    expect(
      screen.getByRole("link", { name: /知识纠错与反馈/ }),
    ).toHaveAttribute("href", "/me/feedback");

    fireEvent.click(screen.getByRole("button", { name: "帮助" }));
    expect(
      screen.getByText("帮助中心将在后续阶段接入，当前没有发起真实客服请求。"),
    ).toBeInTheDocument();
  });
});
