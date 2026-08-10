import type { ProviderToolCall } from "@/features/agent/provider";
import {
  createTaskSixToolRegistry,
  type ToolRegistry,
} from "@/features/agent/tools/registry";
import type {
  ToolAuditEntry,
  ToolContext,
  ToolExecution,
  ToolResult,
  ToolRunStatus,
  ToolSource,
} from "@/features/agent/tools/types";
import { AppError } from "@/lib/errors";

const SENSITIVE_FIELD =
  /(?:api[_-]?key|token|authorization|cookie|password|service[_-]?role)/i;

function summarizeValue(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_FIELD.test(key)) return "[REDACTED]";
  if (value === null || typeof value === "number" || typeof value === "boolean")
    return value;
  if (typeof value === "string")
    return value.length <= 80 ? value : `${value.slice(0, 80)}…`;
  if (depth >= 2) return "[NESTED]";
  if (Array.isArray(value))
    return value
      .slice(0, 10)
      .map((item) => summarizeValue(item, key, depth + 1));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([childKey, childValue]) => [
          childKey,
          summarizeValue(childValue, childKey, depth + 1),
        ]),
    );
  return "[UNSUPPORTED]";
}

export function summarizeToolInput(
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return summarizeValue(value) as Readonly<Record<string, unknown>>;
}

function failure(
  source: ToolSource,
  code: string,
  message: string,
  retryable = false,
): ToolResult {
  return {
    ok: false,
    error: { code, message, retryable },
    source,
    resultCount: 0,
  };
}

function normalizedFailure(error: unknown, source: ToolSource): ToolResult {
  if (error instanceof AppError) {
    return failure(source, error.code, error.message, error.retryable);
  }
  return failure(source, "TOOL_EXECUTION_FAILED", "工具暂时不可用", true);
}

interface ToolExecutorOptions {
  registry?: ToolRegistry;
  timeoutMs?: number;
}

export class ToolExecutor {
  readonly registry: ToolRegistry;
  private readonly timeoutMs: number;

  constructor(options: ToolExecutorOptions = {}) {
    this.registry = options.registry ?? createTaskSixToolRegistry();
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async execute(
    call: ProviderToolCall,
    context: ToolContext,
  ): Promise<ToolExecution> {
    if (context.signal.aborted) {
      throw new AppError({
        code: "PROVIDER_ABORTED",
        message: "工具请求已取消",
        cause: context.signal.reason,
      });
    }
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const runId = crypto.randomUUID();
    const definition = this.registry.find(call.name);
    let auditFailed = false;
    let rawInput: unknown;
    try {
      rawInput = JSON.parse(call.arguments);
    } catch (error) {
      void error;
      rawInput = undefined;
    }
    const inputSummary = summarizeToolInput(rawInput);

    if (!definition) {
      const source = "supabase_mock";
      const result = failure(
        source,
        "TOOL_NOT_FOUND",
        "请求的工具不在允许列表中",
      );
      const record = async (
        status: Extract<ToolRunStatus, "queued" | "failed">,
        extras: Partial<ToolAuditEntry> = {},
      ) => {
        try {
          await context.audit.record({
            runId,
            sessionId: context.sessionId,
            messageId: context.messageId,
            requestId: context.requestId,
            toolName: call.name,
            status,
            inputSummary,
            source,
            startedAt,
            ...extras,
          });
        } catch (error) {
          auditFailed = true;
          void error;
        }
      };
      await record("queued");
      const completedAt = new Date().toISOString();
      const durationMs = Math.round(performance.now() - started);
      await record("failed", {
        completedAt,
        durationMs,
        errorCode: result.error?.code,
        outputSummary: { ok: false, resultCount: 0 },
      });
      return {
        callId: call.id,
        toolName: call.name,
        status: "failed",
        result,
        inputSummary,
        startedAt,
        completedAt,
        durationMs,
        auditFailed,
      };
    }

    const source = definition.source(context);

    const audit = async (
      status: ToolRunStatus,
      extras: Partial<ToolAuditEntry> = {},
    ) => {
      try {
        await context.audit.record({
          runId,
          sessionId: context.sessionId,
          messageId: context.messageId,
          requestId: context.requestId,
          toolName: definition.name,
          status,
          inputSummary,
          source,
          startedAt,
          ...extras,
        });
      } catch (error) {
        auditFailed = true;
        void error;
      }
    };

    await audit("queued");
    const parsed = definition.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const result = failure(
        source,
        "TOOL_ARGUMENTS_INVALID",
        "工具参数格式无效",
      );
      const completedAt = new Date().toISOString();
      const durationMs = Math.round(performance.now() - started);
      await audit("failed", {
        completedAt,
        durationMs,
        errorCode: result.error?.code,
        outputSummary: { ok: false, resultCount: 0 },
      });
      return {
        callId: call.id,
        toolName: call.name,
        status: "failed",
        result,
        inputSummary,
        startedAt,
        completedAt,
        durationMs,
        auditFailed,
      };
    }

    await audit("running");
    const toolController = new AbortController();
    const abortFromRequest = () => toolController.abort(context.signal.reason);
    context.signal.addEventListener("abort", abortFromRequest, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      toolController.abort(new Error("tool timeout"));
    }, this.timeoutMs);

    let result: ToolResult;
    let status: ToolRunStatus;
    try {
      const aborted = new Promise<never>((_resolve, reject) => {
        toolController.signal.addEventListener(
          "abort",
          () => reject(toolController.signal.reason),
          { once: true },
        );
      });
      result = await Promise.race([
        definition.execute(parsed.data, {
          ...context,
          signal: toolController.signal,
        }),
        aborted,
      ]);
      status = result.ok ? "succeeded" : "failed";
    } catch (error) {
      if (context.signal.aborted) {
        throw new AppError({
          code: "PROVIDER_ABORTED",
          message: "工具请求已取消",
          cause: context.signal.reason,
        });
      }
      if (timedOut) {
        status = "timed_out";
        result = failure(source, "TOOL_TIMEOUT", "工具响应超时", true);
      } else {
        status = "failed";
        result = normalizedFailure(error, source);
      }
    } finally {
      clearTimeout(timeout);
      context.signal.removeEventListener("abort", abortFromRequest);
    }

    const completedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - started);
    await audit(status, {
      completedAt,
      durationMs,
      ...(result.error && { errorCode: result.error.code }),
      outputSummary: { ok: result.ok, resultCount: result.resultCount },
    });
    return {
      callId: call.id,
      toolName: call.name,
      status,
      result,
      inputSummary,
      startedAt,
      completedAt,
      durationMs,
      auditFailed,
    };
  }
}
