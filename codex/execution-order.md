# Codex 执行顺序

每轮把总提示词和当前 phase 提示词一起交给 Codex。Codex 完成一项后，检查它的验证输出，再发下一项。

1. `00-master-prompt.md` + `01-scaffold-prompt.md`
2. `00-master-prompt.md` + `02-design-system-prompt.md`
3. `00-master-prompt.md` + `03-pages-prompt.md`
4. `00-master-prompt.md` + `04-supabase-prompt.md`
5. `00-master-prompt.md` + `05-qwen-agent-prompt.md`，先 Task 5，再 Task 6
6. `00-master-prompt.md` + `07-amap-prompt.md`
7. `00-master-prompt.md` + `06-rag-prompt.md`
8. 集成多工具与记忆（实施计划 Task 9）
9. `00-master-prompt.md` + `08-knowledge-loop-prompt.md`
10. `00-master-prompt.md` + `09-testing-deployment-prompt.md`，先 Task 11，再 Task 12

## 赶时间时的演示里程碑

- M1：Task 1–3，完整可点击前端。
- M2：Task 4–6，真实 Supabase + 千问业务工具。
- M3：Task 7–9，高德、深入 RAG、多工具组合。
- M4：Task 10–12，知识闭环、评测、部署。

里程碑不删除最终需求，只决定作品在某一天可以稳定展示到哪个层级。
