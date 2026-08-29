import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiscoverPage } from "@/components/pages/discover-page";
import { MePage } from "@/components/pages/me-page";
import { MessagesPage } from "@/components/pages/messages-page";
import { XiaozhiWelcomePage } from "@/components/pages/xiaozhi-welcome-page";
import { demoCommunityPosts } from "@/features/business/demo-data";

afterEach(() => vi.unstubAllGlobals());

describe("primary product pages", () => {
  it("renders and filters the complete community feed", () => {
    render(
      <DiscoverPage
        posts={demoCommunityPosts}
        mode={{ mode: "demo", reason: "产品演示模式已开启" }}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "租房避坑" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "签租房合同前我会确认的 6 件事" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /收藏 签租房合同/ }));
    expect(screen.getByText(/收藏状态仅保存在当前页面/)).toBeInTheDocument();
  });

  it("labels the Xiaozhi welcome page as demo only in demo mode", () => {
    render(<XiaozhiWelcomePage mode="demo" />);

    expect(
      screen.getByRole("heading", { name: "你好，我是小智" }),
    ).toBeInTheDocument();
    expect(screen.getByText("租房决策主演示")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "运行示例任务" })).toHaveAttribute(
      "href",
      expect.stringContaining("/xiaozhi/chat?q="),
    );
    expect(
      screen.queryByRole("link", { name: "为什么这样设计" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "开始演示对话" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/当前为可验证演示模式/)).toBeInTheDocument();
    expect(screen.queryByText(/后续会连接/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /找预算内一居室/ }),
    ).toHaveAttribute("href", expect.stringContaining("/xiaozhi/chat"));
  });

  it("keeps the live welcome page focused on product actions", () => {
    render(<XiaozhiWelcomePage mode="live" />);

    expect(
      screen.queryByText(/当前为 Live 作品集/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/当前为可验证演示模式/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "运行示例任务" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "开始对话" }),
    ).not.toBeInTheDocument();
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
    expect(screen.getByRole("group", { name: "账户功能" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "帮助" }));
    expect(
      screen.getByText("帮助中心为演示入口，当前没有发起真实客服请求。"),
    ).toBeInTheDocument();
  });

  it("signs out without claiming that cloud preferences were deleted", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const navigate = vi.fn();
    render(<MePage accountNavigate={navigate} />);

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(
      screen.getByRole("alertdialog", { name: "退出当前账号？" }),
    ).toHaveTextContent("不会删除已保存的长期偏好");
    fireEvent.click(screen.getByRole("button", { name: "确认退出" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-out", {
        method: "POST",
      }),
    );
    expect(navigate).toHaveBeenCalledWith("/login");
  });
});
