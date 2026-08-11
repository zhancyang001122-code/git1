import "server-only";

import { z } from "zod";

import type { AIOpsRepository } from "@/features/ai-ops/repository";
import type { ConversationRepository } from "@/features/conversation/repository";
import type { KnowledgeOpsService } from "@/features/knowledge-ops/service";
import { AppError } from "@/lib/errors";

const feedbackReasonSchema = z
  .enum([
    "incorrect",
    "not_relevant",
    "missing_source",
    "unsafe",
    "outdated",
    "other",
  ])
  .nullable();

interface LiveFeedbackDependencies {
  anonymousId: string;
  conversations: Pick<ConversationRepository, "getSession" | "listMessages">;
  aiOps: Pick<AIOpsRepository, "upsertFeedback">;
  knowledgeOps: Pick<KnowledgeOpsService, "createCandidate">;
}

function forbidden(): never {
  throw new AppError({
    code: "FEEDBACK_FORBIDDEN",
    message: "无法验证该消息属于当前浏览器会话",
    status: 403,
  });
}

export function createLiveFeedbackRuntime({
  anonymousId,
  conversations,
  aiOps,
  knowledgeOps,
}: LiveFeedbackDependencies) {
  return {
    mode: "live" as const,
    async verifyOwnership(sessionId: string, messageId: string) {
      const session = await conversations.getSession(sessionId);
      if (!session || session.anonymousId !== anonymousId) forbidden();
      const messages = await conversations.listMessages(sessionId, {
        limit: 100,
      });
      const message = messages.find((entry) => entry.id === messageId);
      if (!message || message.role !== "user") forbidden();
      return { userId: session.userId, question: message.content };
    },
    async recordFeedback(input: {
      userId: string | null;
      sessionId: string;
      messageId: string;
      rating: "up" | "down";
      reason: string | null;
      comment: string | null;
    }) {
      const record = await aiOps.upsertFeedback({
        ...input,
        reason: feedbackReasonSchema.parse(input.reason),
      });
      return { feedbackId: record.id };
    },
    createCandidate: knowledgeOps.createCandidate.bind(knowledgeOps),
  };
}
