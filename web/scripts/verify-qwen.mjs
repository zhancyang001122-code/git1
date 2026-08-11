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

const textStream = await client.chat.completions.create({
  model,
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

const functionStream = await client.chat.completions.create({
  model,
  stream: true,
  stream_options: { include_usage: true },
  max_tokens: 64,
  messages: [{ role: "user", content: "查询杭州今天的天气" }],
  tools: [
    {
      type: "function",
      function: {
        name: "lookup_weather",
        description: "查询指定城市天气",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
          additionalProperties: false,
        },
      },
    },
  ],
  tool_choice: { type: "function", function: { name: "lookup_weather" } },
});
const calls = new Map();
for await (const chunk of functionStream) {
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
if (!call?.id || call.name !== "lookup_weather") {
  throw new Error(
    "Qwen streaming Function Calling did not return the forced tool",
  );
}
const args = JSON.parse(call.arguments);
if (typeof args.city !== "string" || !args.city.includes("杭州")) {
  throw new Error("Qwen Function Calling returned invalid arguments");
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
  `PASS Qwen streaming, Function Calling and ${embeddingModel} 1024-dimension embedding.`,
);
