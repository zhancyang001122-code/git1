import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "@/components/home/home-page";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

beforeEach(() => {
  mocks.push.mockClear();
});

describe("HomePage", () => {
  it("renders every required home section", () => {
    render(<HomePage />);

    expect(screen.getByText("杭州 · 武林广场")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "小智本地生活", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多功能" })).toBeEnabled();
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
    expect(screen.queryByText(/后续将/)).not.toBeInTheDocument();
  });

  it("submits quick prompts through the validated chat route", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: "找武林广场附近房源" }));
    expect(screen.getByRole("searchbox")).toHaveValue("找武林广场附近房源");
    expect(screen.getByRole("search")).toHaveAttribute(
      "action",
      "/xiaozhi/chat",
    );
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("navigates with the exact encoded search query", () => {
    render(<HomePage />);

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "武林广场附近 3500 元房源" },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(mocks.push).toHaveBeenCalledWith(
      "/xiaozhi/chat?q=%E6%AD%A6%E6%9E%97%E5%B9%BF%E5%9C%BA%E9%99%84%E8%BF%91%203500%20%E5%85%83%E6%88%BF%E6%BA%90",
    );
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
