import type { ConversationMessage } from "@/features/conversation/repository";

const MAX_SUMMARY_LENGTH = 1_200;
const SENSITIVE_ASSIGNMENT =
  /\b(api[_-]?key|token|authorization|cookie|password|service[_-]?role)\b\s*[:=：]?\s*[^\s，。；,;]+/gi;

function sanitize(content: string): string {
  return content
    .replace(SENSITIVE_ASSIGNMENT, "$1=[已移除]")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeConversation(
  messages: readonly ConversationMessage[],
): string {
  const lines = messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map((message) => {
      const content = sanitize(message.content);
      if (!content) return "";
      return `${message.role === "user" ? "用户" : "小智"}：${content}`;
    })
    .filter(Boolean);

  if (lines.length === 0) return "";
  const joined = lines.join("\n");
  if (joined.length <= MAX_SUMMARY_LENGTH) return joined;
  return `…${joined.slice(-(MAX_SUMMARY_LENGTH - 1))}`;
}
