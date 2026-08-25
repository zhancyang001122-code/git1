import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommunityPostCard } from "@/components/business/community-post-card";
import { DealCard } from "@/components/business/deal-card";
import { HouseCard } from "@/components/business/house-card";
import { ProductCard } from "@/components/business/product-card";
import { StoreCard } from "@/components/business/store-card";
import { DetailShell } from "@/components/layout/detail-shell";
import {
  demoCommunityPosts,
  demoDeals,
  demoHouses,
  demoProducts,
  demoStores,
} from "@/features/business/demo-data";

const house = demoHouses[0]!;
const deal = demoDeals[0]!;
const product = demoProducts[0]!;
const store = demoStores[0]!;
const post = demoCommunityPosts[0]!;

describe("business presentation components", () => {
  it("renders typed cards with stable detail links", () => {
    render(
      <>
        <HouseCard house={house} />
        <DealCard deal={deal} />
        <ProductCard product={product} />
        <StoreCard store={store} />
        <CommunityPostCard post={post} />
      </>,
    );

    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(
      screen.getByRole("link", { name: /武林晴川一居室/ }),
    ).toHaveAttribute("href", `/houses/${house.id}`);
    expect(
      screen.getByRole("link", { name: /山野火锅双人餐/ }),
    ).toHaveAttribute("href", `/deals/${deal.id}`);
    expect(screen.getByAltText(/西湖边适合慢慢走/)).toHaveAttribute(
      "src",
      expect.stringContaining("/images/home/hangzhou-community.webp"),
    );
  });

  it("labels demo and imported historical housing without conflating them", () => {
    render(
      <>
        <HouseCard house={house} />
        <HouseCard
          house={{ ...house, id: `${house.id}-history`, isDemo: false }}
        />
        <DealCard deal={deal} />
        <ProductCard product={product} />
        <StoreCard store={store} />
        <CommunityPostCard post={post} />
      </>,
    );

    expect(screen.getByText("2024 历史房源数据")).toBeInTheDocument();
    expect(screen.getAllByText("演示业务数据")).toHaveLength(5);
    expect(screen.getByText("2024 历史记录")).toBeInTheDocument();
    expect(screen.getByText("2024 演示记录")).toBeInTheDocument();
    expect(screen.queryByText(/实时在租|当前可租/)).not.toBeInTheDocument();
  });

  it("shows an accessible fallback instead of a broken preview", () => {
    render(<CommunityPostCard post={post} />);

    fireEvent.error(screen.getByAltText(/西湖边适合慢慢走/));

    expect(
      screen.getByRole("img", { name: /图片暂不可用/ }),
    ).toBeInTheDocument();
  });

  it("uses a detail shell with one main heading and no bottom navigation", () => {
    render(
      <DetailShell title="房源详情" backHref="/houses">
        <p>详情内容</p>
      </DetailShell>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "房源详情" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回" })).toHaveAttribute(
      "href",
      "/houses",
    );
    expect(screen.queryByRole("navigation", { name: "主导航" })).toBeNull();
  });
});
