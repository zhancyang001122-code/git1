import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeHighlights } from "@/components/home/home-highlights";
import { homeHighlights } from "@/features/home/home-demo-data";

describe("HomeHighlights", () => {
  it("renders four deterministic typed records", () => {
    render(<HomeHighlights items={homeHighlights} />);

    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(
      screen.getByRole("link", { name: /查看房源 武林晴川一居室/ }),
    ).toHaveAttribute("href", "/houses/20000000-0000-0000-0000-000000000001");
    expect(
      screen.getByRole("link", {
        name: /查看社区内容 西湖边适合慢慢走的一条路线/,
      }),
    ).toHaveAttribute("href", "/discover/50000000-0000-0000-0000-000000000001");
  });

  it("labels housing as historical instead of currently available", () => {
    render(<HomeHighlights items={homeHighlights} />);

    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
    expect(screen.getByText(/2024 历史房源示例/)).toBeInTheDocument();
    expect(
      screen.queryByText(/随时入住|实时在租|当前可租/),
    ).not.toBeInTheDocument();
  });

  it("marks other commercial records as demo content", () => {
    render(<HomeHighlights items={homeHighlights} />);

    expect(screen.getAllByText("演示业务数据")).toHaveLength(3);
  });
});
