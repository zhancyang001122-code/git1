import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { createCircuitBreaker, retryTransient } from "@/lib/resilience";

describe("resilience helpers", () => {
  it("retries one idempotent transient failure but not validation errors", async () => {
    const transient = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new AppError({ code: "UPSTREAM", message: "up", retryable: true }),
      )
      .mockResolvedValue("ok");
    await expect(
      retryTransient(transient, { retries: 1, jitterMs: () => 0 }),
    ).resolves.toBe("ok");
    expect(transient).toHaveBeenCalledTimes(2);

    const invalid = vi.fn(async () => {
      throw new AppError({ code: "INVALID", message: "invalid", status: 400 });
    });
    await expect(
      retryTransient(invalid, { retries: 1, jitterMs: () => 0 }),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(invalid).toHaveBeenCalledOnce();
  });

  it("opens after repeated failures and closes after the cooldown", async () => {
    let now = 0;
    const breaker = createCircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 1_000,
      now: () => now,
    });
    const failing = async () => {
      throw new Error("down");
    };

    await expect(breaker.execute(failing)).rejects.toThrow("down");
    await expect(breaker.execute(failing)).rejects.toThrow("down");
    await expect(breaker.execute(async () => "ok")).rejects.toMatchObject({
      code: "CIRCUIT_OPEN",
    });
    now = 1_001;
    await expect(breaker.execute(async () => "ok")).resolves.toBe("ok");
  });

  it("does not count validation or authorization errors toward the circuit", async () => {
    const breaker = createCircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 1_000,
    });

    await expect(
      breaker.execute(async () => {
        throw new AppError({
          code: "UNAUTHORIZED",
          message: "unauthorized",
          status: 401,
        });
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(breaker.execute(async () => "ok")).resolves.toBe("ok");
  });
});
