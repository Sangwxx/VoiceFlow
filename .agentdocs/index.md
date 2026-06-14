# AI 代理文档索引

## 全局约束

- 项目根目录：`D:\VoiceFlow\VoiceFlow`
- 技术栈：React 19、TypeScript、Vite、Zustand、React Flow、Vitest。
- Diagram JSON 是唯一绘图数据源；组件不得直接修改 Diagram。
- 所有变更完成后执行：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build`。
- GitHub 仓库：`https://github.com/Sangwxx/VoiceFlow`；验证通过后直接使用中文提交更新 `main`。

## 产品文档

- `prd/idea.md`：产品定位、核心能力和当前范围。理解整体产品目标时读取。

## 前端文档

- `frontend/architecture.md`：前端架构、状态边界、测试与修改约束。修改任何前端代码时必读。

## 已完成任务文档

- `workflow/done/260614-fix-free-drawing-svg-export.md`：修复自由画布 SVG 导出空白问题。
- `workflow/done/260614-ai-free-drawing-planner.md`：自由画布本地增删动作与 AI 通用 SVG 图元规划。
- `workflow/done/260614-free-drawing-mode.md`：专业图表与自由画图按钮切换、SVG 自由画布和基础自由绘图指令。
- `workflow/done/260614-export-agent-context-boundaries.md`：真实浏览器导出、Agent JSON 容错和画布级对话上下文边界。
- `workflow/done/260614-editor-lifecycle-and-viewport.md`：基础绘图指令、未保存画布保护与大型图表视口适配。
- `workflow/done/260614-precise-layout-editing.md`：明确位置约束、节点移动与可靠二次编辑。
- `workflow/done/260614-semantic-spatial-operations.md`：语义相对位置、对齐、连线方向和画布空间摘要。
- `workflow/done/260614-voice-task-segmentation.md`：区分组合绘图补充从句与真正的连续语音任务。
- `workflow/done/260614-homophone-slot-calibration.md`：使用命令目标槽位与当前画布解决同音字歧义。
- `workflow/done/260614-final-fragment-merging.md`：合并同一次录音中的多个 final 识别片段，避免完整指令被粉碎。
- `workflow/done/260614-autonomous-generation-fallback.md`：完整创建指令主动补全、最简流程降级与过时语音错误清理。
- `workflow/done/260614-agent-clarification-loop.md`：Agent 反问窗口、语音与文字回答续接。
- `workflow/done/260614-fix-kimi-browser-connection.md`：通过 Vite 同源代理修复 Kimi 浏览器跨域连接。
- `workflow/done/260614-tool-manual-command-coverage.md`：工具手册 28 条示例逐条路由、执行覆盖与本地工具补齐。
- `workflow/done/260614-llm-diagram-generation.md`：完整图表由 LLM 主导生成，基础图形保持本地绘制，并增加文字测试入口。
- `workflow/done/260613-remove-confirmation-questions.md`：删除系统确认与反问流程，改为确定性选择和校验后直接执行。

- `workflow/done/260613-general-structure-diagram.md`：通用结构图生成、低复杂度模型协议与确认队列恢复。
- `workflow/done/260613-project-audit-and-improvement.md`：项目审计、版本存储可靠性与画布分包优化。
- `workflow/done/260613-competition-delivery-sprint.md`：参赛交付冲刺，可解释消歧、延迟展示、演示材料与 CI。
