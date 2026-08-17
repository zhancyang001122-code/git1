import { describe, expect, it } from "vitest";

import {
  assertLocalLiveHealth,
  validateVerificationUrl,
} from "./local-live-preflight.mjs";

describe("local Live preflight", () => {
  it("accepts HTTPS deployments and HTTP loopback URLs only", () => {
    expect(() =>
      validateVerificationUrl(new URL("https://xiaozhi.example.com")),
    ).not.toThrow();
    expect(() =>
      validateVerificationUrl(new URL("http://127.0.0.1:3117")),
    ).not.toThrow();
    expect(() =>
      validateVerificationUrl(new URL("http://localhost:3117")),
    ).not.toThrow();
    expect(() =>
      validateVerificationUrl(new URL("http://xiaozhi.example.com")),
    ).toThrow(/HTTPS or an HTTP loopback/i);
  });

  it("reports safe environment variable names without secret values", () => {
    expect(() =>
      assertLocalLiveHealth({
        app: "xiaozhi",
        mode: "live",
        services: {
          supabase: "configured",
          qwen: "missing",
          amap: "missing",
          housing: "configured",
        },
      }),
    ).toThrow(
      "本机 Live 缺少配置：DASHSCOPE_API_KEY、AMAP_WEB_SERVICE_KEY；如刚写入密钥，请先重启本机开发服务",
    );
  });

  it("accepts a fully configured local Live runtime", () => {
    expect(() =>
      assertLocalLiveHealth({
        app: "xiaozhi",
        mode: "live",
        services: {
          supabase: "configured",
          qwen: "configured",
          amap: "configured",
          housing: "configured",
        },
      }),
    ).not.toThrow();
  });
});
