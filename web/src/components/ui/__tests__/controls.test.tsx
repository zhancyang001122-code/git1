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
        value="  想找可养猫房源  "
        onValueChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.submit(screen.getByRole("search"));
    expect(onSubmit).toHaveBeenCalledWith("想找可养猫房源");
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

  it("maps source codes to controlled user-facing labels", () => {
    render(<SourceBadge source="housing_history_2024" />);

    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
  });
});
