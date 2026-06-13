import { architectureDiagram } from '../../mock/architectureDiagram';
import { loginFlowDiagram } from '../../mock/loginFlowDiagram';
import { cloneDiagram } from '../../core/diagram/diagramUtils';
import { buildAgentPrompt } from './agentPrompt';
import type {
  AgentRequest,
  AiProvider,
  SemanticInterpretationRequest,
  SemanticInterpretationResult,
} from './agentTypes';
import { reinforcementLearningDiagram } from '../../mock/reinforcementLearningDiagram';

type AiProviderConfig = {
  mode?: 'mock' | 'real';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export class MockAiProvider implements AiProvider {
  readonly mode = 'mock' as const;
  readonly model = 'voiceflow-deterministic-mock';

  async interpretCommand(
    request: SemanticInterpretationRequest,
  ): Promise<SemanticInterpretationResult> {
    const replacements: Array<[RegExp, string]> = [
      [/流成图|流程途|流程兔/g, '流程图'],
      [/架够图|价构图|架构途/g, '架构图'],
      [/声成|生成成/g, '生成'],
      [/话一个|化一个/g, '画一个'],
      [/强化学西|强化学习习/g, '强化学习'],
      [/节典/g, '节点'],
      [/连现|连县/g, '连线'],
    ];
    let correctedText = request.transcript;
    for (const [pattern, replacement] of replacements) {
      correctedText = correctedText.replace(pattern, replacement);
    }
    if (
      correctedText === request.transcript &&
      /学习|教程|路线|步骤/.test(correctedText) &&
      !/流程图|架构图/.test(correctedText)
    ) {
      correctedText = `生成一张${correctedText}流程图`;
    }
    return {
      correctedText,
      confidence: correctedText === request.transcript ? 0.35 : 0.82,
      reason:
        correctedText === request.transcript
          ? 'Mock 语义纠错未发现可确定修正'
          : 'Mock 根据绘图上下文修正常见语音识别错词',
    };
  }

  async complete(request: AgentRequest, options?: { signal?: AbortSignal }) {
    if (options?.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
    const text = `${request.originalCommand} ${request.conversation
      .map((turn) => turn.content)
      .join(' ')}`;

    if (request.intent === 'modify_diagram') {
      const failureEdge =
        request.currentDiagram?.edges.find((edge) =>
          /失败|异常|错误/.test(edge.label ?? ''),
        ) ?? request.currentDiagram?.edges.find((edge) => /否/.test(edge.label ?? ''));
      if (failureEdge && /失败|异常|错误/.test(text) && /红|虚线|弱化/.test(text)) {
        return {
          kind: 'operations',
          explanation: '已根据当前图表定位失败分支。',
          summary: '将失败分支调整为红色虚线。',
          operations: [
            {
              type: 'update_edge',
              edgeId: failureEdge.id,
              patch: {
                type: 'dashed',
                style: { stroke: '#dc2626', strokeDasharray: '8 6' },
              },
            },
          ],
        };
      }
      return {
        kind: 'clarification',
        explanation: '当前使用 Mock AI，只能演示有限的上下文修改。',
        question:
          '请明确要修改的节点或分支；配置真实大模型 API 后可理解更自由的图表修改表达。',
      };
    }

    if (request.intent === 'create_architecture' || /架构|网关|服务|数据库/.test(text)) {
      return {
        kind: 'diagram',
        explanation: '已根据描述规划系统组件和调用关系。',
        summary: '包含用户端、服务层与数据存储的系统架构图。',
        diagram: cloneDiagram(architectureDiagram),
      };
    }

    if (/登录|注册|邮箱|找回密码|用户/.test(text)) {
      return {
        kind: 'diagram',
        explanation: '已根据描述规划用户流程和异常分支。',
        summary: '包含登录判断、成功路径和失败回退的完整流程图。',
        diagram: cloneDiagram(loginFlowDiagram),
      };
    }

    if (/强化学习|reinforcementlearning|q-learning|dqn/.test(text)) {
      return {
        kind: 'diagram',
        explanation: '已根据主题规划强化学习的渐进学习路径。',
        summary: '包含理论基础、经典算法、深度强化学习和项目实践。',
        diagram: cloneDiagram(reinforcementLearningDiagram),
      };
    }

    return {
      kind: 'clarification',
      explanation: '当前正在使用 Mock AI，无法为任意主题动态规划图表。',
      question: '当前是 Mock AI 模式。请补充主要步骤，或配置真实大模型 API 后重新描述。',
    };
  }
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly mode = 'real' as const;
  readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: Required<Omit<AiProviderConfig, 'fetchImpl'>> & {
      fetchImpl?: typeof fetch;
    },
  ) {
    this.model = config.model;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(request: AgentRequest, options?: { signal?: AbortSignal }) {
    const response = await this.fetchImpl(
      `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          messages: [{ role: 'user', content: buildAgentPrompt(request) }],
        }),
        signal: options?.signal,
      },
    );

    if (!response.ok) throw new Error(`AI 请求失败：HTTP ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI 响应缺少文本内容');
    return content;
  }

  async interpretCommand(
    request: SemanticInterpretationRequest,
    options?: { signal?: AbortSignal },
  ): Promise<SemanticInterpretationResult> {
    const response = await this.fetchImpl(
      `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          messages: [
            {
              role: 'user',
              content: [
                '你是纯语音绘图工具的语义纠错器。',
                '根据绘图上下文修正口音、同音字、漏字，并还原用户最可能想说的命令。',
                '不要执行命令，不要添加用户没有表达的业务内容。',
                '只返回 JSON：{"correctedText":"...","confidence":0到1,"reason":"..."}。',
                `原始字幕：${request.transcript}`,
                `当前图表：${request.diagramTitle}`,
                `当前节点：${request.nodeLabels.join('、')}`,
                `最近命令：${request.recentCommands.join('；')}`,
              ].join('\n'),
            },
          ],
        }),
        signal: options?.signal,
      },
    );
    if (!response.ok) throw new Error(`AI 语义纠错失败：HTTP ${response.status}`);
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI 语义纠错响应缺少文本');
    const parsed = JSON.parse(
      content
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, ''),
    ) as Partial<SemanticInterpretationResult>;
    if (typeof parsed.correctedText !== 'string') {
      throw new Error('AI 语义纠错结果无效');
    }
    return {
      correctedText: parsed.correctedText,
      confidence:
        typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'AI 语义纠错',
    };
  }
}

export function createConfiguredAiProvider(config: AiProviderConfig = {}): AiProvider {
  const env = import.meta.env;
  const mode = config.mode ?? env.VITE_AI_MODE;
  if (mode === 'mock') return new MockAiProvider();
  const baseUrl = config.baseUrl ?? env.VITE_AI_BASE_URL;
  const apiKey = config.apiKey ?? env.VITE_AI_API_KEY;
  const model = config.model ?? env.VITE_AI_MODEL;
  if (!baseUrl || !apiKey || !model) return new MockAiProvider();
  return new OpenAiCompatibleProvider({
    baseUrl,
    apiKey,
    model,
    fetchImpl: config.fetchImpl,
  });
}
