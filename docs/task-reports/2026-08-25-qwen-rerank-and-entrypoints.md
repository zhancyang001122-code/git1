# Qwen Rerank 与 Production 双入口验收

## 结论

`qwen3-rerank` 已完成独立在线调用、Production 启用和 Knowledge Service 实际应用验证。线上网站本身没有宕机；用户无法打开正式域名的直接原因是 Windows 系统代理 `127.0.0.1:7897` 对该自定义域名建立 CONNECT 后超时。相同代理能够访问 Vercel 正式别名，因此项目保留两个指向同一部署的入口：

- 正式域名：`https://xiaozhi.zaneyang.xyz`
- 代理兼容备用入口：`https://xiaozhi-local-life.vercel.app`

## Rerank 证据

实现提交：`731d33d95681f36acb6640859cce43d81323906d`

独立模型 smoke test：

```text
model=qwen3-rerank
resultCount=3
topIndex=0
topScore=0.9022111756439186
usageTokens=125
```

Production Knowledge Service：

```text
service=configured
rankingStrategy=hybrid_rerank
resultCount=5
topTitle=小智作品集：历史房源数据边界
warnings=[]
```

完整 `pnpm interview:preflight` 在相同提交上通过，并输出 `rerank=qwen3-rerank/applied`。检索响应新增稳定字段：

- `hybrid`：只执行混合召回；
- `hybrid_rerank`：真实重排成功；
- `hybrid_rerank_fallback`：重排失败并退回混合排序，同时包含 `RERANK_FALLBACK`；
- `demo`：确定性演示知识。

预检要求 Production 必须是 `hybrid_rerank`；出现回退会失败，不能用“仍有搜索结果”冒充 Rerank 正常。

## 入口故障证据

诊断结果：

1. `xiaozhi.zaneyang.xyz` DNS 正常解析到 Vercel，直连首页和 `/case-study` 均返回 HTTP 200。
2. Windows Internet Settings 启用了 `127.0.0.1:7897` 系统代理。
3. 显式通过该代理访问自定义域名时，代理返回 `200 Connection established`，随后 TLS 请求超时。
4. 通过同一代理访问 `xiaozhi-local-life.vercel.app` 的首页和 `/case-study` 均返回 HTTP 200。
5. 以 Edge + 该代理对 Vercel 备用入口执行完整 Live 回归通过，包括移动布局、房源、高德、商品、偏好提案和反馈。

因此修复不是修改 Next.js 页面，也不是更换 DNS。项目把 Vercel 正式别名作为代理兼容备用入口，并写入 README 与三分钟演示脚本。没有自动修改 Windows 系统代理或代理软件规则，避免影响用户电脑的其他网络访问。

## 验证命令

```powershell
cd web
pnpm external:verify-qwen-rerank
pnpm external:verify-qwen-rerank-production
pnpm interview:preflight

$env:DEPLOYMENT_URL='https://xiaozhi-local-life.vercel.app'
$env:DEPLOYMENT_PROXY_SERVER='http://127.0.0.1:7897'
node scripts/verify-production.mjs --mode=live
```

## 诚实边界

- 当前证据证明 Rerank 被真实调用并应用，不证明它已经提高企业场景指标。
- 没有企业评测集时，不能宣称准确率提升百分比。
- 正式域名对无该代理问题的访客仍可正常使用；备用域名用于当前电脑和面试现场快速切换。
