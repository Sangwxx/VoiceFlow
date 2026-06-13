import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramEdgeType,
  EdgeStyle,
  NodeStyle,
} from '../../core/diagram/diagramTypes';
import type { DiagramOperation } from '../../core/operations/operationTypes';
import type { SpeechFeedbackService } from '../../services/speechFeedbackService';
import { useCommandStore } from '../../stores/commandStore';
import { useDiagramStore } from '../../stores/diagramStore';
import { createId } from '../../utils/id';
import { normalizeText } from '../../utils/text';
import {
  describeEdge,
  resolveEdge,
  resolveEdgeByEndpoints,
  resolveNode,
} from './entityResolver';
import { parseSimpleCommand } from './simpleCommandParser';
import type {
  ClarificationCandidate,
  ClarificationRequest,
  ResolvedTarget,
  SimpleExecutionResult,
  SimpleOperationDraft,
} from './simpleTypes';

const NODE_COLORS: Record<string, NodeStyle> = {
  红色: { background: '#fff1f0', border: '#ff4d4f', color: '#9b2c2c' },
  蓝色: { background: '#eaf3ff', border: '#2f80ed', color: '#24568f' },
  绿色: { background: '#eaf8f1', border: '#27ae60', color: '#176b3c' },
  黄色: { background: '#fff8df', border: '#e0a925', color: '#795b0c' },
  灰色: { background: '#f1f3f5', border: '#98a2b3', color: '#475467' },
};

const EDGE_COLORS: Record<string, string> = {
  红色: '#ff4d4f',
  蓝色: '#2f80ed',
  绿色: '#27ae60',
  黄色: '#e0a925',
  灰色: '#98a2b3',
};

export function createSimpleCommandExecutor(speechFeedback: SpeechFeedbackService) {
  async function execute(text: string): Promise<SimpleExecutionResult> {
    const parsed = parseSimpleCommand(text);
    if (parsed.status !== 'ready')
      return finish({ status: 'error', message: parsed.message });
    return executeDraft(parsed.draft, text);
  }

  async function answerClarification(text: string): Promise<SimpleExecutionResult> {
    const request = useCommandStore.getState().pendingClarification;
    if (!request) return finish({ status: 'ignored', message: '当前没有需要澄清的操作' });
    const candidate = chooseCandidate(request.candidates, text);
    if (!candidate) {
      return finish({
        status: 'clarification',
        message: `没有匹配到候选项，请说名称或第一个、第二个。${request.question}`,
      });
    }

    const draft = {
      ...request.draft,
      resolved: { ...request.draft.resolved, [request.resolutionField]: candidate.id },
    } as SimpleOperationDraft;
    useCommandStore.getState().setPendingClarification(null);
    return executeDraft(draft, request.originalCommand);
  }

  async function executeDraft(
    draft: SimpleOperationDraft,
    originalCommand: string,
  ): Promise<SimpleExecutionResult> {
    try {
      const diagram = useDiagramStore.getState().diagram;
      switch (draft.intent) {
        case 'create_node':
          return apply(
            createNodeOperation(draft.label, draft.nodeType, `创建节点“${draft.label}”`),
            `已创建节点${draft.label}`,
            { kind: 'node', id: '', label: draft.label },
            draft.intent,
          );
        case 'delete_node': {
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          return apply(
            operation('delete_node', `删除节点“${target.label}”`, { nodeId: target.id }),
            `已删除节点${target.label}`,
            nodeTarget(target),
            draft.intent,
          );
        }
        case 'update_node_text': {
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          return apply(
            operation('update_node', `将“${target.label}”改名为“${draft.newLabel}”`, {
              nodeId: target.id,
              patch: { label: draft.newLabel },
            }),
            `已将${target.label}改名为${draft.newLabel}`,
            { kind: 'node', id: target.id, label: draft.newLabel },
            draft.intent,
          );
        }
        case 'update_node_style': {
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          return apply(
            operation('update_node', `修改节点“${target.label}”颜色`, {
              nodeId: target.id,
              patch: { style: NODE_COLORS[draft.colorName] },
            }),
            `已将${target.label}改成${draft.colorName}`,
            nodeTarget(target),
            draft.intent,
          );
        }
        case 'create_edge': {
          const source = await requireNode(
            diagram,
            draft,
            'sourceNodeId',
            draft.sourceText,
            originalCommand,
          );
          if (!source) return finish(clarificationResult());
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          const edge: DiagramEdge = {
            id: createId('edge'),
            from: source.id,
            to: target.id,
            label: draft.label,
          };
          return apply(
            operation('create_edge', `连接“${source.label}”到“${target.label}”`, {
              edge,
            }),
            `已连接${source.label}到${target.label}`,
            edgeTarget(diagram, edge),
            draft.intent,
          );
        }
        case 'delete_edge': {
          const edge = await requireEdge(diagram, draft, originalCommand);
          if (!edge) return finish(clarificationResult());
          return apply(
            operation('delete_edge', `删除连线“${describeEdge(diagram, edge)}”`, {
              edgeId: edge.id,
            }),
            `已删除${describeEdge(diagram, edge)}`,
            edgeTarget(diagram, edge),
            draft.intent,
          );
        }
        case 'update_edge_style': {
          const edge = await requireEdge(diagram, draft, originalCommand);
          if (!edge) return finish(clarificationResult());
          const type: DiagramEdgeType | undefined =
            draft.lineType === 'dashed'
              ? 'dashed'
              : draft.lineType === 'solid'
                ? 'solid'
                : undefined;
          const stroke = draft.colorName ? EDGE_COLORS[draft.colorName] : undefined;
          const style: EdgeStyle = {};
          if (stroke) style.stroke = stroke;
          if (type === 'dashed') style.strokeDasharray = '6 4';
          if (type === 'solid') style.strokeDasharray = '';
          return apply(
            operation('update_edge', `修改连线“${describeEdge(diagram, edge)}”样式`, {
              edgeId: edge.id,
              patch: {
                ...(type ? { type } : {}),
                ...(Object.keys(style).length ? { style } : {}),
              },
            }),
            `已修改${describeEdge(diagram, edge)}样式`,
            edgeTarget(diagram, edge),
            draft.intent,
          );
        }
        case 'insert_node_after': {
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          const outgoing = diagram.edges.filter((edge) => edge.from === target.id);
          if (outgoing.length === 0) {
            return finish({
              status: 'error',
              intent: draft.intent,
              message: `${target.label}后面没有可插入的连线`,
            });
          }
          const replaced = await requireOutgoingEdge(
            diagram,
            draft,
            outgoing,
            originalCommand,
          );
          if (!replaced) return finish(clarificationResult());
          const newNode = makeNode(draft.newLabel, draft.nodeType);
          return apply(
            operation(
              'insert_node_after',
              `在“${target.label}”后插入“${draft.newLabel}”`,
              {
                targetNodeId: target.id,
                replacedEdgeId: replaced.id,
                newNode,
              },
            ),
            `已在${target.label}后插入${draft.newLabel}`,
            nodeTarget(newNode),
            draft.intent,
          );
        }
      }
    } catch (error) {
      return finish({
        status: 'error',
        intent: draft.intent,
        message: error instanceof Error ? error.message : '简单绘图命令执行失败',
      });
    }
  }

  async function apply(
    operationValue: DiagramOperation,
    message: string,
    target: ResolvedTarget,
    intent: SimpleExecutionResult['intent'],
  ): Promise<SimpleExecutionResult> {
    useDiagramStore.getState().applyOperation(operationValue);
    const actualTarget =
      target.id || ('node' in operationValue ? nodeTarget(operationValue.node) : target);
    useCommandStore.getState().setLastTarget(actualTarget);
    useCommandStore.getState().setLastOperation(operationValue);
    return finish({
      status: 'success',
      message,
      intent,
      target: actualTarget,
      operation: operationValue,
    });
  }

  async function finish(result: SimpleExecutionResult): Promise<SimpleExecutionResult> {
    useCommandStore.getState().setLastMessage(result.message);
    void speechFeedback.speak(result.message);
    return result;
  }

  return { execute, answerClarification };
}

async function requireNode(
  diagram: Diagram,
  draft: SimpleOperationDraft,
  field: string,
  query: string,
  originalCommand: string,
): Promise<DiagramNode | null> {
  const resolvedId = draft.resolved?.[field];
  if (resolvedId) return diagram.nodes.find((node) => node.id === resolvedId) ?? null;
  const result = resolveNode(diagram, query, useCommandStore.getState().lastTarget?.id);
  if (result.status === 'found') return result.item;
  const candidates =
    result.status === 'multiple' ? result.candidates : result.suggestions;
  if (candidates.length) {
    setClarification(
      originalCommand,
      draft,
      field,
      candidates.map(nodeCandidate),
      `你指的是哪个节点？`,
    );
  } else {
    useCommandStore.getState().setPendingClarification(null);
    useCommandStore.getState().setLastMessage(`没有找到“${query}”节点。`);
  }
  return null;
}

async function requireEdge(
  diagram: Diagram,
  draft: Extract<SimpleOperationDraft, { intent: 'delete_edge' | 'update_edge_style' }>,
  originalCommand: string,
): Promise<DiagramEdge | null> {
  const resolvedId = draft.resolved?.edgeId;
  if (resolvedId) return diagram.edges.find((edge) => edge.id === resolvedId) ?? null;
  let result;
  if (draft.intent === 'delete_edge' && draft.sourceText && draft.targetText) {
    const source = await requireNode(
      diagram,
      draft,
      'sourceNodeId',
      draft.sourceText,
      originalCommand,
    );
    if (!source) return null;
    const target = await requireNode(
      diagram,
      draft,
      'targetNodeId',
      draft.targetText,
      originalCommand,
    );
    if (!target) return null;
    result = resolveEdgeByEndpoints(diagram, source.id, target.id);
  } else {
    result = resolveEdge(
      diagram,
      draft.intent === 'update_edge_style' ? draft.edgeText : (draft.edgeText ?? ''),
      useCommandStore.getState().lastTarget?.id,
    );
  }
  if (result.status === 'found') return result.item;
  const candidates =
    result.status === 'multiple' ? result.candidates : result.suggestions;
  if (candidates.length) {
    setClarification(
      originalCommand,
      draft,
      'edgeId',
      candidates.map((edge) => edgeCandidate(diagram, edge)),
      '你指的是哪条连线？',
    );
  } else {
    useCommandStore.getState().setPendingClarification(null);
    useCommandStore.getState().setLastMessage('没有找到对应连线。');
  }
  return null;
}

async function requireOutgoingEdge(
  diagram: Diagram,
  draft: SimpleOperationDraft,
  outgoing: DiagramEdge[],
  originalCommand: string,
): Promise<DiagramEdge | null> {
  const resolvedId = draft.resolved?.replacedEdgeId;
  if (resolvedId) return outgoing.find((edge) => edge.id === resolvedId) ?? null;
  if (outgoing.length === 1) return outgoing[0];
  setClarification(
    originalCommand,
    draft,
    'replacedEdgeId',
    outgoing.map((edge) => edgeCandidate(diagram, edge)),
    '请选择要插入的具体分支。',
  );
  return null;
}

function setClarification(
  originalCommand: string,
  draft: SimpleOperationDraft,
  resolutionField: string,
  candidates: ClarificationCandidate[],
  question: string,
): void {
  const spokenQuestion = candidates.length
    ? `${question} ${candidates
        .map((candidate, index) => `${ordinalLabel(index)}，${candidate.label}`)
        .join('；')}`
    : question;
  const request: ClarificationRequest = {
    id: createId('clarification'),
    originalCommand,
    question: spokenQuestion,
    candidates,
    draft,
    resolutionField,
  };
  useCommandStore.getState().setPendingClarification(request);
  useCommandStore.getState().setLastMessage(spokenQuestion);
}

function clarificationResult(): SimpleExecutionResult {
  const commandState = useCommandStore.getState();
  const request = commandState.pendingClarification;
  return {
    status: request?.candidates.length ? 'clarification' : 'error',
    message: request?.question ?? commandState.lastMessage,
    intent: request?.draft.intent,
  };
}

function chooseCandidate(
  candidates: ClarificationCandidate[],
  answer: string,
): ClarificationCandidate | null {
  const normalized = normalizeText(answer);
  const ordinalWords: Record<string, number> = {
    第一个: 0,
    第一: 0,
    一: 0,
    第二个: 1,
    第二: 1,
    二: 1,
    第三个: 2,
    第三: 2,
    三: 2,
  };
  const ordinal = Object.entries(ordinalWords).find(([word]) =>
    normalized.includes(word),
  );
  if (ordinal) return candidates[ordinal[1]] ?? null;
  const matches = candidates.filter((candidate) => {
    const label = normalizeText(candidate.label);
    return (
      label === normalized || label.includes(normalized) || normalized.includes(label)
    );
  });
  return matches.length === 1 ? matches[0] : null;
}

function ordinalLabel(index: number): string {
  return ['第一个', '第二个', '第三个', '第四个'][index] ?? `第${index + 1}个`;
}

function makeNode(label: string, type: DiagramNode['type']): DiagramNode {
  return { id: createId('node'), label, type };
}

function createNodeOperation(
  label: string,
  type: DiagramNode['type'],
  description: string,
): DiagramOperation {
  return operation('create_node', description, { node: makeNode(label, type) });
}

function operation<T extends DiagramOperation['type']>(
  type: T,
  description: string,
  payload: Omit<
    Extract<DiagramOperation, { type: T }>,
    'id' | 'type' | 'timestamp' | 'description'
  >,
): Extract<DiagramOperation, { type: T }> {
  return {
    id: createId('operation'),
    type,
    timestamp: new Date().toISOString(),
    description,
    ...payload,
  } as Extract<DiagramOperation, { type: T }>;
}

function nodeCandidate(node: DiagramNode): ClarificationCandidate {
  return { id: node.id, label: node.label, kind: 'node', detail: node.type };
}

function edgeCandidate(diagram: Diagram, edge: DiagramEdge): ClarificationCandidate {
  const label = describeEdge(diagram, edge);
  return { id: edge.id, label, kind: 'edge', detail: edge.label };
}

function nodeTarget(node: DiagramNode): ResolvedTarget {
  return { kind: 'node', id: node.id, label: node.label };
}

function edgeTarget(diagram: Diagram, edge: DiagramEdge): ResolvedTarget {
  return { kind: 'edge', id: edge.id, label: describeEdge(diagram, edge) };
}
