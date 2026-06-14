import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramEdgeType,
  EdgeStyle,
  NodeStyle,
} from '../../core/diagram/diagramTypes';
import type { DiagramOperation } from '../../core/operations/operationTypes';
import { executeOperations } from '../../core/operations/operationExecutor';
import { createBlankDiagram } from '../../core/diagram/blankDiagram';
import { getNodeSize } from '../../core/diagram/diagramUtils';
import type { SpeechFeedbackService } from '../../services/speechFeedbackService';
import { saveCurrentDiagramVersion } from '../../services/diagramVersionService';
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
import { matchGenericDrawingActions } from './genericDrawingMatcher';
import type {
  ClarificationCandidate,
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
    const genericDrafts = matchGenericDrawingActions(text);
    if (genericDrafts.length) return executeGenericBatch(genericDrafts, text);
    const parsed = parseSimpleCommand(text);
    if (parsed.status !== 'ready')
      return finish({ status: 'error', message: parsed.message });
    return executeDraft(parsed.draft, text);
  }

  async function executeGenericBatch(
    drafts: SimpleOperationDraft[],
    originalCommand: string,
  ): Promise<SimpleExecutionResult> {
    const createDrafts = drafts.filter(
      (draft): draft is Extract<SimpleOperationDraft, { intent: 'create_node' }> =>
        draft.intent === 'create_node',
    );
    const nodeOperations = createDrafts.map((draft) =>
      createNodeOperation(
        draft.label,
        draft.nodeType,
        `创建图形“${draft.label}”`,
        draft.size,
        draft.style,
      ),
    );
    const createdNodes = nodeOperations.map((operation) => operation.node);
    const edgeOperations =
      /连接|连线|箭头/.test(originalCommand) && createdNodes.length > 1
        ? createdNodes.slice(1).map((node, index) =>
            operation(
              'create_edge',
              `连接图形“${createdNodes[index].label}”到“${node.label}”`,
              {
                edge: {
                  id: createId('edge'),
                  from: createdNodes[index].id,
                  to: node.id,
                },
              },
            ),
          )
        : [];
    const moveOperations = createDrafts.flatMap((draft, index) =>
      draft.placement
        ? [
            operation('move_node', `将图形“${createdNodes[index].label}”放到指定位置`, {
              nodeId: createdNodes[index].id,
              position: genericPlacementPosition(draft.placement, index),
            }),
          ]
        : [],
    );
    const operations = [...nodeOperations, ...edgeOperations, ...moveOperations];
    const startsNewCanvas = /^(?:画出?|绘制出?|生成|创建)/.test(
      normalizeText(originalCommand).replace(/^(?:请|帮我|请帮我)/, ''),
    );
    const verification = startsNewCanvas
      ? replaceWithGenericDrawing(operations, createdNodes.length)
      : useDiagramStore
          .getState()
          .applyOperations(operations, `批量创建 ${createdNodes.length} 个图形`);
    if (!verification.verified) {
      return finish({
        status: 'ignored',
        intent: 'create_node',
        message: verification.message,
      });
    }
    const lastOperation = nodeOperations.at(-1);
    const lastNode = lastOperation?.node;
    if (lastNode && lastOperation) {
      useCommandStore.getState().setLastTarget(nodeTarget(lastNode));
      useCommandStore.getState().setLastOperation(lastOperation);
    }
    return finish({
      status: 'success',
      intent: 'create_node',
      message: `已创建 ${createdNodes.length} 个图形${edgeOperations.length ? `并连接 ${edgeOperations.length} 条线` : ''}`,
      target: lastNode ? nodeTarget(lastNode) : undefined,
      operation: lastOperation,
    });
  }

  function replaceWithGenericDrawing(operations: DiagramOperation[], nodeCount: number) {
    saveCurrentDiagramVersion('auto_before_shape_drawing', true);
    const blank = createBlankDiagram();
    blank.title = nodeCount === 1 ? '单个图形' : '图形组合';
    const next = executeOperations(blank, operations);
    return useDiagramStore
      .getState()
      .replaceDiagram(next, `新建包含 ${nodeCount} 个图形的画布`);
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
            createNodeOperation(
              draft.label,
              draft.nodeType,
              `创建节点“${draft.label}”`,
              draft.size,
              draft.style,
            ),
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
        case 'duplicate_node': {
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          const duplicate: DiagramNode = {
            ...target,
            id: createId('node'),
            label: `${target.label}副本`,
            position: undefined,
            size: target.size ? { ...target.size } : undefined,
            style: target.style ? { ...target.style } : undefined,
            data: target.data ? { ...target.data } : undefined,
          };
          return apply(
            operation('create_node', `复制节点“${target.label}”`, { node: duplicate }),
            `已复制${target.label}`,
            nodeTarget(duplicate),
            draft.intent,
          );
        }
        case 'resize_node': {
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          const current = getNodeSize(target);
          const width = draft.width ?? Math.round(current.width * (draft.scale ?? 1));
          const height = draft.height ?? Math.round(current.height * (draft.scale ?? 1));
          if (width < 24 || height < 24 || width > 2000 || height > 2000) {
            return finish({
              status: 'error',
              intent: draft.intent,
              message: '尺寸需要在 24 到 2000 之间',
            });
          }
          return apply(
            operation('update_node', `调整节点“${target.label}”尺寸`, {
              nodeId: target.id,
              patch: { size: { width, height } },
            }),
            `已调整${target.label}尺寸`,
            nodeTarget(target),
            draft.intent,
          );
        }
        case 'move_node': {
          const target = await requireNode(
            diagram,
            draft,
            'targetNodeId',
            draft.targetText,
            originalCommand,
          );
          if (!target) return finish(clarificationResult());
          return apply(
            operation('move_node', `将节点“${target.label}”移动到指定位置`, {
              nodeId: target.id,
              position: relativePlacementPosition(diagram, target, draft.placement),
            }),
            `已将${target.label}移动到${placementLabel(draft.placement)}`,
            nodeTarget(target),
            draft.intent,
          );
        }
        case 'create_edge': {
          const recentNodes = draft.useRecentNodes ? diagram.nodes.slice(-2) : [];
          const source =
            recentNodes[0] ??
            (await requireNode(
              diagram,
              draft,
              'sourceNodeId',
              draft.sourceText,
              originalCommand,
            ));
          if (!source) return finish(clarificationResult());
          const target =
            recentNodes[1] ??
            (await requireNode(
              diagram,
              draft,
              'targetNodeId',
              draft.targetText,
              originalCommand,
            ));
          if (draft.useRecentNodes && recentNodes.length < 2) {
            return finish({
              status: 'error',
              intent: draft.intent,
              message: '至少需要两个节点才能生成连线',
            });
          }
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
    const verification = useDiagramStore.getState().applyOperation(operationValue);
    if (!verification.verified) {
      return finish({
        status: 'ignored',
        message: `${verification.message}，请换一种描述或确认目标`,
        intent,
        target,
        operation: operationValue,
      });
    }
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
  _originalCommand: string,
): Promise<DiagramNode | null> {
  void _originalCommand;
  const resolvedId = draft.resolved?.[field];
  if (resolvedId) return diagram.nodes.find((node) => node.id === resolvedId) ?? null;
  const result = resolveNode(diagram, query, useCommandStore.getState().lastTarget?.id);
  if (result.status === 'found') return result.item;
  if (result.status === 'multiple' && result.candidates.length) {
    return result.candidates[0];
  } else {
    useCommandStore.getState().setPendingClarification(null);
    useCommandStore.getState().setLastMessage(`没有找到“${query}”节点。`);
  }
  return null;
}

async function requireEdge(
  diagram: Diagram,
  draft: Extract<SimpleOperationDraft, { intent: 'delete_edge' | 'update_edge_style' }>,
  _originalCommand: string,
): Promise<DiagramEdge | null> {
  const originalCommand = _originalCommand;
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
  if (result.status === 'multiple' && result.candidates.length) {
    return result.candidates[0];
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
  void originalCommand;
  const resolvedId = draft.resolved?.replacedEdgeId;
  if (resolvedId) return outgoing.find((edge) => edge.id === resolvedId) ?? null;
  return outgoing[0] ?? null;
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

function makeNode(label: string, type: DiagramNode['type']): DiagramNode {
  return { id: createId('node'), label, type };
}

function createNodeOperation(
  label: string,
  type: DiagramNode['type'],
  description: string,
  size?: DiagramNode['size'],
  style?: DiagramNode['style'],
): DiagramOperation {
  return operation('create_node', description, {
    node: { ...makeNode(label, type), size, style },
  });
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

function nodeTarget(node: DiagramNode): ResolvedTarget {
  return { kind: 'node', id: node.id, label: node.label };
}

function edgeTarget(diagram: Diagram, edge: DiagramEdge): ResolvedTarget {
  return { kind: 'edge', id: edge.id, label: describeEdge(diagram, edge) };
}

function genericPlacementPosition(
  placement: Extract<SimpleOperationDraft, { intent: 'create_node' }>['placement'] & {},
  index: number,
): { x: number; y: number } {
  const offset = index * 24;
  switch (placement) {
    case 'left':
      return { x: 120, y: 280 + offset };
    case 'right':
      return { x: 620, y: 280 + offset };
    case 'top':
      return { x: 370 + offset, y: 80 };
    case 'bottom':
      return { x: 370 + offset, y: 560 };
    case 'center':
      return { x: 370 + offset, y: 280 };
  }
}

function relativePlacementPosition(
  diagram: Diagram,
  target: DiagramNode,
  placement: Extract<SimpleOperationDraft, { intent: 'move_node' }>['placement'],
): { x: number; y: number } {
  const positioned = diagram.nodes.filter(
    (node): node is DiagramNode & { position: { x: number; y: number } } =>
      node.id !== target.id && node.position !== undefined,
  );
  if (!positioned.length) return genericPlacementPosition(placement, 0);
  const minX = Math.min(...positioned.map((node) => node.position.x));
  const maxX = Math.max(
    ...positioned.map((node) => node.position.x + getNodeSize(node).width),
  );
  const minY = Math.min(...positioned.map((node) => node.position.y));
  const maxY = Math.max(
    ...positioned.map((node) => node.position.y + getNodeSize(node).height),
  );
  const size = getNodeSize(target);
  const centerX = (minX + maxX - size.width) / 2;
  const centerY = (minY + maxY - size.height) / 2;
  const gap = 120;
  switch (placement) {
    case 'left':
      return { x: minX - size.width - gap, y: centerY };
    case 'right':
      return { x: maxX + gap, y: centerY };
    case 'top':
      return { x: centerX, y: minY - size.height - gap };
    case 'bottom':
      return { x: centerX, y: maxY + gap };
    case 'center':
      return { x: centerX, y: centerY };
  }
}

function placementLabel(
  placement: Extract<SimpleOperationDraft, { intent: 'move_node' }>['placement'],
): string {
  return {
    left: '最左侧',
    right: '最右侧',
    top: '最上方',
    bottom: '最下方',
    center: '中央',
  }[placement];
}
