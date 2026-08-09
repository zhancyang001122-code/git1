import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppShell activeNav="home">
      <section className="flex min-h-[calc(100dvh-104px)] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm font-medium text-brand">工程基础已启动</p>
        <h1 className="text-2xl font-bold text-text">
          小智本地生活 AI 服务助手
        </h1>
        <p className="text-sm leading-6 text-text-muted">
          当前为 Task 2.5 设计系统阶段，外部服务尚未连接。
        </p>
      </section>
    </AppShell>
  );
}
