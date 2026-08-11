import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginExperience } from "@/components/auth/login-experience";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LoginExperience", () => {
  it("moves from email to a pasteable OTP and follows the safe API redirect", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(
        Response.json({ ok: true, next: "/me/preferences" }),
      );
    const navigate = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginExperience nextPath="/me/preferences" navigate={navigate} />);
    fireEvent.change(screen.getByRole("textbox", { name: "邮箱" }), {
      target: { value: "Learner@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    const otp = await screen.findByLabelText("6 位验证码");
    expect(otp).toHaveAttribute("autocomplete", "one-time-code");
    expect(otp).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByRole("status")).toHaveTextContent(
      "验证码已发送至 learner@example.com",
    );
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/me/preferences"),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      email: "learner@example.com",
      token: "123456",
      next: "/me/preferences",
    });
  });

  it("preserves the email and OTP when verification fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "AUTH_OTP_INVALID",
              message: "验证码错误或已失效",
              requestId: "req-auth-1",
            },
          },
          { status: 400 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginExperience nextPath="/me" />);
    fireEvent.change(screen.getByRole("textbox", { name: "邮箱" }), {
      target: { value: "learner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    const otp = await screen.findByLabelText("6 位验证码");
    fireEvent.change(otp, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "验证码错误或已失效",
    );
    expect(screen.getByText("learner@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("6 位验证码")).toHaveValue("000000");
  });

  it("keeps resend disabled until the visible countdown finishes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true })),
    );

    render(<LoginExperience nextPath="/me" resendSeconds={3} />);
    fireEvent.change(screen.getByRole("textbox", { name: "邮箱" }), {
      target: { value: "learner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    await act(async () => Promise.resolve());

    expect(
      screen.getByRole("button", { name: "3 秒后可重新发送" }),
    ).toBeDisabled();
    act(() => vi.advanceTimersByTime(3_000));
    expect(
      screen.getByRole("button", { name: "重新发送验证码" }),
    ).toBeEnabled();
  });
});
