import { describe, expect, it, vi } from "vitest";

import { createLogger } from "@/lib/logger";

describe("structured logger", () => {
  it("emits JSON diagnostics without secrets or personal data", () => {
    const write = vi.fn();
    const logger = createLogger(write);
    logger.info("chat.completed", {
      requestId: "request-1",
      durationMs: 120,
      apiKey: "secret",
      phone: "13812345678",
    });

    const record = JSON.parse(String(write.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(record).toMatchObject({
      level: "info",
      event: "chat.completed",
      requestId: "request-1",
      durationMs: 120,
      apiKey: "[REDACTED]",
      phone: "[PHONE_REDACTED]",
    });
    expect(JSON.stringify(record)).not.toContain("secret");
    expect(JSON.stringify(record)).not.toContain("13812345678");
  });
});
