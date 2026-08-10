import type { ChatStreamEvent } from "@/features/agent/chat-events";
import { parseChatStreamEvent } from "@/features/agent/chat-events";
import { AppError } from "@/lib/errors";

function wirePayload(event: ChatStreamEvent): unknown {
  switch (event.type) {
    case "tool_progress":
      return event.progress;
    case "debug_tool_run":
      return event.run;
    default: {
      const { type: _type, ...payload } = event;
      void _type;
      return payload;
    }
  }
}

export function encodeSseEvent(event: ChatStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(wirePayload(event))}\n\n`;
}

function fromWirePayload(type: string, payload: unknown): unknown {
  if (type === "tool_progress") return { progress: payload };
  if (type === "debug_tool_run") return { run: payload };
  return payload;
}

function parseFrame(frame: string): ChatStreamEvent | null {
  let type = "";
  const data: string[] = [];
  for (const rawLine of frame.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const separator = rawLine.indexOf(":");
    const field = separator === -1 ? rawLine : rawLine.slice(0, separator);
    const value =
      separator === -1 ? "" : rawLine.slice(separator + 1).replace(/^ /, "");
    if (field === "event") type = value;
    if (field === "data") data.push(value);
  }
  if (!type && data.length === 0) return null;
  if (!type || data.length === 0) {
    throw new AppError({
      code: "SSE_PROTOCOL_INVALID",
      message: "聊天流事件缺少名称或数据",
    });
  }
  try {
    const payload = JSON.parse(data.join("\n"));
    return parseChatStreamEvent(type, fromWirePayload(type, payload));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError({
      code: "SSE_PROTOCOL_INVALID",
      message: "聊天流 JSON 无效",
      cause: error,
    });
  }
}

export class SseEventParser {
  private buffer = "";

  push(chunk: string): ChatStreamEvent[] {
    this.buffer += chunk;
    const events: ChatStreamEvent[] = [];
    while (true) {
      const separator = /\r?\n\r?\n/.exec(this.buffer);
      if (!separator || separator.index === undefined) break;
      const frame = this.buffer.slice(0, separator.index);
      this.buffer = this.buffer.slice(separator.index + separator[0].length);
      const event = parseFrame(frame);
      if (event) events.push(event);
    }
    return events;
  }
}
