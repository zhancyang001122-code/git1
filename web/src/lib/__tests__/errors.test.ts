import { describe, expect, it } from "vitest";

import { AppError, toPublicError } from "@/lib/errors";

describe("public error contract", () => {
  it("preserves safe fields from an application error", () => {
    const error = new AppError({
      code: "SERVICE_TIMEOUT",
      message: "服务暂时响应较慢，请稍后重试",
      status: 504,
      retryable: true,
      cause: new Error("upstream-secret-detail"),
    });

    expect(toPublicError(error, "request-123")).toEqual({
      code: "SERVICE_TIMEOUT",
      message: "服务暂时响应较慢，请稍后重试",
      retryable: true,
      requestId: "request-123",
    });
    expect(error.status).toBe(504);
  });

  it("sanitizes unknown errors instead of exposing their messages", () => {
    const result = toPublicError(
      new Error("database password was leaked here"),
      "request-456",
    );

    expect(result).toEqual({
      code: "INTERNAL_ERROR",
      message: "服务暂时不可用，请稍后重试",
      retryable: false,
      requestId: "request-456",
    });
    expect(JSON.stringify(result)).not.toContain("password");
  });
});
