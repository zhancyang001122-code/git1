import OpenAI from "openai";

import {
  optionalEnvironment,
  requiredEnvironment,
} from "./lib/portfolio-knowledge.mjs";

function rerankBaseUrl() {
  const configured = optionalEnvironment("DASHSCOPE_RERANK_BASE_URL");
  if (configured) return configured;
  const chatUrl = new URL(requiredEnvironment("DASHSCOPE_BASE_URL"));
  if (
    !/^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/i.test(chatUrl.hostname) ||
    chatUrl.pathname.replace(/\/$/, "") !== "/compatible-mode/v1"
  ) {
    throw new Error(
      "DASHSCOPE_RERANK_BASE_URL is required when the chat URL is not a Beijing workspace URL",
    );
  }
  chatUrl.pathname = "/compatible-api/v1";
  return chatUrl.href.replace(/\/$/, "");
}

const apiKey = requiredEnvironment("DASHSCOPE_API_KEY");
const rawBaseUrl = rerankBaseUrl();
const baseUrl = new URL(rawBaseUrl);
if (
  baseUrl.protocol !== "https:" ||
  baseUrl.username ||
  baseUrl.password ||
  !/^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/i.test(baseUrl.hostname) ||
  baseUrl.pathname.replace(/\/$/, "") !== "/compatible-api/v1" ||
  baseUrl.search ||
  baseUrl.hash
) {
  throw new Error(
    "DASHSCOPE_RERANK_BASE_URL must be the Beijing workspace HTTPS compatible-api/v1 URL",
  );
}

const model = optionalEnvironment("DASHSCOPE_RERANK_MODEL") || "qwen3-rerank";
const client = new OpenAI({
  apiKey,
  baseURL: baseUrl.href.replace(/\/$/, ""),
  timeout: 30_000,
  maxRetries: 1,
});
const documents = [
  "房源数据来自 2024 年 11 月，只能用于历史筛选演示，不能代表当前可租状态。",
  "量子计算利用量子力学现象处理信息。",
  "团购券是否退款应以对应商家的演示规则为准。",
];
const result = await client.post("/reranks", {
  body: {
    model,
    query: "历史房源能代表当前可租状态吗？",
    documents,
    top_n: documents.length,
    instruct:
      "Given a customer service question, retrieve passages that directly answer it.",
  },
  cast_to: Object,
});
if (
  !Array.isArray(result?.results) ||
  result.results.length !== documents.length
) {
  throw new Error("qwen3-rerank returned an incomplete result list");
}
const indexes = result.results.map((item) => item?.index);
const scores = result.results.map((item) => item?.relevance_score);
if (
  new Set(indexes).size !== documents.length ||
  indexes.some(
    (index) =>
      !Number.isInteger(index) || index < 0 || index >= documents.length,
  ) ||
  scores.some(
    (score) =>
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 1,
  ) ||
  scores.some((score, index) => index > 0 && scores[index - 1] < score)
) {
  throw new Error("qwen3-rerank returned an invalid order or score");
}
if (indexes[0] !== 0) {
  throw new Error(
    "qwen3-rerank did not rank the directly answering passage first",
  );
}

console.log(
  JSON.stringify({
    model: result.model ?? model,
    resultCount: result.results.length,
    topIndex: indexes[0],
    topScore: scores[0],
    usageTokens: result.usage?.total_tokens ?? null,
  }),
);
