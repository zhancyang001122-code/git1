import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CartExperience } from "@/components/market/cart-experience";
import { MarketExperience } from "@/components/market/market-experience";
import { ProductDetail } from "@/components/market/product-detail";
import { DemoCartProvider } from "@/features/cart/demo-cart";
import { demoProducts, demoStores } from "@/features/business/demo-data";

describe("demo cart", () => {
  it("shares local cart state between market and cart views", () => {
    render(
      <DemoCartProvider>
        <MarketExperience stores={demoStores} products={demoProducts} />
        <CartExperience products={demoProducts} />
      </DemoCartProvider>,
    );

    expect(screen.getByText("购物车还是空的")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "加入购物车" })[0]!);
    expect(screen.getAllByText("购物车 1 件")).toHaveLength(2);
    expect(
      screen.getByRole("status", { name: "已加入购物车" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "模拟结算" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空购物车" }));
    expect(
      screen.getByRole("alertdialog", { name: "清空购物车？" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认清空" }));
    expect(screen.getByText("购物车还是空的")).toBeInTheDocument();
  });

  it("blocks out-of-stock products and explains demo boundaries", () => {
    const outOfStock = demoProducts.find(
      (product) => product.availableStock === 0,
    )!;

    render(
      <DemoCartProvider>
        <ProductDetail product={outOfStock} store={demoStores[1]!} />
      </DemoCartProvider>,
    );

    expect(screen.getByRole("button", { name: "演示缺货" })).toBeDisabled();
    expect(screen.getByText(/不会创建真实订单/)).toBeInTheDocument();
  });
});
