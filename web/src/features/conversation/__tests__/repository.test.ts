import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createSupabaseConversationRepository } from "@/features/conversation/repository";

interface Call {
  method: string;
  args: unknown[];
}

function fakeClient(response: { data: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const builder = new Proxy(
    {
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({
          data: response.data,
          error: response.error ?? null,
        }).then(resolve);
      },
    },
    {
      get(target, property) {
        if (property === "then") return target.then.bind(target);
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    },
  );
  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  } as unknown as SupabaseClient;
  return { calls, client };
}

const userId = "70000000-0000-0000-0000-000000000001";
const sessionId = "71000000-0000-0000-0000-000000000001";

describe("SupabaseConversationRepository", () => {
  it("creates authenticated sessions with an explicit owner", async () => {
    const row = {
      id: sessionId,
      user_id: userId,
      anonymous_id: null,
      title: "找房",
      summary: "",
      last_location_label: null,
      last_longitude: null,
      last_latitude: null,
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:00:00.000Z",
    };
    const fake = fakeClient({ data: row });
    const session = await createSupabaseConversationRepository(
      fake.client,
    ).createSession({ userId, title: "找房" });

    expect(session.userId).toBe(userId);
    expect(
      fake.calls.find((call) => call.method === "insert")?.args[0],
    ).toEqual({ user_id: userId, title: "找房" });
  });

  it("creates and reads a server-authorized anonymous session owner", async () => {
    const row = {
      id: sessionId,
      user_id: null,
      anonymous_id: "anonymous-owner-token",
      title: "匿名对话",
      summary: "",
      last_location_label: null,
      last_longitude: null,
      last_latitude: null,
      created_at: "2026-08-11T00:00:00.000Z",
      updated_at: "2026-08-11T00:00:00.000Z",
    };
    const fake = fakeClient({ data: row });
    const repository = createSupabaseConversationRepository(fake.client);
    const session = await repository.createSession({
      anonymousId: "anonymous-owner-token",
      title: "匿名对话",
    });

    expect(session).toMatchObject({
      userId: null,
      anonymousId: "anonymous-owner-token",
    });
    expect(
      fake.calls.find((call) => call.method === "insert")?.args[0],
    ).toEqual({ anonymous_id: "anonymous-owner-token", title: "匿名对话" });

    const restored = await repository.getSession(sessionId);
    expect(restored?.anonymousId).toBe("anonymous-owner-token");
    expect(fake.calls).toContainEqual({
      method: "eq",
      args: ["id", sessionId],
    });
  });

  it("lists messages in stable chronological order using explicit fields", async () => {
    const row = {
      id: "72000000-0000-0000-0000-000000000001",
      session_id: sessionId,
      role: "user",
      content: "找房",
      structured_payload: null,
      model_name: null,
      input_tokens: null,
      output_tokens: null,
      created_at: "2026-08-11T00:00:00.000Z",
    };
    const fake = fakeClient({ data: [row] });
    const messages = await createSupabaseConversationRepository(
      fake.client,
    ).listMessages(sessionId, { limit: 20 });

    expect(messages[0]?.role).toBe("user");
    expect(
      String(fake.calls.find((call) => call.method === "select")?.args[0]),
    ).not.toContain("*");
    expect(fake.calls).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(fake.calls).toContainEqual({ method: "limit", args: [20] });
  });

  it("rejects invalid roles before writing", async () => {
    const fake = fakeClient({ data: null });
    await expect(
      createSupabaseConversationRepository(fake.client).appendMessage({
        sessionId,
        role: "developer" as "user",
        content: "unsafe",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CONVERSATION_INPUT" });
    expect(fake.calls).toHaveLength(0);
  });
});
