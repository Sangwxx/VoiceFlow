# 前端架构与技术约束

## 技术架构

核心链路：

```text
Web Speech API
  -> VoiceController
  -> Fast / Simple / Workflow / Local Planner / Agent
  -> Operation / Diagram
  -> Zustand Stores
  -> Dagre Layout
  -> 只读 React Flow
```

## 状态边界

- `diagramStore`：已提交 Diagram、撤销/重做和选择状态。
- `versionStore`：命名版本和自动快照，持久化到 `localStorage`。
- `voiceStore`、`commandStore`、`agentStore`、`workflowStore`：语音命令生命周期。
- `canvasViewStore`：聚焦、异常分支显示等非持久视图状态。

## 修改约束

- Diagram 变更统一通过 Operation 或 `diagramStore`，组件只负责渲染。
- LLM 修改节点空间关系时优先输出 `set_relative_position`、`align_nodes`、`set_edge_endpoints` 等语义 Operation，由本地空间约束求解器计算坐标和连线路由；Agent 请求必须携带可读的画布空间摘要。
- 外部输入、AI 输出和持久化数据进入业务状态前必须做运行时校验。
- 浏览器能力和持久化能力不可用时，应降级而不是导致主流程崩溃。
- React Flow 画布通过 `React.lazy` 延迟加载；新增重型首屏模块时应评估独立分包。
- Fast Path 常用命令不得调用 AI；命令执行日志是延迟指标的唯一数据来源。
- 流程图、用例图、组织结构图、架构图、思维导图、数据流图、框架图与表格统一由 LLM 输出紧凑结构蓝图；模型不得输出坐标、样式和元数据，本地负责校验和布局。未配置 AI 时才允许使用本地规划器降级。
- 单个基础图形、节点和连线操作必须优先走 Simple Path 本地执行，不得调用 LLM。
- `画/绘制/生成`基础图形表示新建作品，`添加/加/放置`表示编辑当前作品；任何完整画布替换前必须自动备份当前 Diagram。
- 大型图表完成异步布局后必须重新执行 `fitView`，最小缩放比例应允许完整内容进入可视画布。
- React Flow 与 ELK 是结构图渲染和自动布局的统一基础，不再为单一图表类型引入独立渲染器。
- 语音命令不得通过系统反问、候选预览或确认流程阻塞；多候选采用确定性最佳匹配，失败后直接结束当前任务。
- 麦克风监听默认关闭，只能由用户通过“开始语音输入 / 停止语音输入”按钮显式控制；停止后的残余识别结果不得执行。
- 本地 ASR 同音纠错应优先结合命令目标槽位与当前画布对象，只在存在唯一同音目标时替换；不得对新文字等自由内容槽位进行猜测式纠错。
- 文字指令测试入口必须复用 `VoiceController.handleFinalTranscript`，不得维护独立的命令路由或执行逻辑。
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
