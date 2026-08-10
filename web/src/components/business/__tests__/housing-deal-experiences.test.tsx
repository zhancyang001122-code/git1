import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DealDetail } from "@/components/business/deal-detail";
import { DealListExperience } from "@/components/business/deal-list-experience";
import { HouseDetail } from "@/components/business/house-detail";
import { HouseListExperience } from "@/components/business/house-list-experience";
import { demoDeals, demoHouses } from "@/features/business/demo-data";

const availableHouses = demoHouses.filter((house) => house.available);

describe("housing and deal experiences", () => {
  it("filters, sorts and locally favorites historical houses", () => {
    render(<HouseListExperience houses={availableHouses} />);

    expect(screen.getAllByRole("article")).toHaveLength(11);

    fireEvent.click(screen.getByRole("button", { name: "允许宠物" }));
    expect(screen.getAllByRole("article")).toHaveLength(
      availableHouses.filter((house) => house.petsAllowed).length,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "排序方式" }), {
      target: { value: "price_asc" },
    });
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("大关性价比一居");

    fireEvent.click(screen.getAllByRole("button", { name: "收藏房源" })[0]!);
    expect(
      screen.getByRole("button", { name: "取消收藏房源" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("收藏仅保存在当前页面，刷新后会重置。"),
    ).toBeInTheDocument();
  });

  it("filters demo deals without implying a live marketplace", () => {
    render(<DealListExperience deals={demoDeals} />);

    expect(screen.getAllByRole("article")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "火锅" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "山野火锅双人餐" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/团购、销量和价格均为演示业务数据/),
    ).toBeInTheDocument();
  });

  it("shows provenance and honest actions on a house detail", () => {
    render(<HouseDetail house={demoHouses[0]!} />);

    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
    expect(screen.getByText(/不代表当前仍可出租/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "问小智" })).toHaveAttribute(
      "href",
      expect.stringContaining("/xiaozhi/chat"),
    );

    fireEvent.click(screen.getByRole("button", { name: "预约演示" }));
    expect(screen.getByText(/不会提交真实预约/)).toBeInTheDocument();
  });

  it("shows package rules and blocks real purchase on a deal detail", () => {
    render(<DealDetail deal={demoDeals[0]!} />);

    expect(screen.getByText("演示业务数据")).toBeInTheDocument();
    expect(screen.getByText("有效期至 2027-12-31")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "模拟购买" }));
    expect(screen.getByText(/不会创建真实订单或扣款/)).toBeInTheDocument();
  });
});
