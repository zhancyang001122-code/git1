import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentResultCards } from "@/components/chat/agent-result-cards";

afterEach(() => vi.unstubAllGlobals());

describe("AgentResultCards", () => {
  it("renders a source-labelled, keyboard-focusable housing result", () => {
    render(
      <AgentResultCards
        cards={[
          {
            kind: "house",
            data: {
              id: "20000000-0000-0000-0000-000000000001",
              name: "武林晴川一居室",
              district: "拱墅区",
              address: "武林广场演示房源 A",
              priceMonthly: 3_280,
              roomType: "一居室",
              areaSqm: 43,
              isDemo: false,
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /武林晴川一居室/ }),
    ).toHaveAttribute("href", "/houses/20000000-0000-0000-0000-000000000001");
    expect(screen.getByText("¥3280/月")).toBeInTheDocument();
    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
  });

  it("distinguishes search availability from exact stock", () => {
    render(
      <AgentResultCards
        cards={[
          {
            kind: "product",
            data: {
              id: "40000000-0000-0000-0000-000000000001",
              name: "鲜牛奶 950ml",
              category: "乳品",
              price: 15.9,
              inStock: true,
              isDemo: true,
            },
          },
          {
            kind: "product",
            data: {
              id: "40000000-0000-0000-0000-000000000002",
              name: "无菌鸡蛋 10 枚",
              category: "蛋品",
              price: 18.8,
              inStock: true,
              availableStock: 19,
              isDemo: true,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("演示有货")).toBeInTheDocument();
    expect(screen.getByText("演示库存 19")).toBeInTheDocument();
  });

  it("links historical rows to the shared house detail route", () => {
    render(
      <AgentResultCards
        cards={[
          {
            kind: "house",
            data: {
              id: "house_abc",
              name: "武林广场旁整租两居",
              district: "拱墅区",
              address: "拱墅区武林路 1 号",
              priceMonthly: 3_800,
              roomType: "2室1厅",
              areaSqm: 65,
              distanceM: 23.2,
              isDemo: false,
              detailAvailable: false,
              sourceUrl: "https://example.invalid/HZ-001",
              location: { longitude: 120.1552, latitude: 30.2742 },
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /查看房源 武林广场旁整租两居/ }),
    ).toHaveAttribute("href", "/houses/house_abc");
    expect(screen.getByText("距查询中心 23 米")).toBeInTheDocument();
  });

  it("links an AMap place card to walking navigation", () => {
    render(
      <AgentResultCards
        cards={[
          {
            kind: "place",
            data: {
              id: "amap-demo-market-1",
              name: "武林生活超市（演示）",
              address: "体育场路演示地址 1 号",
              category: "购物服务",
              distanceM: 180,
              source: "amap",
              isDemo: true,
              location: { longitude: 120.16328, latitude: 30.27415 },
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("180 米")).toBeInTheDocument();
    expect(screen.getByText("高德地图")).toBeInTheDocument();
    expect(screen.getByText("接口演示数据")).toBeInTheDocument();
    const link = screen.getByRole("link", {
      name: "在高德地图导航到武林生活超市（演示）",
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("href")).toContain(
      "https://uri.amap.com/navigation?",
    );
    expect(link.getAttribute("href")).toContain("mode=walk");
  });

  it("cancels a preference proposal without making any request", () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AgentResultCards
        cards={[
          {
            kind: "preference_proposal",
            data: {
              id: "preference-proposal:dietary_restrictions",
              proposed: true,
              key: "dietary_restrictions",
              value: ["不吃辣"],
              requiresConfirmation: true,
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("饮食限制")).toBeInTheDocument();
    expect(screen.getByText("不吃辣")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "已取消，本次没有保存长期偏好",
    );
  });

  it("confirms one allowed preference field through the authenticated API", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        allowLongTermMemory: true,
        preferences: {
          maxHousingBudget: null,
          preferredAreas: [],
          dietaryRestrictions: ["不吃辣"],
          transportModes: [],
          familyProfile: [],
        },
        consentedAt: "2026-08-12T01:00:00.000Z",
        updatedAt: "2026-08-12T01:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AgentResultCards
        cards={[
          {
            kind: "preference_proposal",
            data: {
              id: "preference-proposal:dietary_restrictions",
              proposed: true,
              key: "dietary_restrictions",
              value: ["不吃辣"],
              requiresConfirmation: true,
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      allowLongTermMemory: true,
      preferences: { dietaryRestrictions: ["不吃辣"] },
    });
    expect(
      await screen.findByRole("status", { name: "偏好已保存到云端" }),
    ).toBeVisible();
  });

  it("redirects an anonymous confirmation to login with a safe return path", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 }),
        ),
    );
    const navigate = vi.fn();
    render(
      <AgentResultCards
        returnPath="/xiaozhi/chat/demo-housing"
        navigate={navigate}
        cards={[
          {
            kind: "preference_proposal",
            data: {
              id: "preference-proposal:max_housing_budget",
              proposed: true,
              key: "max_housing_budget",
              value: 4_000,
              requiresConfirmation: true,
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认保存" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "/login?next=%2Fxiaozhi%2Fchat%2Fdemo-housing",
      ),
    );
  });

  it("preserves a failed proposal so the user can retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "PREFERENCES_UNAVAILABLE",
              message: "偏好服务暂时不可用，请稍后重试",
            },
          },
          { status: 503 },
        ),
      ),
    );
    render(
      <AgentResultCards
        cards={[
          {
            kind: "preference_proposal",
            data: {
              id: "preference-proposal:preferred_areas",
              proposed: true,
              key: "preferred_areas",
              value: ["滨江"],
              requiresConfirmation: true,
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "偏好服务暂时不可用，请稍后重试",
    );
    expect(screen.getByText("滨江")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认保存" })).toBeEnabled();
  });
});
