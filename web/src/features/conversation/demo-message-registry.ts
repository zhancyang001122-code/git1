import "server-only";

interface DemoMessage {
  question: string;
  createdAt: number;
}

const globalRegistry = globalThis as typeof globalThis & {
  __xiaozhiDemoMessages?: Map<string, DemoMessage>;
};

function registry(): Map<string, DemoMessage> {
  globalRegistry.__xiaozhiDemoMessages ??= new Map();
  return globalRegistry.__xiaozhiDemoMessages;
}

export function registerDemoMessage(
  sessionId: string,
  messageId: string,
  question: string,
): void {
  registry().set(`${sessionId}:${messageId}`, {
    question,
    createdAt: Date.now(),
  });
}

export function findDemoMessage(
  sessionId: string,
  messageId: string,
): string | null {
  return registry().get(`${sessionId}:${messageId}`)?.question ?? null;
}

export function resetDemoMessageRegistryForTests(): void {
  globalRegistry.__xiaozhiDemoMessages = new Map();
}
