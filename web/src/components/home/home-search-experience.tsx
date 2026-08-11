"use client";

import { useRef, useState } from "react";

import { SearchBar } from "@/components/ui/search-bar";

const quickPrompts = [
  "找武林广场附近房源",
  "附近有什么好吃的",
  "今晚买点菜",
  "团购退款规则",
] as const;

export function HomeSearchExperience() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function choosePrompt(prompt: string) {
    setQuery(prompt);
    inputRef.current?.focus();
  }

  return (
    <section aria-label="小智搜索" className="space-y-2.5">
      <SearchBar
        action="/xiaozhi/chat"
        queryName="q"
        inputRef={inputRef}
        label="搜索本地生活服务"
        value={query}
        onValueChange={(value) => {
          setQuery(value);
        }}
        onSubmit={() => undefined}
        placeholder="说说你想找什么……"
      />

      <div aria-label="快捷问题" className="flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-3 text-xs font-medium text-text-muted outline-none transition-colors motion-reduce:transition-none hover:border-brand/30 hover:bg-brand-soft hover:text-brand focus-visible:ring-2 focus-visible:ring-brand"
            onClick={() => choosePrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
