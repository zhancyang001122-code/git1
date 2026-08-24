import { BookOpenText, ExternalLink } from "lucide-react";

import { Tag } from "@/components/ui/tag";
import type { KnowledgeCitation } from "@/features/agent/chat-events";

function provenanceLabel(citation: KnowledgeCitation): string | null {
  if (citation.materialKind === "portfolio_first_party") {
    return "作品集首方说明";
  }
  if (citation.materialKind === "public_official") {
    return "官方公开资料";
  }
  if (citation.materialKind === "external_authorized") {
    return "外部授权资料";
  }
  if (citation.isDemo || citation.materialKind === "demo") {
    return "模拟知识资料";
  }
  return null;
}

function officialSourceUrl(citation: KnowledgeCitation): string | null {
  if (citation.materialKind !== "public_official") return null;
  try {
    const value = new URL(citation.sourceReference ?? "");
    return value.protocol === "https:" ? value.href : null;
  } catch {
    return null;
  }
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
        {citations.map((citation) => {
          const sourceUrl = officialSourceUrl(citation);
          return (
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
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-interactive mt-2 inline-flex min-h-11 items-center gap-1 rounded-control border border-transparent px-2 text-xs font-semibold text-brand outline-none hover:bg-brand-soft"
                >
                  查看官方原文
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
