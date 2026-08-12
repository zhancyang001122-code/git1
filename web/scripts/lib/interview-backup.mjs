import path from "node:path";

export const PRODUCTION_INTERVIEW_URL = "https://xiaozhi.zaneyang.xyz";

const requiredServices = ["supabase", "qwen", "amap", "housing"];

export function assertLiveHealth(health) {
  const valid =
    health?.app === "xiaozhi" &&
    health?.mode === "live" &&
    requiredServices.every(
      (service) => health?.services?.[service] === "configured",
    );
  if (!valid) {
    throw new Error("Production Live health is not fully configured");
  }
}

export function isDisposablePlaywrightVideo(filePath, videosDir) {
  const resolvedFile = path.resolve(filePath);
  const resolvedDirectory = path.resolve(videosDir);
  return (
    path.dirname(resolvedFile) === resolvedDirectory &&
    /^page@[a-f0-9]+\.webm$/i.test(path.basename(resolvedFile))
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildBackupIndex({
  recordedAt,
  commit,
  productionUrl,
  screenshotsAvailable = false,
  qrAvailable = false,
  scenes,
}) {
  const cards = scenes
    .map(
      ({ title, file, evidence }) => `
        <article>
          <h2>${escapeHtml(title)}</h2>
          <video controls preload="metadata" src="${escapeHtml(file)}"></video>
          <p>${escapeHtml(evidence)}</p>
        </article>`,
    )
    .join("");
  const screenshotItem = screenshotsAvailable
    ? '<a href="screens/index.html">查看 26 个页面的完整离线截图</a>'
    : "尚未生成页面截图";
  const qrItem = qrAvailable
    ? '<a href="production-qr.png">查看 Production 二维码</a>'
    : "尚未生成二维码";
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>小智面试离线备份</title>
    <style>
      :root{font-family:system-ui,sans-serif;color:#17202a;background:#eef1f6}body{max-width:1100px;margin:auto;padding:32px 18px}header,article{background:#fff;border-radius:18px;padding:20px;box-shadow:0 8px 32px #1f293714}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:20px}h1{margin-top:0;font-size:28px}h2{font-size:18px}p{line-height:1.65;color:#475467}video{display:block;width:min(100%,430px);margin:auto;border:1px solid #d0d5dd;border-radius:14px;background:#111}code{overflow-wrap:anywhere}.warning{color:#912018;background:#fef3f2;border-radius:12px;padding:12px}
    </style>
  </head>
  <body>
    <header>
      <h1>小智面试离线备份</h1>
      <p class="warning">这是此前成功回归的录屏证据，不代表面试当下网络仍然可用；现场切换到本页时必须明确说明。</p>
      <p>Production：<code>${escapeHtml(productionUrl)}</code><br>录制时间：<code>${escapeHtml(recordedAt)}</code><br>Git commit：<code>${escapeHtml(commit.slice(0, 8))}</code></p>
      <p>${screenshotItem} · ${qrItem}</p>
    </header>
    <main>${cards}</main>
  </body>
</html>`;
}
