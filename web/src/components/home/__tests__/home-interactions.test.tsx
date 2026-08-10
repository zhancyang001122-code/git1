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

  it("submits quick prompts through the validated chat route", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: "找宠物友好房源" }));
    expect(screen.getByRole("searchbox")).toHaveValue("找宠物友好房源");
    expect(screen.getByRole("search")).toHaveAttribute(
      "action",
      "/xiaozhi/chat",
    );
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("links service entries to their completed routes", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "租房" })).toHaveAttribute(
      "href",
      "/houses",
    );
    expect(screen.getByRole("link", { name: "团购" })).toHaveAttribute(
      "href",
      "/deals",
    );
  });
});
