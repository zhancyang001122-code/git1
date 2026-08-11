import { describe, expect, it, vi } from "vitest";

import {
  createPreferencesHandlers,
  type PreferencesApiRuntime,
} from "@/app/api/preferences/route";

const userId = "70000000-0000-0000-0000-000000000001";
const enabled = {
  allowLongTermMemory: true as const,
  preferences: {
    maxHousingBudget: 3_500,
    preferredAreas: ["拱墅区"],
    dietaryRestrictions: [],
    transportModes: ["地铁"],
    familyProfile: [],
  },
  consentedAt: "2026-08-12T08:00:00.000Z",
  updatedAt: "2026-08-12T08:00:00.000Z",
};

function runtime(
  authenticatedUserId: string | null = userId,
): PreferencesApiRuntime {
  return {
    getAuthenticatedUserId: vi.fn(async () => authenticatedUserId),
    getPreferences: vi.fn(async () => enabled),
    patchPreferences: vi.fn(async () => enabled),
  };
}

function patchRequest(body: unknown, origin = "https://xiaozhi.example") {
  return new Request("https://xiaozhi.example/api/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("GET/PATCH /api/preferences", () => {
  it("requires auth before reading or writing", async () => {
    const value = runtime(null);
    const handlers = createPreferencesHandlers(async () => value);
    const getResponse = await handlers.GET(
      new Request("https://xiaozhi.example/api/preferences"),
    );
    const patchResponse = await handlers.PATCH(
      patchRequest({
        allowLongTermMemory: true,
        preferences: { preferredAreas: ["拱墅区"] },
      }),
    );

    for (const response of [getResponse, patchResponse]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: { code: "AUTH_REQUIRED", retryable: false },
      });
    }
    expect(value.getPreferences).not.toHaveBeenCalled();
    expect(value.patchPreferences).not.toHaveBeenCalled();
  });

  it("reads only the authenticated user's cloud preferences", async () => {
    const value = runtime();
    const response = await createPreferencesHandlers(async () => value).GET(
      new Request("https://xiaozhi.example/api/preferences"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(enabled);
    expect(value.getPreferences).toHaveBeenCalledWith(userId);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects client identity and consent time before patching", async () => {
    const value = runtime();
    const handlers = createPreferencesHandlers(async () => value);
    for (const body of [
      {
        allowLongTermMemory: true,
        preferences: { preferredAreas: ["拱墅区"] },
        userId: "70000000-0000-0000-0000-000000000002",
      },
      {
        allowLongTermMemory: true,
        preferences: { preferredAreas: ["拱墅区"] },
        consentedAt: "2026-01-01T00:00:00.000Z",
      },
    ]) {
      const response = await handlers.PATCH(patchRequest(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: "PREFERENCES_INVALID" },
      });
    }
    expect(value.patchPreferences).not.toHaveBeenCalled();
  });

  it("patches with the session user and rejects cross-origin writes", async () => {
    const value = runtime();
    const handlers = createPreferencesHandlers(async () => value);
    const input = {
      allowLongTermMemory: true as const,
      preferences: { dietaryRestrictions: ["不吃辣"] },
    };
    const response = await handlers.PATCH(patchRequest(input));
    expect(response.status).toBe(200);
    expect(value.patchPreferences).toHaveBeenCalledWith(userId, input);

    const rejected = await handlers.PATCH(
      patchRequest(input, "https://evil.example"),
    );
    expect(rejected.status).toBe(403);
    expect(value.patchPreferences).toHaveBeenCalledTimes(1);
  });
});
