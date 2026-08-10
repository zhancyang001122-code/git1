import { BookOpenText } from "lucide-react";

import { Tag } from "@/components/ui/tag";
import type { KnowledgeCitation } from "@/features/agent/chat-events";

export function KnowledgeCitationList({
  citations,
}: {
  citations: readonly KnowledgeCitation[];
}) {
  if (citations.length === 0) return null;

  return (
    <section
      aria-label="知识引用"
      className="rounded-card border border-border bg-surface p-4 shadow-card"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <BookOpenText aria-hidden="true" className="size-4 text-brand" />
        回答依据
      </h2>
      <div className="mt-3 space-y-3">
        {citations.map((citation) => (
          <article
            key={citation.chunkId}
            className="rounded-control bg-page p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-text">
                {citation.title}
              </h3>
              {citation.isDemo ? <Tag>模拟知识资料</Tag> : null}
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
