# VoiceFlow 技术方案设计

# VoiceFlow 技术方案设计

## 纯语音控制的智能流程图 / 架构图绘制工具

# 1\. 项目目标

## 1\.1 项目简介

VoiceFlow 是一款纯语音控制的智能绘图工具。用户不能使用鼠标和键盘，只能通过语音指令完成流程图、架构图等结构化图形的创建、修改、排版、美化、撤销、重做和导出。

本项目不是 AI 生图工具，而是：

语音 → 指令理解 → 图结构 JSON → 自动布局 → 前端可编辑画布渲染

最终结果是可编辑的节点、连线、分组、样式和布局，而不是一张静态图片。

# 2\. 核心技术路线

## 2\.1 技术栈

建议使用：
前端框架：React \+ Vite 或 Next\.js
开发语言：TypeScript
画布渲染：React Flow
自动布局：Dagre，后续可替换为 ELK\.js
状态管理：Zustand
语音识别：Web Speech API，后续可替换为 Whisper / 云端 ASR
AI 指令解析：LLM API，可抽象为 provider
样式：Tailwind CSS 或普通 CSS Modules
导出：SVG / PNG / JSON
测试：Vitest \+ React Testing Library
代码规范：ESLint \+ Prettier

第一版推荐使用：
React \+ Vite \+ TypeScript \+ React Flow \+ Zustand \+ Dagre

原因是 Vite 启动快、结构轻，适合比赛项目快速开发。

# 3\. 总体架构

## 3\.1 架构原则

本项目必须遵守以下设计原则：

1. AI 不直接操作画布
AI 只负责生成 Diagram JSON 或 Operation JSON。

2. 渲染层不关心 AI
React Flow 只接收图结构数据并渲染。

3. 语音识别模块可替换
Web Speech API、Whisper、其他 ASR 都应该实现同一接口。

4. LLM Provider 可替换
任何大模型都通过统一接口调用。

5. 业务状态集中在 Diagram Store
画布、历史记录、版本、选中对象都由统一状态管理。

6. 快捷命令不走 AI
撤销、重做、保存、导出、放大、缩小、暂停等走 Fast Path。

7. 复杂命令才走 AI
新建完整流程图、自动补全、汇报美化、复杂修改等走 Agent Path。

## 3\.2 总体数据流

```Plaintext
用户语音
  ↓
Voice Provider 语音识别
  ↓
Command Router 指令路由
  ├─ Fast Command Engine
  ├─ Simple Command Parser
  └─ Agent Planner
  ↓
Operation Executor 操作执行器
  ↓
Diagram Store 图结构状态
  ↓
Layout Engine 自动布局
  ↓
Canvas Renderer React Flow 渲染
  ↓
Export Engine 导出
```

# 4\. 推荐项目目录结构

```Plaintext
voiceflow/
├─ public/
│  └─ assets/
│
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ AppLayout.tsx
│  │  └─ routes.tsx
│  │
│  ├─ components/
│  │  ├─ canvas/
│  │  │  ├─ VoiceCanvas.tsx
│  │  │  ├─ FlowRenderer.tsx
│  │  │  ├─ nodes/
│  │  │  │  ├─ StartNode.tsx
│  │  │  │  ├─ EndNode.tsx
│  │  │  │  ├─ ProcessNode.tsx
│  │  │  │  ├─ DecisionNode.tsx
│  │  │  │  ├─ DatabaseNode.tsx
│  │  │  │  └─ ServiceNode.tsx
│  │  │  ├─ edges/
│  │  │  │  ├─ DefaultEdge.tsx
│  │  │  │  ├─ DashedEdge.tsx
│  │  │  │  └─ HighlightEdge.tsx
│  │  │  └─ canvasTypes.ts
│  │  │
│  │  ├─ voice/
│  │  │  ├─ VoicePanel.tsx
│  │  │  ├─ VoiceStatus.tsx
│  │  │  └─ TranscriptView.tsx
│  │  │
│  │  ├─ command/
│  │  │  ├─ CommandPanel.tsx
│  │  │  ├─ ParsedIntentView.tsx
│  │  │  └─ OperationQueueView.tsx
│  │  │
│  │  ├─ history/
│  │  │  ├─ HistoryPanel.tsx
│  │  │  └─ VersionList.tsx
│  │  │
│  │  ├─ toolbar/
│  │  │  ├─ TopBar.tsx
│  │  │  └─ StatusBar.tsx
│  │  │
│  │  └─ common/
│  │     ├─ Button.tsx
│  │     ├─ Card.tsx
│  │     └─ EmptyState.tsx
│  │
│  ├─ core/
│  │  ├─ diagram/
│  │  │  ├─ diagramTypes.ts
│  │  │  ├─ diagramFactory.ts
│  │  │  ├─ diagramSelectors.ts
│  │  │  ├─ diagramValidators.ts
│  │  │  └─ diagramUtils.ts
│  │  │
│  │  ├─ operations/
│  │  │  ├─ operationTypes.ts
│  │  │  ├─ operationExecutor.ts
│  │  │  ├─ operationFactory.ts
│  │  │  ├─ operationValidator.ts
│  │  │  └─ operationDescriptions.ts
│  │  │
│  │  ├─ layout/
│  │  │  ├─ layoutTypes.ts
│  │  │  ├─ layoutEngine.ts
│  │  │  ├─ dagreLayout.ts
│  │  │  └─ layoutUtils.ts
│  │  │
│  │  ├─ history/
│  │  │  ├─ historyTypes.ts
│  │  │  ├─ historyManager.ts
│  │  │  └─ versionManager.ts
│  │  │
│  │  ├─ export/
│  │  │  ├─ exportTypes.ts
│  │  │  ├─ exportJson.ts
│  │  │  ├─ exportSvg.ts
│  │  │  └─ exportPng.ts
│  │  │
│  │  └─ theme/
│  │     ├─ themeTypes.ts
│  │     ├─ themes.ts
│  │     └─ applyTheme.ts
│  │
│  ├─ voice/
│  │  ├─ voiceTypes.ts
│  │  ├─ voiceProvider.ts
│  │  ├─ webSpeechProvider.ts
│  │  └─ voiceController.ts
│  │
│  ├─ commands/
│  │  ├─ router/
│  │  │  ├─ commandRouter.ts
│  │  │  ├─ routeTypes.ts
│  │  │  └─ routeRules.ts
│  │  │
│  │  ├─ fast/
│  │  │  ├─ fastCommandTypes.ts
│  │  │  ├─ fastCommandDictionary.ts
│  │  │  └─ fastCommandExecutor.ts
│  │  │
│  │  ├─ simple/
│  │  │  ├─ simpleCommandParser.ts
│  │  │  ├─ simpleCommandRules.ts
│  │  │  └─ entityResolver.ts
│  │  │
│  │  └─ agent/
│  │     ├─ agentPlanner.ts
│  │     ├─ agentPrompts.ts
│  │     ├─ agentSchemas.ts
│  │     └─ agentResultNormalizer.ts
│  │
│  ├─ ai/
│  │  ├─ aiProviderTypes.ts
│  │  ├─ aiProvider.ts
│  │  ├─ mockAiProvider.ts
│  │  └─ httpAiProvider.ts
│  │
│  ├─ stores/
│  │  ├─ diagramStore.ts
│  │  ├─ voiceStore.ts
│  │  ├─ commandStore.ts
│  │  └─ uiStore.ts
│  │
│  ├─ utils/
│  │  ├─ id.ts
│  │  ├─ text.ts
│  │  ├─ logger.ts
│  │  ├─ assertNever.ts
│  │  └─ debounce.ts
│  │
│  ├─ tests/
│  │  ├─ commandRouter.test.ts
│  │  ├─ fastCommand.test.ts
│  │  ├─ operationExecutor.test.ts
│  │  ├─ diagramValidator.test.ts
│  │  └─ layoutEngine.test.ts
│  │
│  ├─ main.tsx
│  └─ index.css
│
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ README.md
└─ docs/
   ├─ architecture.md
   ├─ demo-script.md
   └─ command-examples.md
```

# 5\. 核心数据模型设计

## 5\.1 Diagram 数据模型

位置：
src/core/diagram/diagramTypes\.ts

```TypeScript
export type DiagramType =
  | 'flowchart'
  | 'architecture';

export type NodeType =
  | 'start'
  | 'end'
  | 'process'
  | 'decision'
  | 'database'
  | 'service'
  | 'user'
  | 'external'
  | 'group';

export type LayoutDirection =
  | 'top_down'
  | 'left_to_right';

export type Diagram = {
  id: string;
  title: string;
  diagramType: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
  layout: DiagramLayout;
  theme: DiagramTheme;
  metadata: DiagramMetadata;
};

export type DiagramNode = {
  id: string;
  label: string;
  type: NodeType;
  position?: Position;
  size?: Size;
  style?: NodeStyle;
  locked?: boolean;
  data?: Record<string, unknown>;
};

export type DiagramEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: 'solid' | 'dashed' | 'highlight' | 'weak';
  style?: EdgeStyle;
  locked?: boolean;
};

export type DiagramGroup = {
  id: string;
  label: string;
  nodeIds: string[];
  style?: NodeStyle;
};

export type DiagramLayout = {
  direction: LayoutDirection;
  spacingX: number;
  spacingY: number;
  autoLayout: boolean;
};

export type DiagramTheme = {
  name: 'default' | 'business_blue' | 'report_clean' | 'tech_dark';
};

export type DiagramMetadata = {
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type NodeStyle = {
  background?: string;
  border?: string;
  color?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontSize?: number;
  fontWeight?: number | string;
};

export type EdgeStyle = {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  color?: string;
};
```

## 5\.2 Operation 数据模型

位置：
src/core/operations/operationTypes\.ts

```TypeScript
export type DiagramOperation =
  | CreateDiagramOperation
  | CreateNodeOperation
  | DeleteNodeOperation
  | UpdateNodeOperation
  | CreateEdgeOperation
  | DeleteEdgeOperation
  | UpdateEdgeOperation
  | InsertNodeAfterOperation
  | ApplyLayoutOperation
  | ApplyThemeOperation
  | HighlightMainPathOperation
  | WeakenExceptionPathsOperation;

export type BaseOperation = {
  id: string;
  type: string;
  description?: string;
  timestamp: string;
};

export type CreateDiagramOperation = BaseOperation & {
  type: 'create_diagram';
  diagram: Diagram;
};

export type CreateNodeOperation = BaseOperation & {
  type: 'create_node';
  node: DiagramNode;
};

export type DeleteNodeOperation = BaseOperation & {
  type: 'delete_node';
  nodeId: string;
};

export type UpdateNodeOperation = BaseOperation & {
  type: 'update_node';
  nodeId: string;
  patch: Partial<DiagramNode>;
};

export type CreateEdgeOperation = BaseOperation & {
  type: 'create_edge';
  edge: DiagramEdge;
};

export type DeleteEdgeOperation = BaseOperation & {
  type: 'delete_edge';
  edgeId: string;
};

export type UpdateEdgeOperation = BaseOperation & {
  type: 'update_edge';
  edgeId: string;
  patch: Partial<DiagramEdge>;
};

export type InsertNodeAfterOperation = BaseOperation & {
  type: 'insert_node_after';
  targetNodeId: string;
  newNode: DiagramNode;
};

export type ApplyLayoutOperation = BaseOperation & {
  type: 'apply_layout';
  direction?: LayoutDirection;
};

export type ApplyThemeOperation = BaseOperation & {
  type: 'apply_theme';
  themeName: DiagramTheme['name'];
};

export type HighlightMainPathOperation = BaseOperation & {
  type: 'highlight_main_path';
};

export type WeakenExceptionPathsOperation = BaseOperation & {
  type: 'weaken_exception_paths';
};
```

# 6\. 状态管理设计

## 6\.1 Diagram Store

位置：
src/stores/diagramStore\.ts

职责：

1. 保存当前 Diagram。

2. 执行 Operation。

3. 保存历史栈。

4. 支持撤销重做。

5. 支持版本保存与恢复。

6. 暴露当前选中节点或边。

7. 触发布局更新。

接口建议：

```TypeScript
export type DiagramStoreState = {
  diagram: Diagram | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  past: Diagram[];
  future: Diagram[];
  versions: DiagramVersion[];

  setDiagram: (diagram: Diagram) => void;
  applyOperation: (operation: DiagramOperation) => void;
  applyOperations: (operations: DiagramOperation[]) => void;

  undo: () => void;
  redo: () => void;

  saveVersion: (name?: string) => void;
  restoreVersion: (versionId: string) => void;

  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
};
```

实现要求：

1. 每次修改 diagram 前，都要把旧 diagram 放入 past。

2. undo 时从 past 取最后一个 diagram。

3. redo 时从 future 恢复。

4. 所有修改都必须走 applyOperation 或 applyOperations。

5. 不允许组件直接改 diagram\.nodes 或 diagram\.edges。

## 6\.2 Voice Store

位置：
src/stores/voiceStore\.ts

职责：

1. 记录当前语音状态。

2. 记录实时识别文本。

3. 记录最终识别文本。

4. 记录是否正在监听。

5. 记录是否正在处理中。

接口建议：

```TypeScript
export type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'processing'
  | 'error';

export type VoiceStoreState = {
  status: VoiceStatus;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;

  setStatus: (status: VoiceStatus) => void;
  setInterimTranscript: (text: string) => void;
  setFinalTranscript: (text: string) => void;
  setError: (error: string | null) => void;
  resetTranscript: () => void;
};
```

## 6\.3 Command Store

位置：
src/stores/commandStore\.ts

职责：

1. 保存当前指令解析结果。

2. 保存操作队列。

3. 保存系统理解面板内容。

4. 保存需要用户确认的 pending action。

5. 保存最近执行结果。

接口建议：

```TypeScript
export type CommandStoreState = {
  lastUserCommand: string | null;
  lastRouteResult: RouteResult | null;
  pendingOperations: DiagramOperation[];
  pendingClarification: ClarificationRequest | null;
  executionLog: CommandExecutionLog[];

  setLastUserCommand: (command: string) => void;
  setRouteResult: (result: RouteResult) => void;
  setPendingOperations: (ops: DiagramOperation[]) => void;
  setPendingClarification: (req: ClarificationRequest | null) => void;
  addExecutionLog: (log: CommandExecutionLog) => void;
};
```

# 7\. 语音模块设计

## 7\.1 Voice Provider 抽象

位置：
src/voice/voiceProvider\.ts

目标：
不要让业务代码依赖 Web Speech API。
后续替换 Whisper 时，只需要替换 Provider。

接口：

```TypeScript
export type VoiceRecognitionResult = {
  text: string;
  isFinal: boolean;
};

export type VoiceProviderCallbacks = {
  onResult: (result: VoiceRecognitionResult) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
};

export interface VoiceProvider {
  start(callbacks: VoiceProviderCallbacks): void;
  stop(): void;
  isSupported(): boolean;
}
```

## 7\.2 WebSpeechProvider

位置：
src/voice/webSpeechProvider\.ts

实现要求：

1. 封装浏览器 SpeechRecognition。

2. 支持中文。

3. 支持 interimResults。

4. 支持 continuous。

5. 将结果通过 VoiceProviderCallbacks 回传。

6. 不在这个模块里处理命令，只负责语音识别。

伪代码：

```TypeScript
export class WebSpeechProvider implements VoiceProvider {
  private recognition: SpeechRecognition | null = null;

  isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  start(callbacks: VoiceProviderCallbacks) {
    // 初始化 recognition
    // recognition.lang = 'zh-CN'
    // recognition.interimResults = true
    // recognition.continuous = true
    // onresult 中回调 callbacks.onResult
  }

  stop() {
    this.recognition?.stop();
  }
}
```

## 7\.3 Voice Controller

位置：
src/voice/voiceController\.ts

职责：

1. 启动语音识别。

2. 更新 Voice Store。

3. 当识别到 final text 时，将文本交给 Command Router。

4. 支持停止。

5. 支持高优先级词实时打断。

接口：

```TypeScript
export type VoiceController = {
  startListening: () => void;
  stopListening: () => void;
  handleFinalTranscript: (text: string) => Promise<void>;
};
```

# 8\. 指令路由设计

## 8\.1 RouteResult 类型

位置：
src/commands/router/routeTypes\.ts

```TypeScript
export type CommandRoute =
  | 'fast'
  | 'simple'
  | 'agent'
  | 'clarification'
  | 'unknown';

export type RouteResult = {
  route: CommandRoute;
  confidence: number;
  rawText: string;
  normalizedText: string;
  reason?: string;
  fastCommand?: FastCommandName;
  simpleIntent?: SimpleIntentName;
  agentIntent?: AgentIntentName;
};
```

## 8\.2 Command Router

位置：
src/commands/router/commandRouter\.ts

职责：

1. 接收语音文本。

2. 先判断是否为 Fast Path。

3. 再判断是否为 Simple Path。

4. 最后进入 Agent Path。

5. 返回 RouteResult。

路由优先级：
P0：紧急控制词
P1：快捷命令
P2：简单绘图操作
P3：复杂 Agent 操作

伪代码：

```TypeScript
export function routeCommand(text: string): RouteResult {
  const normalized = normalizeText(text);

  const fast = matchFastCommand(normalized);
  if (fast) {
    return {
      route: 'fast',
      confidence: fast.confidence,
      rawText: text,
      normalizedText: normalized,
      fastCommand: fast.command,
    };
  }

  const simple = matchSimpleCommand(normalized);
  if (simple) {
    return {
      route: 'simple',
      confidence: simple.confidence,
      rawText: text,
      normalizedText: normalized,
      simpleIntent: simple.intent,
    };
  }

  if (looksLikeComplexDrawingTask(normalized)) {
    return {
      route: 'agent',
      confidence: 0.85,
      rawText: text,
      normalizedText: normalized,
      agentIntent: 'plan_diagram',
    };
  }

  return {
    route: 'unknown',
    confidence: 0.2,
    rawText: text,
    normalizedText: normalized,
  };
}
```

# 9\. Fast Command 设计

## 9\.1 Fast Command 类型

位置：
src/commands/fast/fastCommandTypes\.ts

```TypeScript
export type FastCommandName =
  | 'undo'
  | 'redo'
  | 'save_version'
  | 'restore_previous_version'
  | 'zoom_in'
  | 'zoom_out'
  | 'fit_view'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'export_svg'
  | 'export_png'
  | 'export_json'
  | 'confirm'
  | 'reject';
```

## 9\.2 Fast Command Dictionary

位置：
src/commands/fast/fastCommandDictionary\.ts

示例：

```TypeScript
export const fastCommandDictionary = [
  {
    command: 'undo',
    phrases: ['撤销', '回到上一步', '退一步', '刚才的不算', '恢复刚才'],
  },
  {
    command: 'redo',
    phrases: ['重做', '恢复回来', '再做一次'],
  },
  {
    command: 'pause',
    phrases: ['暂停', '停一下', '先别动', '停止'],
  },
  {
    command: 'fit_view',
    phrases: ['看全图', '适应屏幕', '显示完整画布'],
  },
  {
    command: 'export_svg',
    phrases: ['导出 SVG', '导出矢量图'],
  },
  {
    command: 'export_png',
    phrases: ['导出 PNG', '导出图片'],
  },
];
```

## 9\.3 Fast Command Executor

位置：
src/commands/fast/fastCommandExecutor\.ts

职责：
根据 FastCommandName 调用对应 store 或服务。

接口：

```TypeScript
export async function executeFastCommand(command: FastCommandName): Promise<void> {
  switch (command) {
    case 'undo':
      useDiagramStore.getState().undo();
      break;

    case 'redo':
      useDiagramStore.getState().redo();
      break;

    case 'save_version':
      useDiagramStore.getState().saveVersion();
      break;

    case 'fit_view':
      // 调用 React Flow instance.fitView()
      break;

    case 'export_json':
      exportCurrentDiagramAsJson();
      break;

    default:
      assertNever(command);
  }
}
```

设计要求：

1. Fast Command 不调用 AI。

2. Fast Command 必须更新 command log。

3. Fast Command 执行失败时要返回错误。

4. pause / cancel 等命令优先级最高。

# 10\. Simple Command 设计

## 10\.1 Simple Intent 类型

位置：
src/commands/simple/simpleCommandParser\.ts

```TypeScript
export type SimpleIntentName =
  | 'create_node'
  | 'delete_node'
  | 'update_node_text'
  | 'update_node_style'
  | 'create_edge'
  | 'delete_edge'
  | 'update_edge_style'
  | 'insert_node_after'
  | 'apply_layout'
  | 'apply_theme';
```

## 10\.2 Simple Command Parser

职责：
将简单语音命令解析为 Operation JSON。

示例 1：
输入：
加一个节点，叫验证码校验

```JSON
{
  "type": "create_node",
  "node": {
    "id": "node_xxx",
    "label": "验证码校验",
    "type": "process"
  }
}
```

示例 2：
输入：
把失败分支改成红色虚线

```JSON
{
  "type": "update_edge",
  "edgeId": "edge_failed",
  "patch": {
    "type": "dashed",
    "style": {
      "stroke": "#ff4d4f",
      "strokeDasharray": "6 4"
    }
  }
}
```

## 10\.3 Entity Resolver

位置：
src/commands/simple/entityResolver\.ts

职责：
根据用户口语找到对应节点或连线。

输入：
resolveNodeByLabelOrAlias\(diagram, '登录页'\)
resolveEdgeByLabelOrAlias\(diagram, '失败分支'\)

输出：

```TypeScript
type ResolveResult<T> =
  | { status: 'found'; item: T }
  | { status: 'multiple'; candidates: T[] }
  | { status: 'not_found' };
```

处理规则：

1. 精确匹配 label。

2. 包含匹配 label。

3. 同义词匹配。

4. 最近操作对象优先。

5. 当前选中对象优先。

6. 多个候选时进入 clarification。

# 11\. Agent Planner 设计

## 11\.1 触发场景

Agent Planner 只处理复杂任务：

1. 新建完整流程图。

2. 新建系统架构图。

3. 根据已有图进行复杂优化。

4. 自动补全异常分支。

5. 汇报美化。

6. 技术文档模式。

7. 检查流程逻辑完整性。

## 11\.2 AI Provider 抽象

位置：
src/ai/aiProviderTypes\.ts

```TypeScript
export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiCompletionOptions = {
  temperature?: number;
  responseFormat?: 'json' | 'text';
};

export interface AiProvider {
  complete(messages: AiMessage[], options?: AiCompletionOptions): Promise<string>;
}
```

提供两个实现：
mockAiProvider\.ts：用于本地开发和测试
httpAiProvider\.ts：用于真实 LLM API

## 11\.3 Agent 输出格式

Agent 不直接输出自然语言，而是输出：

```TypeScript
export type AgentPlanResult = {
  kind: 'diagram' | 'operations' | 'clarification';
  explanation: string;
  diagram?: Diagram;
  operations?: DiagramOperation[];
  clarification?: ClarificationRequest;
};
```

示例：

```JSON
{
  "kind": "diagram",
  "explanation": "已识别为用户登录流程图，包含 6 个节点和 2 个判断分支。",
  "diagram": {
    "id": "diagram_login",
    "title": "用户登录流程图",
    "diagramType": "flowchart",
    "nodes": [],
    "edges": [],
    "layout": {
      "direction": "top_down",
      "spacingX": 180,
      "spacingY": 120,
      "autoLayout": true
    },
    "theme": {
      "name": "business_blue"
    },
    "metadata": {}
  }
}
```

## 11\.4 Agent Prompt 要求

Agent Prompt 必须明确：

1. 只输出合法 JSON。

2. 不输出 Markdown。

3. 不输出解释性废话。

4. 节点 id 必须英文小写加下划线。

5. 判断节点使用 decision。

6. 开始节点使用 start。

7. 结束节点使用 end。

8. 流程节点使用 process。

9. 数据库使用 database。

10. 连线 from 和 to 必须引用已有节点 id。

11. 缺失信息不要乱猜，必要时输出 clarification。

12. 不要生成坐标，坐标由 Layout Engine 负责。

## 11\.5 Agent 结果校验

位置：
src/commands/agent/agentResultNormalizer\.ts

处理流程：
AI 原始输出
↓
JSON parse
↓
schema validate
↓
normalize ids
↓
ensure edges reference existing nodes
↓
fill default layout/theme/metadata
↓
return AgentPlanResult

如果失败：

1. 不更新画布。

2. 给出错误提示。

3. 使用 mock fallback 或让用户重说。

# 12\. Operation Executor 设计

## 12\.1 位置

src/core/operations/operationExecutor\.ts

## 12\.2 职责

接收 Diagram 和 Operation，返回新的 Diagram。

接口：

```TypeScript
export function executeOperation(
  diagram: Diagram,
  operation: DiagramOperation
): Diagram;

export function executeOperations(
  diagram: Diagram,
  operations: DiagramOperation[]
): Diagram;
```

## 12\.3 设计要求

1. 纯函数，不直接修改原 diagram。

2. 每个 operation 单独处理。

3. 找不到节点或边时抛出明确错误。

4. 执行后更新 metadata\.updatedAt。

5. 对需要重新布局的操作标记 layout dirty。

# 13\. Layout Engine 设计

## 13\.1 位置

src/core/layout/layoutEngine\.ts

## 13\.2 接口

```TypeScript
export interface LayoutEngine {
  layout(diagram: Diagram): Diagram;
}
```

## 13\.3 Dagre 实现

位置：
src/core/layout/dagreLayout\.ts

实现逻辑：

1. 创建 dagre graph。

2. 根据 layout\.direction 设置 rankdir。

3. 添加所有节点。

4. 添加所有边。

5. 执行 dagre\.layout。

6. 将坐标写回 diagram\.nodes。

方向映射：
top\_down → TB
left\_to\_right → LR

默认尺寸：
process: 180 x 64
decision: 180 x 90
database: 180 x 72
start/end: 140 x 56

# 14\. Canvas Renderer 设计

## 14\.1 React Flow 数据转换

位置：
src/components/canvas/canvasTypes\.ts

职责：
将 Diagram 转换为 React Flow 需要的 nodes / edges。

接口：

```TypeScript
export function diagramToReactFlow(diagram: Diagram): {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
};
```

映射规则：
DiagramNode\.type = start → StartNode
DiagramNode\.type = end → EndNode
DiagramNode\.type = process → ProcessNode
DiagramNode\.type = decision → DecisionNode
DiagramNode\.type = database → DatabaseNode
DiagramNode\.type = service → ServiceNode

## 14\.2 FlowRenderer

位置：
src/components/canvas/FlowRenderer\.tsx

职责：

1. 从 Diagram Store 读取 diagram。

2. 转换为 React Flow nodes / edges。

3. 渲染 React Flow。

4. 提供 fitView、zoomIn、zoomOut 方法给 UI Store 或 Canvas Controller。

5. 不直接处理语音或 AI。

## 14\.3 自定义节点

每个节点组件只负责展示。

例如 ProcessNode：

```TypeScript
export function ProcessNode({ data }: NodeProps) {
  return (
    <div className="voiceflow-node process-node">
      {data.label}
    </div>
  );
}
```

DecisionNode 使用菱形样式。
DatabaseNode 使用圆柱样式。

# 15\. 主题与美化设计

## 15\.1 Theme 类型

位置：
src/core/theme/themeTypes\.ts

```TypeScript
export type ThemePreset = {
  name: DiagramTheme['name'];
  nodeStyles: Record<NodeType, NodeStyle>;
  edgeStyle: EdgeStyle;
  canvasBackground: string;
};
```

## 15\.2 内置主题

位置：
src/core/theme/themes\.ts

建议内置：
default：默认简洁风
business\_blue：商务蓝
report\_clean：汇报简洁风
tech\_dark：技术深色风

## 15\.3 Apply Theme

位置：
src/core/theme/applyTheme\.ts

接口：

```TypeScript
export function applyTheme(diagram: Diagram, themeName: DiagramTheme['name']): Diagram;
```

要求：

1. 根据 node\.type 应用样式。

2. 根据 edge\.type 应用样式。

3. 保留用户手动设置的部分样式，除非用户明确说“统一样式”。

4. 自动更新 diagram\.theme。

# 16\. 汇报模式设计

## 16\.1 用户指令

把这个流程整理成适合汇报的版本
主流程突出，异常分支弱化
改成老板能看懂的版本

## 16\.2 执行策略

生成一组 Operation：

1. apply\_theme\(report\_clean\)

2. highlight\_main\_path

3. weaken\_exception\_paths

4. apply\_layout

5. save\_version\("汇报版"\)

## 16\.3 主流程识别

第一版规则：

1. 从 start 节点出发。

2. 优先选择 label 为“是”“成功”“正常”的边。

3. 避免 label 为“否”“失败”“异常”“错误”的边。

4. 直到 end 节点或无后续节点。

## 16\.4 异常分支识别

边 label 包含：
否
失败
异常
错误
超时
拒绝

则视为异常分支。

异常分支样式：

```JSON
{
  "type": "weak",
  "style": {
    "stroke": "#B0B7C3",
    "strokeDasharray": "6 4",
    "strokeWidth": 1.5
  }
}
```

# 17\. 导出模块设计

## 17\.1 Export JSON

位置：
src/core/export/exportJson\.ts

功能：
将 Diagram JSON 下载为文件。

文件名：
voiceflow\-${diagram.title}-$\{timestamp\}\.json

## 17\.2 Export SVG

位置：
src/core/export/exportSvg\.ts

第一版可通过 React Flow 容器中的 SVG 结构导出，或使用 html\-to\-image 方案。

要求：

1. 导出当前画布。

2. 背景为白色。

3. 文件名包含图标题。

4. 导出前自动 fitView。

## 17\.3 Export PNG

位置：
src/core/export/exportPng\.ts

第一版可以使用 html\-to\-image 将画布 DOM 转成 PNG。

# 18\. UI 页面设计

## 18\.1 总体布局

```Plaintext
┌──────────────────────────────────────────┐
│ TopBar：标题、当前状态、导出状态          │
├───────────────┬──────────────────────────┤
│ Left Panel    │ Canvas                   │
│ 语音状态       │ React Flow 画布           │
│ 快捷命令提示   │                          │
├───────────────┴──────────────────────────┤
│ Bottom Transcript：实时语音字幕           │
├──────────────────────────────────────────┤
│ Right Panel：系统理解、操作队列、历史版本 │
└──────────────────────────────────────────┘
```

## 18\.2 必须展示的 UI 信息

1. 当前是否正在聆听。

2. 当前识别到的语音文本。

3. 当前指令路由结果：Fast / Simple / Agent。

4. 当前系统理解结果。

5. 即将执行的操作队列。

6. 当前版本历史。

7. 最近一次执行结果。

8. 当前是否需要用户澄清。

# 19\. 功能清单与验收标准

## 19\.1 语音创建流程图

输入：
新建一个流程图，主题是用户登录流程。从打开 App 开始，判断是否已登录，已登录进入首页，未登录进入登录页，登录成功进入首页，失败提示错误。

验收：

1. 能识别语音。

2. 能生成至少 6 个节点。

3. 能生成判断分支。

4. 能自动布局。

5. 能显示系统理解结果。

## 19\.2 语音添加节点

输入：
在登录页后面加一个验证码校验节点

验收：

1. 能找到登录页节点。

2. 能插入验证码节点。

3. 能更新连线。

4. 能局部重新布局。

5. 能撤销。

## 19\.3 语音修改连线样式

输入：
把失败分支改成红色虚线

验收：

1. 能定位失败分支。

2. 能修改颜色。

3. 能修改虚线样式。

4. 如果多个失败分支，能澄清。

## 19\.4 快捷命令

输入：
撤销
重做
看全图
导出 PNG

验收：

1. 不调用 AI。

2. 响应快速。

3. 状态正确更新。

4. 操作日志记录。

## 19\.5 汇报美化

输入：
把这个流程整理成适合汇报的版本，主流程突出，异常分支弱化。

验收：

1. 应用汇报主题。

2. 主流程明显高亮。

3. 异常分支弱化。

4. 自动重新布局。

5. 保存一个新版本。

# 20\. 开发阶段计划

## 20\.1 Milestone 1：基础画布

目标：
静态 Diagram JSON 可以渲染成 React Flow 图

任务：

1. 初始化项目。

2. 配置 TypeScript。

3. 集成 React Flow。

4. 定义 Diagram 类型。

5. 实现 diagramToReactFlow。

6. 实现基础节点组件。

7. 实现 Dagre 布局。

## 20\.2 Milestone 2：状态与操作

目标：
通过 Operation JSON 修改图结构

任务：

1. 实现 Diagram Store。

2. 实现 Operation 类型。

3. 实现 Operation Executor。

4. 实现 undo / redo。

5. 实现 save version / restore version。

6. 实现操作历史面板。

## 20\.3 Milestone 3：语音与 Fast Path

目标：
用户可以通过语音执行快捷命令

任务：

1. 实现 VoiceProvider。

2. 实现 WebSpeechProvider。

3. 实现 VoicePanel。

4. 实现 Command Router。

5. 实现 Fast Command Dictionary。

6. 实现 Fast Command Executor。

## 20\.4 Milestone 4：Simple Path

目标：
用户可以通过语音添加、删除、修改节点和连线

任务：

1. 实现 Simple Command Parser。

2. 实现 Entity Resolver。

3. 支持添加节点。

4. 支持插入节点。

5. 支持修改节点颜色。

6. 支持修改连线样式。

7. 支持自动布局。

## 20\.5 Milestone 5：Agent Path

目标：
用户可以通过长语音生成完整流程图

任务：

1. 实现 AiProvider。

2. 实现 MockAiProvider。

3. 实现 HttpAiProvider。

4. 编写 Agent Prompt。

5. 实现 Agent Result Normalizer。

6. 实现 Schema 校验。

7. 支持创建流程图。

8. 支持创建架构图。

## 20\.6 Milestone 6：创新功能与 Demo

目标：
完成比赛演示效果

任务：

1. 汇报美化模式。

2. 主流程高亮。

3. 异常分支弱化。

4. 语音澄清。

5. 导出 SVG / PNG。

6. Demo 脚本。

7. README。

8. 架构文档。

# 21\. 推荐 PR 拆分

PR 01：项目初始化
PR 02：React Flow 画布接入
PR 03：Diagram 类型定义
PR 04：Diagram 转 React Flow
PR 05：Dagre 自动布局
PR 06：Zustand Diagram Store
PR 07：Operation 类型与执行器
PR 08：Undo / Redo / Version
PR 09：VoiceProvider 抽象
PR 10：WebSpeechProvider 实现
PR 11：Command Router
PR 12：Fast Command Engine
PR 13：Simple Command Parser
PR 14：Entity Resolver
PR 15：Agent Provider 抽象
PR 16：Agent Planner
PR 17：AI JSON 校验与归一化
PR 18：汇报美化模式
PR 19：导出 SVG / PNG
PR 20：Demo 页面与文档

# 22\. 测试方案

## 22\.1 单元测试

必须测试：

1. Command Router 分类。

2. Fast Command 匹配。

3. Operation Executor。

4. Entity Resolver。

5. Diagram Validator。

6. Layout Engine。

7. Theme Apply。

8. Undo / Redo。

## 22\.2 测试示例

Command Router：

```TypeScript
expect(routeCommand('撤销').route).toBe('fast');
expect(routeCommand('加一个节点叫登录').route).toBe('simple');
expect(routeCommand('画一个电商下单流程图').route).toBe('agent');
```

Operation Executor：

```TypeScript
const next = executeOperation(diagram, createNodeOp);
expect(next.nodes.length).toBe(diagram.nodes.length + 1);
```

Entity Resolver：

```TypeScript
const result = resolveNodeByLabelOrAlias(diagram, '登录页');
expect(result.status).toBe('found');
```

# 23\. Mock 数据

建议提供 demo diagrams：

```Plaintext
src/mock/
├─ loginFlowDiagram.ts
├─ ecommerceFlowDiagram.ts
└─ architectureDiagram.ts
```

用于：

1. 开发画布。

2. 测试布局。

3. 无 AI 环境演示。

4. Demo 兜底。

# 24\. Demo 场景

## 24\.1 登录流程图

语音：
新建一个流程图，主题是用户登录流程。从打开 App 开始，判断是否已登录，已登录进入首页，未登录进入登录页，登录成功进入首页，失败提示错误。

## 24\.2 添加验证码

语音：
在登录页后面加一个验证码校验节点

## 24\.3 修改失败分支

语音：
把失败分支改成红色虚线

## 24\.4 快捷命令

语音：
撤销
重做
看全图

## 24\.5 汇报美化

语音：
把这个流程整理成适合汇报的版本，主流程突出，异常分支弱化。

## 24\.6 导出

语音：
导出 PNG

# 25\. Codex 开发要求

请 Codex 按以下规则实现：

1. 使用 TypeScript，所有核心类型必须显式定义。

2. 不要把语音、AI、画布、状态管理写在同一个文件。

3. 每个模块只做一件事。

4. AI 模块只能输出 Diagram JSON 或 Operation JSON。

5. React 组件不要直接修改 Diagram。

6. 所有 Diagram 修改必须经过 Operation Executor。

7. 所有快捷命令必须绕过 AI。

8. 所有 Agent 输出必须校验后才能写入 Store。

9. 复杂功能先实现 mock 版本，再接真实 API。

10. 保证项目可以在没有 AI Key 的情况下运行 Demo。

# 26\. 最终验收标准

项目完成后，必须能够演示以下完整流程：

1. 打开页面

2. 点击或自动开启语音监听

3. 用户说：新建一个用户登录流程图……

4. 系统生成流程图

5. 用户说：添加验证码节点

6. 系统插入节点并重排

7. 用户说：失败分支改成红色虚线

8. 系统修改样式

9. 用户说：撤销

10. 系统立即撤销

11. 用户说：重做

12. 系统立即恢复

13. 用户说：整理成汇报版

14. 系统美化并突出主流程

15. 用户说：导出 PNG

16. 系统导出图片

# 27\. 总结

VoiceFlow 的技术核心是：

语音识别

- 指令路由

- Diagram JSON

- Operation JSON

- 自动布局

- React Flow 渲染

- 快捷命令低延迟执行

- AI 复杂指令规划

本项目最重要的工程思想是：

让 AI 负责理解，让数据结构负责稳定，让前端画布负责渲染，让快捷命令负责低延迟。

通过该架构，项目既能在比赛周期内快速完成，又具备足够完整的产品形态和创新亮点。

> （注：文档部分内容可能由 AI 生成）
