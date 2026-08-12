# 第 1 课练习单：一条真实请求怎样走完整系统

## 本课只学两个概念

- **前端**：用户能看到和操作的页面。它收集问题并显示结果，但不能持有百炼、高德或 Supabase 管理密钥。
- **API**：前端与服务端之间的输入输出约定。它不是某个页面，也不是数据库；`POST /api/chat` 是聊天请求进入服务端的门。

## 先看结果

打开 [Production Live](https://xiaozhi.zaneyang.xyz)，输入：

> 请帮我查杭州武林广场附近、3500元以下的一居室，并同时用高德查附近超市。房源和周边都要分别查询。

只观察四件事：

1. 发送前，问题只在输入框里。
2. 发送后，页面出现处理进度。
3. 房源卡和周边卡使用不同来源标签。
4. 最终回答完成后，页面重新出现发送按钮。

## 只看四个文件

1. `web/src/components/chat/chat-experience.tsx`：读取输入、发请求、接收 SSE 事件并渲染页面。
2. `web/src/app/api/chat/route.ts`：`POST /api/chat` 的最薄入口，统一接入请求观测。
3. `web/src/features/agent/chat-handler.ts`：限制请求体、用 Zod 校验、选择 Demo/Live 运行时、创建工具和持久化依赖。
4. `web/src/features/agent/orchestrator.ts`：控制一次请求的超时与工具循环，把事件逐步向前端返回。

不要通读整个文件。先分别找到这些关键词：`fetch`、`POST`、`chatRequestSchema.safeParse`、`orchestrateChatTurn`、`QWEN_PROVIDER_TIMEOUT`。

## 五格数据流

```text
输入框
  → POST /api/chat
  → chat-handler 校验并组装 Live 运行时
  → orchestrator / tool-loop 调用白名单工具
  → SSE 事件返回，页面渲染进度、回答、卡片与引用
```

每一格只回答“它负责什么”，不要先背代码语法。

## 安全小实验

在 `web/` 运行：

```powershell
@'
const response = await fetch("https://xiaozhi.zaneyang.xyz/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ messages: "这不是数组" })
});
console.log(response.status, response.headers.get("x-error-code"));
console.log(await response.json());
'@ | node -
```

正确结果不是服务器崩溃，而是 HTTP 400 和稳定错误码 `INVALID_CHAT_REQUEST`。这证明 TypeScript 类型之外还有运行时校验。

## 面试 30 秒答案

> 用户输入先由 React 页面提交到 `POST /api/chat`。Route 只负责接入和观测，真正的请求体限制、Zod 校验、Demo/Live 选择和依赖组装在 `chat-handler`。之后 orchestrator 驱动千问和白名单工具循环，通过 SSE 把进度、文本、结构化卡片与引用逐步返回。密钥与数据库管理权限只留在服务端，所以查看网页源码拿不到它们。

## 面试官可能追问

**为什么不让浏览器直接调用千问或高德？**

因为密钥会暴露，权限、限流、日志脱敏、超时和工具白名单也会被绕过。

**为什么 Route 文件只有几行？**

入口薄可以让 HTTP 与业务逻辑分离；`chat-handler` 能独立测试，也不会把数据库、模型和页面绑在一起。

**SSE 是什么？**

它让服务端在一个 HTTP 响应中持续发送事件。用户不必等所有工具和模型都结束，先看到“正在查询房源”等进度，再看到文本和结果卡。

## 完成标准

以下四项必须由学习者本人完成，不能由 Codex 代打勾：

- 能在 Production 复现一次请求。
- 能指着四个文件说出各自职责。
- 能运行非法请求实验并解释为什么是 400。
- 能不看文档说完上面的 30 秒答案。
