import { describe, expect, it } from "vitest";

import { requiredEvidenceTool } from "@/features/agent/grounding-policy";

describe("agent grounding policy", () => {
  it.each([
    "房源数据是哪一期，共有多少条？",
    "小智是原生微信小程序吗？",
    "Production Live 已接通哪些外部服务？",
    "未使用的团购券能退款吗？",
    "账号和长期记忆是什么关系？",
    "Production 现在用什么方式登录，是否已经完成验收？",
    "千问大模型负责什么，能不能作为事实来源？",
  ])("requires knowledge evidence for %s", (message) => {
    expect(requiredEvidenceTool(message)).toBe("search_knowledge");
  });

  it.each([
    "帮我找武林广场附近 3500 元以下的一居室",
    "找武林广场附近3500以内且附近有超市的一居室，并告诉我退租押金规则",
    "附近有没有地铁和超市？",
    "帮我找 30 元以内有库存的早餐",
    "你好",
  ])("leaves ordinary routing automatic for %s", (message) => {
    expect(requiredEvidenceTool(message)).toBeNull();
  });
});
