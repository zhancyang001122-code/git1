import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FavoritesExperience,
  FeedbackExperience,
} from "@/components/account/account-experiences";
import {
  KnowledgeAdminDetail,
  KnowledgeAdminList,
  KnowledgeMaterialIntake,
} from "@/components/account/knowledge-admin-experiences";
import type { KnowledgeCandidateRecord } from "@/features/knowledge-ops/repository";

const candidate: KnowledgeCandidateRecord = {
  id: "64000000-0000-4000-8000-000000000001",
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
      "模拟规则：已预约套餐需先取消预约，再进入人工退款复核流程。",
    changeSummary: "补充预约限制",
    sourceReference: "DEMO-EVIDENCE-01",
    owner: "知识运营演示负责人",
    domain: "group_buy",
    category: "refund",
    effectiveFrom: "2026-08-11",
  },
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("account and knowledge admin demo flows", () => {
  it("removes a favorite only from local page state", () => {
    render(<FavoritesExperience />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: "移除收藏" })[0]!);
    expect(
      screen.getByRole("alertdialog", { name: "移除这条收藏？" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认移除" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText(/仅从当前页面移除/)).toBeInTheDocument();
  });

  it("turns feedback into a reviewable candidate instead of published knowledge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          feedbackId: "66000000-0000-4000-8000-000000000001",
          candidateId: "64000000-0000-4000-8000-000000000004",
          isDemo: true,
        }),
      ),
    );
    render(<FeedbackExperience />);
    fireEvent.change(screen.getByLabelText("纠正建议"), {
      target: { value: "退款规则需要补充预约限制。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交演示反馈" }));
    expect(
      await screen.findByText(/已进入服务器内存中的待审核候选/),
    ).toBeInTheDocument();
  });

  it("shows the candidate lifecycle and sends review through the protected API", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return Response.json({ review: { status: "approved" }, isDemo: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(
      <KnowledgeAdminList candidates={[candidate]} isDemo />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
    unmount();

    render(<KnowledgeAdminDetail candidate={candidate} isDemo />);
    expect(
      screen.getByText("候选 → 审核 → 发布 → 索引 → 评测"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "批准草稿" }));
    expect(
      screen.getByRole("alertdialog", { name: "批准这份草稿？" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.getByText(/候选已批准，但尚未发布/)).toBeInTheDocument();
    expect(JSON.stringify(fetchMock.mock.calls[0]?.[1])).not.toContain(
      "DEMO_ADMIN_TOKEN",
    );
  });

  it("submits formal material as a reviewable draft and never claims it is searchable", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          candidate: {
            ...candidate,
            id: "64000000-0000-4000-8000-000000000099",
            status: "drafted",
          },
          deduplicated: false,
          isDemo: false,
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<KnowledgeMaterialIntake isDemo={false} />);
    expect(screen.queryByLabelText("代表问题")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "录入" }));

    fireEvent.change(screen.getByLabelText("代表问题"), {
      target: { value: "历史房源数据能否代表当前可租状态？" },
    });
    fireEvent.change(screen.getByLabelText("材料标题"), {
      target: { value: "历史房源数据使用边界" },
    });
    fireEvent.change(screen.getByLabelText("材料正文"), {
      target: {
        value:
          "房源数据来自 2024 年 11 月，只能用于历史筛选演示，不能据此判断当前是否可租。",
      },
    });
    fireEvent.change(screen.getByLabelText("来源文件或编号"), {
      target: { value: "housing-data-readme.md" },
    });
    fireEvent.change(screen.getByLabelText("内容负责人"), {
      target: { value: "作品集作者" },
    });
    fireEvent.change(screen.getByLabelText("版本号"), {
      target: { value: "v1.0" },
    });
    fireEvent.change(screen.getByLabelText("生效日期"), {
      target: { value: "2026-08-12" },
    });
    fireEvent.change(screen.getByLabelText("分类标识"), {
      target: { value: "data_freshness" },
    });
    fireEvent.change(screen.getByLabelText("变更说明"), {
      target: { value: "首次录入历史房源数据说明" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存为待审核草稿" }));

    expect(await screen.findByText(/已保存为草稿/)).toBeInTheDocument();
    expect(screen.getByText(/尚未发布，也不能被检索/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入审核" })).toHaveAttribute(
      "href",
      "/knowledge-admin/64000000-0000-4000-8000-000000000099",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/knowledge/candidates",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("lets a live admin process a queued index job without exposing credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          versionId: "62000000-0000-4000-8000-000000000001",
          indexStatus: "queued",
          evaluationStatus: "not_run",
          searchable: false,
          rollbackAvailable: false,
          warnings: ["INDEXING_QUEUED"],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "succeeded",
          versionId: "62000000-0000-4000-8000-000000000001",
          candidateId: candidate.id,
          finalization: {
            evaluationStatus: "passed",
            searchable: true,
            rollbackAvailable: false,
            warnings: [],
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <KnowledgeAdminDetail
        candidate={{ ...candidate, status: "approved" }}
        isDemo={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发布并排队索引" }));
    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));
    expect(
      await screen.findByRole("button", { name: "立即处理索引任务" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "立即处理索引任务" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/internal/knowledge-index-worker",
    );
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      "DEMO_ADMIN_TOKEN",
    );
  });
});
