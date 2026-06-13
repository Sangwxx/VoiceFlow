# 项目审计与优化

## 目标

理解 VoiceFlow 的产品、架构和运行链路，在不扩大产品边界的前提下，修复高价值可靠性问题并完善 AI 代理治理文档。

## 现状分析

- 项目采用 React 19、TypeScript、Vite、Zustand、React Flow 和 Vitest。
- 命令按 Fast、Simple、Workflow、Agent 四条路径分流，Diagram 变更边界清晰。
- 初始质量基线通过：TypeScript、ESLint、Prettier 和 104 个测试均通过。
- 项目缺少 `.agentdocs` 索引和架构记忆。
- `versionStore` 只校验持久化版本中的 Diagram，未校验版本元数据；损坏数据可能在搜索或渲染时导致异常。
- `localStorage` 写入和删除异常未被隔离，浏览器禁用存储或容量不足时会中断版本操作。
- React Flow 与主应用同步加载，初始构建包约 503 kB，并触发 Vite 大包警告。

## 分阶段计划

- [x] 阶段一：梳理项目结构、架构文档与质量基线。
- [x] 阶段二：初始化 `.agentdocs` 索引、产品记忆和前端架构文档。
- [x] 阶段三：增强版本持久化的运行时校验和异常降级。
- [x] 阶段四：将重型画布模块延迟加载，并补充单元测试和完整验证。
- [x] 阶段五：任务回顾，更新长期文档并归档任务文档。

## 关键决策

- 持久化版本必须同时校验版本元数据和 Diagram，损坏记录直接过滤。
- `localStorage` 失败时版本仍保留在 Zustand 内存状态，并通过界面提示用户。
- React Flow 画布独立分包，保持画布行为不变并降低首屏主包体积。
