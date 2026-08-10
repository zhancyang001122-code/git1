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
    const result = await context.knowledge.search(
      {
        query: input.query,
        domain: input.domain,
        category: input.category,
        city: input.city,
        topK: input.top_k,
      },
      context.signal,
    );
    const warnings = [...result.warnings];
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
        warnings.push("KNOWLEDGE_CANDIDATE_CREATED");
      } catch (error) {
        void error;
        warnings.push("KNOWLEDGE_CANDIDATE_ENQUEUE_FAILED");
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
        warnings,
        isDemo: result.isDemo,
      },
      source: "knowledge_base",
      citations: result.citations,
      resultCount: result.chunks.length,
    };
  },
};

export const knowledgeToolDefinitions: readonly ErasedToolDefinition[] = [
  searchKnowledge,
] as unknown as readonly ErasedToolDefinition[];
