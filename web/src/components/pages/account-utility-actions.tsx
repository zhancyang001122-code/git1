"use client";

import { HelpCircle, LogOut, Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toast } from "@/components/ui/toast";

const notices = {
  help: "帮助中心为演示入口，当前没有发起真实客服请求。",
  settings: "设置中心为演示入口，当前不会修改账户配置。",
} as const;

export function AccountUtilityActions({
  navigate = (path: string) => window.location.assign(path),
}: {
  navigate?: (path: string) => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST" });
      if (!response.ok) {
        setNotice("退出登录失败，请稍后重试。");
        return;
      }
      navigate("/login");
    } catch {
      setNotice("网络连接失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

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
      <Button
        variant="ghost"
        className="mt-3 w-full text-text-muted"
        disabled={busy}
        onClick={() => setSignOutOpen(true)}
      >
        <LogOut aria-hidden="true" className="size-4" />
        退出登录
      </Button>
      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="退出当前账号？"
        description="退出只会清除当前浏览器会话，不会删除已保存的长期偏好。"
        confirmLabel="确认退出"
        onConfirm={() => void signOut()}
      />
      <Toast
        open={Boolean(notice)}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
        message={notice ?? ""}
        duration={0}
        tone={notice?.includes("失败") ? "error" : "neutral"}
      />
    </div>
  );
}
