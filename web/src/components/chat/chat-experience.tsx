"use client";

import {
  Bot,
  Bug,
  CheckCircle2,
  RotateCcw,
  Send,
  Square,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AgentProgressList } from "@/components/chat/agent-progress-list";
import { AgentResultCards } from "@/components/chat/agent-result-cards";
import { useChatStream } from "@/components/chat/use-chat-stream";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import type { ChatRequest } from "@/features/agent/chat-request";
import type { ChatContext } from "@/features/chat/chat-context";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function requestContext(
  context: ChatContext,
): ChatRequest["context"] | undefined {
  if (
    !context.entityId ||
    !context.source ||
    !["community_post", "house", "deal", "product"].includes(context.source)
  )
    return undefined;
  return {
    sourceType: context.source as NonNullable<
      ChatRequest["context"]
    >["sourceType"],
    sourceId: context.entityId,
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
          { id: "restored-user", role: "user", text: "继续上次的演示问题" },
          {
            id: "restored-assistant",
            role: "assistant",
            text: `这是演示会话 ${conversationId} 的页面占位，不是从服务端恢复的历史记录。`,
          },
        ]
      : [],
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState(initialContext.prompt ?? "");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const { state: stream, status, send, cancel, reset } = useChatStream();
  const running = status === "streaming";

  async function run(prompt: string, appendUser = true) {
    const normalized = prompt.trim();
    if (!normalized || running) return;
    if (appendUser) {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "user", text: normalized },
      ]);
    }
    setLastPrompt(normalized);
    setFeedback(null);
    const result = await send({
      ...(sessionId && { sessionId }),
      message: normalized,
      ...(requestContext(initialContext) && {
        context: requestContext(initialContext),
      }),
      debug: initialContext.debug,
    });
    if (!result) return;
    if (result.sessionId) setSessionId(result.sessionId);
    if (result.assistantText) {
      setMessages((current) => [
        ...current,
        {
          id: result.messageId ?? crypto.randomUUID(),
          role: "assistant",
          text: result.assistantText,
        },
      ]);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const prompt = input;
    setInput("");
    void run(prompt);
  }

  function startNewConversation() {
    reset();
    setMessages([]);
    setSessionId(undefined);
    setInput("");
    setLastPrompt("");
    setFeedback(null);
  }

  const progressItems = Object.values(stream.progress);

  return (
    <div className="flex min-h-[calc(100dvh-48px)] flex-col bg-page">
      <div className="flex-1 space-y-4 px-4 py-3">
        <DemoNotice>
          回答通过服务端流式 API
          生成；演示模式、未接通能力和保存失败都会明确标注。
        </DemoNotice>
        {messages.length === 0 && !running ? (
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
                className={`max-w-[82%] px-4 py-2.5 text-sm leading-6 shadow-card ${message.role === "user" ? "rounded-[12px_4px_12px_12px] bg-brand text-white" : "rounded-[4px_12px_12px_12px] bg-surface text-text"}`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.role === "assistant" ? (
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
                          "已记录演示纠错入口，可前往反馈页补充说明。",
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
          {running && stream.assistantText ? (
            <article className="flex gap-2">
              <span className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Bot className="size-4" />
              </span>
              <div className="max-w-[82%] rounded-[4px_12px_12px_12px] bg-surface px-4 py-2.5 text-sm leading-6 text-text shadow-card">
                <p className="whitespace-pre-wrap">{stream.assistantText}</p>
                <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-brand" />
              </div>
            </article>
          ) : null}
        </section>
        <AgentProgressList items={progressItems} />
        <AgentResultCards cards={stream.cards} />
        {running && progressItems.length === 0 ? (
          <div
            role="status"
            className="rounded-card border border-brand/20 bg-surface p-4"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-text">
              <span className="size-2 animate-pulse rounded-full bg-brand" />
              正在生成回答
            </p>
            <p className="mt-2 text-xs text-text-subtle">
              关闭页面或点击取消会中止本轮请求
            </p>
          </div>
        ) : null}
        {running && progressItems.length > 0 ? (
          <p className="text-xs text-text-subtle">
            关闭页面或点击取消会中止本轮请求
          </p>
        ) : null}
        {stream.warnings.map((warning) => (
          <DemoNotice key={`${warning.code}-${warning.message}`}>
            {warning.message}
          </DemoNotice>
        ))}
        {status === "cancelled" ? (
          <DemoNotice>本轮请求已取消。</DemoNotice>
        ) : null}
        {stream.error ? (
          <div
            role="alert"
            className="rounded-card border border-danger/30 bg-surface p-4"
          >
            <p className="text-sm font-medium text-danger">
              {stream.error.message}
            </p>
            {stream.error.retryable ? (
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => void run(lastPrompt, false)}
              >
                <RotateCcw className="size-4" />
                重试
              </Button>
            ) : null}
          </div>
        ) : null}
        {feedback ? <DemoNotice>{feedback}</DemoNotice> : null}
        {messages.some((message) => message.role === "assistant") ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void run(lastPrompt)}>
              再次发送
            </Button>
            {conversationId ? (
              <Link
                href="/xiaozhi/chat"
                className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-brand"
              >
                新对话
              </Link>
            ) : (
              <Button variant="ghost" onClick={startNewConversation}>
                新对话
              </Button>
            )}
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
          <div className="mt-3 space-y-2">
            {stream.debugRuns.length > 0 ? (
              stream.debugRuns.map((run) => (
                <div key={run.id}>
                  <p>工具：{run.toolName}</p>
                  <p>耗时：{run.durationMs ?? "进行中"}</p>
                  <p>错误码：{run.errorCode ?? "无"}</p>
                </div>
              ))
            ) : progressItems.length > 0 ? (
              <p>工具已执行；内部调试摘要未开启。</p>
            ) : (
              <p>本轮未执行外部工具。</p>
            )}
          </div>
        </details>
      </div>
      <form
        onSubmit={submit}
        className="sticky bottom-0 border-t border-border bg-surface p-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]"
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
            maxLength={4_000}
            placeholder="问问小智……"
            className="min-h-11 flex-1 resize-none rounded-control border border-border bg-page px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
          {running ? (
            <Button
              type="button"
              aria-label="取消"
              onClick={cancel}
              variant="secondary"
              className="size-11 px-0"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              aria-label="发送"
              disabled={!input.trim()}
              className="size-11 px-0"
            >
              <Send className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1 text-xs text-text-subtle">
          <CheckCircle2 className="size-3.5" />
          输入最多 4000 字，请求会在服务端再次校验
        </p>
      </form>
    </div>
  );
}
