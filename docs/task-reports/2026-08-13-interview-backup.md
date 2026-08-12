# 面试离线备份与脚本验收

日期：2026-08-13

## 结论

面试备份已生成在仓库外：`C:\Users\Administrator\Desktop\xiaozhi-interview-backup-20260813`。目录包含 26 个当前页面的 430px 长截图、Production 二维码、三段 Production Live 录屏、录制证据 JSON 和一个可离线打开的索引页。

录屏不是手工点完后主观认为“看起来正常”。生成器先要求 `/api/health` 为 Live 且 Supabase、Qwen、AMap、housing 全部 `configured`，再分别断言：

1. 历史房源与高德场景同时出现“2024 历史房源数据”和“高德地图”，不出现“接口演示数据”。
2. 首方 RAG 场景出现目标文章、“作品集首方说明”和生效日期，不混入“模拟知识资料”。
3. 商品与偏好场景出现“演示业务数据”和待确认偏好，点击取消后出现“没有保存长期偏好”。

任何断言失败都会终止任务，不生成成功索引。

## 产物

- `index.html`：离线入口，明确写明“此前成功回归，不代表面试当下网络仍可用”。
- `production-qr.png`：只编码 `https://xiaozhi.zaneyang.xyz`。
- `recording-evidence.json`：录制时间、Git commit、Production URL、健康状态与场景清单。
- `videos/01-housing-amap.webm`：历史房源 + 高德。
- `videos/02-first-party-rag.webm`：作品集首方 RAG。
- `videos/03-commerce-preference.webm`：演示商品 + 授权偏好。
- `screens/index.html`：26 个路由模板的截图索引。

## 可重复执行

页面截图：

```powershell
$env:PREVIEW_DIR='C:\absolute\path\screens'
pnpm preview:capture
```

Production 录屏：

```powershell
$env:INTERVIEW_BACKUP_DIR='C:\absolute\path\backup'
$env:PRODUCTION_URL='https://xiaozhi.zaneyang.xyz'
pnpm interview:record-production
```

录屏生成器固定拒绝其他域名，避免误录 Preview 或旧 Vercel 别名。Playwright 原始临时视频只允许在目标 `videos` 目录内按 `page@*.webm` 白名单清理；三个命名后的证据视频不删除。

## 不能由本报告证明的事项

- 录屏不能证明面试当下公网或供应商仍然在线，因此切换到离线页时必须口头说明。
- Demo 页面截图不能证明 Supabase、高德或千问刚刚返回了结果。
- 录屏没有把企业客服资料、qwen3-rerank 在线调用或外部值班通知包装成已完成。
