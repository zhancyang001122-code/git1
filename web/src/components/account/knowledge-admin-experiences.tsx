"use client";

import {
  CheckCircle2,
  ChevronRight,
  DatabaseZap,
  FilePlus2,
  FlaskConical,
  Save,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Tag } from "@/components/ui/tag";
import { Toast } from "@/components/ui/toast";
import type { KnowledgeCandidateRecord } from "@/features/knowledge-ops/repository";
import type { CandidateDraft } from "@/features/knowledge-ops/schemas";
import type { KnowledgeMaterialKind } from "@/features/knowledge/types";

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

interface ManualMaterialForm {
  question: string;
  title: string;
  answerMarkdown: string;
  materialKind: KnowledgeMaterialKind;
  sourceReference: string;
  owner: string;
  domain: CandidateDraft["domain"];
  category: string;
  versionLabel: string;
  effectiveFrom: string;
  effectiveUntil: string;
  changeSummary: string;
}

const emptyMaterial: ManualMaterialForm = {
  question: "",
  title: "",
  answerMarkdown: "",
  materialKind: "external_authorized",
  sourceReference: "",
  owner: "",
  domain: "housing",
  category: "",
  versionLabel: "",
  effectiveFrom: "",
  effectiveUntil: "",
  changeSummary: "",
};

export function KnowledgeMaterialIntake({ isDemo }: { isDemo: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<ManualMaterialForm>(emptyMaterial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);

  function update<K extends keyof ManualMaterialForm>(
    key: K,
    value: ManualMaterialForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setCandidateId(null);
    try {
      const response = await fetch("/api/knowledge/candidates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_draft",
          material: {
            question: form.question,
            draft: {
              title: form.title,
              answerMarkdown: form.answerMarkdown,
              materialKind: form.materialKind,
              sourceReference: form.sourceReference,
              owner: form.owner,
              domain: form.domain,
              category: form.category,
              versionLabel: form.versionLabel,
              effectiveFrom: form.effectiveFrom,
              ...(form.effectiveUntil && {
                effectiveUntil: form.effectiveUntil,
              }),
              changeSummary: form.changeSummary,
            },
          },
        }),
      });
      const payload = (await response.json()) as {
        candidate?: { id?: string };
        deduplicated?: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.candidate?.id) {
        throw new Error(payload.error?.message ?? "材料录入失败");
      }
      setCandidateId(payload.candidate.id);
      setNotice(
        payload.deduplicated
          ? "已更新同一代表问题的现有草稿；尚未发布，也不能被检索。"
          : isDemo
            ? "已保存为服务器内存草稿；尚未发布，也不能被检索。"
            : "已保存为草稿；尚未发布，也不能被检索。",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "材料录入失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-4 mt-4 rounded-feature border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
          <FilePlus2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text">录入正式资料</h2>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            只创建待审核草稿，不会自动发布、索引或进入回答。
          </p>
        </div>
        <Button
          variant="secondary"
          aria-expanded={expanded}
          aria-controls="knowledge-material-intake-form"
          onClick={() => setExpanded((current) => !current)}
          className="shrink-0 px-3"
        >
          {expanded ? "收起" : "录入"}
        </Button>
      </div>
      {expanded ? (
        <form
          id="knowledge-material-intake-form"
          className="mt-4 space-y-3"
          onSubmit={(event) => void submit(event)}
        >
          <label className="block text-sm font-medium text-text">
            代表问题
            <input
              aria-label="代表问题"
              required
              minLength={2}
              maxLength={500}
              value={form.question}
              onChange={(event) => update("question", event.target.value)}
              className={fieldClass}
              placeholder="例如：历史房源能代表当前可租状态吗？"
            />
          </label>
          <label className="block text-sm font-medium text-text">
            材料标题
            <input
              aria-label="材料标题"
              required
              minLength={2}
              maxLength={160}
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium text-text">
            材料正文
            <textarea
              aria-label="材料正文"
              required
              minLength={10}
              maxLength={20_000}
              value={form.answerMarkdown}
              onChange={(event) => update("answerMarkdown", event.target.value)}
              className={`${fieldClass} min-h-36 py-3 leading-6`}
            />
          </label>
          <label className="block text-sm font-medium text-text">
            资料性质
            <select
              aria-label="资料性质"
              value={form.materialKind}
              onChange={(event) =>
                update(
                  "materialKind",
                  event.target.value as KnowledgeMaterialKind,
                )
              }
              className={fieldClass}
            >
              <option value="external_authorized">外部授权正式资料</option>
              <option value="public_official">官方公开资料</option>
              <option value="portfolio_first_party">作品集首方公开说明</option>
              <option value="demo">虚构演示资料</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-text">
            来源文件或编号
            <input
              aria-label="来源文件或编号"
              required
              minLength={3}
              maxLength={500}
              value={form.sourceReference}
              onChange={(event) =>
                update("sourceReference", event.target.value)
              }
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-text">
              内容负责人
              <input
                aria-label="内容负责人"
                required
                minLength={2}
                maxLength={120}
                value={form.owner}
                onChange={(event) => update("owner", event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-text">
              版本号
              <input
                aria-label="版本号"
                required
                maxLength={80}
                value={form.versionLabel}
                onChange={(event) => update("versionLabel", event.target.value)}
                className={fieldClass}
                placeholder="v1.0"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-text">
              业务领域
              <select
                aria-label="业务领域"
                value={form.domain}
                onChange={(event) =>
                  update(
                    "domain",
                    event.target.value as CandidateDraft["domain"],
                  )
                }
                className={fieldClass}
              >
                <option value="housing">房源</option>
                <option value="group_buy">团购</option>
                <option value="market">超市</option>
                <option value="platform">平台</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-text">
              分类标识
              <input
                aria-label="分类标识"
                required
                pattern="[a-z][a-z0-9_-]{1,79}"
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
                className={fieldClass}
                placeholder="data_freshness"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-text">
              生效日期
              <input
                aria-label="生效日期"
                type="date"
                required
                value={form.effectiveFrom}
                onChange={(event) =>
                  update("effectiveFrom", event.target.value)
                }
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-text">
              失效日期（可选）
              <input
                aria-label="失效日期（可选）"
                type="date"
                min={form.effectiveFrom || undefined}
                value={form.effectiveUntil}
                onChange={(event) =>
                  update("effectiveUntil", event.target.value)
                }
                className={fieldClass}
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-text">
            变更说明
            <input
              aria-label="变更说明"
              required
              minLength={2}
              maxLength={500}
              value={form.changeSummary}
              onChange={(event) => update("changeSummary", event.target.value)}
              className={fieldClass}
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            <Save className="size-4" />
            {busy ? "正在保存…" : "保存为待审核草稿"}
          </Button>
        </form>
      ) : null}
      {notice ? (
        <div
          className="mt-3 rounded-control bg-brand-soft p-3 text-sm leading-6 text-text"
          role="status"
        >
          <p>{notice}</p>
          {candidateId ? (
            <Link
              href={`/knowledge-admin/${candidateId}`}
              className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand"
            >
              进入审核
              <ChevronRight className="ml-1 size-4" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function defaultDraft(candidate: KnowledgeCandidateRecord): CandidateDraft {
  return (
    candidate.draft ?? {
      title: `${candidate.normalizedQuestion}（模拟草稿）`,
      answerMarkdown: `模拟规则草稿：${candidate.normalizedQuestion}。当前没有真实企业资料，发布前必须补充可核验来源。`,
      materialKind: "demo",
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
                className="ui-interactive flex min-h-20 items-center gap-3 border border-transparent p-4 outline-none hover:bg-brand-soft/60"
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
    versionId: string;
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
          versionId: String(result.versionId),
          indexStatus: String(result.indexStatus),
          evaluationStatus: String(result.evaluationStatus),
          searchable: result.searchable === true,
          rollbackAvailable: result.rollbackAvailable === true,
          warnings: Array.isArray(result.warnings)
            ? result.warnings.map(String)
            : [],
        });
        setNotice(
          result.indexStatus === "queued"
            ? "版本已发布并进入持久化索引队列；Worker 完成前不会标记为可检索。"
            : result.searchable === true
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

  async function runIndexWorker() {
    setBusy(true);
    try {
      const result = await request("/api/internal/knowledge-index-worker", {});
      const workerStatus = String(result.status);
      if (
        workerStatus !== "idle" &&
        String(result.versionId) !== publication?.versionId
      ) {
        setNotice(
          "已先处理队列中更早的索引任务；当前版本仍在排队，可再次点击处理。",
        );
        return;
      }
      if (workerStatus === "succeeded") {
        const finalization =
          typeof result.finalization === "object" &&
          result.finalization !== null
            ? (result.finalization as Record<string, unknown>)
            : {};
        setPublication({
          versionId: String(result.versionId),
          indexStatus: "ready",
          evaluationStatus: String(finalization.evaluationStatus ?? "not_run"),
          searchable: finalization.searchable === true,
          rollbackAvailable: finalization.rollbackAvailable === true,
          warnings: Array.isArray(finalization.warnings)
            ? finalization.warnings.map(String)
            : [],
        });
        setNotice("索引任务已完成，页面状态已更新。");
      } else if (workerStatus === "idle") {
        setNotice("当前没有等待处理的索引任务。");
      } else {
        setPublication((current) =>
          current
            ? {
                ...current,
                indexStatus: workerStatus === "retrying" ? "queued" : "failed",
                warnings: [String(result.errorCode ?? "INDEXING_FAILED")],
              }
            : current,
        );
        setNotice(
          workerStatus === "retrying"
            ? "索引暂时失败，任务已按退避策略重新排队。"
            : "索引任务已达到重试上限，请检查外部服务和任务错误码。",
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "索引任务处理失败");
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
            版本号
            <input
              aria-label="版本号"
              value={draft.versionLabel ?? ""}
              onChange={(event) =>
                updateDraft("versionLabel", event.target.value || undefined)
              }
              className={fieldClass}
              placeholder="未填写时按系统版本递增"
            />
          </label>
          <label className="block text-sm font-medium text-text">
            失效日期（可选）
            <input
              aria-label="失效日期（可选）"
              type="date"
              min={draft.effectiveFrom}
              value={draft.effectiveUntil ?? ""}
              onChange={(event) =>
                updateDraft("effectiveUntil", event.target.value || undefined)
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
          {isDemo ? "发布并索引" : "发布并排队索引"}
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
        <section className="grid grid-cols-2 gap-3 text-sm" aria-live="polite">
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
          {!isDemo && publication.indexStatus === "queued" ? (
            <Button
              variant="secondary"
              className="col-span-2 w-full"
              disabled={busy}
              onClick={() => void runIndexWorker()}
            >
              <DatabaseZap className="size-4" />
              立即处理索引任务
            </Button>
          ) : null}
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
            ? isDemo
              ? "Demo 会在当前请求内完成确定性索引和评测。"
              : "发布与持久化入队在同一数据库事务内完成；Worker 成功前不会宣称可检索。"
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
