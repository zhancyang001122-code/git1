import type {
  ChatStreamEvent,
  KnowledgeCitation,
  ResultCard,
} from "@/features/agent/chat-events";
import type { ChatTurnCompletion } from "@/features/agent/completion";
import type {
  AIProvider,
  ProviderMessage,
  ProviderToolCall,
  ProviderToolChoice,
} from "@/features/agent/provider";
import { buildToolModelPayload } from "@/features/agent/result-synthesizer";
import type { ToolExecutor } from "@/features/agent/tools/executor";
import type {
  ToolContext,
  ToolExecution,
  ToolResult,
  ToolSource,
} from "@/features/agent/tools/types";
import { AppError } from "@/lib/errors";

interface AgentToolLoopInput {
  provider: AIProvider;
  messages: readonly ProviderMessage[];
  signal: AbortSignal;
  executor?: ToolExecutor;
  toolContext?: ToolContext;
  debug?: boolean;
  maxRounds?: number;
  initialToolChoice?: ProviderToolChoice;
  onComplete?: (completion: ChatTurnCompletion) => Promise<void> | void;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalValue(child)]),
    );
  return value;
}

function dedupeKey(call: ProviderToolCall): string {
  try {
    return `${call.name}:${JSON.stringify(canonicalValue(JSON.parse(call.arguments)))}`;
  } catch {
    return `${call.name}:invalid:${call.arguments}`;
  }
}

function toolMessage(
  call: ProviderToolCall,
  result: ToolResult,
  duplicate = false,
  repairAllowed?: boolean,
  repairHint?: string,
): ProviderMessage {
  return {
    role: "tool",
    toolCallId: call.id,
    content: JSON.stringify({
      ...buildToolModelPayload(call.name, result),
      ...(duplicate && { duplicate: true }),
      ...(repairAllowed !== undefined && { repairAllowed }),
      ...(repairAllowed === true && repairHint && { repairHint }),
    }),
  };
}

function repairHint(toolName: string): string {
  if (toolName === "search_products") {
    return "Return every required field. query must be a non-empty keyword or null. category must use the schema enum or null when unsure. If the user did not specify a store, set store_id to null; never invent a store_id. A non-null store_id must be a UUID from a previous trusted result.";
  }
  if (toolName === "propose_user_preference") {
    return "For max_housing_budget use an integer. For preferred_areas, dietary_restrictions, transport_modes, and family_profile use a non-empty string array.";
  }
  return "Return a complete JSON object matching the tool schema. Include every required nullable field explicitly as null when the user did not provide it.";
}

function registerInvalidAttempt(
  counts: Map<string, number>,
  toolName: string,
): { repairAllowed: boolean; exhausted: boolean } {
  const count = (counts.get(toolName) ?? 0) + 1;
  counts.set(toolName, count);
  return { repairAllowed: count === 1, exhausted: count >= 2 };
}

function blockedResult(source: ToolSource): ToolResult {
  return {
    ok: false,
    error: {
      code: "TOOL_ARGUMENTS_REPAIR_EXHAUSTED",
      message: "该工具参数连续无效，本轮不再重试",
      retryable: false,
    },
    source,
    resultCount: 0,
  };
}

async function persistenceFailed(
  callback: AgentToolLoopInput["onComplete"],
  completion: ChatTurnCompletion,
): Promise<boolean> {
  if (!callback) return false;
  try {
    await callback(completion);
    return false;
  } catch (error) {
    void error;
    return true;
  }
}

function completion(
  assistantText: string,
  finishReason: ChatTurnCompletion["finishReason"],
  inputTokens: number | undefined,
  outputTokens: number | undefined,
  usageRounds: readonly { inputTokens: number; outputTokens: number }[],
): ChatTurnCompletion {
  return {
    assistantText,
    finishReason,
    ...(inputTokens !== undefined && { inputTokens }),
    ...(outputTokens !== undefined && { outputTokens }),
    ...(usageRounds.length > 0 && { usageRounds }),
  };
}

export async function* runAgentToolLoop(
  input: AgentToolLoopInput,
): AsyncIterable<ChatStreamEvent> {
  if (Boolean(input.executor) !== Boolean(input.toolContext)) {
    throw new AppError({
      code: "TOOL_RUNTIME_INVALID",
      message: "工具运行环境配置不完整",
    });
  }

  const messages = [...input.messages];
  const completedCalls = new Map<string, ToolExecution>();
  const invalidCounts = new Map<string, number>();
  const blockedTools = new Set<string>();
  const maxRounds = input.maxRounds ?? 8;
  let assistantText = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  const usageRounds: { inputTokens: number; outputTokens: number }[] = [];
  let usageCoverageComplete = true;
  let auditWarningEmitted = false;
  const resultCards: NonNullable<ChatTurnCompletion["cards"]>[number][] = [];
  const citations: KnowledgeCitation[] = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    let roundText = "";
    let calls: readonly ProviderToolCall[] = [];
    let finished = false;
    let roundInputTokens: number | undefined;
    let roundOutputTokens: number | undefined;
    const requiredToolChoice =
      round === 1 ? input.initialToolChoice : undefined;
    const providerInput = {
      messages,
      ...(input.executor && {
        tools: input.executor.registry.providerDefinitions(),
      }),
      ...(requiredToolChoice && { toolChoice: requiredToolChoice }),
    };

    for await (const event of input.provider.streamTurn(
      providerInput,
      input.signal,
    )) {
      if (event.type === "text_delta") {
        roundText += event.delta;
        if (!requiredToolChoice) {
          assistantText += event.delta;
          yield { type: "assistant_delta", delta: event.delta };
        }
      } else if (event.type === "usage") {
        if (event.inputTokens !== undefined)
          roundInputTokens = (roundInputTokens ?? 0) + event.inputTokens;
        if (event.outputTokens !== undefined)
          roundOutputTokens = (roundOutputTokens ?? 0) + event.outputTokens;
      } else if (event.type === "tool_calls") {
        calls = event.calls;
      } else if (event.type === "finish") {
        finished = true;
      }
    }

    if (!finished) {
      throw new AppError({
        code: "QWEN_STREAM_INCOMPLETE",
        message: "模型响应未完整结束，请重试",
        retryable: true,
      });
    }
    if (
      requiredToolChoice &&
      !calls.some((call) => call.name === requiredToolChoice.name)
    ) {
      throw new AppError({
        code: "REQUIRED_TOOL_NOT_CALLED",
        message: "模型未按要求核验事实，请重试",
        retryable: true,
      });
    }
    if (
      usageCoverageComplete &&
      roundInputTokens !== undefined &&
      roundOutputTokens !== undefined
    ) {
      usageRounds.push({
        inputTokens: roundInputTokens,
        outputTokens: roundOutputTokens,
      });
      inputTokens = (inputTokens ?? 0) + roundInputTokens;
      outputTokens = (outputTokens ?? 0) + roundOutputTokens;
    } else {
      usageCoverageComplete = false;
      inputTokens = undefined;
      outputTokens = undefined;
      usageRounds.length = 0;
    }

    if (calls.length === 0) {
      const final = completion(
        assistantText,
        "stop",
        inputTokens,
        outputTokens,
        usageRounds,
      );
      if (resultCards.length > 0) final.cards = resultCards;
      if (citations.length > 0) final.citations = citations;
      if (await persistenceFailed(input.onComplete, final)) {
        yield {
          type: "warning",
          code: "CONVERSATION_PERSISTENCE_FAILED",
          message: "回答已生成，但对话记录暂未保存",
        };
      }
      yield { type: "done", finishReason: "stop" };
      return;
    }

    if (!input.executor || !input.toolContext) {
      const final = completion(
        assistantText,
        "fallback",
        inputTokens,
        outputTokens,
        usageRounds,
      );
      if (resultCards.length > 0) final.cards = resultCards;
      if (citations.length > 0) final.citations = citations;
      yield {
        type: "warning",
        code: "TOOLS_NOT_AVAILABLE",
        message: "当前阶段暂不执行外部工具，请稍后重试",
      };
      if (await persistenceFailed(input.onComplete, final)) {
        yield {
          type: "warning",
          code: "CONVERSATION_PERSISTENCE_FAILED",
          message: "回答已生成，但对话记录暂未保存",
        };
      }
      yield { type: "done", finishReason: "fallback" };
      return;
    }

    messages.push({
      role: "assistant",
      content: roundText,
      toolCalls: calls,
    });

    for (const call of calls) {
      const definition = input.executor.registry.find(call.name);
      const initialSource =
        definition?.source(input.toolContext) ?? "supabase_mock";
      if (blockedTools.has(call.name)) {
        messages.push(
          toolMessage(call, blockedResult(initialSource), false, false),
        );
        continue;
      }

      const key = dedupeKey(call);
      const existing = completedCalls.get(key);
      if (existing) {
        if (existing.result.error?.code === "TOOL_ARGUMENTS_INVALID") {
          const attempt = registerInvalidAttempt(invalidCounts, call.name);
          if (attempt.exhausted) {
            blockedTools.add(call.name);
            yield {
              type: "warning",
              code: "TOOL_ARGUMENTS_REPAIR_EXHAUSTED",
              message: "工具参数连续无效，请换一种说法后重试",
            };
          }
          messages.push(
            toolMessage(
              call,
              existing.result,
              true,
              attempt.repairAllowed,
              repairHint(call.name),
            ),
          );
        } else {
          messages.push(toolMessage(call, existing.result, true));
        }
        continue;
      }

      const progressId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const label = definition?.publicLabel ?? "正在处理请求";
      yield {
        type: "tool_progress",
        progress: {
          id: progressId,
          label,
          status: "queued",
          source: initialSource,
          startedAt,
          completedAt: null,
        },
      };
      yield {
        type: "tool_progress",
        progress: {
          id: progressId,
          label,
          status: "running",
          source: initialSource,
          startedAt,
          completedAt: null,
        },
      };

      const execution: ToolExecution = await input.executor.execute(
        call,
        input.toolContext,
      );
      completedCalls.set(key, execution);
      yield {
        type: "tool_progress",
        progress: {
          id: progressId,
          label,
          status: execution.status,
          source: execution.result.source,
          startedAt: execution.startedAt,
          completedAt: execution.completedAt,
        },
      };

      const invalid = execution.result.error?.code === "TOOL_ARGUMENTS_INVALID";
      let repairAllowed: boolean | undefined;
      if (invalid) {
        const attempt = registerInvalidAttempt(invalidCounts, call.name);
        repairAllowed = attempt.repairAllowed;
        if (attempt.exhausted) {
          blockedTools.add(call.name);
          yield {
            type: "warning",
            code: "TOOL_ARGUMENTS_REPAIR_EXHAUSTED",
            message: "工具参数连续无效，请换一种说法后重试",
          };
        }
      }
      messages.push(
        toolMessage(
          call,
          execution.result,
          false,
          repairAllowed,
          repairHint(call.name),
        ),
      );

      if (execution.result.ok && execution.result.cards?.length) {
        for (const card of execution.result.cards as readonly ResultCard[]) {
          const id: unknown = card.data.id;
          const existingIndex =
            typeof id === "string"
              ? resultCards.findIndex(
                  (candidate) =>
                    candidate.kind === card.kind && candidate.data.id === id,
                )
              : -1;
          if (existingIndex >= 0) resultCards[existingIndex] = card;
          else if (resultCards.length < 20) resultCards.push(card);
        }
        yield { type: "result_cards", cards: [...execution.result.cards] };
      }
      if (execution.result.ok && execution.result.citations?.length) {
        const incoming: KnowledgeCitation[] = [];
        for (const citation of execution.result.citations) {
          if (citations.some((item) => item.chunkId === citation.chunkId))
            continue;
          if (citations.length >= 20) break;
          citations.push(citation);
          incoming.push(citation);
        }
        if (incoming.length > 0)
          yield { type: "citations", citations: incoming };
      }
      if (execution.auditFailed && !auditWarningEmitted) {
        auditWarningEmitted = true;
        yield {
          type: "warning",
          code: "TOOL_AUDIT_FAILED",
          message: "查询已完成，但工具审计记录暂未保存",
        };
      }
      if (input.debug) {
        yield {
          type: "debug_tool_run",
          run: {
            id: progressId,
            label,
            status: execution.status,
            source: execution.result.source,
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
            toolName: execution.toolName,
            inputSummary: execution.inputSummary,
            resultCount: execution.result.resultCount,
            durationMs: execution.durationMs,
            errorCode: execution.result.error?.code ?? null,
          },
        };
      }
    }

    if (round === maxRounds) {
      const final = completion(
        assistantText,
        "tool_limit",
        inputTokens,
        outputTokens,
        usageRounds,
      );
      if (resultCards.length > 0) final.cards = resultCards;
      if (citations.length > 0) final.citations = citations;
      yield {
        type: "warning",
        code: "TOOL_ROUND_LIMIT",
        message: "工具调用已达到 8 轮，请缩小问题范围后重试",
      };
      if (await persistenceFailed(input.onComplete, final)) {
        yield {
          type: "warning",
          code: "CONVERSATION_PERSISTENCE_FAILED",
          message: "回答已生成，但对话记录暂未保存",
        };
      }
      yield { type: "done", finishReason: "tool_limit" };
      return;
    }
  }
}
