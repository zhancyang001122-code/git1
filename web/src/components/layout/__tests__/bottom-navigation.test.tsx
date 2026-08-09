import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/layout/app-shell";
import { BottomNavigation } from "@/components/layout/bottom-navigation";

describe("BottomNavigation", () => {
  it("renders the five fixed product destinations", () => {
    render(<BottomNavigation active="home" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/discover",
      "/xiaozhi",
      "/messages",
      "/me",
    ]);
    expect(screen.getByRole("link", { name: "小智" })).toBeInTheDocument();
  });

  it("marks only the active destination as current", () => {
    render(<BottomNavigation active="messages" />);

    expect(screen.getByRole("link", { name: "消息" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page"),
    ).toHaveLength(1);
  });

  it("lets AppShell own the only navigation landmark", () => {
    render(
      <AppShell activeNav="home">
        <h1>首页</h1>
      </AppShell>,
    );

    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveClass("pb-[104px]");
  });
});
