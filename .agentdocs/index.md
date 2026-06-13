# AI 代理文档索引

## 全局约束

- 项目根目录：`D:\VoiceFlow\VoiceFlow`
- 技术栈：React 19、TypeScript、Vite、Zustand、React Flow、Vitest。
- Diagram JSON 是唯一绘图数据源；组件不得直接修改 Diagram。
- 所有变更完成后执行：`npm run typecheck`、`npm run lint`、`npm run format:check`、`npm test`、`npm run build`。
- 项目当前未初始化 Git 仓库，修改前后需通过文件检查与测试确认范围。

## 产品文档

- `prd/idea.md`：产品定位、核心能力和当前范围。理解整体产品目标时读取。

## 前端文档

- `frontend/architecture.md`：前端架构、状态边界、测试与修改约束。修改任何前端代码时必读。

## 已完成任务文档

- `workflow/done/260613-project-audit-and-improvement.md`：项目审计、版本存储可靠性与画布分包优化。
