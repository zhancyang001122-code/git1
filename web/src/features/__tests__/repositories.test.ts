import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createRepositories } from "@/features/repositories";

function fakeClient(response: {
  data: unknown;
  count?: number | null;
  error?: unknown;
}): SupabaseClient {
  const builder = new Proxy(
    {
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({
          data: response.data,
          count: response.count ?? null,
          error: response.error ?? null,
        }).then(resolve);
      },
    },
    {
      get(target, property) {
        if (property === "then") return target.then.bind(target);
        return () => builder;
      },
    },
  );
  return { from: () => builder } as unknown as SupabaseClient;
}

const liveEnvironment = {
  NEXT_PUBLIC_DEMO_MODE: "false",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
};

describe("repository factory", () => {
  it("uses an explicitly visible demo mode without external configuration", async () => {
    const repositories = await createRepositories({
      environment: { NEXT_PUBLIC_DEMO_MODE: "true" },
    });
    const houses = await repositories.business.listHouses({ limit: 2 });

    expect(repositories.mode).toEqual({
      mode: "demo",
      reason: "产品演示模式已开启",
    });
    expect(houses.items).toHaveLength(2);
    await expect(
      repositories.memory.upsertPreferences(
        "70000000-0000-0000-0000-000000000001",
        { pets: ["猫"] },
        "2026-08-12T00:00:00.000Z",
      ),
    ).rejects.toMatchObject({ code: "DEMO_PERSISTENCE_DISABLED" });
  });

  it("rejects live mode when public Supabase configuration is missing", async () => {
    await expect(
      createRepositories({ environment: { NEXT_PUBLIC_DEMO_MODE: "false" } }),
    ).rejects.toMatchObject({ code: "SUPABASE_NOT_CONFIGURED" });
  });

  it("uses Supabase in live mode and does not require admin credentials for public reads", async () => {
    const repositories = await createRepositories({
      environment: liveEnvironment,
      serverClient: fakeClient({ data: [], count: 0 }),
    });
    await repositories.business.listHouses({});

    expect(repositories.mode).toEqual({ mode: "supabase" });
    await expect(
      repositories.aiOps.recordToolRun({
        toolName: "search_houses",
        status: "running",
        input: {},
        requestId: "74000000-0000-0000-0000-000000000001",
      }),
    ).rejects.toMatchObject({ code: "SUPABASE_ADMIN_NOT_CONFIGURED" });
  });

  it("keeps provider failures visible when fallback is disabled", async () => {
    const repositories = await createRepositories({
      environment: liveEnvironment,
      serverClient: fakeClient({ data: null, error: { message: "offline" } }),
    });
    await expect(repositories.business.listHouses({})).rejects.toMatchObject({
      code: "SUPABASE_QUERY_FAILED",
    });
    expect(repositories.mode).toEqual({ mode: "supabase" });
  });

  it("falls back only when explicitly enabled and marks the response source", async () => {
    const repositories = await createRepositories({
      environment: { ...liveEnvironment, SUPABASE_FALLBACK_TO_DEMO: "true" },
      serverClient: fakeClient({ data: null, error: { message: "offline" } }),
    });
    const page = await repositories.business.listHouses({ limit: 2 });
    const stores = await repositories.business.listStores();

    expect(page.items).toHaveLength(2);
    expect(stores.length).toBeGreaterThan(0);
    expect(repositories.mode).toEqual({
      mode: "demo_fallback",
      reason: "Supabase 暂时不可用，已显式回退到演示数据",
    });
  });
});
