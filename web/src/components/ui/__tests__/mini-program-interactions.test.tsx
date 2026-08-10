import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionSheet } from "@/components/ui/action-sheet";
import { Cell, CellGroup } from "@/components/ui/cell-group";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toast } from "@/components/ui/toast";

afterEach(() => vi.useRealTimers());

function ActionSheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开筛选
      </button>
      <ActionSheet open={open} onOpenChange={setOpen} title="筛选房源">
        <button type="button">价格最低</button>
        <button type="button">距离最近</button>
      </ActionSheet>
    </>
  );
}

describe("mini-program interaction primitives", () => {
  it("closes an action sheet with Escape and restores trigger focus", async () => {
    const user = userEvent.setup();
    render(<ActionSheetHarness />);
    const trigger = screen.getByRole("button", { name: "打开筛选" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "筛选房源" })).toBeVisible();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "筛选房源" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("renders a destructive confirmation with explicit actions", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="清空购物车？"
        description="清空后需要重新添加商品。"
        confirmLabel="清空购物车"
        onConfirm={onConfirm}
        danger
      />,
    );

    await user.click(screen.getByRole("button", { name: "清空购物车" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("announces a toast and dismisses it after the configured duration", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(
      <Toast
        open
        onOpenChange={onOpenChange}
        message="已加入购物车"
        duration={1_000}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("已加入购物车");
    act(() => vi.advanceTimersByTime(1_000));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders linked and static cells with aligned supporting content", async () => {
    render(
      <CellGroup title="个人服务">
        <Cell
          title="我的收藏"
          description="查看收藏的房源与内容"
          meta="12"
          href="/me/favorites"
        />
        <Cell title="当前模式" meta="演示" />
      </CellGroup>,
    );

    expect(screen.getByRole("group", { name: "个人服务" })).toBeVisible();
    expect(screen.getByRole("link", { name: /我的收藏/ })).toHaveAttribute(
      "href",
      "/me/favorites",
    );
    await waitFor(() => expect(screen.getByText("当前模式")).toBeVisible());
  });
});
