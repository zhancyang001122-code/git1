"use client";

import { HelpCircle, Settings } from "lucide-react";
import { useState } from "react";

import { DemoNotice } from "@/components/ui/demo-notice";

const notices = {
  help: "帮助中心将在后续阶段接入，当前没有发起真实客服请求。",
  settings: "设置中心将在后续阶段接入，当前不会修改任何账户配置。",
} as const;

export function AccountUtilityActions() {
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-3">
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
      {notice ? <DemoNotice>{notice}</DemoNotice> : null}
    </div>
  );
}
