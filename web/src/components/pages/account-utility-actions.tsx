"use client";

import { HelpCircle, Settings } from "lucide-react";
import { useState } from "react";

import { Toast } from "@/components/ui/toast";

const notices = {
  help: "帮助中心为演示入口，当前没有发起真实客服请求。",
  settings: "设置中心为演示入口，当前不会修改账户配置。",
} as const;

export function AccountUtilityActions() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div>
      <section aria-label="帮助与设置" className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setNotice(notices.help)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-control border border-border bg-surface text-sm text-text-muted outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
        >
          <HelpCircle aria-hidden="true" className="size-4" />
          帮助
        </button>
        <button
          type="button"
          onClick={() => setNotice(notices.settings)}
          className="flex min-h-12 items-center justify-center gap-2 rounded-control border border-border bg-surface text-sm text-text-muted outline-none hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Settings aria-hidden="true" className="size-4" />
          设置
        </button>
      </section>
      <Toast
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice ?? ""}
        duration={0}
        tone="neutral"
      />
    </div>
  );
}
