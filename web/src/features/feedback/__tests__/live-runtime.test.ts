import { describe, expect, it, vi } from "vitest";

import { createLiveFeedbackRuntime } from "@/features/feedback/live-runtime";

const anonymousId = "a".repeat(43);
const sessionId = "71000000-0000-4000-8000-000000000001";
const messageId = "72000000-0000-4000-8000-000000000001";

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    anonymousId,
    conversations: {
      getSession: vi.fn(async () => ({
        id: sessionId,
        userId: null,
        anonymousId,
      })),
      listMessages: vi.fn(async () => [
        {
          id: messageId,
          sessionId,
          role: "user",
          content: "What evidence is needed for a deposit deduction?",
        },
      ]),
    },
    aiOps: {
      upsertFeedback: vi.fn(async () => ({
        id: "75000000-0000-4000-8000-000000000001",
      })),
    },
    knowledgeOps: {
      createCandidate: vi.fn(async () => ({
        candidateId: "64000000-0000-4000-8000-000000000001",
        deduplicated: false,
      })),
    },
    ...overrides,
  };
}

describe("live feedback runtime", () => {
  it("verifies anonymous session and user-message ownership", async () => {
    const value = dependencies();
    const runtime = createLiveFeedbackRuntime(value as never);

    await expect(
      runtime.verifyOwnership(sessionId, messageId),
    ).resolves.toEqual({
      userId: null,
      question: "What evidence is needed for a deposit deduction?",
    });
    await expect(
      runtime.recordFeedback({
        userId: null,
        sessionId,
        messageId,
        rating: "down",
        reason: "missing_source",
        comment: null,
      }),
    ).resolves.toEqual({
      feedbackId: "75000000-0000-4000-8000-000000000001",
    });
    expect(value.aiOps.upsertFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, messageId }),
    );
  });

  it("rejects a session owned by another anonymous browser", async () => {
    const value = dependencies({
      conversations: {
        getSession: vi.fn(async () => ({
          id: sessionId,
          userId: null,
          anonymousId: "b".repeat(43),
        })),
        listMessages: vi.fn(),
      },
    });
    const runtime = createLiveFeedbackRuntime(value as never);

    await expect(
      runtime.verifyOwnership(sessionId, messageId),
    ).rejects.toMatchObject({ code: "FEEDBACK_FORBIDDEN", status: 403 });
  });

  it("rejects assistant messages even when the session belongs to the browser", async () => {
    const value = dependencies({
      conversations: {
        getSession: vi.fn(async () => ({
          id: sessionId,
          userId: null,
          anonymousId,
        })),
        listMessages: vi.fn(async () => [
          {
            id: messageId,
            sessionId,
            role: "assistant",
            content: "An answer",
          },
        ]),
      },
    });
    const runtime = createLiveFeedbackRuntime(value as never);

    await expect(
      runtime.verifyOwnership(sessionId, messageId),
    ).rejects.toMatchObject({ code: "FEEDBACK_FORBIDDEN", status: 403 });
  });
});
