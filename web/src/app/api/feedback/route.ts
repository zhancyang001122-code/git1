import { z } from "zod";

import { findDemoMessage } from "@/features/conversation/demo-message-registry";
import { createDemoKnowledgeOpsService } from "@/features/knowledge-ops/demo-store";
import type { CandidateInput } from "@/features/knowledge-ops/schemas";
import { AppError, toPublicError } from "@/lib/errors";
import { parsePublicEnv } from "@/lib/env";
import { requestIdFor } from "@/lib/request-id";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import {
  createFixedWindowRateLimiter,
  requestClientKey,
} from "@/lib/rate-limit";

const feedbackRateLimiter = createFixedWindowRateLimiter({
  limit: 30,
  windowMs: 60_000,
});

const feedbackRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    messageId: z.string().uuid(),
    rating: z.enum(["up", "down"]),
    reason: z
      .enum([
        "incorrect",
        "not_relevant",
        "missing_source",
        "unsafe",
        "outdated",
        "other",
      ])
      .nullable()
      .default(null),
    comment: z.string().trim().max(1_000).nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.rating === "down" && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "点踩时必须选择原因",
      });
    }
  });

export interface FeedbackRuntime {
  mode: "demo" | "live";
  verifyOwnership(
    sessionId: string,
    messageId: string,
  ): Promise<{ userId: string | null; question: string }>;
  recordFeedback(input: {
    userId: string | null;
    sessionId: string;
    messageId: string;
    rating: "up" | "down";
    reason: string | null;
    comment: string | null;
  }): Promise<{ feedbackId: string }>;
  createCandidate(
    input: CandidateInput,
  ): Promise<{ candidateId: string; deduplicated: boolean }>;
}

const demoMessages = new Map([
  [
    "71000000-0000-4000-8000-000000000001:72000000-0000-4000-8000-000000000001",
    "团购券过期两天可以退款吗",
  ],
  [
    "71000000-0000-4000-8000-000000000002:72000000-0000-4000-8000-000000000002",
    "允许养猫的房源需要核验什么",
  ],
  [
    "71000000-0000-4000-8000-000000000003:72000000-0000-4000-8000-000000000003",
    "配送超时如何处理",
  ],
]);
const demoFeedback = new Map<string, string>();

async function defaultRuntime(): Promise<FeedbackRuntime> {
  const configuration = parsePublicEnv(process.env);
  if (!configuration.NEXT_PUBLIC_DEMO_MODE) {
    throw new AppError({
      code: "FEEDBACK_LIVE_NOT_CONFIGURED",
      message: "真实反馈服务尚未配置完成",
      status: 503,
    });
  }
  const service = createDemoKnowledgeOpsService();
  return {
    mode: "demo",
    async verifyOwnership(sessionId, messageId) {
      const question =
        findDemoMessage(sessionId, messageId) ??
        demoMessages.get(`${sessionId}:${messageId}`);
      if (!question) {
        throw new AppError({
          code: "FEEDBACK_FORBIDDEN",
          message: "无法验证该演示消息的归属",
          status: 403,
        });
      }
      return { userId: null, question };
    },
    async recordFeedback(input) {
      const key = `${input.sessionId}:${input.messageId}`;
      const feedbackId = demoFeedback.get(key) ?? crypto.randomUUID();
      demoFeedback.set(key, feedbackId);
      return { feedbackId };
    },
    createCandidate: (input) => service.createCandidate(input),
  };
}

function errorResponse(error: unknown, requestId: string): Response {
  const status =
    error instanceof AppError
      ? error.status
      : typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof error.status === "number"
        ? error.status
        : 500;
  const normalized = toPublicError(error, requestId);
  return Response.json(
    { error: normalized },
    {
      status,
      headers: { "cache-control": "no-store", "x-request-id": requestId },
    },
  );
}

const candidateReasons = new Set(["incorrect", "missing_source", "outdated"]);

export function createFeedbackHandler(
  runtimeFactory: () => Promise<FeedbackRuntime> = defaultRuntime,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    try {
      const rateLimit = feedbackRateLimiter.check(requestClientKey(request));
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit, requestId);
      const parsed = feedbackRequestSchema.safeParse(
        await readJsonWithLimit(request, 8_192),
      );
      if (!parsed.success) {
        throw new AppError({
          code: "FEEDBACK_INPUT_INVALID",
          message: "反馈参数格式无效",
          status: 400,
          cause: parsed.error,
        });
      }
      const runtime = await runtimeFactory();
      const input = parsed.data;
      const owner = await runtime.verifyOwnership(
        input.sessionId,
        input.messageId,
      );
      const feedback = await runtime.recordFeedback({
        userId: owner.userId,
        sessionId: input.sessionId,
        messageId: input.messageId,
        rating: input.rating,
        reason: input.reason,
        comment: input.comment,
      });
      let candidateId: string | null = null;
      if (
        input.rating === "down" &&
        input.reason &&
        candidateReasons.has(input.reason)
      ) {
        const candidate = await runtime.createCandidate({
          sourceType: "user_feedback",
          sessionId: input.sessionId,
          messageId: input.messageId,
          question: owner.question,
          domain: null,
          reason: input.reason,
          evidence: [],
        });
        candidateId = candidate.candidateId;
      }
      return Response.json(
        {
          feedbackId: feedback.feedbackId,
          candidateId,
          isDemo: runtime.mode === "demo",
        },
        { headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

export const POST = createFeedbackHandler();
