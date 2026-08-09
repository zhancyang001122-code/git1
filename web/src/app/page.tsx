export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="text-sm font-medium text-blue-600">工程基础已启动</p>
      <h1 className="text-2xl font-bold text-zinc-950">
        小智本地生活 AI 服务助手
      </h1>
      <p className="text-sm leading-6 text-zinc-600">
        当前为 Task 1 工程阶段，外部服务尚未连接。
      </p>
    </main>
  );
}
