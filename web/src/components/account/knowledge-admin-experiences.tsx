"use client";

import {
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  FlaskConical,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Tag } from "@/components/ui/tag";
import { Toast } from "@/components/ui/toast";
import {
  demoKnowledgeCandidates,
  type DemoKnowledgeCandidate,
} from "@/features/account/demo-knowledge-data";

const statusLabels = {
  reviewing: "待审核",
  draft: "草稿",
  rejected: "已驳回",
} as const;

export function KnowledgeAdminList() {
  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>
        这是作品集中的 Demo Admin；生产环境必须使用独立后台、登录和 RBAC。
      </DemoNotice>
      <section className="rounded-feature bg-text p-5 text-white">
        <p className="text-xs opacity-70">知识运营闭环</p>
        <h2 className="mt-2 text-xl font-semibold">
          候选 → 审核 → 发布 → 索引 → 评测
        </h2>
        <p className="mt-2 text-sm opacity-75">
          当前只演示工作流，不执行数据库写入或向量化。
        </p>
      </section>
      <section
        aria-label="知识候选"
        className="divide-y divide-border overflow-hidden rounded-card bg-surface"
      >
        {demoKnowledgeCandidates.map((candidate) => (
          <article key={candidate.id} className="bg-surface">
            <Link
              href={`/knowledge-admin/${candidate.id}`}
              className="flex min-h-20 items-center gap-3 p-4 outline-none hover:bg-page focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-control bg-brand-soft text-brand">
                <ShieldCheck className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <strong className="truncate text-sm text-text">
                    {candidate.title}
                  </strong>
                  <Tag>{statusLabels[candidate.status]}</Tag>
                </span>
                <span className="mt-2 block text-xs text-text-muted">
                  {candidate.domain} · {candidate.trigger}
                </span>
              </span>
              <ChevronRight className="size-4 text-text-subtle" />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}

export function KnowledgeAdminDetail({
  candidate,
}: {
  candidate: DemoKnowledgeCandidate;
}) {
  const [draft, setDraft] = useState(candidate.draft);
  const [state, setState] = useState<string>(statusLabels[candidate.status]);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    next: string;
    message: string;
    danger?: boolean;
  } | null>(null);
  function act(next: string, text: string) {
    setState(next);
    setNotice(text);
  }
  return (
    <div className="space-y-5 px-4 py-4">
      <DemoNotice>
        所有审核、发布、索引和评测按钮都只更新当前页面状态。
      </DemoNotice>
      <section className="rounded-feature bg-text p-5 text-white">
        <p className="text-xs opacity-70">{candidate.id}</p>
        <h2 className="mt-2 text-xl font-semibold">{candidate.title}</h2>
        <p className="mt-3 text-sm opacity-80">
          候选 → 审核 → 发布 → 索引 → 评测
        </p>
        <Tag className="mt-3">当前：{state}</Tag>
      </section>
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <h3 className="text-base font-semibold text-text">触发上下文</h3>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {candidate.trigger}
        </p>
        <p className="mt-2 text-xs text-text-subtle">
          证据：{candidate.evidence}
        </p>
      </section>
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <h3 className="text-base font-semibold text-text">当前知识</h3>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {candidate.currentKnowledge}
        </p>
      </section>
      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <label
          className="text-base font-semibold text-text"
          htmlFor="candidate-draft"
        >
          AI 辅助草稿
        </label>
        <textarea
          id="candidate-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-3 min-h-36 w-full rounded-control border border-border p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="mt-2 text-xs text-text-subtle">
          草稿不是事实，必须核验证据后人工决定。
        </p>
      </section>
      <div className="grid grid-cols-2 gap-2">
        <Button
          aria-label="批准草稿"
          onClick={() =>
            setPendingAction({
              title: "批准这份草稿？",
              description: "请先核对证据。确认后只更新当前页面的演示状态。",
              confirmLabel: "确认批准",
              next: "已批准",
              message: "本地状态已更新为“已批准”，尚未发布。",
            })
          }
        >
          <CheckCircle2 className="size-4" />
          批准草稿
        </Button>
        <Button
          variant="danger"
          aria-label="驳回草稿"
          onClick={() =>
            setPendingAction({
              title: "驳回这份草稿？",
              description: "确认后只更新当前页面，不会删除候选知识。",
              confirmLabel: "确认驳回",
              next: "已驳回",
              message: "本地状态已更新为“已驳回”。",
              danger: true,
            })
          }
        >
          <XCircle className="size-4" />
          驳回草稿
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setPendingAction({
              title: "发布这个演示版本？",
              description: "不会生成正式知识版本，也不会影响线上回答。",
              confirmLabel: "确认发布",
              next: "发布演示",
              message: "仅演示发布步骤，没有生成正式版本。",
            })
          }
        >
          <ShieldCheck className="size-4" />
          发布演示
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setPendingAction({
              title: "开始演示索引？",
              description: "不会调用 Embedding 模型，也不会写入数据库。",
              confirmLabel: "确认索引",
              next: "索引演示",
              message: "未调用 embedding 模型，索引状态没有写入数据库。",
            })
          }
        >
          <DatabaseZap className="size-4" />
          索引演示
        </Button>
      </div>
      <Button
        variant="secondary"
        className="w-full"
        onClick={() =>
          act(
            "评测演示",
            "回归评测仅展示固定演示结果：引用正确率 92%，未执行真实评测。",
          )
        }
      >
        <FlaskConical className="size-4" />
        运行演示评测
      </Button>
      <Toast
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice ?? ""}
        duration={0}
        tone="neutral"
      />
      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title={pendingAction?.title ?? "确认操作"}
        description={pendingAction?.description ?? ""}
        confirmLabel={pendingAction?.confirmLabel ?? "确认"}
        danger={pendingAction?.danger}
        onConfirm={() => {
          if (!pendingAction) return;
          act(pendingAction.next, pendingAction.message);
        }}
      />
      <section className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-card bg-surface-tint p-4">
          <p className="text-text-subtle">Embedding</p>
          <strong className="mt-1 block text-text">
            {candidate.embeddingStatus}
          </strong>
        </div>
        <div className="rounded-card bg-surface-tint p-4">
          <p className="text-text-subtle">回归评测</p>
          <strong className="mt-1 block text-text">
            {candidate.evalScore ?? "未运行"}
          </strong>
        </div>
      </section>
    </div>
  );
}
