import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KnowledgeCitationList } from "@/components/chat/knowledge-citation-list";

describe("KnowledgeCitationList", () => {
  it("labels synthetic knowledge and displays version evidence", () => {
    render(
      <KnowledgeCitationList
        citations={[
          {
            articleId: "61000000-0000-0000-0000-000000000001",
            versionId: "62000000-0000-0000-0000-000000000001",
            chunkId: "63000000-0000-0000-0000-000000000001",
            title: "租房押金退还说明",
            versionLabel: "v1.0",
            effectiveFrom: "2026-08-01",
            excerpt: "退租验收完成后按合同约定处理押金。",
            score: 0.8,
            isDemo: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("模拟知识资料")).toBeInTheDocument();
    expect(screen.getByText(/v1.0/)).toBeInTheDocument();
    expect(screen.getByText(/退租验收完成后/)).toBeInTheDocument();
  });
});
