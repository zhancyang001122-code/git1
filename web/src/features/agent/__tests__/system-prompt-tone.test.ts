import { describe, expect, it } from "vitest";

import { XIAOZHI_SYSTEM_PROMPT } from "@/features/agent/system-prompt";

describe("Xiaozhi conversation tone", () => {
  it("stays friendly and practical without adopting a scripted customer-service voice", () => {
    expect(XIAOZHI_SYSTEM_PROMPT).toContain("亲切自然");
    expect(XIAOZHI_SYSTEM_PROMPT).toContain("先给结论或下一步");
    expect(XIAOZHI_SYSTEM_PROMPT).toContain("不卖萌");
    expect(XIAOZHI_SYSTEM_PROMPT).toContain("不使用“亲”");
  });
});
