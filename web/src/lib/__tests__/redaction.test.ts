import { describe, expect, it } from "vitest";

import { redactForLogs } from "@/lib/redaction";

describe("redactForLogs", () => {
  it("removes secrets, phone numbers and precise addresses while preserving diagnostics", () => {
    expect(
      redactForLogs({
        requestId: "request-1",
        apiKey: "secret-key",
        authorization: "Bearer secret",
        nested: { service_role: "role-secret", phone: "13812345678" },
        preciseAddress: "杭州市某区某路 18 号 3 单元",
        resultCount: 3,
      }),
    ).toEqual({
      requestId: "request-1",
      apiKey: "[REDACTED]",
      authorization: "[REDACTED]",
      nested: { service_role: "[REDACTED]", phone: "[PHONE_REDACTED]" },
      preciseAddress: "[ADDRESS_REDACTED]",
      resultCount: 3,
    });
  });

  it("redacts sensitive strings nested in arrays", () => {
    expect(redactForLogs(["联系 13900001111", { password: "123456" }])).toEqual(
      ["联系 [PHONE_REDACTED]", { password: "[REDACTED]" }],
    );
  });
});
