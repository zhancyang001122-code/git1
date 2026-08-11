export type DemoMessageCategory = "system" | "xiaozhi" | "interaction";

export interface DemoMessage {
  id: string;
  category: DemoMessageCategory;
  title: string;
  summary: string;
  timeLabel: string;
  unread: number;
}

export const demoMessages: readonly DemoMessage[] = [
  {
    id: "message-system-house-price",
    category: "system",
    title: "你收藏的房源价格已变动",
    summary: "历史房源演示提醒，不代表当前真实租金。",
    timeLabel: "08:56",
    unread: 1,
  },
  {
    id: "message-xiaozhi-weekend",
    category: "xiaozhi",
    title: "小智为你整理了周末灵感",
    summary: "西湖散步、演示团购和采购清单已组合完成。",
    timeLabel: "09:28",
    unread: 1,
  },
  {
    id: "message-interaction-deal",
    category: "interaction",
    title: "你关注的演示团购还有 3 天到期",
    summary: "仅作前端提醒演示，不代表真实券状态。",
    timeLabel: "昨天 18:20",
    unread: 2,
  },
  {
    id: "message-interaction-community",
    category: "interaction",
    title: "有人回复了你的帖子",
    summary: "用户“杭州小象”回复了演示社区内容。",
    timeLabel: "昨天 14:35",
    unread: 1,
  },
];

export const demoProfile = {
  name: "小智的朋友",
  city: "杭州",
  savedCount: 12,
  historyCount: 28,
  orderCount: 5,
  conversationCount: 56,
  budgetLabel: "≤ ¥3500",
  transportLabel: "步行 + 地铁",
  areaLabel: "武林广场",
  foodLabel: "不吃辣",
} as const;
