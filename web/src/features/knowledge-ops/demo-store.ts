import "server-only";

import { runEvaluationSuite } from "@/features/evaluation/runner";
import type { KnowledgeHit } from "@/features/knowledge/types";
import type { KnowledgeCandidateInput } from "@/features/knowledge/types";
import type { KnowledgeCandidateSink } from "@/features/knowledge/types";
import {
  createInMemoryKnowledgeOpsRepository,
  type KnowledgeCandidateRecord,
  type KnowledgeOpsRepository,
  type PreparedPublication,
} from "@/features/knowledge-ops/repository";
import { createKnowledgeOpsService } from "@/features/knowledge-ops/service";

const now = "2026-08-11T00:00:00.000Z";

export const DEMO_KNOWLEDGE_CANDIDATE_IDS = {
  refund: "64000000-0000-4000-8000-000000000001",
  deposit: "64000000-0000-4000-8000-000000000002",
  delivery: "64000000-0000-4000-8000-000000000003",
} as const;

const seed: readonly KnowledgeCandidateRecord[] = [
  {
    id: DEMO_KNOWLEDGE_CANDIDATE_IDS.refund,
    sourceType: "user_feedback",
    sourceSessionId: null,
    sourceMessageId: null,
    normalizedQuestion: "团购退款需补充预约限制",
    domain: "group_buy",
    reason: "missing_source",
    evidence: [],
    status: "reviewing",
    occurrenceCount: 1,
    draft: {
      title: "团购退款预约限制（模拟）",
      answerMarkdown:
        "模拟规则：未使用且有效期内可申请退款；已预约套餐需先取消预约，并以商家演示规则为准。",
      changeSummary: "补充预约套餐处理条件",
      sourceReference: "DEMO-EVIDENCE-01",
      owner: "知识运营演示负责人",
      domain: "group_buy",
      category: "refund",
      effectiveFrom: "2026-08-11",
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: DEMO_KNOWLEDGE_CANDIDATE_IDS.deposit,
    sourceType: "human_correction",
    sourceSessionId: null,
    sourceMessageId: null,
    normalizedQuestion: "押金扣款证据如何核验",
    domain: "housing",
    reason: "field_contract_difference",
    evidence: [],
    status: "drafted",
    occurrenceCount: 1,
    draft: {
      title: "押金扣款证据清单（模拟）",
      answerMarkdown:
        "模拟规则：发生押金扣款时需核对合同条款、退租验收记录和费用凭证，不能仅凭口头说明确定金额。",
      changeSummary: "补充押金扣款证据边界",
      sourceReference: "DEMO-EVIDENCE-02",
      owner: "知识运营演示负责人",
      domain: "housing",
      category: "deposit",
      effectiveFrom: "2026-08-11",
    },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: DEMO_KNOWLEDGE_CANDIDATE_IDS.delivery,
    sourceType: "low_confidence",
    sourceSessionId: null,
    sourceMessageId: null,
    normalizedQuestion: "配送超时是否自动补偿",
    domain: "market",
    reason: "missing_evidence",
    evidence: [],
    status: "rejected",
    occurrenceCount: 1,
    draft: null,
    createdAt: now,
    updatedAt: now,
  },
];

interface DemoKnowledgeState {
  repository: KnowledgeOpsRepository;
  publishedHits: Map<string, KnowledgeHit>;
}

const globalState = globalThis as typeof globalThis & {
  __xiaozhiDemoKnowledgeOps?: DemoKnowledgeState;
};

function createState(): DemoKnowledgeState {
  return {
    repository: createInMemoryKnowledgeOpsRepository(seed),
    publishedHits: new Map(),
  };
}

function state(): DemoKnowledgeState {
  globalState.__xiaozhiDemoKnowledgeOps ??= createState();
  return globalState.__xiaozhiDemoKnowledgeOps;
}

function addIndexedHit(
  publication: PreparedPublication,
  candidate: KnowledgeCandidateRecord,
) {
  if (!candidate.draft) return;
  const hit: KnowledgeHit = {
    chunkId: crypto.randomUUID(),
    articleId: publication.articleId,
    versionId: publication.versionId,
    chunkIndex: 0,
    title: candidate.draft.title,
    versionLabel: candidate.draft.versionLabel ?? "demo-v1",
    effectiveFrom: candidate.draft.effectiveFrom,
    effectiveUntil: candidate.draft.effectiveUntil ?? null,
    articleStatus: "published",
    versionStatus: "published",
    content: candidate.draft.answerMarkdown,
    metadata: {
      domain: candidate.draft.domain,
      category: candidate.draft.category,
      isDemo: true,
      sourceReference: candidate.draft.sourceReference,
    },
    vectorScore: 1,
    textScore: 1,
    combinedScore: 1,
    score: 1,
    isDemo: true,
  };
  state().publishedHits.set(candidate.id, hit);
}

export function createDemoKnowledgeOpsService() {
  return createKnowledgeOpsService({
    repository: state().repository,
    indexer: {
      async indexVersion(versionId) {
        return {
          versionId,
          totalChunks: 1,
          indexedChunks: 1,
          skippedChunks: 0,
          status: "ready" as const,
        };
      },
    },
    evaluator: {
      async run(candidateId) {
        const candidate = await state().repository.getCandidate(candidateId);
        const hit = state().publishedHits.get(candidateId);
        const suite = await runEvaluationSuite(
          [
            {
              id: "indexed-candidate",
              category: "citation",
              input: candidate?.normalizedQuestion ?? "",
              expected: { searchable: true },
            },
            {
              id: "citation-provenance",
              category: "citation",
              input: candidate?.normalizedQuestion ?? "",
              expected: { sourceReference: true },
            },
            {
              id: "published-state",
              category: "workflow",
              input: candidate?.normalizedQuestion ?? "",
              expected: { status: "published" },
            },
            {
              id: "rejected-exclusion",
              category: "safety",
              input: "配送超时是否自动补偿",
              expected: { searchable: false },
            },
          ],
          async (evaluationCase) => {
            const passed =
              evaluationCase.id === "indexed-candidate"
                ? Boolean(hit)
                : evaluationCase.id === "citation-provenance"
                  ? Boolean(
                      hit?.title &&
                      hit.versionId &&
                      hit.chunkId &&
                      hit.metadata.sourceReference,
                    )
                  : evaluationCase.id === "published-state"
                    ? candidate?.status === "published"
                    : !state().publishedHits.has(
                        DEMO_KNOWLEDGE_CANDIDATE_IDS.delivery,
                      );
            return {
              passed,
              score: passed ? 1 : 0,
              notes: passed ? "演示断言通过" : "演示断言失败",
            };
          },
        );
        return {
          runId: crypto.randomUUID(),
          total: suite.total,
          passedCount: suite.passedCount,
          score: suite.score,
          passed: suite.passed,
        };
      },
    },
    hooks: {
      onIndexed: addIndexedHit,
      onRolledBack(candidateId) {
        state().publishedHits.delete(candidateId);
      },
    },
    isDemo: true,
  });
}

export function createDemoKnowledgeCandidateSink(): KnowledgeCandidateSink {
  return {
    async enqueue(input: KnowledgeCandidateInput) {
      const result = await createDemoKnowledgeOpsService().createCandidate({
        sourceType: input.sourceType,
        sessionId: input.sessionId,
        messageId: input.messageId,
        question: input.question,
        domain: input.domain,
        reason: input.reason,
        evidence: input.evidence.map((citation) => ({
          articleId: citation.articleId,
          versionId: citation.versionId,
          chunkId: citation.chunkId,
          title: citation.title,
          versionLabel: citation.versionLabel,
        })),
      });
      return { candidateId: result.candidateId };
    },
  };
}

export function findPublishedDemoKnowledge(query: string): KnowledgeHit | null {
  const normalized = query.toLocaleLowerCase("zh-CN");
  return (
    [...state().publishedHits.values()].find((hit) => {
      const haystack = `${hit.title} ${hit.content}`.toLocaleLowerCase("zh-CN");
      return (
        (normalized.includes("过期") && haystack.includes("过期")) ||
        normalized
          .split(/\s+/)
          .some((term) => term.length >= 2 && haystack.includes(term))
      );
    }) ?? null
  );
}

export function resetDemoKnowledgeOpsForTests() {
  globalState.__xiaozhiDemoKnowledgeOps = createState();
}
