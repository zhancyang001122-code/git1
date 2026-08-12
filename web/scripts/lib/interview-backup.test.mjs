import { describe, expect, it } from "vitest";

import {
  assertLiveHealth,
  buildBackupIndex,
  isDisposablePlaywrightVideo,
  PRODUCTION_INTERVIEW_URL,
} from "./interview-backup.mjs";

describe("interview backup evidence", () => {
  it("uses the verified custom Production domain", () => {
    expect(PRODUCTION_INTERVIEW_URL).toBe("https://xiaozhi.zaneyang.xyz");
  });

  it("only allows generated Playwright videos inside the recording directory", () => {
    const videosDir = "C:\\backup\\videos";

    expect(
      isDisposablePlaywrightVideo(
        "C:\\backup\\videos\\page@abc.webm",
        videosDir,
      ),
    ).toBe(true);
    expect(
      isDisposablePlaywrightVideo(
        "C:\\backup\\videos\\01-housing-amap.webm",
        videosDir,
      ),
    ).toBe(false);
    expect(
      isDisposablePlaywrightVideo("C:\\outside\\page@abc.webm", videosDir),
    ).toBe(false);
  });

  it("accepts only fully configured Live health evidence", () => {
    expect(() =>
      assertLiveHealth({
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

    expect(() =>
      assertLiveHealth({
        app: "xiaozhi",
        mode: "demo",
        services: { supabase: "disabled" },
      }),
    ).toThrow(/Production Live health/i);
  });

  it("labels recordings as prior evidence instead of a current network claim", () => {
    const html = buildBackupIndex({
      recordedAt: "2026-08-13T04:00:00.000Z",
      commit: "abcdef1234567890",
      productionUrl: PRODUCTION_INTERVIEW_URL,
      screenshotsAvailable: true,
      qrAvailable: true,
      scenes: [
        {
          title: "历史房源 + 高德",
          file: "01-housing-amap.webm",
          evidence: "历史房源与高德来源标签",
        },
      ],
    });

    expect(html).toContain("此前成功回归的录屏证据");
    expect(html).toContain("不代表面试当下网络仍然可用");
    expect(html).toContain("abcdef12");
    expect(html).toContain("01-housing-amap.webm");
    expect(html).toContain('href="screens/index.html"');
    expect(html).toContain('href="production-qr.png"');
  });

  it("does not advertise backup artifacts that were not generated", () => {
    const html = buildBackupIndex({
      recordedAt: "2026-08-13T04:00:00.000Z",
      commit: "abcdef1234567890",
      productionUrl: PRODUCTION_INTERVIEW_URL,
      screenshotsAvailable: false,
      qrAvailable: false,
      scenes: [],
    });

    expect(html).not.toContain('href="screens/index.html"');
    expect(html).not.toContain('href="production-qr.png"');
    expect(html).toContain("尚未生成页面截图");
    expect(html).toContain("尚未生成二维码");
  });
});
