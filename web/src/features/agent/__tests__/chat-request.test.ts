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

  it("requires the complete selected-location payload as one trusted unit", () => {
    const complete = {
      message: "附近有什么超市",
      location: { longitude: 120.163102, latitude: 30.274085 },
      locationWgs84: { longitude: 120.1585, latitude: 30.2764 },
      locationLabel: "杭州 · 武林广场",
      locationCity: "杭州",
    };

    expect(chatRequestSchema.safeParse(complete).success).toBe(true);
    expect(
      chatRequestSchema.safeParse({ ...complete, locationWgs84: undefined })
        .success,
    ).toBe(false);
  });
});
