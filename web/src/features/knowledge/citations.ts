import type { KnowledgeCitation } from "@/features/agent/chat-events";
import type { KnowledgeHit } from "@/features/knowledge/types";

export function citationFromHit(hit: KnowledgeHit): KnowledgeCitation {
  return {
    articleId: hit.articleId,
    versionId: hit.versionId,
    chunkId: hit.chunkId,
    title: hit.title,
    versionLabel: hit.versionLabel,
    effectiveFrom: hit.effectiveFrom,
    excerpt: hit.content.slice(0, 280),
    score: hit.score,
    isDemo: hit.isDemo,
  };
}
