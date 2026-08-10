import "server-only";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import {
  chatRequestSchema,
  type ChatRequest,
} from "@/features/agent/chat-request";
import { FakeAIProvider } from "@/features/agent/fake-provider";
import { orchestrateChatTurn } from "@/features/agent/orchestrator";
import type { AIProvider } from "@/features/agent/provider";
import { createQwenProvider } from "@/features/agent/qwen-provider";
import { encodeSseEvent } from "@/features/agent/sse";
import { XIAOZHI_SYSTEM_PROMPT } from "@/features/agent/system-prompt";
import {
  createAnonymousSessionCookie,
  readAnonymousSessionCookie,
  ANONYMOUS_SESSION_COOKIE,
  anonymousSessionCookieOptions,
} from "@/features/conversation/anonymous-session";
import {
  createEphemeralChatPersistence,
  createSupabaseChatPersistence,
  type ChatPersistence,
} from "@/features/conversation/chat-persistence";
import { createSupabaseConversationRepository } from "@/features/conversation/repository";
import { AppError, toPublicError } from "@/lib/errors";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";

export interface ChatRuntime {
  provider: AIProvider;
  persistence: ChatPersistence;
  timeoutMs: number;
  warning?: { code: string; message: string };
}

export type ChatRuntimeFactory = (request: ChatRequest) => Promise<ChatRuntime>;

function invalidRequest(cause: unknown): AppError {
  return new AppError({
    code: "INVALID_CHAT_REQUEST",
    message: "聊天请求格式无效",
    status: 400,
    cause,
  });
}

function jsonError(error: unknown, requestId: string): Response {
  const status = error instanceof AppError ? error.status : 500;
  return Response.json(
    { error: toPublicError(error, requestId) },
    { status, headers: { "x-request-id": requestId } },
  );
}

async function parseRequest(request: Request): Promise<ChatRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw invalidRequest(error);
  }
  const result = chatRequestSchema.safeParse(body);
  if (!result.success) throw invalidRequest(result.error);
  return result.data;
}

async function defaultChatRuntime(): Promise<ChatRuntime> {
  const publicConfiguration = parsePublicEnv(process.env);
  const serverConfiguration = parseServerEnv(process.env);

  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    return {
      provider: new FakeAIProvider([
        {
          type: "text_delta",
          delta: "当前为聊天链路演示模式，未调用真实千问或外部工具。",
        },
        {
          type: "text_delta",
          delta:
            "我可以继续了解你的需求，但暂时不会给出未经工具核验的价格、库存、距离或政策。",
        },
        { type: "finish", reason: "stop" },
      ]),
      persistence: createEphemeralChatPersistence(),
      timeoutMs: serverConfiguration.AI_REQUEST_TIMEOUT_MS,
      warning: {
        code: "DEMO_MODE",
        message: "当前为演示模式，对话不会写入云端，也未调用真实千问或外部工具",
      },
    };
  }

  if (!serverConfiguration.DASHSCOPE_API_KEY) {
    throw new AppError({
      code: "QWEN_NOT_CONFIGURED",
      message: "千问服务尚未配置",
      status: 503,
      retryable: true,
    });
  }
  if (
    !publicConfiguration.NEXT_PUBLIC_SUPABASE_URL ||
    !publicConfiguration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !serverConfiguration.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new AppError({
      code: "SUPABASE_ADMIN_NOT_CONFIGURED",
      message: "对话存储服务尚未配置",
      status: 503,
      retryable: true,
    });
  }
  if (!serverConfiguration.ANONYMOUS_COOKIE_SECRET) {
    throw new AppError({
      code: "ANONYMOUS_COOKIE_SECRET_MISSING",
      message: "匿名会话服务尚未配置",
      status: 503,
    });
  }

  const { cookies } = await import("next/headers");
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ANONYMOUS_SESSION_COOKIE)?.value;
  let anonymousId = readAnonymousSessionCookie(
    cookieValue,
    serverConfiguration.ANONYMOUS_COOKIE_SECRET,
  );
  if (!anonymousId) {
    const created = createAnonymousSessionCookie(
      serverConfiguration.ANONYMOUS_COOKIE_SECRET,
    );
    anonymousId = created.anonymousId;
    cookieStore.set(
      ANONYMOUS_SESSION_COOKIE,
      created.value,
      anonymousSessionCookieOptions,
    );
  }

  const repository = createSupabaseConversationRepository(
    createAdminSupabaseClient(),
  );
  return {
    provider: createQwenProvider(),
    persistence: createSupabaseChatPersistence({
      repository,
      anonymousId,
      modelName: serverConfiguration.DASHSCOPE_MODEL,
    }),
    timeoutMs: serverConfiguration.AI_REQUEST_TIMEOUT_MS,
  };
}

export function createChatHandler(
  runtimeFactory: ChatRuntimeFactory = defaultChatRuntime,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID();
    let chatRequest: ChatRequest;
    let runtime: ChatRuntime;
    let prepared: Awaited<ReturnType<ChatPersistence["prepare"]>>;

    try {
      chatRequest = await parseRequest(request);
      runtime = await runtimeFactory(chatRequest);
      prepared = await runtime.persistence.prepare(chatRequest);
    } catch (error) {
      return jsonError(error, requestId);
    }

    const streamController = new AbortController();
    const abortFromRequest = () =>
      streamController.abort(request.signal.reason);
    request.signal.addEventListener("abort", abortFromRequest, { once: true });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of orchestrateChatTurn({
            sessionId: prepared.sessionId,
            messageId: prepared.messageId,
            provider: runtime.provider,
            messages: [
              { role: "system", content: XIAOZHI_SYSTEM_PROMPT },
              ...prepared.messages,
            ],
            signal: streamController.signal,
            timeoutMs: runtime.timeoutMs,
            onComplete: prepared.persistAssistant,
          })) {
            controller.enqueue(encoder.encode(encodeSseEvent(event)));
            if (event.type === "session" && runtime.warning) {
              const warning: ChatStreamEvent = {
                type: "warning",
                ...runtime.warning,
              };
              controller.enqueue(encoder.encode(encodeSseEvent(warning)));
            }
          }
        } catch (error) {
          if (!streamController.signal.aborted) {
            const normalized = toPublicError(error, requestId);
            controller.enqueue(
              encoder.encode(
                encodeSseEvent({
                  type: "error",
                  code: normalized.code,
                  message: normalized.message,
                  retryable: normalized.retryable,
                }),
              ),
            );
          }
        } finally {
          request.signal.removeEventListener("abort", abortFromRequest);
          controller.close();
        }
      },
      cancel(reason) {
        streamController.abort(reason);
      },
    });

    return new Response(body, {
      headers: {
        "cache-control": "no-cache, no-transform",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
        "x-request-id": requestId,
      },
    });
  };
}
