import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Database,
  MapPinned,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";

import { DetailShell } from "@/components/layout/detail-shell";
import { Tag } from "@/components/ui/tag";

const flagshipPrompt =
  "我预算3500元，想找武林广场附近的一居室。请查询2024年历史房源，再找附近的地铁和超市，并说明签约前需要核验哪些信息、是否需要办理网签备案。";

const flow = [
  {
    icon: Database,
    title: "筛选历史房源",
    detail: "结构化条件进入 Supabase，不用向量检索替代精确筛选。",
  },
  {
    icon: MapPinned,
    title: "核验周边条件",
    detail: "地点、POI 和步行路线来自高德，失败时不猜测距离。",
  },
  {
    icon: BookOpenCheck,
    title: "检索签约依据",
    detail: "RAG 只引用已发布、有效且标明来源版本的知识片段。",
  },
  {
    icon: ShieldCheck,
    title: "合并并说明边界",
    detail: "千问组织回答，但房态、距离和政策事实仍由工具负责。",
  },
] as const;

export function CaseStudyPage() {
  return (
    <DetailShell title="交付案例" backHref="/">
      <div className="space-y-4 px-4 py-4">
        <section className="glass-panel overflow-hidden rounded-feature bg-gradient-to-br from-brand-soft/90 to-accent/10 p-5">
          <Tag className="bg-white/75">FDE / AI 解决方案作品</Tag>
          <h1 className="mt-3 text-2xl font-bold leading-8 text-text">
            小智租房决策助手
          </h1>
          <p className="mt-2 text-sm leading-[22px] text-text-muted">
            把分散的历史房源、地图服务和租赁知识，组织成一次可解释、可追溯的租房决策任务。
          </p>
          <Link
            href={`/xiaozhi/chat?q=${encodeURIComponent(flagshipPrompt)}`}
            className="ui-interactive mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-brand bg-brand px-4 text-sm font-semibold text-white outline-none hover:bg-brand-strong"
          >
            立即运行主演示
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>

        <section
          aria-labelledby="problem-title"
          className="glass-panel rounded-card p-4"
        >
          <p className="text-xs font-semibold text-brand">01 · 问题判断</p>
          <h2 id="problem-title" className="mt-1 text-lg font-bold text-text">
            用户缺的不是另一个房源列表
          </h2>
          <p className="mt-2 text-sm leading-[22px] text-text-muted">
            租房决策同时包含精确筛选、地点核验和规则理解。把三类事实都交给大模型生成，会让历史房源被误认为当前可租，也会产生虚假的距离和政策结论。
          </p>
        </section>

        <section aria-labelledby="evidence-title" className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-brand">02 · 当前证据</p>
            <h2
              id="evidence-title"
              className="mt-1 text-lg font-bold text-text"
            >
              能运行，也明确哪些还没证明
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <EvidenceMetric value="60,202" label="历史房源记录" />
            <EvidenceMetric value="20 / 20" label="现有 RAG 固定评测" />
            <EvidenceMetric value="Live" label="Supabase / 千问 / 高德" />
            <EvidenceMetric value="2024-11" label="房源数据期次" />
          </div>
        </section>

        <section aria-labelledby="flow-title" className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-brand">03 · 薄切片方案</p>
            <h2 id="flow-title" className="mt-1 text-lg font-bold text-text">
              四步完成一个可核验任务
            </h2>
          </div>
          <ol className="space-y-2">
            {flow.map(({ detail, icon: Icon, title }, index) => (
              <li
                key={title}
                className="glass-panel flex gap-3 rounded-card p-3"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {index + 1}. {title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    {detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="boundary-title"
          className="rounded-card border border-warning/35 bg-warning/10 p-4"
        >
          <h2
            id="boundary-title"
            className="flex items-center gap-2 text-sm font-semibold text-text"
          >
            <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
            真实边界
          </h2>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-text-muted">
            <li className="flex gap-2">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-success"
              />
              工程链路和线上服务已验证，历史房源不冒充当前房态。
            </li>
            <li className="flex gap-2">
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0 text-warning"
              />
              尚未完成真实用户效率验证，因此不宣称节省了多少时间或提升了多少转化。
            </li>
          </ul>
        </section>
      </div>
    </DetailShell>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="glass-panel rounded-card p-3">
      <p className="text-lg font-bold text-brand">{value}</p>
      <p className="mt-1 text-xs leading-5 text-text-muted">{label}</p>
    </article>
  );
}
