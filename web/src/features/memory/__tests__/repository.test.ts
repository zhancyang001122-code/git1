import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createSupabaseMemoryRepository } from "@/features/memory/repository";

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
const row = {
  user_id: userId,
  max_housing_budget: 3500,
  preferred_areas: ["拱墅区"],
  dietary_restrictions: [],
  transport_modes: ["地铁"],
  family_profile: ["独居"],
  allow_long_term_memory: true,
  consented_at: "2026-08-11T00:00:00.000Z",
  updated_at: "2026-08-11T00:00:00.000Z",
};

describe("SupabaseMemoryRepository", () => {
  it("reads only the requested owner with explicit fields", async () => {
    const fake = fakeClient({ data: row });
    const value = await createSupabaseMemoryRepository(
      fake.client,
    ).getPreferences(userId);

    expect(value?.maxHousingBudget).toBe(3500);
    expect(fake.calls).toContainEqual({
      method: "eq",
      args: ["user_id", userId],
    });
    expect(
      String(fake.calls.find((call) => call.method === "select")?.args[0]),
    ).not.toContain("*");
  });

  it("rejects an invalid server authorization time", async () => {
    const fake = fakeClient({ data: row });
    await expect(
      createSupabaseMemoryRepository(fake.client).upsertPreferences(
        userId,
        { preferredAreas: ["拱墅区"] },
        "not-a-time",
      ),
    ).rejects.toMatchObject({ code: "INVALID_PREFERENCES" });
    expect(fake.calls).toHaveLength(0);
  });

  it("upserts a user-owned row using snake_case database fields", async () => {
    const fake = fakeClient({ data: row });
    await createSupabaseMemoryRepository(fake.client).upsertPreferences(
      userId,
      {
        maxHousingBudget: 3500,
        preferredAreas: ["拱墅区"],
        dietaryRestrictions: [],
        transportModes: ["地铁"],
        familyProfile: ["独居"],
      },
      "2026-08-11T00:00:00.000Z",
    );

    const upsert = fake.calls.find((call) => call.method === "upsert");
    expect(upsert?.args[0]).toMatchObject({
      user_id: userId,
      max_housing_budget: 3500,
      allow_long_term_memory: true,
    });
    expect(upsert?.args[1]).toEqual({ onConflict: "user_id" });
  });

  it("deletes only the requested owner row", async () => {
    const fake = fakeClient({ data: null });
    await createSupabaseMemoryRepository(fake.client).deletePreferences(userId);
    expect(fake.calls).toContainEqual({ method: "delete", args: [] });
    expect(fake.calls).toContainEqual({
      method: "eq",
      args: ["user_id", userId],
    });
  });
});
