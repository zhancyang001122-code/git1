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
    "找武林广场附近3500以内的一居室，并说明签约前是否应该网签备案",
    "租房签合同前需要核验哪些信息？",
  ])("requires knowledge evidence for %s", (message) => {
    expect(requiredEvidenceTool(message)).toBe("search_knowledge");
  });

  it.each([
    "帮我找武林广场附近 3500 元以下的一居室",
    "附近有没有地铁和超市？",
    "帮我找 30 元以内有库存的早餐",
    "你好",
  ])("leaves ordinary routing automatic for %s", (message) => {
    expect(requiredEvidenceTool(message)).toBeNull();
  });
});
