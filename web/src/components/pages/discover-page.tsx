"use client";

import { Bot, Heart } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CommunityPostCard } from "@/components/business/community-post-card";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DemoNotice } from "@/components/ui/demo-notice";
import { SearchBar } from "@/components/ui/search-bar";
import { demoCommunityPosts } from "@/features/business/demo-data";

const categories = [
  "全部",
  "周末去哪儿",
  "租房避坑",
  "附近美食",
  "超市好物",
  "团购经验",
] as const;

export function DiscoverPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("全部");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const posts = useMemo(
    () =>
      demoCommunityPosts.filter(
        (post) =>
          (category === "全部" || post.category === category) &&
          (!query.trim() ||
            `${post.title}${post.excerpt}${post.tags.join("")}`.includes(
              query.trim(),
            )),
      ),
    [category, query],
  );

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setNotice("收藏状态仅保存在当前页面，接入 Supabase 后才会持久化。");
  }

  return (
    <AppShell activeNav="discover" header={<PageHeader title="推荐" />}>
      <div className="space-y-4 px-4 py-4">
        <SearchBar
          label="搜索社区演示内容"
          value={query}
          onValueChange={setQuery}
          onSubmit={() =>
            setNotice("当前搜索使用本地演示内容，没有发送网络请求。")
          }
          placeholder="搜索周末、租房、美食……"
        />

        <div aria-label="推荐分类" className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand ${category === item ? "bg-brand text-white" : "border border-border bg-surface text-text-muted"}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {notice ? <DemoNotice>{notice}</DemoNotice> : null}

        <section aria-label="社区推荐" className="grid grid-cols-2 gap-3">
          {posts.map((post, index) => {
            const favorite = favorites.has(post.id);
            return (
              <CommunityPostCard
                key={post.id}
                post={post}
                eager={index === 0}
                actions={
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-label={`${favorite ? "取消收藏" : "收藏"} ${post.title}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-xs text-text-muted outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
                      onClick={() => toggleFavorite(post.id)}
                    >
                      <Heart
                        aria-hidden="true"
                        className={`size-4 ${favorite ? "fill-danger text-danger" : ""}`}
                      />
                      {favorite ? "已收藏" : "收藏"}
                    </button>
                    <Link
                      href={`/xiaozhi/chat?source=community_post&id=${post.id}`}
                      aria-label={`问问小智 ${post.title}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-xs font-medium text-brand outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <Bot aria-hidden="true" className="size-4" />
                      问小智
                    </Link>
                  </div>
                }
              />
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
