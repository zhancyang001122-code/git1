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

const sessionId = "71000000-0000-0000-0000-000000000001";
const userMessageId = "72000000-0000-0000-0000-000000000001";
const assistantMessageId = "72000000-0000-0000-0000-000000000002";
const anonymousId = "anonymous-owner-token";

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
    });
    expect(repo.appendMessage).toHaveBeenLastCalledWith({
      sessionId,
      role: "assistant",
      content: "新的回答",
      structuredPayload: { finishReason: "stop" },
      modelName: "qwen-plus",
      inputTokens: 12,
      outputTokens: 8,
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
