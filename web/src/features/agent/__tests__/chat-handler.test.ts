import { describe, expect, it } from "vitest";

import { createChatHandler } from "@/features/agent/chat-handler";
import { DemoToolCallingProvider } from "@/features/agent/demo-tool-provider";
import { FakeAIProvider } from "@/features/agent/fake-provider";
import { SseEventParser } from "@/features/agent/sse";
import { createInMemoryToolAudit } from "@/features/agent/tools/audit";
import { ToolExecutor } from "@/features/agent/tools/executor";
import { createDemoRepository } from "@/features/business/demo-repository";
import { createEphemeralChatPersistence } from "@/features/conversation/chat-persistence";
import { FakeMapsService } from "@/features/maps/fake-adapter";
import { FakeKnowledgeService } from "@/features/knowledge/fake-service";

function handler() {
  return createChatHandler(async () => ({
    provider: new FakeAIProvider([
      { type: "text_delta", delta: "你好，杭州" },
      { type: "finish", reason: "stop" },
    ]),
    persistence: createEphemeralChatPersistence(),
    timeoutMs: 1_000,
    warning: {
      code: "DEMO_MODE",
      message: "当前为演示模式，未调用真实千问或外部工具",
    },
  }));
}

describe("POST /api/chat handler", () => {
  it("returns a stable JSON error for malformed JSON", async () => {
    const response = await handler()(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: "{broken",
        headers: { "content-type": "application/json" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "INVALID_CHAT_REQUEST",
      retryable: false,
    });
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects unknown request fields before creating the runtime", async () => {
    let runtimeCreated = false;
    const post = createChatHandler(async () => {
      runtimeCreated = true;
      throw new Error("not reached");
    });
    const response = await post(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "你好", systemPrompt: "unsafe" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(400);
    expect(runtimeCreated).toBe(false);
  });

  it("rejects an oversized body before creating the runtime", async () => {
    let runtimeCreated = false;
    const post = createChatHandler(async () => {
      runtimeCreated = true;
      throw new Error("not reached");
    });
    const response = await post(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "x".repeat(17_000) }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("REQUEST_BODY_TOO_LARGE");
    expect(runtimeCreated).toBe(false);
  });

  it("streams session first, a visible demo warning, Unicode text and done", async () => {
    const response = await handler()(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "你好" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );

    const parser = new SseEventParser();
    const responseText = await response.text();
    const events = parser.push(responseText);
    expect(events.map((event) => event.type)).toEqual([
      "session",
      "warning",
      "assistant_delta",
      "done",
    ]);
    expect(events[2]).toEqual({ type: "assistant_delta", delta: "你好，杭州" });
    expect(responseText).not.toContain("secret");
  });

  it("streams public tool progress and cards without leaking tool names", async () => {
    const post = createChatHandler(async () => ({
      provider: new DemoToolCallingProvider(),
      persistence: createEphemeralChatPersistence(),
      timeoutMs: 1_000,
      tools: {
        executor: new ToolExecutor(),
        context: {
          business: createDemoRepository(),
          maps: new FakeMapsService(),
          knowledge: new FakeKnowledgeService(),
          memory: {
            getPreferences: async () => null,
            upsertPreferences: async () => {
              throw new Error("not available");
            },
            deletePreferences: async () => {
              throw new Error("not available");
            },
          },
          audit: createInMemoryToolAudit(),
          businessSource: "supabase_mock",
          userId: null,
        },
        debugEnabled: false,
        maxRounds: 8,
      },
    }));
    const response = await post(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "找3500元以内允许养猫的一居室",
          debug: true,
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    const responseText = await response.text();
    const events = new SseEventParser().push(responseText);

    expect(events[0]?.type).toBe("session");
    expect(events.some((event) => event.type === "tool_progress")).toBe(true);
    expect(events.some((event) => event.type === "result_cards")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
    expect(responseText).not.toContain("search_houses");
  });

  it("streams knowledge citations before the grounded answer", async () => {
    const post = createChatHandler(async () => ({
      provider: new DemoToolCallingProvider(),
      persistence: createEphemeralChatPersistence(),
      timeoutMs: 1_000,
      tools: {
        executor: new ToolExecutor(),
        context: {
          business: createDemoRepository(),
          maps: new FakeMapsService(),
          knowledge: new FakeKnowledgeService(),
          memory: {
            getPreferences: async () => null,
            upsertPreferences: async () => {
              throw new Error("not available");
            },
            deletePreferences: async () => {
              throw new Error("not available");
            },
          },
          audit: createInMemoryToolAudit(),
          businessSource: "supabase_mock",
          userId: null,
        },
        debugEnabled: false,
        maxRounds: 8,
      },
    }));

    const response = await post(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: "团购券没核销可以退吗" }),
        headers: { "content-type": "application/json" },
      }),
    );
    const events = new SseEventParser().push(await response.text());
    const citationIndex = events.findIndex(
      (event) => event.type === "citations",
    );
    const answerIndex = events.findIndex(
      (event) => event.type === "assistant_delta",
    );

    expect(citationIndex).toBeGreaterThan(0);
    expect(answerIndex).toBeGreaterThan(citationIndex);
    expect(events[citationIndex]).toMatchObject({
      type: "citations",
      citations: [expect.objectContaining({ title: "团购券退款规则" })],
    });
  });
});
