import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = process.env.PREVIEW_DIR;
if (!outputDir) throw new Error("PREVIEW_DIR is required");

const pages = [
  ["01-home", "/", "首页"],
  ["02-discover", "/discover", "推荐"],
  [
    "03-community-detail",
    "/discover/50000000-0000-0000-0000-000000000001",
    "社区详情",
  ],
  ["04-xiaozhi", "/xiaozhi", "小智欢迎页"],
  [
    "05-chat",
    "/xiaozhi/chat?q=找3500元以内允许养猫的房源&debug=true",
    "小智对话",
  ],
  ["06-existing-chat", "/xiaozhi/chat/demo-housing", "已有会话"],
  ["07-chat-history", "/xiaozhi/history", "对话历史"],
  ["08-messages", "/messages", "消息"],
  ["09-me", "/me", "我的"],
  ["10-favorites", "/me/favorites", "我的收藏"],
  ["11-account-history", "/me/history", "浏览与对话历史"],
  ["12-orders", "/me/orders", "演示订单"],
  ["13-addresses", "/me/addresses", "地址管理"],
  ["14-preferences", "/me/preferences", "小智偏好"],
  ["15-feedback", "/me/feedback", "知识纠错与反馈"],
  ["16-houses", "/houses", "房源列表"],
  [
    "17-house-detail",
    "/houses/20000000-0000-0000-0000-000000000001",
    "房源详情",
  ],
  ["18-deals", "/deals", "团购列表"],
  ["19-deal-detail", "/deals/30000000-0000-0000-0000-000000000001", "团购详情"],
  ["20-market", "/market", "线上超市"],
  [
    "21-store-detail",
    "/market/stores/10000000-0000-0000-0000-000000000001",
    "门店详情",
  ],
  [
    "22-product-detail",
    "/market/products/40000000-0000-0000-0000-000000000001",
    "商品详情",
  ],
  ["23-cart", "/cart", "购物车"],
  ["24-nearby", "/nearby", "周边服务"],
  ["25-knowledge-admin", "/knowledge-admin", "知识运营"],
  ["26-knowledge-review", "/knowledge-admin/candidate-refund-001", "候选审核"],
] as const;

test("capture every frontend route template", async ({ browser }) => {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
  });
  for (const [slug, route] of pages) {
    const page = await context.newPage();
    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.ok(), route).toBe(true);
    if (slug === "05-chat") {
      await page.getByRole("button", { name: "发送" }).click();
      await expect(page.getByText(/已从演示房源数据查询到/)).toBeVisible();
    }
    await page.screenshot({
      path: path.join(outputDir, `${slug}.png`),
      fullPage: true,
    });
    await page.close();
  }
  await context.close();

  const cards = pages
    .map(
      ([slug, route, title]) =>
        `<article><h2>${title}</h2><p><code>${route}</code></p><a href="${slug}.png"><img src="${slug}.png" alt="${title} 页面预览"></a></article>`,
    )
    .join("\n");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>小智前端逐页预览</title><style>body{margin:0;background:#eef1f4;color:#17202a;font:14px system-ui;padding:24px}header{max-width:1200px;margin:auto auto 24px}main{max-width:1200px;margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}article{background:#fff;border-radius:18px;padding:14px;box-shadow:0 8px 28px #18212a14}h1{font-size:28px}h2{font-size:16px;margin:0 0 6px}p{color:#667085;margin:0 0 12px;overflow-wrap:anywhere}img{display:block;width:100%;height:620px;object-fit:cover;object-position:top;border:1px solid #e5e7eb;border-radius:12px}</style></head><body><header><h1>小智前端逐页预览</h1><p>共 ${pages.length} 个路由模板，点击图片查看完整长截图。</p></header><main>${cards}</main></body></html>`;
  await writeFile(path.join(outputDir, "index.html"), html, "utf8");
});
