import { afterEach, describe, expect, it, vi } from "vitest";

import { SseEventParser } from "@/features/agent/sse";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

function chatRequest(message = "你好") {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

describe("POST /api/chat", () => {
  it("uses the visible deterministic provider in demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const response = await POST(chatRequest());
    const events = new SseEventParser().push(await response.text());

    expect(response.status).toBe(200);
    expect(events[0]?.type).toBe("session");
    expect(
      events.some(
        (event) => event.type === "warning" && event.code === "DEMO_MODE",
      ),
    ).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
  });

  it("executes demo business tools and emits typed cards", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AI_DEBUG", "false");
    const response = await POST(chatRequest("找3500元以内允许养猫的一居室"));
    const responseText = await response.text();
    const events = new SseEventParser().push(responseText);

    expect(events.some((event) => event.type === "tool_progress")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "result_cards" &&
          event.cards.every((card) => card.kind === "house"),
      ),
    ).toBe(true);
    expect(responseText).not.toContain("search_houses");
  });

  it("returns 503 instead of pretending live Qwen works without a key", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("DASHSCOPE_API_KEY", "");
    const response = await POST(chatRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toMatchObject({
      code: "QWEN_NOT_CONFIGURED",
      retryable: true,
    });
  });

  it("never exposes configured server credentials in setup errors", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubEnv("DASHSCOPE_API_KEY", "qwen-secret-value");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const response = await POST(chatRequest());

    expect(await response.text()).not.toContain("qwen-secret-value");
  });
});
