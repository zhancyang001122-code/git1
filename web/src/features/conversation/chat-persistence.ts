import "server-only";

import type { ChatRequest } from "@/features/agent/chat-request";
import type { ChatTurnCompletion } from "@/features/agent/completion";
import type { ProviderMessage } from "@/features/agent/provider";
import type { ConversationRepository } from "@/features/conversation/repository";
import { summarizeConversation } from "@/features/conversation/summarizer";
import { AppError } from "@/lib/errors";

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

export function createEphemeralChatPersistence(): ChatPersistence {
  return {
    async prepare(request) {
      return {
        sessionId: crypto.randomUUID(),
        messageId: crypto.randomUUID(),
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
}

export function createSupabaseChatPersistence({
  repository,
  anonymousId,
  modelName,
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
        });
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
