const loopbackHostnames = new Set(["127.0.0.1", "localhost", "::1"]);

const serviceConfigurationNames = {
  supabase: "NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  qwen: "DASHSCOPE_API_KEY",
  amap: "AMAP_WEB_SERVICE_KEY",
  housing: "SUPABASE_SECRET_KEY（或本机房源 HTTP 配置）",
};

export function validateVerificationUrl(url) {
  const valid =
    url.protocol === "https:" ||
    (url.protocol === "http:" && loopbackHostnames.has(url.hostname));
  if (!valid) {
    throw new Error("Verification URL must use HTTPS or an HTTP loopback host");
  }
}

export function assertLocalLiveHealth(health) {
  if (health?.app !== "xiaozhi" || health?.mode !== "live") {
    throw new Error(
      "本机不是 Live 模式：请在 web/.env.local 设置 NEXT_PUBLIC_DEMO_MODE=false",
    );
  }
  const missing = Object.entries(serviceConfigurationNames)
    .filter(([service]) => health?.services?.[service] !== "configured")
    .map(([, configuration]) => configuration);
  if (missing.length > 0) {
    throw new Error(
      `本机 Live 缺少配置：${missing.join("、")}；如刚写入密钥，请先重启本机开发服务`,
    );
  }
}
