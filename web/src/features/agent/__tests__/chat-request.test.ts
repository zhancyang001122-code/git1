import { describe, expect, it } from "vitest";

import { chatRequestSchema } from "@/features/agent/chat-request";

describe("chatRequestSchema", () => {
  it("trims a valid request and applies the debug default", () => {
    expect(chatRequestSchema.parse({ message: "  你好，小智  " })).toEqual({
      message: "你好，小智",
      debug: false,
    });
  });

  it("rejects unknown fields and invalid coordinates", () => {
    expect(
      chatRequestSchema.safeParse({ message: "你好", promptOverride: "unsafe" })
        .success,
    ).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        message: "你好",
        location: { longitude: 181, latitude: 30 },
      }).success,
    ).toBe(false);
  });
});
