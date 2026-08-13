import { describe, expect, it, vi } from "vitest";

import {
  createEphemeralChatPersistence,
  createSupabaseChatPersistence,
} from "@/features/conversation/chat-persistence";
import type {
  ConversationMessage,
  ConversationRepository,
  ConversationSession,
} from "@/features/conversation/repository";
import type { AIModelPricingConfiguration } from "@/features/ai-ops/pricing";

const sessionId = "71000000-0000-0000-0000-000000000001";
const userMessageId = "72000000-0000-0000-0000-000000000001";
const assistantMessageId = "72000000-0000-0000-0000-000000000002";
const anonymousId = "anonymous-owner-token";
const pricing: AIModelPricingConfiguration = {
  model: "qwen-plus",
  modeLabel: "非思考模式",
  effectiveFrom: "2026-08-12",
  sourceUrl: "https://help.aliyun.com/zh/model-studio/qwen-plus",
  tiers: [
    {
      maxInputTokens: 128_000,
      inputCnyPerMillion: 0.8,
      outputCnyPerMillion: 2,
    },
  ],
};

function session(owner = anonymousId): ConversationSession {
  return {
    id: sessionId,
    userId: null,
    anonymousId: owner,
    title: "找房",
    summary: "",
    lastLocationLabel: null,
    location: null,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
  };
}

function message(
  role: ConversationMessage["role"],
  content: string,
  id = userMessageId,
): ConversationMessage {
  return {
    id,
    sessionId,
    role,
    content,
    structuredPayload: null,
    modelName: null,
    inputTokens: null,
    outputTokens: null,
    firstTokenMs: null,
    estimatedCostCny: null,
    pricingEffectiveFrom: null,
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

function repository(overrides: Partial<ConversationRepository> = {}) {
  const repo: ConversationRepository = {
    createSession: vi.fn(async () => session()),
    getSession: vi.fn(async () => session()),
    listSessions: vi.fn(async () => []),
    appendMessage: vi.fn(async (input) =>
      message(
        input.role,
        input.content,
        input.role === "assistant" ? assistantMessageId : userMessageId,
      ),
    ),
    listMessages: vi.fn(async () => [message("user", "之前的问题")]),
    updateSummary: vi.fn(async () => {}),
    updateLocation: vi.fn(async () => {}),
    ...overrides,
  };
  return repo;
}

describe("chat persistence", () => {
  it("rejects an anonymous user reading another owner's session", async () => {
    const repo = repository({
      getSession: vi.fn(async () => session("other-owner-token")),
    });
    const persistence = createSupabaseChatPersistence({
      repository: repo,
      anonymousId,
      modelName: "qwen-plus",
      pricing,
    });

    await expect(
      persistence.prepare({ sessionId, message: "继续", debug: false }),
    ).rejects.toMatchObject({ code: "CONVERSATION_FORBIDDEN", status: 403 });
    expect(repo.appendMessage).not.toHaveBeenCalled();
  });

  it("creates a session, appends the user turn and persists model usage", async () => {
    const repo = repository({
      listMessages: vi.fn(async () => [
        message("user", "之前的问题"),
        message("assistant", "之前的回答", assistantMessageId),
        message("user", "现在的问题"),
      ]),
    });
    const persistence = createSupabaseChatPersistence({
      repository: repo,
      anonymousId,
      modelName: "qwen-plus",
      pricing,
    });

    const prepared = await persistence.prepare({
      message: "现在的问题",
      debug: false,
    });
    expect(repo.createSession).toHaveBeenCalledWith({
      anonymousId,
      title: "现在的问题",
    });
    expect(
      prepared.messages.map(({ role, content }) => ({ role, content })),
    ).toEqual([
      { role: "user", content: "之前的问题" },
      { role: "assistant", content: "之前的回答" },
      { role: "user", content: "现在的问题" },
    ]);

    await prepared.persistAssistant({
      assistantText: "新的回答",
      finishReason: "stop",
      inputTokens: 12,
      outputTokens: 8,
      firstTokenMs: 420,
      usageRounds: [{ inputTokens: 12, outputTokens: 8 }],
    });
    expect(repo.appendMessage).toHaveBeenLastCalledWith({
      sessionId,
      role: "assistant",
      content: "新的回答",
      structuredPayload: { finishReason: "stop" },
      modelName: "qwen-plus",
      inputTokens: 12,
      outputTokens: 8,
      firstTokenMs: 420,
      estimatedCostCny: 0.000026,
      pricingEffectiveFrom: "2026-08-12",
    });
  });

  it("persists structured result cards with the assistant turn", async () => {
    const repo = repository();
    const prepared = await createSupabaseChatPersistence({
      repository: repo,
      anonymousId,
      modelName: "qwen-plus",
    }).prepare({ message: "找房", debug: false });
    const cards = [
      {
        kind: "house" as const,
        data: {
          id: "20000000-0000-0000-0000-000000000001",
          name: "武林晴川一居室",
        },
      },
    ];

    await prepared.persistAssistant({
      assistantText: "找到一条记录",
      finishReason: "stop",
      cards,
    });

    expect(repo.appendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        role: "assistant",
        structuredPayload: { finishReason: "stop", cards },
      }),
    );
  });

  it("keeps recent messages intact and refreshes a redacted summary after 12 messages", async () => {
    const history = Array.from({ length: 13 }, (_, index) =>
      message(
        index % 2 === 0 ? "user" : "assistant",
        index === 0 ? "预算3500元，token=secret-value" : `第${index + 1}条消息`,
        `72000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
      ),
    );
    const repo = repository({
      listMessages: vi.fn(async () => history),
    });
    const prepared = await createSupabaseChatPersistence({
      repository: repo,
      anonymousId,
      modelName: "qwen-plus",
    }).prepare({ message: "继续", debug: false });

    expect(prepared.messages).toHaveLength(13);
    expect(prepared.conversationSummary).toContain("预算3500元");
    expect(prepared.conversationSummary).not.toContain("secret-value");

    await prepared.persistAssistant({
      assistantText: "请确认区域",
      finishReason: "stop",
    });
    expect(repo.updateSummary).toHaveBeenCalledWith(
      sessionId,
      expect.stringContaining("请确认区域"),
    );
    expect(
      String(vi.mocked(repo.updateSummary).mock.calls[0]?.[1]),
    ).not.toContain("secret-value");
  });

  it("keeps demo persistence explicitly ephemeral", async () => {
    const prepared = await createEphemeralChatPersistence().prepare({
      message: "演示问题",
      debug: false,
    });
    expect(prepared.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(prepared.messages).toEqual([{ role: "user", content: "演示问题" }]);
    await expect(
      prepared.persistAssistant({
        assistantText: "演示回答",
        finishReason: "stop",
      }),
    ).resolves.toBeUndefined();
  });
});
