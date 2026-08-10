import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "@/components/home/home-page";

describe("HomePage", () => {
  it("renders every required home section", () => {
    render(<HomePage />);

    expect(screen.getByText("杭州 · 武林广场")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "小智本地生活 AI 服务助手",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "附近精选" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "主导航" }),
    ).toBeInTheDocument();
  });

  it("keeps quick prompts local and never claims an AI request was sent", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: "找宠物友好房源" }));
    expect(screen.getByRole("searchbox")).toHaveValue("找宠物友好房源");
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "小智对话将在下一阶段接通",
    );
    expect(screen.queryByText(/查询成功|已经找到/)).not.toBeInTheDocument();
  });

  it("explains unavailable service entries instead of navigating to a missing route", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: "租房" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "租房功能将在下一阶段开放",
    );
  });
});
