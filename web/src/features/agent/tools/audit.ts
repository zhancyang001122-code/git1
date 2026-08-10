import type { AIOpsRepository } from "@/features/ai-ops/repository";
import type { ToolAuditSink, ToolSource } from "@/features/agent/tools/types";

const sourceLabels: Record<ToolSource, string> = {
  housing_history_2024: "2024 历史房源数据",
  supabase_mock: "演示业务数据",
  amap: "高德地图",
  user_memory: "用户授权偏好",
};

export function createAIOpsToolAudit(
  repository: AIOpsRepository,
): ToolAuditSink {
  return {
    async record(entry) {
      await repository.recordToolRun({
        sessionId: entry.sessionId,
        messageId: entry.messageId,
        toolName: entry.toolName,
        status: entry.status,
        input: {
          runId: entry.runId,
          arguments: entry.inputSummary,
        },
        outputSummary: entry.outputSummary ?? null,
        sourceLabel: sourceLabels[entry.source],
        durationMs: entry.durationMs ?? null,
        errorCode: entry.errorCode ?? null,
        requestId: entry.requestId,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt ?? null,
      });
    },
  };
}

export function createInMemoryToolAudit(): ToolAuditSink {
  return { async record() {} };
}
