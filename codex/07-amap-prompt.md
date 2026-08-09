# Phase 7：高德地图工具

执行实施计划 Task 7。

实现 `MapsService`：

```ts
interface MapsService {
  geocode(input: GeocodeInput, signal?: AbortSignal): Promise<GeoPoint | null>;
  searchNearby(input: NearbySearchInput, signal?: AbortSignal): Promise<PlaceResult[]>;
  walkingRoute(input: WalkingRouteInput, signal?: AbortSignal): Promise<WalkingRouteResult | null>;
}
```

要求：

- Web Service key 仅服务端使用。
- 支持固定地点和浏览器授权当前位置；拒绝定位时回退杭州武林广场并明确提示。
- 统一经纬度顺序为 `{longitude, latitude}`，调用高德时才序列化 `longitude,latitude`。
- POI 结果标注 source=amap，不持久化为永久业务事实。
- 超时、配额、无结果、非法响应分别映射稳定错误码。
- 多房源查询周边时限制并发和候选数量，避免 N×M 爆炸调用。
- 用 fixture 测试，不让 CI 请求真实高德。
