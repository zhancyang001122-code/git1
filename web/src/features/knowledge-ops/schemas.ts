import { z } from "zod";

import { knowledgeDomains } from "@/features/knowledge/types";

const uuid = z.string().uuid();
const isoDate = z.iso.date();

export const candidateSourceTypeSchema = z.enum([
  "low_confidence",
  "no_result",
  "user_feedback",
  "repeated_question",
  "human_correction",
]);
export const candidateStatusSchema = z.enum([
  "pending",
  "drafted",
  "reviewing",
  "approved",
  "rejected",
  "published",
]);
export const candidateEvidenceSchema = z
  .object({
    articleId: uuid,
    versionId: uuid,
    chunkId: uuid,
    title: z.string().trim().max(160).optional(),
    versionLabel: z.string().trim().max(80).optional(),
    effectiveFrom: isoDate.optional(),
    excerpt: z.string().trim().max(1_000).optional(),
    score: z.number().finite().optional(),
  })
  .strict();
export const candidateInputSchema = z
  .object({
    sourceType: candidateSourceTypeSchema,
    sessionId: uuid.nullable().default(null),
    messageId: uuid.nullable().default(null),
    question: z.string().trim().min(2).max(500),
    domain: z.enum(knowledgeDomains).nullable().default(null),
    reason: z.string().trim().min(2).max(160),
    evidence: z.array(candidateEvidenceSchema).max(20).default([]),
  })
  .strict();
export const candidateDraftSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    answerMarkdown: z.string().trim().min(10).max(20_000),
    changeSummary: z.string().trim().min(2).max(500),
    sourceReference: z.string().trim().min(3).max(500),
    owner: z.string().trim().min(2).max(120),
    domain: z.enum(knowledgeDomains),
    category: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,79}$/),
    versionLabel: z.string().trim().min(1).max(80).optional(),
    effectiveFrom: isoDate,
    effectiveUntil: isoDate.optional(),
  })
  .strict();

export const manualMaterialInputSchema = z
  .object({
    question: z.string().trim().min(2).max(500),
    draft: candidateDraftSchema.extend({
      versionLabel: z.string().trim().min(1).max(80),
    }),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.draft.effectiveUntil &&
      value.draft.effectiveUntil < value.draft.effectiveFrom
    ) {
      context.addIssue({
        code: "custom",
        path: ["draft", "effectiveUntil"],
        message: "失效日期不能早于生效日期",
      });
    }
  });

const approveReviewSchema = z
  .object({
    candidateId: uuid,
    decision: z.literal("approve"),
    notes: z.string().trim().min(2).max(1_000),
    draft: candidateDraftSchema,
  })
  .strict();
const rejectReviewSchema = z
  .object({
    candidateId: uuid,
    decision: z.literal("reject"),
    notes: z.string().trim().min(2).max(1_000),
  })
  .strict();
const changesReviewSchema = z
  .object({
    candidateId: uuid,
    decision: z.literal("request_changes"),
    notes: z.string().trim().min(2).max(1_000),
  })
  .strict();

export const reviewInputSchema = z.discriminatedUnion("decision", [
  approveReviewSchema,
  rejectReviewSchema,
  changesReviewSchema,
]);
export const publishInputSchema = z.object({ candidateId: uuid }).strict();
export const rollbackInputSchema = publishInputSchema;

export type CandidateInput = z.infer<typeof candidateInputSchema>;
export type CandidateDraft = z.infer<typeof candidateDraftSchema>;
export type ManualMaterialInput = z.infer<typeof manualMaterialInputSchema>;
export type CandidateEvidence = z.infer<typeof candidateEvidenceSchema>;
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;
export type CandidateSourceType = z.infer<typeof candidateSourceTypeSchema>;
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export type PublishInput = z.infer<typeof publishInputSchema>;
export type RollbackInput = z.infer<typeof rollbackInputSchema>;
