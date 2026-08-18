"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchBar } from "@/components/ui/search-bar";
import { useSelectedLocation } from "@/features/location/selected-location-provider";

export function HomeSearchExperience() {
  const router = useRouter();
  const { location } = useSelectedLocation();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const quickPrompts = [
    `找${location.name}附近房源`,
    "附近有什么好吃的",
    "今晚买点菜",
    "团购退款规则",
  ] as const;

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
        onSubmit={(value) => {
          router.push(`/xiaozhi/chat?q=${encodeURIComponent(value)}`);
        }}
        placeholder="说说你想找什么……"
      />

      <div aria-label="快捷问题" className="flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="glass-control ui-interactive inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-medium text-text-muted outline-none motion-reduce:transition-none hover:bg-brand-soft hover:text-brand"
            onClick={() => choosePrompt(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
