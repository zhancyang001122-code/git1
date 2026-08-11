import type { AIOpsDashboard } from "@/features/ai-ops/dashboard";

type DashboardStatus = "ready" | "demo" | "unavailable";

function percentage(success: number, total: number): string {
  if (total === 0) return "暂无样本";
  return `${((success / total) * 100).toFixed(1)}%`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-card bg-surface-tint p-4">
      <dt className="text-xs text-text-subtle">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-text">{value}</dd>
      <dd className="mt-1 text-xs leading-5 text-text-muted">{detail}</dd>
    </div>
  );
}

export function AIOpsOverview({
  dashboard,
  status,
}: {
  dashboard: AIOpsDashboard | null;
  status: DashboardStatus;
}) {
  if (status !== "ready" || !dashboard) {
    return (
      <section
        aria-label="AI Ops 近 7 天概览"
        className="mx-4 mt-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 className="text-base font-semibold text-text">
          AI Ops 近 7 天概览
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {status === "demo"
            ? "Demo 不读取集中式 AI Ops 数据，避免把内存演示值伪装成真实运营指标。"
            : "集中式 AI Ops 汇总暂时不可用；知识审核仍可继续，稍后再检查数据库迁移和服务端配置。"}
        </p>
      </section>
    );
  }

  const toolSuccesses = dashboard.toolRuns - dashboard.toolFailures;
  const usefulFeedback = dashboard.feedbackUp + dashboard.feedbackDown;
  return (
    <section
      aria-label="AI Ops 近 7 天概览"
      className="mx-4 mt-4 rounded-feature border border-border bg-surface p-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-brand">受控管理视图</p>
          <h2 className="mt-1 text-lg font-semibold text-text">
            AI Ops 近 7 天概览
          </h2>
        </div>
        <span className="rounded-control bg-success/10 px-2 py-1 text-xs text-success">
          Live 数据
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label="对话使用"
          value={dashboard.assistantMessages.toLocaleString("zh-CN")}
          detail={`${dashboard.sessions.toLocaleString("zh-CN")} 个会话 / assistant 消息`}
        />
        <Metric
          label="模型 Token"
          value={(
            dashboard.inputTokens + dashboard.outputTokens
          ).toLocaleString("zh-CN")}
          detail={`输入 ${dashboard.inputTokens.toLocaleString("zh-CN")} / 输出 ${dashboard.outputTokens.toLocaleString("zh-CN")}`}
        />
        <Metric
          label="工具成功率"
          value={percentage(toolSuccesses, dashboard.toolRuns)}
          detail={`${dashboard.toolRuns.toLocaleString("zh-CN")} 次调用，${dashboard.toolFailures.toLocaleString("zh-CN")} 次失败或超时`}
        />
        <Metric
          label="反馈有用率"
          value={percentage(dashboard.feedbackUp, usefulFeedback)}
          detail={`${dashboard.feedbackUp.toLocaleString("zh-CN")} 赞 / ${dashboard.feedbackDown.toLocaleString("zh-CN")} 踩`}
        />
        <Metric
          label="RAG 检索"
          value={dashboard.knowledgeSearches.toLocaleString("zh-CN")}
          detail={`${dashboard.knowledgeSearchFailures.toLocaleString("zh-CN")} 次失败或超时`}
        />
        <Metric
          label="回归评测"
          value={percentage(dashboard.evalPassed, dashboard.evalRuns)}
          detail={`${dashboard.evalPassed.toLocaleString("zh-CN")} / ${dashboard.evalRuns.toLocaleString("zh-CN")} 通过`}
        />
        <Metric
          label="知识缺口"
          value={dashboard.candidatesCreated.toLocaleString("zh-CN")}
          detail="统计窗口内新增候选"
        />
        <Metric
          label="可用知识"
          value={dashboard.readyChunks.toLocaleString("zh-CN")}
          detail={`${dashboard.publishedVersions.toLocaleString("zh-CN")} 个发布版本，其中 ${dashboard.demoPublishedVersions.toLocaleString("zh-CN")} 个为 Demo`}
        />
      </dl>

      <p className="mt-3 text-xs leading-5 text-text-subtle">
        未配置模型价格，不估算人民币成本；Token 是实际记录值，不等于账单金额。
      </p>
    </section>
  );
}
