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
- `workspaceModeStore`：专业图表与自由画图模式切换；`freeDrawingStore`：独立 SVG 自由画图 Scene，禁止与 Diagram 状态混用。

## 修改约束

- Diagram 变更统一通过 Operation 或 `diagramStore`，组件只负责渲染。
- LLM 修改节点空间关系时优先输出 `set_relative_position`、`align_nodes`、`set_edge_endpoints` 等语义 Operation，由本地空间约束求解器计算坐标和连线路由；Agent 请求必须携带可读的画布空间摘要。
- 外部输入、AI 输出和持久化数据进入业务状态前必须做运行时校验。
- 本地开发环境中的 Moonshot/Kimi 请求统一通过 Vite `/api/moonshot` 同源代理发送，避免浏览器直接跨域请求导致 `Failed to fetch`。
- 浏览器能力和持久化能力不可用时，应降级而不是导致主流程崩溃。
- React Flow 画布通过 `React.lazy` 延迟加载；新增重型首屏模块时应评估独立分包。
- Fast Path 常用命令不得调用 AI；命令执行日志是延迟指标的唯一数据来源。
- 工具手册中的确定性示例必须通过逐条路由与执行覆盖测试；画布控制、基础编辑、场景、美化、版本和导出均优先使用本地工具，LLM 只负责完整结构规划与规则未覆盖的上下文理解。
- 浏览器导出必须通过真实下载验证；`html-to-image` 的过滤器需要容忍非 Element 输入，Blob 下载链接需要挂载到文档后点击并延迟释放。
- 未指定格式的“导出这个图表、导出当前图”等自然指令默认导出 PNG；导出属于本地 Fast Path，不得交由 LLM 判断。
- 流程图、用例图、组织结构图、架构图、思维导图、数据流图、框架图与表格统一由 LLM 输出紧凑结构蓝图；模型不得输出坐标、样式和元数据，本地负责校验和布局。未配置 AI 时才允许使用本地规划器降级。
- 明确表达“画、生成或创建某类图”的请求均视为完整创建意图；普通缺省信息由 LLM 主动补全，只有会明显改变图表含义的关键歧义才允许反问。
- Agent 反问必须进入 `clarifying` 等待状态并在工作区展示问题；下一句语音或文字作为回答续接原始任务，不得丢失原指令或作为新命令重新路由。
- Agent 对话、反问续答和近期命令必须绑定当前 Diagram ID；画布切换后旧对话自动结束，历史命令不得跨画布发送给模型。
- Agent 输出仍需通过运行时校验；允许从模型说明文字中提取首个完整 JSON 对象，以兼容模型偶发的前后缀说明。
- 单个基础图形、节点和连线操作必须优先走 Simple Path 本地执行，不得调用 LLM。
- `画/绘制/生成`基础图形表示新建作品，`添加/加/放置`表示编辑当前作品；任何完整画布替换前必须自动备份当前 Diagram。
- 大型图表完成异步布局后必须重新执行 `fitView`，最小缩放比例应允许完整内容进入可视画布。
- React Flow 与 ELK 是结构图渲染和自动布局的统一基础，不再为单一图表类型引入独立渲染器。
- 专业图表继续使用 React Flow；自由画图使用独立 SVG 渲染器，两种模式分别保存作品与上下文，切换时不得互相覆盖。
- 专业图表与自由画图模式切换统一通过 `workspaceModeService`；按钮和高优先级语音 Fast Path 必须复用该服务，不得进入节点解析或 Agent。
- 自由画布中的删除、清空和已覆盖的基础绘制必须本地确定性执行；只有未预设的完整绘制请求才调用 AI。AI 仅输出受控 SVG 基础图元，进入状态前必须校验类型、数量、坐标、颜色和路径安全性。
- Simple Path 多候选采用确定性最佳匹配，不使用确认流程阻塞；Agent 仅在关键语义歧义时允许通过可见反问卡片等待回答。
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
