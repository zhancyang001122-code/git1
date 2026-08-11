import type {
  AIOpsDashboard,
  RAGOpsTrendPoint,
} from "@/features/ai-ops/dashboard";

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

export function RAGOpsTrend({
  trend,
  status,
}: {
  trend: readonly RAGOpsTrendPoint[] | null;
  status: DashboardStatus;
}) {
  if (status !== "ready" || !trend) {
    return (
      <section
        aria-label="RAG 近 7 天趋势"
        className="mx-4 mt-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 className="text-base font-semibold text-text">RAG 近 7 天趋势</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {status === "demo"
            ? "Demo 不生成生产 RAG 趋势，避免把预置交互当成线上质量。"
            : "RAG 趋势暂时不可用；请检查最新数据库迁移和服务端配置。"}
        </p>
      </section>
    );
  }

  const maxSearches = Math.max(
    1,
    ...trend.map((point) => point.knowledgeSearches),
  );
  return (
    <section
      aria-label="RAG 近 7 天趋势"
      className="mx-4 mt-4 rounded-feature border border-border bg-surface p-4 shadow-card"
    >
      <h2 className="text-lg font-semibold text-text">RAG 近 7 天趋势</h2>
      <p className="mt-1 text-xs leading-5 text-text-subtle">
        按北京时间汇总真实终态工具记录；没有调用的日期保留为 0。
      </p>
      <ol className="mt-4 space-y-3">
        {trend.map((point) => {
          const successRate = percentage(
            point.knowledgeSuccesses,
            point.knowledgeSearches,
          );
          const width = `${Math.max(
            point.knowledgeSearches === 0 ? 0 : 6,
            (point.knowledgeSearches / maxSearches) * 100,
          )}%`;
          return (
            <li
              key={point.date}
              aria-label={point.date}
              className="rounded-card bg-surface-tint p-3"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <time dateTime={point.date} className="font-medium text-text">
                  {point.date.slice(5)}
                </time>
                <span className="text-text-muted">
                  {point.knowledgeSearches} 次检索 · 成功率 {successRate}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-2 h-2 overflow-hidden rounded-control bg-page"
              >
                <div
                  className="h-full rounded-control bg-brand"
                  style={{ width }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-text-subtle">
                零结果 {point.noResultSearches} · 平均耗时{" "}
                {point.averageDurationMs === null
                  ? "无样本"
                  : `${point.averageDurationMs}ms`}{" "}
                · RAG 反馈 +{point.feedbackUp}/-
                {point.feedbackDown}
              </p>
              <p className="text-xs leading-5 text-text-subtle">
                RAG 评测 {point.evalPassed}/{point.evalRuns} · 新增知识候选{" "}
                {point.candidatesCreated}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
