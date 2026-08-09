"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { IconButton } from "@/components/ui/icon-button";
import { SearchBar } from "@/components/ui/search-bar";
import { SourceBadge } from "@/components/ui/source-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";

export function ComponentGallery() {
  const [query, setQuery] = useState("");

  return (
    <main className="mx-auto min-h-dvh max-w-[430px] space-y-8 bg-page px-4 py-8">
      <header>
        <p className="text-sm font-semibold text-brand">仅开发环境</p>
        <h1 className="mt-1 text-page-title font-bold text-text">组件展示</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          集中检查组件的默认、选中、禁用、加载、空数据和错误状态。
        </p>
      </header>

      <section aria-labelledby="gallery-buttons" className="space-y-3">
        <h2 id="gallery-buttons" className="text-section-title font-bold">
          按钮与标签
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>主要按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="ghost">幽灵按钮</Button>
          <Button disabled>禁用按钮</Button>
          <IconButton label="收藏">
            <Heart aria-hidden="true" className="size-5" />
          </IconButton>
          <Tag selected>已选择</Tag>
          <SourceBadge source="housing_history_2024" />
        </div>
      </section>

      <section aria-labelledby="gallery-search" className="space-y-3">
        <h2 id="gallery-search" className="text-section-title font-bold">
          搜索
        </h2>
        <SearchBar
          label="组件搜索示例"
          value={query}
          onValueChange={setQuery}
          onSubmit={setQuery}
        />
      </section>

      <section aria-labelledby="gallery-states" className="space-y-3">
        <h2 id="gallery-states" className="text-section-title font-bold">
          状态
        </h2>
        <LoadingState message="正在加载演示内容" />
        <DemoNotice>当前内容为演示数据，不代表真实业务结果。</DemoNotice>
        <EmptyState title="暂时没有内容" message="换个条件再试一次。" />
        <ErrorState
          title="暂时无法加载"
          message="请稍后重试。"
          requestId="gallery-request"
        />
      </section>
    </main>
  );
}
