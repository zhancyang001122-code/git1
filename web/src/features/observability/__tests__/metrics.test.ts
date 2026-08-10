import { describe, expect, it } from "vitest";

import { createMetricsRegistry } from "@/features/observability/metrics";

describe("metrics registry", () => {
  it("keeps aggregate timing values without request payloads", () => {
    const registry = createMetricsRegistry();
    registry.observe("chat_duration_ms", 100);
    registry.observe("chat_duration_ms", 200);
    registry.observe("chat_duration_ms", Number.NaN);

    expect(registry.snapshot()).toEqual({
      chat_duration_ms: { count: 2, average: 150, max: 200 },
    });
  });
});
