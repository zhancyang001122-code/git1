import { Bot, Sparkles } from "lucide-react";

import { Tag } from "@/components/ui/tag";

export function XiaozhiHero() {
  return (
    <section
      aria-labelledby="xiaozhi-home-title"
      className="relative overflow-hidden rounded-feature bg-gradient-to-br from-brand-soft to-accent/10 p-5"
    >
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 size-32 rounded-full bg-white/45 blur-2xl"
      />
      <div className="relative grid grid-cols-[1fr_92px] items-center gap-3">
        <div className="min-w-0">
          <Tag className="mb-3 bg-white/75">能力预览</Tag>
          <h1
            id="xiaozhi-home-title"
            className="text-2xl font-bold leading-8 text-text"
          >
            小智本地生活 AI 服务助手
          </h1>
          <p className="mt-2 text-sm leading-[22px] text-text-muted">
            后续将把找房、周边和规则查询串成一次可核验的对话。
          </p>
        </div>

        <div className="relative flex aspect-square items-center justify-center rounded-feature bg-white/70 shadow-floating">
          <Sparkles
            aria-hidden="true"
            className="absolute right-2 top-2 size-4 text-accent"
          />
          <Bot
            aria-hidden="true"
            className="size-12 text-brand"
            strokeWidth={1.6}
          />
        </div>
      </div>
    </section>
  );
}
