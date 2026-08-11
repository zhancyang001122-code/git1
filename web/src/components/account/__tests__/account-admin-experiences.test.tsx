import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FavoritesExperience,
  FeedbackExperience,
} from "@/components/account/account-experiences";
import {
  KnowledgeAdminDetail,
  KnowledgeAdminList,
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
