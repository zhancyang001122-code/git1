import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("home page smoke test", () => {
  it("shows the Xiaozhi product identity", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "小智租房决策",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "从预算到签约核验，一次问完",
      }),
    ).toBeInTheDocument();
  });
});
