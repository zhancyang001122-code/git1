import type { ToolInputs, ToolName } from "@/features/agent/tools/schemas";
import {
  toolContractDefinitions,
  toolInputSchemas,
} from "@/features/agent/tools/schemas";
import type {
  ErasedToolDefinition,
  ToolDefinition,
} from "@/features/agent/tools/types";

function contract(name: ToolName) {
  return toolContractDefinitions.find(
    (definition) => definition.name === name,
  )!;
}

const searchKnowledge: ToolDefinition<ToolInputs["search_knowledge"]> = {
  ...contract("search_knowledge"),
  publicLabel: "正在检索知识依据",
  source: () => "knowledge_base",
  inputSchema: toolInputSchemas.search_knowledge,
  async execute(input, context) {
    let result = await context.knowledge.search(
      {
        query: input.query,
        domain: input.domain,
        category: input.category,
        city: input.city,
        topK: input.top_k,
      },
      context.signal,
    );
    const warnings = new Set(result.warnings);
    if (input.category !== null && result.chunks.length === 0) {
      result = await context.knowledge.search(
        {
          query: input.query,
          domain: input.domain,
          category: null,
          city: input.city,
          topK: input.top_k,
        },
        context.signal,
      );
      warnings.add("CATEGORY_FILTER_RELAXED");
      result.warnings.forEach((warning) => warnings.add(warning));
    }
    if (
      context.knowledgeCandidates &&
      (result.lowConfidence || result.conflict || result.chunks.length === 0)
    ) {
      try {
        await context.knowledgeCandidates.enqueue(
          {
            sourceType:
              result.chunks.length === 0 ? "no_result" : "low_confidence",
            sessionId: context.sessionId,
            messageId: context.messageId,
            question: input.query,
            domain: result.queryPlan.domain ?? input.domain,
            reason: result.conflict
              ? "conflicting_evidence"
              : result.chunks.length === 0
                ? "no_effective_evidence"
                : "score_below_threshold",
            evidence: result.citations,
          },
          context.signal,
        );
        warnings.add("KNOWLEDGE_CANDIDATE_CREATED");
      } catch (error) {
        void error;
        warnings.add("KNOWLEDGE_CANDIDATE_ENQUEUE_FAILED");
      }
    }
    return {
      ok: true,
      data: {
        passages: result.chunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          title: chunk.title,
          versionLabel: chunk.versionLabel,
          effectiveFrom: chunk.effectiveFrom,
          content: chunk.content,
          score: chunk.score,
        })),
        lowConfidence: result.lowConfidence,
        conflict: result.conflict,
        queryPlan: result.queryPlan,
        warnings: [...warnings],
        rankingStrategy: result.rankingStrategy,
        isDemo: result.isDemo,
      },
      source: "knowledge_base",
      citations:
        result.lowConfidence || result.conflict ? [] : result.citations,
      resultCount: result.chunks.length,
    };
  },
};

export const knowledgeToolDefinitions: readonly ErasedToolDefinition[] = [
  searchKnowledge,
] as unknown as readonly ErasedToolDefinition[];
