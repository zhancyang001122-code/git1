"use client";

import {
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  FlaskConical,
  Save,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Tag } from "@/components/ui/tag";
import { Toast } from "@/components/ui/toast";
import type { KnowledgeCandidateRecord } from "@/features/knowledge-ops/repository";
import type { CandidateDraft } from "@/features/knowledge-ops/schemas";

const statusLabels = {
  pending: "待处理",
  drafted: "草稿",
  reviewing: "待审核",
  approved: "已批准",
  rejected: "已驳回",
  published: "已发布",
} as const;

const fieldClass =
  "mt-2 min-h-11 w-full rounded-control border border-border bg-page px-3 text-sm text-text outline-none focus:ring-2 focus:ring-brand";

function defaultDraft(candidate: KnowledgeCandidateRecord): CandidateDraft {
  return (
    candidate.draft ?? {
      title: `${candidate.normalizedQuestion}（模拟草稿）`,
      answerMarkdown: `模拟规则草稿：${candidate.normalizedQuestion}。当前没有真实企业资料，发布前必须补充可核验来源。`,
      changeSummary: "补充当前知识缺口",
      sourceReference: "DEMO-EVIDENCE-REQUIRED",
      owner: "知识运营演示负责人",
      domain: candidate.domain ?? "platform",
      category: "general",
      effectiveFrom: "2026-08-11",
    }
  );
}

export function KnowledgeAdminList({
  candidates,
  isDemo,
}: {
  candidates: readonly KnowledgeCandidateRecord[];
  isDemo: boolean;
}) {
  return (
    <div className="space-y-4 px-4 py-4">
      <DemoNotice>
        {isDemo
          ? "这是受口令保护的服务器内存 Demo Admin；重启后状态会重置，不会写入 Supabase。"
          : "当前为 Live 知识运营模式，所有操作必须保留审核和评测证据。"}
      </DemoNotice>
      <section className="rounded-feature bg-text p-5 text-white">
        <p className="text-xs opacity-70">知识运营闭环</p>
        <h2 className="mt-2 text-xl font-semibold">
          候选 → 审核 → 发布 → 索引 → 评测
        </h2>
        <p className="mt-2 text-sm opacity-75">
          未经批准和索引成功的内容不会进入检索。
        </p>
      </section>
      <section
        aria-label="知识候选"
        className="divide-y divide-border overflow-hidden rounded-card bg-surface"
      >
        {candidates.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">当前没有待处理候选。</p>
        ) : (
          candidates.map((candidate) => (
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
                      {candidate.normalizedQuestion}
                    </strong>
                    <Tag>{statusLabels[candidate.status]}</Tag>
                  </span>
                  <span className="mt-2 block text-xs text-text-muted">
                    {candidate.domain ?? "未分类"} · {candidate.reason} · 出现
                    {candidate.occurrenceCount} 次
                  </span>
                </span>
                <ChevronRight className="size-4 text-text-subtle" />
              </Link>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

type PendingAction = "approve" | "reject" | "publish" | "rollback" | null;

export function KnowledgeAdminDetail({
  candidate,
  isDemo,
}: {
  candidate: KnowledgeCandidateRecord;
  isDemo: boolean;
}) {
  const [draft, setDraft] = useState<CandidateDraft>(defaultDraft(candidate));
  const [status, setStatus] = useState(candidate.status);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [publication, setPublication] = useState<{
    indexStatus: string;
    evaluationStatus: string;
    searchable: boolean;
    rollbackAvailable: boolean;
    warnings: readonly string[];
  } | null>(null);

  function updateDraft<K extends keyof CandidateDraft>(
    key: K,
    value: CandidateDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function request(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: { message?: string };
      [key: string]: unknown;
    };
    if (!response.ok) throw new Error(payload.error?.message ?? "操作失败");
    return payload;
  }

  async function saveDraft() {
    setBusy(true);
    try {
      await request("/api/knowledge/candidates", {
        action: "draft",
        candidateId: candidate.id,
        draft,
      });
      setStatus("drafted");
      setNotice(
        isDemo
          ? "草稿已写入服务器内存 Demo 队列，重启后会重置。"
          : "草稿已保存。",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "草稿保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      if (pendingAction === "approve") {
        await request("/api/knowledge/candidates", {
          action: "review",
          review: {
            candidateId: candidate.id,
            decision: "approve",
            notes: "已核对来源、负责人、分类和生效日期",
            draft,
          },
        });
        setStatus("approved");
        setNotice("候选已批准，但尚未发布或进入检索。");
      } else if (pendingAction === "reject") {
        await request("/api/knowledge/candidates", {
          action: "review",
          review: {
            candidateId: candidate.id,
            decision: "reject",
            notes: "证据不足，驳回本次候选",
          },
        });
        setStatus("rejected");
        setNotice("候选已驳回，不会进入检索。候选记录仍保留。 ");
      } else if (pendingAction === "publish") {
        const result = await request("/api/knowledge/publish", {
          candidateId: candidate.id,
        });
        setStatus("published");
        setPublication({
          indexStatus: String(result.indexStatus),
          evaluationStatus: String(result.evaluationStatus),
          searchable: result.searchable === true,
          rollbackAvailable: result.rollbackAvailable === true,
          warnings: Array.isArray(result.warnings)
            ? result.warnings.map(String)
            : [],
        });
        setNotice(
          result.searchable === true
            ? isDemo
              ? "模拟版本已发布、索引并通过确定性评测；仅在当前服务器进程内可检索。"
              : "版本已发布、索引并完成评测。"
            : "版本已发布但索引失败，当前不可检索。",
        );
      } else {
        const result = await request("/api/knowledge/rollback", {
          candidateId: candidate.id,
        });
        setPublication((current) =>
          current
            ? {
                ...current,
                evaluationStatus: "rolled_back",
                searchable: true,
                rollbackAvailable: false,
                warnings: [],
              }
            : current,
        );
        setNotice(
          `已回滚到上一版本 ${String(result.versionId)}；当前候选版本不再参与检索。`,
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  async function runEvaluation() {
    setBusy(true);
    try {
      const result = await request("/api/knowledge/evaluate", {
        candidateId: candidate.id,
      });
      setNotice(
        `评测完成：${String(result.passedCount)}/${String(result.total)}，得分 ${String(result.score)}${isDemo ? "（确定性演示评测）" : ""}。`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "评测失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 px-4 py-4">
      <DemoNotice>
        {isDemo
          ? "所有状态只保存在服务器内存；模拟发布不会调用千问 Embedding 或写入 Supabase。"
          : "当前操作会写入知识版本与审核记录，请确认来源真实性。"}
      </DemoNotice>
      <section className="rounded-feature bg-text p-5 text-white">
        <p className="text-xs opacity-70">{candidate.id}</p>
        <h2 className="mt-2 text-xl font-semibold">
          {candidate.normalizedQuestion}
        </h2>
        <p className="mt-3 text-sm opacity-80">
          候选 → 审核 → 发布 → 索引 → 评测
        </p>
        <Tag className="mt-3">当前：{statusLabels[status]}</Tag>
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-card">
        <h3 className="text-base font-semibold text-text">触发与证据</h3>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          {candidate.sourceType} · {candidate.reason}
        </p>
        <p className="mt-2 text-xs text-text-subtle">
          仅保存规范化问题和 {candidate.evidence.length} 个证据
          ID；不保存完整对话。
        </p>
      </section>

      <section className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
        <h3 className="text-base font-semibold text-text">
          审核草稿与必填依据
        </h3>
        <label className="block text-sm font-medium text-text">
          标题
          <input
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm font-medium text-text">
          规则正文
          <textarea
            aria-label="规则正文"
            value={draft.answerMarkdown}
            onChange={(event) =>
              updateDraft("answerMarkdown", event.target.value)
            }
            className={`${fieldClass} min-h-36 py-3 leading-6`}
          />
        </label>
        <label className="block text-sm font-medium text-text">
          来源编号或文档引用
          <input
            aria-label="来源编号或文档引用"
            value={draft.sourceReference}
            onChange={(event) =>
              updateDraft("sourceReference", event.target.value)
            }
            className={fieldClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-text">
            负责人
            <input
              value={draft.owner}
              onChange={(event) => updateDraft("owner", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium text-text">
            生效日期
            <input
              type="date"
              value={draft.effectiveFrom}
              onChange={(event) =>
                updateDraft("effectiveFrom", event.target.value)
              }
              className={fieldClass}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-text">
            Domain
            <select
              value={draft.domain}
              onChange={(event) =>
                updateDraft(
                  "domain",
                  event.target.value as CandidateDraft["domain"],
                )
              }
              className={fieldClass}
            >
              <option value="housing">housing</option>
              <option value="group_buy">group_buy</option>
              <option value="market">market</option>
              <option value="platform">platform</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-text">
            Category
            <input
              value={draft.category}
              onChange={(event) => updateDraft("category", event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-text">
          变更说明
          <input
            value={draft.changeSummary}
            onChange={(event) =>
              updateDraft("changeSummary", event.target.value)
            }
            className={fieldClass}
          />
        </label>
        <p className="text-xs text-text-subtle">
          AI 草稿不是事实；批准前必须人工核对来源、负责人和生效日期。
        </p>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() => void saveDraft()}
        >
          <Save className="size-4" />
          保存草稿
        </Button>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button
          aria-label="批准草稿"
          disabled={busy || status === "published"}
          onClick={() => setPendingAction("approve")}
        >
          <CheckCircle2 className="size-4" />
          批准草稿
        </Button>
        <Button
          variant="danger"
          aria-label="驳回草稿"
          disabled={busy || status === "published"}
          onClick={() => setPendingAction("reject")}
        >
          <XCircle className="size-4" />
          驳回草稿
        </Button>
        <Button
          variant="secondary"
          disabled={busy || status !== "approved"}
          onClick={() => setPendingAction("publish")}
        >
          <DatabaseZap className="size-4" />
          发布并索引
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void runEvaluation()}
        >
          <FlaskConical className="size-4" />
          运行评测
        </Button>
        {publication?.rollbackAvailable ? (
          <Button
            variant="danger"
            className="col-span-2"
            disabled={busy}
            onClick={() => setPendingAction("rollback")}
          >
            <Undo2 className="size-4" />
            回滚上一版本
          </Button>
        ) : null}
      </div>

      {publication ? (
        <section className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-card bg-surface-tint p-4">
            <p className="text-text-subtle">索引状态</p>
            <strong className="mt-1 block text-text">
              {publication.indexStatus}
            </strong>
          </div>
          <div className="rounded-card bg-surface-tint p-4">
            <p className="text-text-subtle">回归评测</p>
            <strong className="mt-1 block text-text">
              {publication.evaluationStatus}
            </strong>
          </div>
          <div className="col-span-2 rounded-card bg-surface-tint p-4">
            <p className="text-text-subtle">检索可用</p>
            <strong className="mt-1 block text-text">
              {publication.searchable ? "是" : "否"}
            </strong>
            {publication.warnings.length > 0 ? (
              <p className="mt-2 text-xs text-warning">
                {publication.warnings.join("、")}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

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
        title={
          pendingAction === "approve"
            ? "批准这份草稿？"
            : pendingAction === "reject"
              ? "驳回这份草稿？"
              : pendingAction === "rollback"
                ? "回滚到上一版本？"
                : "发布并索引这个版本？"
        }
        description={
          pendingAction === "publish"
            ? "发布后才会进入索引和评测；索引失败时不会宣称可检索。"
            : pendingAction === "rollback"
              ? "当前候选版本将退出检索，并恢复上一已发布版本。"
              : "审核会保留决策记录，用户原话不会直接成为正式知识。"
        }
        confirmLabel={
          pendingAction === "approve"
            ? "确认批准"
            : pendingAction === "reject"
              ? "确认驳回"
              : pendingAction === "rollback"
                ? "确认回滚"
                : "确认发布"
        }
        danger={pendingAction === "reject" || pendingAction === "rollback"}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}
