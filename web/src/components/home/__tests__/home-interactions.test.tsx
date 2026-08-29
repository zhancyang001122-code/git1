import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "@/components/home/home-page";
import { SelectedLocationProvider } from "@/features/location/selected-location-provider";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

beforeEach(() => {
  mocks.push.mockClear();
  localStorage.clear();
});

const defaultLocation = {
  name: "武林广场",
  city: "杭州",
  point: { longitude: 120.16328, latitude: 30.27415 },
  wgs84Point: { longitude: 120.15868, latitude: 30.27645 },
  source: "default" as const,
};

function renderHome() {
  return render(
    <SelectedLocationProvider defaultLocation={defaultLocation}>
      <HomePage />
    </SelectedLocationProvider>,
  );
}

describe("HomePage", () => {
  it("renders every required home section", () => {
    renderHome();

    expect(screen.getByText("杭州 · 武林广场")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "小智租房决策", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多功能" })).toBeEnabled();
    expect(
      screen.getByRole("heading", {
        name: "从预算到签约核验，一次问完",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "问问小智" })).toHaveAttribute(
      "href",
      expect.stringContaining("/xiaozhi/chat?q="),
    );
    expect(
      screen.queryByRole("link", { name: "查看交付证据" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "更多演示内容" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "主导航" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/后续将/)).not.toBeInTheDocument();
  });

  it("submits quick prompts through the validated chat route", () => {
    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "找武林广场附近房源" }));
    expect(screen.getByRole("searchbox")).toHaveValue("找武林广场附近房源");
    expect(screen.getByRole("search")).toHaveAttribute(
      "action",
      "/xiaozhi/chat",
    );
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("navigates with the exact encoded search query", () => {
    renderHome();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "武林广场附近 3500 元房源" },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(mocks.push).toHaveBeenCalledWith(
      "/xiaozhi/chat?q=%E6%AD%A6%E6%9E%97%E5%B9%BF%E5%9C%BA%E9%99%84%E8%BF%91%203500%20%E5%85%83%E6%88%BF%E6%BA%90",
    );
  });

  it("links service entries to their completed routes", () => {
    renderHome();

    expect(screen.getByRole("link", { name: "租房" })).toHaveAttribute(
      "href",
      "/houses",
    );
    expect(screen.getByRole("link", { name: "团购" })).toHaveAttribute(
      "href",
      "/deals",
    );
  });

  it("opens an accessible location picker from the home location header", async () => {
    renderHome();

    await userEvent.click(
      screen.getByRole("button", { name: "选择位置：杭州 · 武林广场" }),
    );

    expect(
      screen.getByRole("dialog", { name: "选择位置" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "使用我的当前位置" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "确认手动选择" })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("城市"));
    await userEvent.type(screen.getByLabelText("城市"), "绍兴");
    await userEvent.type(screen.getByLabelText("地点名称或地址"), "鲁迅故里");
    expect(screen.getByRole("button", { name: "确认手动选择" })).toBeEnabled();
    expect(screen.getByText(/选择保存在当前浏览器/)).toBeInTheDocument();
  });
});
