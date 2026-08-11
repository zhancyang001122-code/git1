import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { ProviderToolCall } from "@/features/agent/provider";
import { ToolExecutor } from "@/features/agent/tools/executor";
import { ToolRegistry } from "@/features/agent/tools/registry";
import type {
  ErasedToolDefinition,
  ToolAuditEntry,
} from "@/features/agent/tools/types";
import { createDemoRepository } from "@/features/business/demo-repository";

import { createToolTestContext } from "./helpers";

function call(name: string, args: unknown): ProviderToolCall {
  return { id: "call-1", name, arguments: JSON.stringify(args) };
}

describe("ToolExecutor", () => {
  it("rejects invalid arguments before calling a repository", async () => {
    const business = createDemoRepository();
    const listHouses = vi.spyOn(business, "listHouses");
    const execution = await new ToolExecutor().execute(
      call("search_houses", {
        city: "杭州",
        near_location: null,
        min_price: null,
        max_price: 3_500,
        room_type: null,
        limit: 50,
      }),
      createToolTestContext({ business }),
    );

    expect(execution).toMatchObject({
      status: "failed",
      result: {
        ok: false,
        error: { code: "TOOL_ARGUMENTS_INVALID", retryable: false },
      },
    });
    expect(listHouses).not.toHaveBeenCalled();
  });

  it("records queued, running and succeeded states with bounded summaries", async () => {
    const audit = {
      record: vi.fn(async (entry: ToolAuditEntry) => {
        void entry;
      }),
    };
    const execution = await new ToolExecutor().execute(
      call("search_deals", {
        query: "火".repeat(200),
        category: null,
        max_price: null,
        refundable_only: null,
        limit: 5,
      }),
      createToolTestContext({ audit }),
    );

    expect(execution.status).toBe("succeeded");
    expect(audit.record.mock.calls.map(([entry]) => entry.status)).toEqual([
      "queued",
      "running",
      "succeeded",
    ]);
    const summary = audit.record.mock.calls[0]![0].inputSummary;
    expect(String(summary.query).length).toBeLessThanOrEqual(81);
    expect(audit.record.mock.calls[2]![0].outputSummary).toEqual({
      ok: true,
      resultCount: 0,
    });
  });

  it("returns a stable timeout and records timed_out", async () => {
    const slowDefinition = {
      name: "search_houses",
      description: "slow",
      strict: true,
      parameters: {},
      publicLabel: "正在查询",
      source: () => "supabase_mock" as const,
      inputSchema: z.object({}).strict(),
      execute: async () => new Promise<never>(() => undefined),
    } as unknown as ErasedToolDefinition;
    const audit = {
      record: vi.fn(async (entry: ToolAuditEntry) => {
        void entry;
      }),
    };
    const execution = await new ToolExecutor({
      registry: new ToolRegistry([slowDefinition]),
      timeoutMs: 5,
    }).execute(call("search_houses", {}), createToolTestContext({ audit }));

    expect(execution).toMatchObject({
      status: "timed_out",
      result: {
        error: { code: "TOOL_TIMEOUT", retryable: true },
      },
    });
    expect(audit.record.mock.calls.at(-1)?.[0].status).toBe("timed_out");
  });

  it("does not expose unknown tool names or let audit failures break results", async () => {
    const executor = new ToolExecutor();
    const unknown = await executor.execute(
      call("drop_database", {}),
      createToolTestContext(),
    );
    expect(unknown.result.error).toMatchObject({ code: "TOOL_NOT_FOUND" });

    const result = await executor.execute(
      call("search_products", {
        query: "牛奶",
        category: null,
        store_id: null,
        max_price: null,
        in_stock_only: true,
        limit: 6,
      }),
      createToolTestContext({
        audit: {
          record: vi.fn(async (entry: ToolAuditEntry) => {
            void entry;
            return Promise.reject(new Error("down"));
          }),
        },
      }),
    );
    expect(result.status).toBe("succeeded");
    expect(result.auditFailed).toBe(true);
  });

  it("audits allowlist rejections without storing sensitive arguments", async () => {
    const audit = {
      record: vi.fn(async (entry: ToolAuditEntry) => {
        void entry;
      }),
    };
    const execution = await new ToolExecutor().execute(
      call("drop_database", { authorization: "Bearer secret", table: "users" }),
      createToolTestContext({ audit }),
    );

    expect(execution.result.error?.code).toBe("TOOL_NOT_FOUND");
    expect(audit.record.mock.calls.map(([entry]) => entry.status)).toEqual([
      "queued",
      "failed",
    ]);
    expect(audit.record.mock.calls[0]?.[0]).toMatchObject({
      toolName: "drop_database",
      inputSummary: { authorization: "[REDACTED]", table: "users" },
    });
    expect(audit.record.mock.calls[1]?.[0].errorCode).toBe("TOOL_NOT_FOUND");
  });

  it("rejects a request that was already cancelled before tool execution", async () => {
    const controller = new AbortController();
    controller.abort(new Error("client disconnected"));
    const business = createDemoRepository();
    const listHouses = vi.spyOn(business, "listHouses");

    await expect(
      new ToolExecutor().execute(
        call("search_houses", {
          city: "杭州",
          near_location: null,
          min_price: null,
          max_price: 3_500,
          room_type: "一居室",
          limit: 5,
        }),
        createToolTestContext({ business, signal: controller.signal }),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_ABORTED" });
    expect(listHouses).not.toHaveBeenCalled();
  });
});
