# RAG 与知识进化系统

## 1. 定位

Knowledge Service 在职责上独立。当前 Demo 和业务表共用一个 Supabase 项目，但 Agent 只能通过 `search_knowledge` 调用。未来更换搜索平台时，工具契约不变。

## 2. 数据层

```text
kb_articles          原始知识条目
kb_article_versions  不可变版本
kb_chunks            切片、Metadata、embedding
knowledge_candidates 对话产生的候选知识
knowledge_reviews    审核记录
ai_eval_cases        固定评测
ai_eval_runs         评测结果
```

原始文章和版本是权威来源；chunks 是可重建索引。

## 3. 生命周期

```text
draft -> reviewing -> published -> archived
                   -> rejected
```

只有 published 且当前时间位于有效期内的版本参与检索。

## 4. 切片

- 按 Markdown 标题、条款和段落切分
- 目标 300–600 中文字符
- 重叠 60–100 字符
- 保留 article/version/title path/domain/category/city/audience/effective time
- 表格转换为带列名的自然语言
- 不把多个无关政策放入同一 chunk

## 5. Embedding

- 模型：`text-embedding-v4`
- 维度：1024
- 文档与查询使用适合检索的输入类型
- 发布后异步生成，支持状态、失败原因和重试
- embedding 维度与数据库列必须一致

## 6. 检索流程

```text
问题规范化
→ 领域和 Metadata 过滤
→ Supabase RPC 混合召回 Top 12（向量权重 0.65、文本权重 0.35）
→ 合并、去重和版本校验
→ 可选 qwen3-rerank 重排
→ 最终 Top 5
→ 置信度/冲突检查
→ 带引用生成
```

MVP 先使用 Supabase RPC 的向量 + trigram 加权分数；P1 启用重排。

## 7. 拒答与冲突

初始规则：

- 无候选：拒答并创建知识缺口
- Top1 分数低于阈值：低置信，不确定回答
- 候选来自冲突版本：转人工
- 过期或未发布来源：不得引用
- 每条政策结论至少对应一个 chunk

阈值需通过评测校准。

## 8. 知识进化

```text
对话与工具日志
→ 无结果/低置信/点踩/人工纠正
→ 候选知识草稿
→ 人工审核和证据确认
→ 发布新版本
→ 切片和 embedding
→ 回归评测
→ 进入正式检索
```

严禁把用户原话或模型回答直接写入 published 知识。

## 9. 评测

检索：
- Recall@5
- MRR
- 正确版本命中
- 过期知识误召回

生成：
- 引用正确性
- 忠实度
- 答案相关性
- 拒答准确性
- 政策条件完整度

门槛：
- P0 引用正确率 ≥ 90%
- 无依据拒答 ≥ 90%
- 新版本不得使关键集下降超过 3 个百分点
