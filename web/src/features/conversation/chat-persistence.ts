import "server-only";

import type { ChatRequest } from "@/features/agent/chat-request";
import type { ChatTurnCompletion } from "@/features/agent/completion";
import type { ProviderMessage } from "@/features/agent/provider";
import type { ConversationRepository } from "@/features/conversation/repository";
import { summarizeConversation } from "@/features/conversation/summarizer";
import { AppError } from "@/lib/errors";
import {
  estimateAIRequestCost,
  type AIModelPricingConfiguration,
} from "@/features/ai-ops/pricing";

export interface PreparedChatTurn {
  sessionId: string;
  messageId: string;
  messages: readonly ProviderMessage[];
  conversationSummary?: string;
  persistAssistant(completion: ChatTurnCompletion): Promise<void>;
}

export interface ChatPersistence {
  prepare(request: ChatRequest): Promise<PreparedChatTurn>;
}

function sessionTitle(message: string): string {
  return message.slice(0, 120);
}

function providerHistory(
  messages: Awaited<ReturnType<ConversationRepository["listMessages"]>>,
): ProviderMessage[] {
  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map(({ role, content }) => ({
      role: role as "user" | "assistant",
      content,
    }));
}

export function createEphemeralChatPersistence(options?: {
  onPrepared?: (input: {
    sessionId: string;
    messageId: string;
    question: string;
  }) => void;
}): ChatPersistence {
  return {
    async prepare(request) {
      const sessionId = crypto.randomUUID();
      const messageId = crypto.randomUUID();
      options?.onPrepared?.({
        sessionId,
        messageId,
        question: request.message,
      });
      return {
        sessionId,
        messageId,
        messages: [{ role: "user", content: request.message }],
        async persistAssistant() {},
      };
    },
  };
}

interface SupabaseChatPersistenceOptions {
  repository: ConversationRepository;
  anonymousId: string;
  modelName: string;
  pricing?: AIModelPricingConfiguration | null;
}

export function createSupabaseChatPersistence({
  repository,
  anonymousId,
  modelName,
  pricing,
}: SupabaseChatPersistenceOptions): ChatPersistence {
  return {
    async prepare(request) {
      let session;
      if (request.sessionId) {
        session = await repository.getSession(request.sessionId);
        if (!session || session.anonymousId !== anonymousId) {
          throw new AppError({
            code: "CONVERSATION_FORBIDDEN",
            message: "无权访问该对话",
            status: 403,
          });
        }
      } else {
        session = await repository.createSession({
          anonymousId,
          title: sessionTitle(request.message),
          ...(request.location &&
            request.locationLabel && {
              location: request.location,
              locationLabel: request.locationLabel,
            }),
        });
      }

      if (
        request.location &&
        request.locationLabel &&
        (session.lastLocationLabel !== request.locationLabel ||
          session.location?.longitude !== request.location.longitude ||
          session.location?.latitude !== request.location.latitude)
      ) {
        await repository.updateLocation(
          session.id,
          request.locationLabel,
          request.location,
        );
      }

      const userMessage = await repository.appendMessage({
        sessionId: session.id,
        role: "user",
        content: request.message,
      });
      const messages = await repository.listMessages(session.id, { limit: 40 });
      const olderMessages = messages.slice(0, -12);
      const conversationSummary =
        session.summary.trim() ||
        (olderMessages.length > 0
          ? summarizeConversation(olderMessages)
          : undefined);

      return {
        sessionId: session.id,
        messageId: userMessage.id,
        messages: providerHistory(messages),
        ...(conversationSummary && { conversationSummary }),
        async persistAssistant(completion) {
          const costs = pricing
            ? (completion.usageRounds ?? []).map((usage) =>
                estimateAIRequestCost({ modelName, ...usage }, pricing),
              )
            : [];
          const estimatedCostCny =
            costs.length > 0 && costs.every((cost) => cost !== null)
              ? Number(
                  costs
                    .reduce((total, cost) => total + (cost ?? 0), 0)
                    .toFixed(6),
                )
              : null;
          const assistantMessage = await repository.appendMessage({
            sessionId: session.id,
            role: "assistant",
            content: completion.assistantText,
            structuredPayload: {
              finishReason: completion.finishReason,
              ...(completion.cards?.length && { cards: completion.cards }),
              ...(completion.citations?.length && {
                citations: completion.citations,
              }),
            },
            modelName,
            inputTokens: completion.inputTokens ?? null,
            outputTokens: completion.outputTokens ?? null,
            firstTokenMs: completion.firstTokenMs ?? null,
            estimatedCostCny,
            pricingEffectiveFrom:
              estimatedCostCny === null ? null : pricing!.effectiveFrom,
          });
          if (messages.length + 1 > 12) {
            const summary = summarizeConversation([
              ...messages,
              assistantMessage,
            ]);
            if (summary) await repository.updateSummary(session.id, summary);
          }
        },
      };
    },
  };
}
