import { describe, expect, it, vi } from "vitest";

import { createFeedbackHandler } from "@/app/api/feedback/route";

const sessionId = "71000000-0000-4000-8000-000000000001";
const messageId = "72000000-0000-4000-8000-000000000001";

function runtime() {
  return {
    mode: "demo" as const,
    verifyOwnership: vi.fn(async () => ({
      userId: null,
      question: "团购券过期两天可以退款吗",
    })),
    recordFeedback: vi.fn(async () => ({
      feedbackId: "66000000-0000-4000-8000-000000000001",
    })),
    createCandidate: vi.fn(async () => ({
      candidateId: "64000000-0000-4000-8000-000000000004",
      deduplicated: false,
    })),
  };
}

describe("POST /api/feedback", () => {
  it("records an upvote without creating knowledge", async () => {
    const value = runtime();
    const post = createFeedbackHandler(async () => value);
    const response = await post(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, messageId, rating: "up" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(value.recordFeedback).toHaveBeenCalledOnce();
    expect(value.createCandidate).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      candidateId: null,
      isDemo: true,
    });
  });

  it("creates one reviewable candidate for a source-related downvote", async () => {
    const value = runtime();
    const post = createFeedbackHandler(async () => value);
    const response = await post(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messageId,
          rating: "down",
          reason: "missing_source",
          comment: "请补充过期券的处理依据",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(value.createCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "user_feedback",
        question: "团购券过期两天可以退款吗",
        reason: "missing_source",
      }),
    );
  });

  it("rejects feedback when session ownership cannot be verified", async () => {
    const value = runtime();
    value.verifyOwnership.mockRejectedValueOnce(
      Object.assign(new Error("forbidden"), {
        code: "FEEDBACK_FORBIDDEN",
        status: 403,
        retryable: false,
      }),
    );
    const post = createFeedbackHandler(async () => value);
    const response = await post(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, messageId, rating: "up" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(value.recordFeedback).not.toHaveBeenCalled();
  });
});
