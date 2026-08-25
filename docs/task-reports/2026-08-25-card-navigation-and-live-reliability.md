# 卡片跳转、房源详情与 Live 稳定性修复报告

## 结论

本轮已修复用户看到的房源详情失败、不可点击卡片、缺失导航和推荐封面破图。Production 应用代码基线为提交 `5545e699750fa6dbcc2d224ffd9904434f0f1b8d`；本报告对应的后续提交只改变交付记录，不改变应用代码。

对话中原有的红色处理状态不是“千问没接通”，而是历史房源搜索与详情查询使用了不同数据源：`search_houses` 返回 Supabase `historical_houses` 的真实 UUID，`get_house_detail` 却只查询演示业务表 `houses`，因此同一轮连续 5 次得到 `HOUSE_NOT_FOUND`。

## 修复内容

- `HistoricalHousingSupabaseAdapter` 新增按 UUID 查询详情，房源搜索、工具详情和 `/houses/[id]` 共用同一 Housing Service。
- 小智历史房源卡、房源列表卡、团购卡、商品卡、推荐卡和首页四张演示卡均进入对应详情。
- POI 卡和房源详情提供高德步行导航；历史房源的 WGS84 坐标先转换为 GCJ-02，再生成高德 URI。
- 同一工具因同一业务错误重复失败两次后，本轮停止继续尝试，避免模型更换 ID 后形成无效循环。
- Supabase 旧种子数据中的 `/images/demo/*` 路径并不存在；Adapter 现在把不可信旧路径归一化为本地 WebP，并提供可访问的图片失败占位。
- 5 张原始 PNG 已转换为 41–271 KB 的本地 WebP。推荐页 10 张封面已在 Production 浏览器中验证 `naturalWidth > 0`。
- 首轮已强制某个取证工具时，只向千问发送该工具契约；Production 模型预算为 110 秒、函数上限为 120 秒、工具预算为 20 秒。
- Production Functions 最终固定在 `iad1`。`hkg1` 对百炼 Embedding 出现超时，`sin1` 对高德出现超时；在用户恢复百炼额度后，`iad1` 的高德、Embedding、Rerank、千问和多工具核心链路通过。

## 根因与边界

| 现象 | 已验证根因或状态 | 处理 |
| --- | --- | --- |
| 房源详情连续失败 | 历史搜索与演示详情 Repository 不一致 | 详情统一接入历史 Housing Service |
| 失败状态重复出现 | 只限制了参数错误，没有限制重复业务错误 | 同错误两次后阻断该工具 |
| 推荐封面破图 | 数据库存有不存在的 `/images/demo/*` | Adapter 白名单、本地 WebP、失败占位 |
| 百炼相关接口阶段性超时 | 用户确认当时百炼额度已耗尽 | 恢复额度；保留稳定错误和更合理预算 |
| 本机 Playwright 无法打开自定义域名 | 本机代理对该域名的 CONNECT 超时 | 使用同一 Production 的 Vercel 官方域名完成浏览器回归 |

`/api/health` 中的 `configured` 只表示环境变量存在，不能证明账号仍有余额或外部 API 当前健康。面试前仍要执行预检并确认百炼额度。

## 验证证据

```text
pnpm lint       PASS
pnpm typecheck  PASS
pnpm test       PASS (136 files, 589 tests)
pnpm build      PASS
pnpm test:e2e   PASS (54 passed, 1 skipped)
pnpm local:preflight PASS
```

Production 验证结果：

- `/api/health` 为 Live，Supabase、Qwen、Rerank、AMap 和 Housing 均为 configured。
- 生产核心预检通过非法请求边界、高德地理编码、真实 Rerank、首方 RAG，以及“历史房源 + 高德 + 官方租赁知识”主演示。
- 使用 `https://xiaozhi-local-life.vercel.app` 完成 Live 浏览器回归：主页、案例页、移动布局、房源、地图、商品、偏好提案和反馈均通过。
- 首页“更多演示内容”返回 4 个真实详情 URL。
- 推荐页 10 张封面全部加载成功。
- 历史房源 `817c19d8-3b22-5726-be92-fea6d70d190a` 的 Production 详情页可打开，标题为“整租·文欣商务楼 1室1厅 南”，导航指向 `https://uri.amap.com/navigation`，模式为 `walk` 且包含目的地坐标。

高德导航参数遵循[高德 URI API 路线规划文档](https://lbs.amap.com/api/uri-api/guide/travel/route)。百炼继续使用华北共享端点；若以后创建并使用百炼业务空间，可按阿里云文档改为相应的业务空间专属域名，当前不把它作为完成条件。

## 面试前操作

1. 在百炼控制台确认余额、额度和 API Key 状态。
2. 打开 `https://xiaozhi.zaneyang.xyz/api/health` 确认 Live 配置；若本机代理无法打开自定义域名，使用 `https://xiaozhi-local-life.vercel.app` 备用入口。
3. 执行 `pnpm interview:preflight`。该命令会产生真实模型调用和测试数据，不应作为高频监控。
4. 演示时先用固定主演示问题，再点击返回的房源卡进入详情，最后点击“高德步行导航”。
