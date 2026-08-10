import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentResultCards } from "@/components/chat/agent-result-cards";

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
              petsAllowed: true,
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

  it("shows AMap place distance while keeping fixture status visible", () => {
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
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("180 米")).toBeInTheDocument();
    expect(screen.getByText("高德地图")).toBeInTheDocument();
    expect(screen.getByText("接口演示数据")).toBeInTheDocument();
  });
});
