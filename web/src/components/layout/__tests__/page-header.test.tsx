import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/layout/page-header";

describe("PageHeader", () => {
  it("centers the title and exposes two functional capsule actions", () => {
    render(<PageHeader title="小智" />);

    expect(screen.getByRole("heading", { name: "小智" })).toHaveClass(
      "text-center",
    );
    expect(screen.getByRole("button", { name: "更多功能" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("opens an accessible menu from the more button", async () => {
    const user = userEvent.setup();
    render(<PageHeader title="房源详情" />);

    const trigger = screen.getByRole("button", { name: "更多功能" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "更多功能" })).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "帮助与说明" }),
    ).toHaveAttribute("href", "/me");
  });
});
