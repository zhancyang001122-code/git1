import "server-only";

import type { ChatStreamEvent } from "@/features/agent/chat-events";
import { buildContextWindow } from "@/features/agent/context-builder";
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
import { registerDemoMessage } from "@/features/conversation/demo-message-registry";
import { createSupabaseConversationRepository } from "@/features/conversation/repository";
import { createRepositories } from "@/features/repositories";
import { createMapsRuntime } from "@/features/maps/runtime";
import { createKnowledgeRuntime } from "@/features/knowledge/runtime";
import { createHousingRuntime } from "@/features/housing/runtime";
import { createSupabaseKnowledgeCandidateSink } from "@/features/knowledge/candidate-sink";
import { createDemoKnowledgeCandidateSink } from "@/features/knowledge-ops/demo-store";
import { metrics } from "@/features/observability/metrics";
import { AppError, toPublicError } from "@/lib/errors";
import { parsePublicEnv, parseServerEnv } from "@/lib/env";
import { rateLimitResponse, readJsonWithLimit } from "@/lib/api-security";
import { requestClientKey, type RateLimiter } from "@/lib/rate-limit";
import { createEnvironmentFixedWindowRateLimiter } from "@/lib/distributed-rate-limit";
import { logger } from "@/lib/logger";
import { requestIdFor } from "@/lib/request-id";

const chatRateLimiter = createEnvironmentFixedWindowRateLimiter({
  scope: "chat_ip",
  limit: 60,
  windowMs: 60_000,
});

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
  const normalized = toPublicError(error, requestId);
  return Response.json(
    { error: normalized },
    {
      status,
      headers: { "x-error-code": normalized.code, "x-request-id": requestId },
    },
  );
}

async function parseRequest(request: Request): Promise<ChatRequest> {
  let body: unknown;
  try {
    body = await readJsonWithLimit(request, 16_384);
  } catch (error) {
    if (error instanceof AppError && error.code === "REQUEST_BODY_TOO_LARGE")
      throw error;
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
    const knowledge = createKnowledgeRuntime({ environment: process.env });
    const housing = createHousingRuntime(process.env);
    return {
      provider: new DemoToolCallingProvider(),
      persistence: createEphemeralChatPersistence({
        onPrepared: ({ sessionId, messageId, question }) =>
          registerDemoMessage(sessionId, messageId, question),
      }),
      timeoutMs: serverConfiguration.AI_REQUEST_TIMEOUT_MS,
      warning: {
        code: "DEMO_MODE",
        message:
          housing.mode === "http"
            ? "当前为本地混合演示：武林广场附近房源来自 2024-11 历史库；团购、商品、地图和知识仍为模拟数据，未连接 Supabase、高德或千问"
            : "当前为本地确定性演示：房源、团购、商品、地图和知识均为模拟数据；未连接 Supabase、高德或千问，对话和审计不会写入云端",
      },
      tools: {
        executor: new ToolExecutor({
          timeoutMs: serverConfiguration.TOOL_TIMEOUT_MS,
        }),
        context: {
          business: repositories.business,
          housing,
          maps: maps.service,
          knowledge: knowledge.service,
          knowledgeCandidates: createDemoKnowledgeCandidateSink(),
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
    !(
      serverConfiguration.SUPABASE_SECRET_KEY ||
      serverConfiguration.SUPABASE_SERVICE_ROLE_KEY
    )
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
  const housing = createHousingRuntime(process.env);
  const knowledge = createKnowledgeRuntime({
    environment: process.env,
    supabase: adminClient,
  });
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
        housing,
        maps: maps.service,
        knowledge: knowledge.service,
        knowledgeCandidates: createSupabaseKnowledgeCandidateSink(adminClient),
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
  rateLimiter: RateLimiter = chatRateLimiter,
) {
  return async function POST(request: Request): Promise<Response> {
    const requestId = requestIdFor(request);
    const startedAt = Date.now();
    let chatRequest: ChatRequest;
    let runtime: ChatRuntime;
    let prepared: Awaited<ReturnType<ChatPersistence["prepare"]>>;

    try {
      const rateLimit = await rateLimiter.check(requestClientKey(request));
      if (!rateLimit.allowed) {
        logger.warn("chat.rate_limited", {
          requestId,
          errorCode: "RATE_LIMITED",
        });
        return rateLimitResponse(rateLimit, requestId);
      }
      chatRequest = await parseRequest(request);
      runtime = await runtimeFactory(chatRequest);
      prepared = await runtime.persistence.prepare(chatRequest);
    } catch (error) {
      const normalized = toPublicError(error, requestId);
      logger.warn("chat.rejected", {
        requestId,
        durationMs: Date.now() - startedAt,
        errorCode: normalized.code,
      });
      return jsonError(error, requestId);
    }

    const streamController = new AbortController();
    const abortFromRequest = () =>
      streamController.abort(request.signal.reason);
    request.signal.addEventListener("abort", abortFromRequest, { once: true });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let errorCode: string | undefined;
        try {
          const contextWindow = buildContextWindow({
            systemPrompt: XIAOZHI_SYSTEM_PROMPT,
            conversationSummary: prepared.conversationSummary,
            recentMessages: prepared.messages,
            pageContext: chatRequest.context,
          });
          for await (const event of orchestrateChatTurn({
            sessionId: prepared.sessionId,
            messageId: prepared.messageId,
            provider: runtime.provider,
            messages: contextWindow.messages,
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
            errorCode = normalized.code;
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
          metrics.observe("chat_duration_ms", Date.now() - startedAt);
          logger.info("chat.completed", {
            requestId,
            sessionId: prepared.sessionId,
            durationMs: Date.now() - startedAt,
            ...(errorCode && { errorCode }),
          });
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
