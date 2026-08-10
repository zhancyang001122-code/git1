import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatExperience } from "@/components/chat/chat-experience";
import { CommunityPostDetail } from "@/components/chat/community-post-detail";
import { ConversationHistory } from "@/components/chat/conversation-history";
import { demoCommunityPosts } from "@/features/business/demo-data";

describe("scripted conversation experiences", () => {
  it("runs and labels a local multi-step housing demonstration", async () => {
    vi.useFakeTimers();
    render(
      <ChatExperience
        initialContext={{
          prompt: "找 3500 元以内允许养猫的房源",
          source: "home",
          debug: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(screen.getByText("正在查询演示房源")).toBeInTheDocument();
    expect(screen.getByText(/未调用真实模型或外部工具/)).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(600));
    expect(screen.getByText(/本地脚本演示已完成/)).toBeInTheDocument();
    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
    expect(screen.getByText("工具：local_demo_search")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("carries a community post through the allowlisted chat context", () => {
    render(<CommunityPostDetail post={demoCommunityPosts[0]!} />);

    expect(
      screen.getByRole("heading", { name: demoCommunityPosts[0]!.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "带着这篇内容问小智" }),
    ).toHaveAttribute("href", expect.stringContaining("source=community_post"));
  });

  it("links every demo conversation history item to a stable route", () => {
    render(<ConversationHistory />);
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getByRole("link", { name: /宠物友好房源/ })).toHaveAttribute(
      "href",
      "/xiaozhi/chat/demo-housing",
    );
  });
});
