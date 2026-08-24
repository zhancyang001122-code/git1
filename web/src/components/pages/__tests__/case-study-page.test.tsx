import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CaseStudyPage } from "@/components/pages/case-study-page";

describe("CaseStudyPage", () => {
  it("presents the delivery case with honest evidence and limits", () => {
    render(<CaseStudyPage />);

    expect(
      screen.getByRole("heading", { name: "小智租房决策助手" }),
    ).toBeInTheDocument();
    expect(screen.getByText("60,202")).toBeInTheDocument();
    expect(screen.getByText("20 / 20")).toBeInTheDocument();
    expect(screen.getByText(/尚未完成真实用户效率验证/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "立即运行主演示" }),
    ).toHaveAttribute("href", expect.stringContaining("/xiaozhi/chat?q="));
  });
});
