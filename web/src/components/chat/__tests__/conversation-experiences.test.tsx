import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatExperience } from "@/components/chat/chat-experience";
import { CommunityPostDetail } from "@/components/chat/community-post-detail";
import { ConversationHistory } from "@/components/chat/conversation-history";
import { demoCommunityPosts } from "@/features/business/demo-data";
import { encodeSseEvent } from "@/features/agent/sse";
import { SelectedLocationProvider } from "@/features/location/selected-location-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("conversation experiences", () => {
  const selectedLocation = {
    name: "鲁迅故里",
    city: "绍兴",
    point: { longitude: 120.586109, latitude: 29.995762 },
    wgs84Point: { longitude: 120.5815, latitude: 29.9982 },
    source: "manual" as const,
  };

  it("renders the server SSE warning and streamed answer", async () => {
    const responseText = [
      encodeSseEvent({
        type: "session",
        sessionId: "71000000-0000-0000-0000-000000000001",
        messageId: "72000000-0000-0000-0000-000000000001",
      }),
      encodeSseEvent({
        type: "warning",
        code: "DEMO_MODE",
        message: "当前为演示模式，未调用真实千问或外部工具",
      }),
      encodeSseEvent({ type: "assistant_delta", delta: "这是流式回答" }),
      encodeSseEvent({ type: "done", finishReason: "stop" }),
    ].join("");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(responseText, {
            headers: { "content-type": "text/event-stream; charset=utf-8" },
          }),
      ),
    );
    render(
      <ChatExperience
        initialContext={{
          prompt: "找武林广场附近 3500 元以内的房源",
          source: "home",
          debug: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() =>
      expect(screen.getByText("这是流式回答")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("当前为演示模式，未调用真实千问或外部工具"),
    ).toBeInTheDocument();
    expect(screen.getByText("本轮未执行外部工具。")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "新对话" }));
    expect(screen.queryByText("这是流式回答")).not.toBeInTheDocument();
    expect(screen.getByText("从一个真实需求开始")).toBeInTheDocument();
  });

  it("cancels the browser request instead of leaving it running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    render(
      <ChatExperience
        initialContext={{ prompt: "帮我看看附近", debug: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    fireEvent.click(await screen.findByRole("button", { name: "取消" }));
    await waitFor(() =>
      expect(screen.getByText("本轮请求已取消。")).toBeInTheDocument(),
    );
  });

  it("sends the shared selected location with every chat request", async () => {
    const responseText = [
      encodeSseEvent({
        type: "session",
        sessionId: "71000000-0000-0000-0000-000000000001",
        messageId: "72000000-0000-0000-0000-000000000001",
      }),
      encodeSseEvent({ type: "assistant_delta", delta: "已按当前位置查询" }),
      encodeSseEvent({ type: "done", finishReason: "stop" }),
    ].join("");
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(responseText),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SelectedLocationProvider defaultLocation={selectedLocation}>
        <ChatExperience
          initialContext={{ prompt: "附近有什么超市", debug: false }}
        />
      </SelectedLocationProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await screen.findByText("已按当前位置查询");
    const request = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(request).toMatchObject({
      location: selectedLocation.point,
      locationWgs84: selectedLocation.wgs84Point,
      locationLabel: "绍兴 · 鲁迅故里",
      locationCity: "绍兴",
    });
  });

  it("submits message-scoped feedback to the server API", async () => {
    const sessionId = "71000000-0000-4000-8000-000000000001";
    const messageId = "72000000-0000-4000-8000-000000000001";
    const responseText = [
      encodeSseEvent({ type: "session", sessionId, messageId }),
      encodeSseEvent({ type: "assistant_delta", delta: "需要核验来源" }),
      encodeSseEvent({ type: "done", finishReason: "stop" }),
    ].join("");
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const [input] = args;
      if (String(input) === "/api/feedback") {
        return Response.json({
          candidateId: "64000000-0000-4000-8000-000000000001",
          isDemo: true,
        });
      }
      return new Response(responseText, {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ChatExperience
        initialContext={{ prompt: "这个回答有来源吗", debug: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("需要核验来源");
    fireEvent.click(screen.getByRole("button", { name: "回答需改进" }));

    await screen.findByText(/已生成服务器内存中的待审核候选/);
    const feedbackCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/feedback",
    );
    expect(JSON.parse(String(feedbackCall?.[1]?.body))).toMatchObject({
      sessionId,
      messageId,
      rating: "down",
      reason: "missing_source",
    });
  });

  it("does not report a truncated SSE response as completed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            encodeSseEvent({
              type: "session",
              sessionId: "71000000-0000-0000-0000-000000000001",
              messageId: "72000000-0000-0000-0000-000000000001",
            }) + encodeSseEvent({ type: "assistant_delta", delta: "未完成" }),
          ),
      ),
    );
    render(
      <ChatExperience initialContext={{ prompt: "测试中断", debug: false }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() =>
      expect(screen.getByText("聊天响应意外中断，请重试")).toBeInTheDocument(),
    );
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
    expect(
      screen.getByRole("link", { name: /武林广场附近房源/ }),
    ).toHaveAttribute("href", "/xiaozhi/chat/demo-housing");
  });
});
