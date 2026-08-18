import { Sparkles } from "lucide-react";
import Image from "next/image";

import { Tag } from "@/components/ui/tag";

export function XiaozhiHero() {
  return (
    <section
      aria-labelledby="xiaozhi-home-title"
      className="glass-panel relative overflow-hidden rounded-feature bg-gradient-to-br from-brand-soft/90 to-accent/10 p-4"
    >
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 size-32 rounded-full bg-white/45 blur-2xl"
      />
      <div className="relative grid grid-cols-[1fr_84px] items-center gap-3">
        <div className="min-w-0">
          <Tag className="mb-2 bg-white/75">AI 生活助手</Tag>
          <h2
            id="xiaozhi-home-title"
            className="text-lg font-bold leading-7 text-text"
          >
            小智本地生活 AI 服务助手
          </h2>
          <p className="mt-1 text-sm leading-[22px] text-text-muted">
            查询房源、地图和规则，每项结果都保留可核验来源。
          </p>
        </div>

        <div className="relative aspect-square overflow-hidden rounded-feature bg-white/70 shadow-floating">
          <Image
            fill
            src="/images/home/xiaozhi-mascot.png"
            alt=""
            sizes="84px"
            loading="eager"
            className="object-contain"
          />
          <Sparkles
            aria-hidden="true"
            className="absolute right-2 top-2 z-10 size-4 text-accent"
          />
        </div>
      </div>
    </section>
  );
}
