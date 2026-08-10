import { KeyRound } from "lucide-react";

import { DetailShell } from "@/components/layout/detail-shell";
import { DemoNotice } from "@/components/ui/demo-notice";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const notConfigured = status === "not-configured";
  return (
    <DetailShell title="知识运营登录" backHref="/me">
      <div className="space-y-4 px-4 py-5">
        <DemoNotice>
          管理口令只提交给服务端并换取 HttpOnly 会话 Cookie，不会写入 URL
          或浏览器脚本。
        </DemoNotice>
        <form
          action="/api/knowledge/admin-session"
          method="post"
          className="rounded-card border border-border bg-surface p-5 shadow-card"
        >
          <KeyRound className="size-7 text-brand" />
          <h2 className="mt-3 text-lg font-semibold text-text">
            进入 Demo Admin
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            {notConfigured
              ? "当前服务器尚未配置 DEMO_ADMIN_TOKEN，管理操作不可用。"
              : "请输入服务器管理员提供的演示口令。生产环境应替换为 RBAC 或 SSO。"}
          </p>
          <label className="mt-4 block text-sm font-medium text-text">
            管理口令
            <input
              name="token"
              type="password"
              autoComplete="current-password"
              required
              disabled={notConfigured}
              className="mt-2 min-h-11 w-full rounded-control border border-border bg-page px-3 outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <button
            type="submit"
            disabled={notConfigured}
            className="mt-4 min-h-11 w-full rounded-control bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            验证并进入
          </button>
        </form>
      </div>
    </DetailShell>
  );
}
