import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NearbyExperience } from "@/components/market/nearby-experience";
import { SelectedLocationProvider } from "@/features/location/selected-location-provider";

const defaultLocation = {
  name: "武林广场",
  city: "杭州",
  point: { longitude: 120.163102, latitude: 30.274085 },
  wgs84Point: { longitude: 120.1585, latitude: 30.2764 },
};

afterEach(() => vi.restoreAllMocks());

function renderNearby() {
  return render(
    <SelectedLocationProvider
      defaultLocation={{ ...defaultLocation, source: "default" }}
    >
      <NearbyExperience />
    </SelectedLocationProvider>,
  );
}

describe("NearbyExperience", () => {
  it("asks before using browser location", () => {
    renderNearby();

    expect(screen.getByText("杭州 · 武林广场")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用我的位置" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "手动选择地点" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "使用武林广场" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("武林生活超市（演示）")).not.toBeInTheDocument();
  });

  it("falls back visibly to Wulin Square when geolocation is denied", async () => {
    renderNearby();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success, failure) =>
          failure?.({
            code: 1,
            message: "denied",
            PERMISSION_DENIED: 1,
          } as GeolocationPositionError),
        ),
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "demo",
          warning: "当前为高德接口演示数据，未发起实时调用",
          center: { longitude: 120.163102, latitude: 30.274085 },
          data: [
            {
              id: "amap-demo-market-1",
              name: "武林生活超市（演示）",
              address: "演示地址",
              category: "购物服务",
              distanceM: 180,
              location: { longitude: 120.164, latitude: 30.273 },
              source: "amap",
              isDemo: true,
            },
          ],
        }),
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "使用我的位置" }));

    expect(
      await screen.findByText(/定位权限未开启.*继续使用杭州 · 武林广场/),
    ).toBeInTheDocument();
    expect(await screen.findByText("武林生活超市（演示）")).toBeInTheDocument();
    const navigation = screen.getByRole("link", {
      name: "在高德地图导航到武林生活超市（演示）",
    });
    expect(navigation).toHaveAttribute("target", "_blank");
    expect(navigation.getAttribute("href")).toContain(
      "https://uri.amap.com/navigation?",
    );
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/maps/nearby",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("retries only the failed nearby search", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "高德服务暂时不可用" },
          }),
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: "demo",
            center: defaultLocation.point,
            data: [],
          }),
        ),
      );

    renderNearby();
    await user.click(screen.getByRole("button", { name: "查询当前地点周边" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "高德服务暂时不可用",
    );

    await user.click(screen.getByRole("button", { name: "重试周边查询" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
