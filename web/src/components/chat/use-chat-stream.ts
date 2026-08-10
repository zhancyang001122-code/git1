"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  initialChatStreamState,
  reduceChatStreamEvent,
  type ChatStreamState,
} from "@/features/agent/chat-events";
import type { ChatRequest } from "@/features/agent/chat-request";
import { SseEventParser } from "@/features/agent/sse";

export type ChatRequestStatus =
  "idle" | "streaming" | "completed" | "error" | "cancelled";

interface ChatStreamController {
  state: ChatStreamState;
  status: ChatRequestStatus;
  send(request: ChatRequest): Promise<ChatStreamState | null>;
  cancel(): void;
  reset(): void;
}

function clientError(
  message: string,
  current: ChatStreamState = initialChatStreamState,
): ChatStreamState {
  return {
    ...current,
    error: { code: "CHAT_REQUEST_FAILED", message, retryable: true },
  };
}

export function useChatStream(): ChatStreamController {
  const [state, setState] = useState(initialChatStreamState);
  const [status, setStatus] = useState<ChatRequestStatus>("idle");
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState(initialChatStreamState);
    setStatus("idle");
  }, []);

  const send = useCallback(async (request: ChatRequest) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(initialChatStreamState);
    setStatus("streaming");
    let current = initialChatStreamState;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message ?? "聊天服务暂时不可用");
      }
      if (!response.body) throw new Error("浏览器未收到聊天响应流");

      const parser = new SseEventParser();
      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parser.push(
          decoder.decode(value, { stream: true }),
        )) {
          current = reduceChatStreamEvent(current, event);
          setState(current);
        }
      }
      for (const event of parser.push(decoder.decode())) {
        current = reduceChatStreamEvent(current, event);
        setState(current);
      }
      if (!current.finishReason && !current.error) {
        current = clientError("聊天响应意外中断，请重试", current);
        setState(current);
      }
      setStatus(current.error ? "error" : "completed");
      return current;
    } catch (error) {
      if (controller.signal.aborted) {
        setStatus("cancelled");
        return null;
      }
      current = clientError(
        error instanceof Error ? error.message : "聊天服务暂时不可用",
      );
      setState(current);
      setStatus("error");
      return current;
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, status, send, cancel, reset };
}
