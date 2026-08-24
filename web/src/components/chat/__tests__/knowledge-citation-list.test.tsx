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

  it("shows portfolio first-party provenance separately from enterprise material", () => {
    render(
      <KnowledgeCitationList
        citations={[
          {
            articleId: "61000000-0000-0000-0000-000000000002",
            versionId: "62000000-0000-0000-0000-000000000002",
            chunkId: "63000000-0000-0000-0000-000000000002",
            title: "小智作品集：历史房源数据边界",
            versionLabel: "2026.08.1",
            effectiveFrom: "2026-08-12",
            excerpt: "这是 2024-11 历史快照，不代表当前可租。",
            score: 0.91,
            isDemo: false,
            materialKind: "portfolio_first_party",
          },
        ]}
      />,
    );

    expect(screen.getByText("作品集首方说明")).toBeInTheDocument();
    expect(screen.queryByText("外部授权资料")).not.toBeInTheDocument();
  });

  it("labels official public material without presenting it as enterprise authorization", () => {
    render(
      <KnowledgeCitationList
        citations={[
          {
            articleId: "61000000-0000-0000-0000-000000000003",
            versionId: "62000000-0000-0000-0000-000000000003",
            chunkId: "63000000-0000-0000-0000-000000000003",
            title: "住房租赁条例：签约与房源核验要点",
            versionLabel: "国务院令第812号",
            sourceReference:
              "https://xzfg.moj.gov.cn/front/law/detail?LawID=1774",
            effectiveFrom: "2025-09-15",
            excerpt: "签约前应核验房屋权属和出租人身份信息。",
            score: 0.88,
            isDemo: false,
            materialKind: "public_official",
          },
        ]}
      />,
    );

    expect(screen.getByText("官方公开资料")).toBeInTheDocument();
    expect(screen.queryByText("外部授权资料")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看官方原文" })).toHaveAttribute(
      "href",
      "https://xzfg.moj.gov.cn/front/law/detail?LawID=1774",
    );
  });
});
