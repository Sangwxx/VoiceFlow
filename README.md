# VoiceFlow：纯语音 AI 绘图工具

VoiceFlow 面向比赛题目“AI 语音绘图工具”，用户授权浏览器麦克风后，可以不使用鼠标、键盘或触摸编辑，通过语音完成流程图和架构图的创建、修改、排版、美化、版本管理与导出。

![VoiceFlow 参赛界面](docs/images/voiceflow-overview.png)

## 核心创新

### 分层低延迟路由

```text
语音输入
  -> Fast Path：撤销、保存、导出、缩放等常用命令本地直通
  -> Simple Path：确定性的节点与连线操作
  -> Workflow Path：版本、主题、场景和视图工作流
  -> Agent Path：复杂生成、上下文修改与语义纠错
```

系统不会让所有命令都等待 AI。确定性命令直接本地执行，界面实时展示执行路径、路由置信度、本次耗时、各路径平均耗时和 Fast Path 命中率。

### 三级置信度语义纠错

- 高置信度（不低于 75%）：自动纠错并直接执行，同时回显修正内容和原因。
- 中置信度（50%–75%）：展示纠错建议，等待用户语音确认或取消。
- 低置信度（低于 50%）：不执行猜测，主动要求用户重新描述。

### 视觉化消歧与安全预览

当一句话可能指向多个节点或分支时，系统暂停操作，用候选框展示原始语音、判断原因、候选编号与类型，用户继续通过语音选择。完整图表生成和复杂批量修改会先进入 Proposal 预览，只有说“确认”后才会提交。

## 题目要求映射

| 题目要求           | VoiceFlow 实现                                          |
| ------------------ | ------------------------------------------------------- |
| 纯语音绘图         | 只读 React Flow 画布，绘图操作统一由语音命令驱动        |
| 指令理解准确与容错 | 上下文语义纠错、三级置信度策略、候选消歧                |
| 降低语音到绘图延迟 | 四级路由、Fast Path 本地直通、实时延迟指标              |
| 复杂指令拆解与执行 | Agent 输出经过校验的 Operation 批次，预览确认后一次提交 |
| 可恢复与安全       | 撤销/重做、持久版本、候选预览、运行时 Diagram 校验      |

## 稳定 Demo 模式

录制和现场演示推荐使用确定性 Mock AI，避免网络与模型输出波动：

```bash
copy .env.example .env.local
npm install
npm run dev
```

`.env.example` 默认包含 `VITE_AI_MODE=mock`。如需连接 OpenAI-compatible Provider，将其改为 `real`，并配置 `VITE_AI_BASE_URL`、`VITE_AI_API_KEY` 和 `VITE_AI_MODEL`。浏览器中的 `VITE_` 配置仅适合本地演示，生产环境应使用后端代理。

## 推荐语音命令

- Fast Path：`撤销`、`重做`、`保存`、`导出 SVG`、`看全图`
- 语义纠错：`声成一张强化学西的流成图`
- 视觉消歧：`把失败分支改成红色虚线`，随后说 `第二个`
- Agent 生成：`画一个用户登录流程图`，随后说 `确认`
- Workflow：`整理成适合汇报的版本`、`保存当前版本叫修改完成`

## 工程质量

- Diagram JSON 是唯一绘图数据源，组件不直接修改图表。
- AI 输出、Operation 和持久化版本进入状态前均经过运行时校验。
- React Flow 画布延迟加载，保持首屏主包体积可控。
- GitHub Actions 自动执行完整质量检查。

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

更多内容见 [ARCHITECTURE.md](ARCHITECTURE.md)、[DEMO_SCRIPT.md](DEMO_SCRIPT.md) 和 [DESIGN_AUDIT.md](DESIGN_AUDIT.md)。
