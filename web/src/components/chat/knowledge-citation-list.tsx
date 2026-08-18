import { BookOpenText } from "lucide-react";

import { Tag } from "@/components/ui/tag";
import type { KnowledgeCitation } from "@/features/agent/chat-events";

function provenanceLabel(citation: KnowledgeCitation): string | null {
  if (citation.materialKind === "portfolio_first_party") {
    return "作品集首方说明";
  }
  if (citation.materialKind === "external_authorized") {
    return "外部授权资料";
  }
  if (citation.isDemo || citation.materialKind === "demo") {
    return "模拟知识资料";
  }
  return null;
}

export function KnowledgeCitationList({
  citations,
}: {
  citations: readonly KnowledgeCitation[];
}) {
  if (citations.length === 0) return null;

  return (
    <section aria-label="知识引用" className="glass-panel rounded-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <BookOpenText aria-hidden="true" className="size-4 text-brand" />
        回答依据
      </h2>
      <div className="mt-3 space-y-3">
        {citations.map((citation) => (
          <article
            key={citation.chunkId}
            className="glass-control rounded-control border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-text">
                {citation.title}
              </h3>
              {provenanceLabel(citation) ? (
                <Tag>{provenanceLabel(citation)}</Tag>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {citation.versionLabel} · 生效日期：
              {citation.effectiveFrom ?? "未记录"}
            </p>
            <p className="mt-2 text-xs leading-5 text-text-muted">
              {citation.excerpt}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
