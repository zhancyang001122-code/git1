import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PreferencesExperience } from "@/components/account/preferences-experience";

const disabledPreferences = {
  allowLongTermMemory: false as const,
  preferences: null,
  consentedAt: null,
  updatedAt: null,
};

const enabledPreferences = {
  allowLongTermMemory: true as const,
  preferences: {
    maxHousingBudget: 4_200,
    pets: ["可以养猫"],
    preferredAreas: ["武林广场"],
    dietaryRestrictions: ["不吃辣"],
    transportModes: ["地铁"],
    familyProfile: ["独居"],
  },
  consentedAt: "2026-08-12T01:00:00.000Z",
  updatedAt: "2026-08-12T02:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("PreferencesExperience", () => {
  it("loads an empty cloud state and requires confirmation before saving", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(disabledPreferences))
      .mockResolvedValueOnce(Response.json(enabledPreferences));
    vi.stubGlobal("fetch", fetchMock);

    render(<PreferencesExperience />);
    expect(screen.getByRole("status")).toHaveTextContent("正在读取云端偏好");
    await screen.findByRole("button", { name: "同意并保存到云端" });

    fireEvent.change(screen.getByLabelText("住房月预算上限"), {
      target: { value: "4200" },
    });
    fireEvent.change(screen.getByLabelText("宠物偏好"), {
      target: { value: "可以养猫" },
    });
    fireEvent.click(screen.getByRole("button", { name: "同意并保存到云端" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("alertdialog", { name: "授权保存长期偏好？" }),
    ).toHaveTextContent("住房月预算上限：¥4,200");
    fireEvent.click(screen.getByRole("button", { name: "确认保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      allowLongTermMemory: true,
      preferences: {
        maxHousingBudget: 4200,
        pets: ["可以养猫"],
        preferredAreas: [],
        dietaryRestrictions: [],
        transportModes: [],
        familyProfile: [],
      },
    });
    expect(
      await screen.findByRole("status", { name: "云端偏好已保存" }),
    ).toBeVisible();
  });

  it("deletes saved preferences only after a danger confirmation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(enabledPreferences))
      .mockResolvedValueOnce(Response.json(disabledPreferences));
    vi.stubGlobal("fetch", fetchMock);

    render(<PreferencesExperience />);
    await screen.findByRole("button", { name: "关闭长期记忆并删除偏好" });
    fireEvent.click(
      screen.getByRole("button", { name: "关闭长期记忆并删除偏好" }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("alertdialog", {
        name: "关闭长期记忆并删除偏好？",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      allowLongTermMemory: false,
    });
    expect(
      await screen.findByRole("status", { name: "长期偏好已从云端删除" }),
    ).toBeVisible();
  });

  it("keeps edited form values and reports the API error when saving fails", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(enabledPreferences))
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "PREFERENCES_UNAVAILABLE",
              message: "偏好服务暂时不可用，请稍后重试",
              requestId: "req-pref-1",
            },
          },
          { status: 503 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<PreferencesExperience />);
    const area = await screen.findByLabelText("常用区域");
    fireEvent.change(area, { target: { value: "武林广场,滨江" } });
    fireEvent.click(screen.getByRole("button", { name: "更新云端偏好" }));
    fireEvent.click(screen.getByRole("button", { name: "确认更新" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "偏好服务暂时不可用，请稍后重试",
    );
    expect(screen.getByLabelText("常用区域")).toHaveValue("武林广场,滨江");
    expect(screen.queryByLabelText("云端偏好已保存")).not.toBeInTheDocument();
  });
});
