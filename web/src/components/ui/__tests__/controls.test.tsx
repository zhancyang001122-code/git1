import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SearchBar } from "@/components/ui/search-bar";
import { SourceBadge } from "@/components/ui/source-badge";

describe("common controls", () => {
  it("forwards button refs and preserves native disabled behavior", () => {
    const ref = createRef<HTMLButtonElement>();

    render(
      <Button ref={ref} disabled>
        提交
      </Button>,
    );

    expect(ref.current).toBe(screen.getByRole("button", { name: "提交" }));
    expect(ref.current).toBeDisabled();
  });

  it("gives icon-only actions an accessible name", () => {
    render(<IconButton label="收藏">+</IconButton>);

    expect(screen.getByRole("button", { name: "收藏" })).toBeInTheDocument();
  });

  it("submits a trimmed controlled search value by keyboard", () => {
    const onSubmit = vi.fn();

    render(
      <SearchBar
        label="搜索本地生活服务"
        value="  想找预算内房源  "
        onValueChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.submit(screen.getByRole("search"));
    expect(onSubmit).toHaveBeenCalledWith("想找预算内房源");
  });

  it("does not submit blank search input", () => {
    const onSubmit = vi.fn();

    render(
      <SearchBar
        label="搜索本地生活服务"
        value="   "
        onValueChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.submit(screen.getByRole("search"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("uses the client submit callback while preserving the native GET fallback", () => {
    const onSubmit = vi.fn();

    render(
      <SearchBar
        action="/xiaozhi/chat"
        queryName="q"
        label="搜索本地生活服务"
        value="帮我找房"
        onValueChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    const form = screen.getByRole("search");
    expect(fireEvent.submit(form)).toBe(false);
    expect(onSubmit).toHaveBeenCalledWith("帮我找房");
    expect(form).toHaveAttribute("action", "/xiaozhi/chat");
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("maps source codes to controlled user-facing labels", () => {
    render(<SourceBadge source="housing_history_2024" />);

    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
  });
});
