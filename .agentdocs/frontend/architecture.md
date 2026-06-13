# 前端架构与技术约束

## 技术架构

核心链路：

```text
Web Speech API
  -> VoiceController
  -> Fast / Simple / Workflow / Agent
  -> Operation / Proposal
  -> Zustand Stores
  -> Dagre Layout
  -> 只读 React Flow
```

## 状态边界

- `diagramStore`：已提交 Diagram、撤销/重做和选择状态。
- `proposalStore`：未提交的候选 Diagram 或 Operation 批次。
- `versionStore`：命名版本和自动快照，持久化到 `localStorage`。
- `voiceStore`、`commandStore`、`agentStore`、`workflowStore`：语音命令生命周期。
- `canvasViewStore`：聚焦、异常分支显示等非持久视图状态。

## 修改约束

- Diagram 变更统一通过 Operation、Proposal 或 `diagramStore`，组件只负责渲染。
- 外部输入、AI 输出和持久化数据进入业务状态前必须做运行时校验。
- 浏览器能力和持久化能力不可用时，应降级而不是导致主流程崩溃。
- React Flow 画布通过 `React.lazy` 延迟加载；新增重型首屏模块时应评估独立分包。
- Fast Path 常用命令不得调用 AI；命令执行日志是延迟指标的唯一数据来源。
- 语义纠错使用三级置信度策略，待确认纠错必须优先于 Proposal 确认处理。
- 消歧候选可以视觉化展示，但不得增加鼠标或键盘编辑入口。
- 新增或修改行为必须补充对应 Vitest 测试。
- 单个代码文件不超过 1000 行，优先复用现有模块。

## 验证命令

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```
