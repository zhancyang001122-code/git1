import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  KnowledgeCandidateInput,
  KnowledgeCandidateSink,
} from "@/features/knowledge/types";
import { AppError } from "@/lib/errors";

const candidateIdSchema = z.string().uuid();

export function normalizeCandidateQuestion(question: string): string {
  return question
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[邮箱]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[手机号]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function evidenceView(input: KnowledgeCandidateInput) {
  return input.evidence.map((citation) => ({
    articleId: citation.articleId,
    versionId: citation.versionId,
    chunkId: citation.chunkId,
    title: citation.title,
    versionLabel: citation.versionLabel,
    effectiveFrom: citation.effectiveFrom,
    excerpt: citation.excerpt,
    score: citation.score,
  }));
}

export function createSupabaseKnowledgeCandidateSink(
  client: SupabaseClient,
): KnowledgeCandidateSink {
  return {
    async enqueue(input, signal) {
      const question = normalizeCandidateQuestion(input.question);
      if (question.length < 2) {
        throw new AppError({
          code: "KNOWLEDGE_CANDIDATE_INVALID",
          message: "知识缺口问题脱敏后内容不足",
        });
      }
      const query = client.rpc("enqueue_knowledge_candidate", {
        p_source_type: input.sourceType,
        p_source_session_id: input.sessionId,
        p_source_message_id: input.messageId,
        p_normalized_question: question,
        p_domain: input.domain,
        p_reason: input.reason,
        p_evidence_json: evidenceView(input),
      });
      if (signal) query.abortSignal(signal);
      const result = await query;
      if (result.error) {
        throw new AppError({
          code: "KNOWLEDGE_CANDIDATE_ENQUEUE_FAILED",
          message: "知识缺口暂时无法进入审核队列",
          retryable: true,
          cause: result.error,
        });
      }
      const parsed = candidateIdSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new AppError({
          code: "KNOWLEDGE_CANDIDATE_INVALID_RESPONSE",
          message: "知识缺口队列返回格式无效",
          retryable: true,
          cause: parsed.error,
        });
      }
      return { candidateId: parsed.data };
    },
  };
}
