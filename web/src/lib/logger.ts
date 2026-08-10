import { redactForLogs } from "@/lib/redaction";

export interface LogContext {
  requestId: string;
  sessionId?: string;
  toolName?: string;
  durationMs?: number;
  errorCode?: string;
  resultCount?: number;
  [key: string]: unknown;
}

export function createLogger(write: (line: string) => void = console.info) {
  function emit(
    level: "info" | "warn" | "error",
    event: string,
    context: LogContext,
  ) {
    write(
      JSON.stringify(
        redactForLogs({
          timestamp: new Date().toISOString(),
          level,
          event,
          ...context,
        }),
      ),
    );
  }
  return {
    info: (event: string, context: LogContext) => emit("info", event, context),
    warn: (event: string, context: LogContext) => emit("warn", event, context),
    error: (event: string, context: LogContext) =>
      emit("error", event, context),
  };
}

export const logger = createLogger();
