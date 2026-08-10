import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  FavoritesExperience,
  FeedbackExperience,
  PreferencesExperience,
} from "@/components/account/account-experiences";
import {
  KnowledgeAdminDetail,
  KnowledgeAdminList,
} from "@/components/account/knowledge-admin-experiences";
import { demoKnowledgeCandidates } from "@/features/account/demo-knowledge-data";

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

  it("saves preferences without claiming persistence", () => {
    render(<PreferencesExperience />);
    fireEvent.change(screen.getByLabelText("预算上限"), {
      target: { value: "4200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存演示偏好" }));
    expect(screen.getByText(/没有写入 Supabase/)).toBeInTheDocument();
  });

  it("turns feedback into a local candidate instead of published knowledge", () => {
    render(<FeedbackExperience />);
    fireEvent.change(screen.getByLabelText("纠正建议"), {
      target: { value: "退款规则需要补充预约限制。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交演示反馈" }));
    expect(screen.getByText(/仅生成待审核候选/)).toBeInTheDocument();
  });

  it("shows the candidate lifecycle and keeps review actions local", () => {
    const { unmount } = render(<KnowledgeAdminList />);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    unmount();

    render(<KnowledgeAdminDetail candidate={demoKnowledgeCandidates[0]!} />);
    expect(
      screen.getByText("候选 → 审核 → 发布 → 索引 → 评测"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "批准草稿" }));
    expect(
      screen.getByRole("alertdialog", { name: "批准这份草稿？" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认批准" }));
    expect(screen.getByText(/本地状态已更新为“已批准”/)).toBeInTheDocument();
  });
});
