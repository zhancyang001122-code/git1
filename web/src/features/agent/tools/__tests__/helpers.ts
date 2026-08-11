import { vi } from "vitest";

import type { ToolAuditEntry, ToolContext } from "@/features/agent/tools/types";
import { createDemoRepository } from "@/features/business/demo-repository";
import { FakeMapsService } from "@/features/maps/fake-adapter";
import { FakeKnowledgeService } from "@/features/knowledge/fake-service";

export function createToolTestContext(
  overrides: Partial<ToolContext> = {},
): ToolContext {
  return {
    business: createDemoRepository(),
    maps: new FakeMapsService(),
    knowledge: new FakeKnowledgeService(),
    memory: {
      getPreferences: vi.fn(async () => null),
      upsertPreferences: vi.fn(async () => {
        throw new Error("not configured");
      }),
      deletePreferences: vi.fn(async () => {
        throw new Error("not configured");
      }),
    },
    audit: {
      record: vi.fn(async (entry: ToolAuditEntry) => {
        void entry;
      }),
    },
    businessSource: "supabase_mock",
    userId: null,
    sessionId: "71000000-0000-0000-0000-000000000001",
    messageId: "72000000-0000-0000-0000-000000000001",
    requestId: "73000000-0000-0000-0000-000000000001",
    signal: new AbortController().signal,
    ...overrides,
  };
}
