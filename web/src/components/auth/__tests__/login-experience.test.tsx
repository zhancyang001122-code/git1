import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginExperience } from "@/components/auth/login-experience";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginExperience", () => {
  it("discloses the fixed demo account and logs in with the prefilled code", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true, next: "/me/preferences" }));
    const navigate = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginExperience nextPath="/me/preferences" navigate={navigate} />);
    expect(screen.getByText("固定演示码登录")).toBeInTheDocument();
    expect(screen.getByText(/不会发送短信或邮件/)).toBeInTheDocument();
    expect(screen.getByLabelText("6 位演示码")).toHaveValue("666666");

    fireEvent.click(screen.getByRole("button", { name: "进入演示账号" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/me/preferences"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/demo-login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "666666",
          next: "/me/preferences",
        }),
      }),
    );
  });

  it("preserves the code and displays a stable API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "AUTH_DEMO_CODE_INVALID",
              message: "演示码错误",
              requestId: "req-auth-1",
            },
          },
          { status: 400 },
        ),
      ),
    );

    render(<LoginExperience nextPath="/me" />);
    const input = screen.getByLabelText("6 位演示码");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "进入演示账号" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("演示码错误");
    expect(input).toHaveValue("123456");
  });
});
