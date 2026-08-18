import { readFileSync } from "node:fs";

import OpenAI from "openai";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const apiKey = required("DASHSCOPE_API_KEY");
const baseURL =
  process.env.DASHSCOPE_BASE_URL?.trim() ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.env.DASHSCOPE_MODEL?.trim() || "qwen-plus";
const embeddingModel =
  process.env.DASHSCOPE_EMBEDDING_MODEL?.trim() || "text-embedding-v4";
const client = new OpenAI({ apiKey, baseURL, timeout: 45_000, maxRetries: 1 });
const toolContract = JSON.parse(
  readFileSync(
    new URL("../../contracts/tool-contracts.json", import.meta.url),
    "utf8",
  ),
);

function contractTool(name) {
  const tool = toolContract.tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing tool contract: ${name}`);
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: tool.strict,
    },
  };
}

async function forcedToolCall(prompt, tool) {
  const stream = await client.chat.completions.create({
    model,
    enable_thinking: false,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 128,
    messages: [{ role: "user", content: prompt }],
    tools: [tool],
    tool_choice: { type: "function", function: { name: tool.function.name } },
  });
  const calls = new Map();
  for await (const chunk of stream) {
    for (const fragment of chunk.choices[0]?.delta?.tool_calls ?? []) {
      const current = calls.get(fragment.index) ?? {
        id: "",
        name: "",
        arguments: "",
      };
      current.id += fragment.id ?? "";
      current.name += fragment.function?.name ?? "";
      current.arguments += fragment.function?.arguments ?? "";
      calls.set(fragment.index, current);
    }
  }
  const call = calls.get(0);
  if (!call?.id || call.name !== tool.function.name) {
    throw new Error(`Qwen did not return forced tool ${tool.function.name}`);
  }
  return JSON.parse(call.arguments);
}

function normalizedNumber(value) {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) return value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : value;
}

function normalizedStringArray(value) {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

const textStream = await client.chat.completions.create({
  model,
  enable_thinking: false,
  stream: true,
  stream_options: { include_usage: true },
  max_tokens: 32,
  messages: [
    {
      role: "user",
      content: "只回复四个字：连接成功",
    },
  ],
});
let text = "";
let usageReceived = false;
for await (const chunk of textStream) {
  text += chunk.choices[0]?.delta?.content ?? "";
  usageReceived ||= Boolean(chunk.usage);
}
if (!text.includes("连接成功")) {
  throw new Error("Qwen streaming response did not contain the expected text");
}
if (!usageReceived) {
  throw new Error("Qwen streaming response did not include token usage");
}

const productArgs = await forcedToolCall(
  "帮我找30元以内有库存的早餐，没有指定门店。",
  contractTool("search_products"),
);
const normalizedProductArgs = {
  ...productArgs,
  max_price: normalizedNumber(productArgs.max_price),
};
const productCategories = new Set([
  "乳品",
  "蛋品",
  "水果",
  "蔬菜",
  "肉类",
  "主食",
  "饮料",
  "速冻",
  "日用",
  "早餐",
]);
if (
  typeof normalizedProductArgs.query !== "string" ||
  normalizedProductArgs.query.trim().length === 0 ||
  (normalizedProductArgs.category !== null &&
    !productCategories.has(normalizedProductArgs.category)) ||
  normalizedProductArgs.store_id !== null ||
  normalizedProductArgs.max_price !== 30 ||
  normalizedProductArgs.in_stock_only !== true
) {
  throw new Error(
    `Qwen product Function Calling returned invalid filters: ${JSON.stringify(productArgs)}`,
  );
}

const preferenceArgs = await forcedToolCall(
  "请准备一个待用户确认的长期偏好：我不吃辣。",
  contractTool("propose_user_preference"),
);
const normalizedPreferenceArgs = {
  ...preferenceArgs,
  value: normalizedStringArray(preferenceArgs.value),
};
if (
  normalizedPreferenceArgs.key !== "dietary_restrictions" ||
  !Array.isArray(normalizedPreferenceArgs.value) ||
  !normalizedPreferenceArgs.value.includes("不吃辣")
) {
  throw new Error("Qwen preference Function Calling returned invalid value");
}

const embedding = await client.embeddings.create({
  model: embeddingModel,
  input: ["小智本地生活知识检索连接验证"],
  dimensions: 1024,
  encoding_format: "float",
});
const vector = embedding.data[0]?.embedding;
if (
  !vector ||
  vector.length !== 1024 ||
  vector.some((value) => !Number.isFinite(value))
) {
  throw new Error(
    "Qwen embedding response is not a finite 1024-dimension vector",
  );
}

console.log(
  `PASS Qwen streaming, project Function Calling contracts and ${embeddingModel} 1024-dimension embedding.`,
);
