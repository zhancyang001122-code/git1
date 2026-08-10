"use client";

import {
  Bot,
  Bug,
  CheckCircle2,
  Send,
  Square,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SourceBadge, type SourceCode } from "@/components/ui/source-badge";
import type { ChatContext } from "@/features/chat/chat-context";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  source?: SourceCode;
}

function scriptedResult(prompt: string): {
  progress: string;
  answer: string;
  source: SourceCode;
} {
  if (/房|租|猫|宠物/.test(prompt))
    return {
      progress: "正在查询演示房源",
      answer:
        "本地脚本演示已完成：可以优先查看 3500 元以内、记录允许宠物的历史房源。请注意，这不是当前可租结论。",
      source: "housing_history_2024",
    };
  if (/团购|退款/.test(prompt))
    return {
      progress: "正在查询演示团购与规则",
      answer:
        "本地脚本演示已完成：团购价格是演示数据，退款结论仍需正式知识库依据。",
      source: "supabase_mock",
    };
  if (/商品|买菜|采购|库存/.test(prompt))
    return {
      progress: "正在查询演示商品库存",
      answer:
        "本地脚本演示已完成：已按演示库存整理可选商品，结算不会产生真实订单。",
      source: "supabase_mock",
    };
  return {
    progress: "正在整理本地演示信息",
    answer: "本地脚本演示已完成：真实位置、距离和路线需要接入高德后才能回答。",
    source: "supabase_mock",
  };
}

export function ChatExperience({
  conversationId,
  initialContext,
}: {
  conversationId?: string;
  initialContext: ChatContext;
}) {
  const [input, setInput] = useState(initialContext.prompt ?? "");
  const [messages, setMessages] = useState<Message[]>(
    conversationId
      ? [
          { id: 1, role: "user", text: "继续上次的演示问题" },
          {
            id: 2,
            role: "assistant",
            text: `已恢复演示会话 ${conversationId}。这不是服务端持久化记录。`,
            source: "supabase_mock",
          },
        ]
      : [],
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState(initialContext.prompt ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function run(prompt: string, appendUser = true) {
    const normalized = prompt.trim();
    if (!normalized || running) return;
    const result = scriptedResult(normalized);
    if (appendUser)
      setMessages((current) => [
        ...current,
        { id: Date.now(), role: "user", text: normalized },
      ]);
    setLastPrompt(normalized);
    setRunning(true);
    setProgress(result.progress);
    setFeedback(null);
    timerRef.current = setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: result.answer,
          source: result.source,
        },
      ]);
      setProgress(null);
      setRunning(false);
      timerRef.current = null;
    }, 500);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    run(input);
    setInput("");
  }
  function cancel() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setProgress(null);
    setMessages((current) => [
      ...current,
      { id: Date.now(), role: "assistant", text: "已取消本地演示响应。" },
    ]);
  }

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      <div className="flex-1 space-y-4 px-4 py-4">
        <DemoNotice>
          当前是本地脚本化对话，未调用真实模型或外部工具；工具步骤仅用于演示交互结构。
        </DemoNotice>
        {messages.length === 0 ? (
          <section className="rounded-feature bg-brand-soft p-5 text-center">
            <Bot className="mx-auto size-8 text-brand" />
            <h2 className="mt-3 text-lg font-semibold text-text">
              从一个真实需求开始
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              输入房源、团购、买菜或周边问题。
            </p>
          </section>
        ) : null}
        <section aria-live="polite" className="space-y-3">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <span
                className={`mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${message.role === "user" ? "order-2 bg-text text-white" : "bg-brand-soft text-brand"}`}
              >
                {message.role === "user" ? (
                  <UserRound className="size-4" />
                ) : (
                  <Bot className="size-4" />
                )}
              </span>
              <div
                className={`max-w-[82%] rounded-card px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-brand text-white" : "border border-border bg-surface text-text"}`}
              >
                <p>{message.text}</p>
                {message.source ? (
                  <SourceBadge source={message.source} className="mt-3" />
                ) : null}
                {message.role === "assistant" && message.source ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      aria-label="回答有帮助"
                      onClick={() =>
                        setFeedback("感谢反馈，本次反馈仅保存在页面状态。")
                      }
                      className="p-2 text-text-muted"
                    >
                      <ThumbsUp className="size-4" />
                    </button>
                    <button
                      aria-label="回答需改进"
                      onClick={() =>
                        setFeedback(
                          "已记录演示纠错入口，正式提交将在反馈模块完成。",
                        )
                      }
                      className="p-2 text-text-muted"
                    >
                      <ThumbsDown className="size-4" />
                    </button>
                    <Link
                      href="/me/feedback"
                      className="self-center text-xs text-brand"
                    >
                      知识纠错
                    </Link>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
        {running && progress ? (
          <div
            role="status"
            className="rounded-card border border-brand/20 bg-surface p-4"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-text">
              <span className="size-2 animate-pulse rounded-full bg-brand" />
              {progress}
            </p>
            <p className="mt-2 text-xs text-text-subtle">
              本地演示步骤 · 不代表真实工具已执行
            </p>
          </div>
        ) : null}
        {feedback ? <DemoNotice>{feedback}</DemoNotice> : null}
        {messages.some(
          (message) => message.role === "assistant" && message.source,
        ) ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => run(lastPrompt, false)}>
              重试演示
            </Button>
            <Link
              href="/xiaozhi/chat"
              className="inline-flex min-h-11 items-center rounded-control px-3 text-sm text-brand"
            >
              新对话
            </Link>
          </div>
        ) : null}
        <details
          open={initialContext.debug}
          className="rounded-card border border-border bg-surface p-4 text-xs text-text-muted"
        >
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-text">
            <Bug className="size-4" />
            调试摘要
          </summary>
          <div className="mt-3 space-y-1">
            <p>工具：local_demo_search</p>
            <p>来源：本地确定性演示数据</p>
            <p>结果数：最多 3 条</p>
            <p>错误码：无</p>
          </div>
        </details>
      </div>
      <form
        onSubmit={submit}
        className="sticky bottom-0 border-t border-border bg-surface p-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
      >
        <label htmlFor="chat-input" className="sr-only">
          输入消息
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={1}
            maxLength={500}
            placeholder="问问小智……"
            className="min-h-12 flex-1 resize-none rounded-control border border-border px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          {running ? (
            <Button
              type="button"
              aria-label="取消"
              onClick={cancel}
              variant="secondary"
              className="size-12 px-0"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              aria-label="发送"
              disabled={!input.trim()}
              className="size-12 px-0"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs text-text-subtle">
          <CheckCircle2 className="size-3.5" />
          输入最多 500 字，查询参数已经过白名单校验
        </p>
      </form>
    </div>
  );
}
