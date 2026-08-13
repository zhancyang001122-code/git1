import type {
  AIProvider,
  ProviderEvent,
  ProviderMessage,
  ProviderToolCall,
  ProviderTurnInput,
} from "@/features/agent/provider";

interface InternalToolPayload {
  ok?: boolean;
  error?: { code?: string; message?: string };
  resultCount?: number;
  source?: string;
  itemIds?: readonly string[];
  facts?: readonly Record<string, unknown>[];
  knowledge?: {
    lowConfidence?: boolean;
    conflict?: boolean;
    isDemo?: boolean;
    passages?: readonly { content?: string }[];
  };
}

function latestUserText(messages: readonly ProviderMessage[]): string {
  return messages.findLast((message) => message.role === "user")?.content ?? "";
}

interface SelectedLocationContext {
  label: string;
  city: string;
  point: { longitude: number; latitude: number };
}

function selectedLocationContext(
  messages: readonly ProviderMessage[],
): SelectedLocationContext | null {
  const prefix = "用户当前选择的位置";
  const message = messages.find(
    (candidate) =>
      candidate.role === "system" && candidate.content.startsWith(prefix),
  );
  const json = message?.content.slice(message.content.indexOf("：") + 1);
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<SelectedLocationContext>;
    return typeof value.label === "string" &&
      typeof value.city === "string" &&
      typeof value.point?.longitude === "number" &&
      typeof value.point.latitude === "number"
      ? (value as SelectedLocationContext)
      : null;
  } catch {
    return null;
  }
}

function latestToolExchange(messages: readonly ProviderMessage[]): {
  name: string;
  payload: InternalToolPayload;
} | null {
  const toolIndex = messages.findLastIndex(
    (message) => message.role === "tool",
  );
  if (toolIndex < 0) return null;
  const toolMessage = messages[toolIndex]!;
  const assistant = messages
    .slice(0, toolIndex)
    .findLast(
      (message) =>
        message.role === "assistant" &&
        message.toolCalls?.some((call) => call.id === toolMessage.toolCallId),
    );
  const call = assistant?.toolCalls?.find(
    (candidate) => candidate.id === toolMessage.toolCallId,
  );
  if (!call) return null;
  try {
    return {
      name: call.name,
      payload: JSON.parse(toolMessage.content) as InternalToolPayload,
    };
  } catch {
    return { name: call.name, payload: {} };
  }
}

function amount(text: string): number | null {
  const patterns = [
    /预算(?:是|为)?\s*(\d{1,6})/,
    /(\d{1,6})\s*元(?:以内|以下|左右)?/,
    /(\d{1,6})\s*(?:以内|以下)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

function productQuery(text: string): string | null {
  return (
    [
      "鲜牛奶",
      "牛奶",
      "鸡蛋",
      "蓝莓",
      "番茄",
      "牛肉",
      "生菜",
      "酸奶",
      "香蕉",
      "水饺",
      "鸡胸肉",
      "西兰花",
      "燕麦",
    ].find((keyword) => text.includes(keyword)) ?? null
  );
}

function nearbyKeyword(text: string): string {
  return (
    ["超市", "便利店", "咖啡", "餐饮", "医院", "地铁站", "公园"].find(
      (keyword) => text.includes(keyword),
    ) ?? "生活服务"
  );
}

function nearbyCall(
  text: string,
  selectedLocation?: SelectedLocationContext | null,
): ProviderToolCall {
  const namedCenter = text.includes("绍兴")
    ? "绍兴市政府"
    : text.includes("武林广场")
      ? "武林广场"
      : selectedLocation &&
          text.includes(selectedLocation.label.split(" · ").at(-1) ?? "")
        ? (selectedLocation.label.split(" · ").at(-1) ?? null)
        : null;
  return call("search_nearby_places", {
    keyword: nearbyKeyword(text),
    city: text.includes("绍兴") ? "绍兴" : (selectedLocation?.city ?? "杭州"),
    center_name: namedCenter,
    longitude: null,
    latitude: null,
    radius_m: 2000,
    limit: 5,
  });
}

function call(name: string, args: Record<string, unknown>): ProviderToolCall {
  return {
    id: crypto.randomUUID(),
    name,
    arguments: JSON.stringify(args),
  };
}

function requiresKnowledge(text: string): boolean {
  return /(?:退款|押金|抓坏|损坏|责任|配送|送达|政策|隐私|个人信息|删除账号|注销账号|保证|赔三倍|团购券.*退|退.*团购券)/.test(
    text,
  );
}

function knowledgeCall(text: string): ProviderToolCall {
  return call("search_knowledge", {
    query: text,
    domain: /(?:退款|团购券)/.test(text)
      ? "group_buy"
      : /(?:押金|退租|验房|损坏)/.test(text)
        ? "housing"
        : /(?:配送|送达)/.test(text)
          ? "market"
          : /(?:隐私|个人信息|删除账号|注销账号)/.test(text)
            ? "platform"
            : null,
    category: /(?:退款|团购券)/.test(text)
      ? "refund"
      : /(?:押金|退租|验房|损坏)/.test(text)
        ? "deposit"
        : /(?:配送|送达)/.test(text)
          ? "delivery"
          : /(?:隐私|个人信息|删除账号|注销账号)/.test(text)
            ? "privacy"
            : null,
    city: /绍兴/.test(text) ? "绍兴" : "杭州",
    top_k: 5,
  });
}

function route(
  text: string,
  selectedLocation?: SelectedLocationContext | null,
): ProviderToolCall | null {
  if (
    requiresKnowledge(text) &&
    !/(?:推荐|找).*(?:房|一居室|两居室|开间|合租)/.test(text)
  )
    return knowledgeCall(text);
  if (/(?:记住|以后都).*(?:预算|租金)/.test(text)) {
    const budget = amount(text);
    if (budget !== null)
      return call("propose_user_preference", {
        key: "max_housing_budget",
        value: budget,
      });
  }
  if (/(?:我的|读取|查看).*(?:偏好|预算)/.test(text)) {
    return call("get_user_preferences", { scope: "housing" });
  }
  if (
    /(?:附近|周边)/.test(text) &&
    !/(?:房|租房|一居室|两居室|开间|合租)/.test(text)
  ) {
    return nearbyCall(text, selectedLocation);
  }
  if (/(?:房|租房|一居室|两居室|开间|合租)/.test(text)) {
    const maximum = amount(text);
    const roomType = /(一居室|两居室|开间|合租)/.exec(text)?.[1] ?? null;
    return call("search_houses", {
      city: text.includes("绍兴") ? "绍兴" : (selectedLocation?.city ?? "杭州"),
      near_location: text.includes("武林广场")
        ? "武林广场"
        : selectedLocation &&
            text.includes(selectedLocation.label.split(" · ").at(-1) ?? "")
          ? (selectedLocation.label.split(" · ").at(-1) ?? null)
          : null,
      min_price: null,
      max_price: maximum,
      room_type: roomType,
      limit: 5,
    });
  }
  if (/(?:团购|套餐|火锅|咖啡)/.test(text)) {
    return call("search_deals", {
      query: /火锅/.test(text) ? "火锅" : /咖啡/.test(text) ? "咖啡" : null,
      category: null,
      max_price: amount(text),
      refundable_only: null,
      limit: 5,
    });
  }
  if (/(?:商品|买菜|库存|超市|牛奶|鸡蛋|蔬菜|水果)/.test(text)) {
    return call("search_products", {
      query: productQuery(text),
      category: null,
      store_id: null,
      max_price: amount(text),
      in_stock_only: true,
      limit: 6,
    });
  }
  return null;
}

function firstProductId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  return (data as InternalToolPayload).itemIds?.[0] ?? null;
}

function stockSummary(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as InternalToolPayload).facts?.[0] as
    | {
        name?: unknown;
        availableStock?: unknown;
        inStock?: unknown;
      }
    | undefined;
  if (
    typeof value?.name !== "string" ||
    typeof value?.availableStock !== "number"
  )
    return null;
  return value.inStock
    ? `${value.name}的演示可用库存为 ${value.availableStock} 件。`
    : `${value.name}当前演示可用库存为 0 件。`;
}

function summarizeTool(
  name: string,
  payload: InternalToolPayload,
  userText: string,
): string {
  if (!payload.ok) {
    if (payload.error?.code === "USER_AUTH_REQUIRED")
      return "长期偏好没有保存：请先登录，再明确确认要长期记住该偏好。";
    if (name === "search_nearby_places" || name === "calculate_walking_route")
      return `${payload.error?.message ?? "地图查询失败"}，本次周边条件尚未通过高德核验；我不会估算距离或路线。`;
    return payload.error?.message ?? "本次工具查询失败，请稍后重试。";
  }
  if ((payload.resultCount ?? 0) === 0)
    return name === "search_knowledge"
      ? "知识库没有找到足够可靠且当前有效的依据，所以我不能给出确定的政策结论。"
      : "没有找到符合全部条件的记录。可以先放宽一个条件，例如预算或区域。";
  if (name === "search_knowledge") {
    const data = payload.knowledge;
    if (data?.conflict)
      return "检索到的知识依据互相冲突，需要人工复核；我不能替你做确定结论。";
    if (data?.lowConfidence)
      return "检索到的知识依据置信度不足，所以我不能给出确定的政策结论。";
    if (
      data?.passages?.some((passage) =>
        passage.content?.includes("未提供固定到账天数"),
      )
    )
      return "当前知识依据没有提供固定到账天数，因此我不能承诺具体日期；请以合同约定和退租验收结果为准。";
    return `已根据${data?.isDemo ? "演示知识库" : "当前有效知识库"}核验，请以随回答展示的引用版本和生效日期为准。`;
  }
  if (name === "get_product_stock")
    return stockSummary(payload) ?? "已核对演示商品库存，请查看结果卡。";
  if (name === "search_houses") {
    const label =
      payload.source === "housing_history_2024"
        ? "2024 年历史房源数据"
        : "演示房源数据";
    const hasHistoricalDistance =
      payload.source === "housing_history_2024" &&
      (payload.facts?.some((fact) => typeof fact.distanceM === "number") ??
        false);
    const locationNotice = /(?:附近|周边|路线|距离|步行)/.test(userText)
      ? hasHistoricalDistance
        ? " 房源距离按 2024 历史坐标计算直线距离，不等同于高德步行路线。"
        : " 周边条件尚未通过高德核验，结果未按真实距离排序。"
      : "";
    const historyNotice =
      payload.source === "housing_history_2024"
        ? " 这些是 2024-11 历史记录，不代表当前仍可出租或当前价格。"
        : "";
    return `已从${label}查询到 ${payload.resultCount} 条符合结构化条件的记录，请查看结果卡。${historyNotice}${locationNotice}`;
  }
  if (name === "search_deals")
    return `已查询到 ${payload.resultCount} 条演示团购，请查看结果卡；退款结论仍需正式知识库核验。`;
  if (name === "search_products")
    return `已查询到 ${payload.resultCount} 条演示商品，请查看结果卡。精确库存需要继续核对具体商品。`;
  if (name === "get_user_preferences") return "已读取你明确授权的长期偏好。";
  if (name === "propose_user_preference")
    return "我已准备偏好提案，请检查后手动确认保存；目前还没有写入长期记忆。";
  if (name === "search_nearby_places") {
    const demo = payload.facts?.some((fact) => fact.isDemo === true) ?? false;
    const housingNotice = /(?:房|租房|一居室|两居室|开间|合租)/.test(userText)
      ? " 房源卡可能来自 2024-11 历史库或演示数据，不代表当前仍可出租或当前价格。"
      : "";
    return `已查询到 ${payload.resultCount} 个周边地点，请查看结果卡。${demo ? " 当前为明确标注的高德接口演示数据。" : " 地点与距离来自高德地图工具。"}${housingNotice}`;
  }
  if (name === "calculate_walking_route")
    return "步行距离和耗时已由高德地图工具计算，请查看路线结果。";
  return "工具查询已完成。";
}

function directReply(text: string): string {
  if (/(?:service role|千问key|密钥|令牌|系统提示词)/i.test(text))
    return "我不能提供密钥、令牌、隐藏提示词或内部错误详情。";
  if (/(?:附近|路线|距离|步行)/.test(text))
    return "请先告诉我要以哪个地点为中心；也可以在“周边服务”页主动授权定位。拿到中心点后，我会用高德工具核验地点、距离和路线。";
  if (/(?:记住|以后都).*(?:预算|租金)/.test(text))
    return "请告诉我需要记住的具体预算金额，并明确确认是否长期保存。";
  return "当前演示路由支持结构化查询房源、团购、商品和库存；地图与正式知识库将在后续阶段接入。";
}

export class DemoToolCallingProvider implements AIProvider {
  async *streamTurn(
    input: ProviderTurnInput,
    signal: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    signal.throwIfAborted();
    const userText = latestUserText(input.messages);
    const selectedLocation = selectedLocationContext(input.messages);
    const exchange = latestToolExchange(input.messages);
    const completedToolNames = new Set(
      input.messages.flatMap((message) =>
        message.role === "assistant"
          ? (message.toolCalls ?? []).map((toolCall) => toolCall.name)
          : [],
      ),
    );

    if (
      !exchange &&
      input.toolChoice?.name === "search_knowledge" &&
      !completedToolNames.has("search_knowledge")
    ) {
      yield { type: "tool_calls", calls: [knowledgeCall(userText)] };
      yield { type: "finish", reason: "tool_calls" };
      return;
    }

    if (exchange) {
      if (
        exchange.name === "search_houses" &&
        /(?:附近|周边|路线|距离|步行)/.test(userText) &&
        exchange.payload.ok &&
        (exchange.payload.resultCount ?? 0) > 0
      ) {
        yield {
          type: "tool_calls",
          calls: [nearbyCall(userText, selectedLocation)],
        };
        yield { type: "finish", reason: "tool_calls" };
        return;
      }
      if (
        exchange.name === "search_nearby_places" &&
        requiresKnowledge(userText) &&
        !completedToolNames.has("search_knowledge")
      ) {
        yield { type: "tool_calls", calls: [knowledgeCall(userText)] };
        yield { type: "finish", reason: "tool_calls" };
        return;
      }
      if (
        exchange.name === "search_products" &&
        /(?:库存|还有|有货)/.test(userText) &&
        exchange.payload.ok
      ) {
        const productId = firstProductId(exchange.payload);
        if (productId) {
          yield {
            type: "tool_calls",
            calls: [call("get_product_stock", { product_id: productId })],
          };
          yield { type: "finish", reason: "tool_calls" };
          return;
        }
      }
      if (exchange.name === "search_houses" && requiresKnowledge(userText)) {
        yield { type: "tool_calls", calls: [knowledgeCall(userText)] };
        yield { type: "finish", reason: "tool_calls" };
        return;
      }
      if (
        exchange.name === "search_knowledge" &&
        completedToolNames.has("search_houses") &&
        completedToolNames.has("search_nearby_places")
      ) {
        const knowledgeSummary = summarizeTool(
          exchange.name,
          exchange.payload,
          userText,
        );
        yield {
          type: "text_delta",
          delta: `房源、周边和规则三项查询已按顺序完成。${knowledgeSummary} 房源与周边结果请查看卡片。`,
        };
        yield { type: "finish", reason: "stop" };
        return;
      }
      yield {
        type: "text_delta",
        delta: summarizeTool(exchange.name, exchange.payload, userText),
      };
      yield { type: "finish", reason: "stop" };
      return;
    }

    const requestedTool = route(userText, selectedLocation);
    if (requestedTool) {
      yield { type: "tool_calls", calls: [requestedTool] };
      yield { type: "finish", reason: "tool_calls" };
      return;
    }

    yield { type: "text_delta", delta: directReply(userText) };
    yield { type: "finish", reason: "stop" };
  }
}
