import "server-only";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import {
  chatRequestSchema,
  type ChatRequest,
} from "@/features/agent/chat-request";
import { DemoToolCallingProvider } from "@/features/agent/demo-tool-provider";
import { orchestrateChatTurn } from "@/features/agent/orchestrator";
import type { AIProvider } from "@/features/agent/provider";
import { createQwenProvider } from "@/features/agent/qwen-provider";
import { encodeSseEvent } from "@/features/agent/sse";
import { XIAOZHI_SYSTEM_PROMPT } from "@/features/agent/system-prompt";
import {
  createAIOpsToolAudit,
  createInMemoryToolAudit,
} from "@/features/agent/tools/audit";
import { ToolExecutor } from "@/features/agent/tools/executor";
import type { ToolContext } from "@/features/agent/tools/types";
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
import { createRepositories } from "@/features/repositories";
import { createMapsRuntime } from "@/features/maps/runtime";
import { AppError, toPublicError } from "@/lib/errors";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";

export interface ChatRuntime {
  provider: AIProvider;
  persistence: ChatPersistence;
  timeoutMs: number;
  warning?: { code: string; message: string };
  tools?: {
    executor: ToolExecutor;
    context: Omit<
      ToolContext,
      "sessionId" | "messageId" | "requestId" | "signal"
    >;
    debugEnabled: boolean;
    maxRounds: number;
  };
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

async function defaultChatRuntime(request: ChatRequest): Promise<ChatRuntime> {
  const publicConfiguration = parsePublicEnv(process.env);
  const serverConfiguration = parseServerEnv(process.env);

  if (publicConfiguration.NEXT_PUBLIC_DEMO_MODE) {
    const repositories = await createRepositories({ environment: process.env });
    const maps = createMapsRuntime(process.env);
    return {
      provider: new DemoToolCallingProvider(),
      persistence: createEphemeralChatPersistence(),
      timeoutMs: serverConfiguration.AI_REQUEST_TIMEOUT_MS,
      warning: {
        code: "DEMO_MODE",
        message:
          "当前为确定性工具演示模式：没有调用真实千问，对话和审计不会写入云端",
      },
      tools: {
        executor: new ToolExecutor({
          timeoutMs: serverConfiguration.TOOL_TIMEOUT_MS,
        }),
        context: {
          business: repositories.business,
          maps: maps.service,
          memory: repositories.memory,
          audit: createInMemoryToolAudit(),
          businessSource: "supabase_mock",
          userId: null,
        },
        debugEnabled:
          request.debug && publicConfiguration.NEXT_PUBLIC_ENABLE_AI_DEBUG,
        maxRounds: serverConfiguration.AI_MAX_TOOL_ROUNDS,
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
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
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

  const adminClient = createAdminSupabaseClient();
  const serverClient = await createServerSupabaseClient();
  const repository = createSupabaseConversationRepository(adminClient);
  const repositories = await createRepositories({ serverClient, adminClient });
  const maps = createMapsRuntime(process.env);
  const authenticated = await serverClient.auth.getUser();
  return {
    provider: createQwenProvider(),
    persistence: createSupabaseChatPersistence({
      repository,
      anonymousId,
      modelName: serverConfiguration.DASHSCOPE_MODEL,
    }),
    timeoutMs: serverConfiguration.AI_REQUEST_TIMEOUT_MS,
    tools: {
      executor: new ToolExecutor({
        timeoutMs: serverConfiguration.TOOL_TIMEOUT_MS,
      }),
      context: {
        business: repositories.business,
        maps: maps.service,
        memory: repositories.memory,
        audit: createAIOpsToolAudit(repositories.aiOps),
        businessSource:
          repositories.mode.mode === "supabase"
            ? "housing_history_2024"
            : "supabase_mock",
        userId: authenticated.data.user?.id ?? null,
      },
      debugEnabled:
        request.debug && publicConfiguration.NEXT_PUBLIC_ENABLE_AI_DEBUG,
      maxRounds: serverConfiguration.AI_MAX_TOOL_ROUNDS,
    },
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
            ...(runtime.tools && {
              toolExecutor: runtime.tools.executor,
              toolContext: {
                ...runtime.tools.context,
                sessionId: prepared.sessionId,
                messageId: prepared.messageId,
                requestId,
                signal: streamController.signal,
              },
              debug: runtime.tools.debugEnabled,
              maxToolRounds: runtime.tools.maxRounds,
            }),
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
