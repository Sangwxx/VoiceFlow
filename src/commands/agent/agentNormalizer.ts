import {
  DIAGRAM_TYPES,
  EDGE_TYPES,
  NODE_TYPES,
  type Diagram,
  type DiagramEdge,
  type DiagramNode,
} from '../../core/diagram/diagramTypes';
import { validateDiagram } from '../../core/diagram/diagramValidators';
import { defaultLayoutEngine } from '../../core/layout/layoutEngine';
import { executeOperations } from '../../core/operations/operationExecutor';
import type { DiagramOperation } from '../../core/operations/operationTypes';
import type { AgentPlanResult } from './agentTypes';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI 输出必须是 JSON 对象');
  }
  return value as UnknownRecord;
}

function parsePayload(input: unknown): UnknownRecord {
  if (typeof input !== 'string') return record(input);
  const cleaned = input
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return record(JSON.parse(cleaned));
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function slug(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let index = 2;
  while (used.has(id)) id = `${base}_${index++}`;
  used.add(id);
  return id;
}

export function normalizeAgentResult(
  input: unknown,
  currentDiagram?: Diagram,
): AgentPlanResult {
  const payload = parsePayload(input);
  if (payload.kind === 'clarification') {
    return {
      kind: 'clarification',
      explanation: stringValue(payload.explanation, '需要补充信息。'),
      question: stringValue(payload.question, '请补充图表的主要步骤或组件。'),
    };
  }
  if (payload.kind === 'operations') {
    if (!currentDiagram) throw new Error('AI 修改图表时缺少当前图表上下文。');
    const operations = normalizeOperations(payload.operations);
    if (operations.length === 0) throw new Error('AI 未返回任何可执行操作。');
    const diagram = executeOperations(currentDiagram, operations);
    return {
      kind: 'operations',
      explanation: stringValue(payload.explanation, 'AI 已规划图表修改。'),
      summary: stringValue(payload.summary, `${operations.length} 项图表修改`),
      operations,
      diagram,
    };
  }

  const source = record(payload.diagram ?? payload);
  const now = new Date().toISOString();
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  if (rawNodes.length === 0) throw new Error('AI 图表至少需要一个节点');

  const usedNodeIds = new Set<string>();
  const idMap = new Map<string, string>();
  const nodes: DiagramNode[] = rawNodes.map((raw, index) => {
    const node = record(raw);
    const label = stringValue(node.label ?? node.name, `节点 ${index + 1}`);
    const originalId = stringValue(node.id, slug(label, `node_${index + 1}`));
    const id = uniqueId(slug(originalId, `node_${index + 1}`), usedNodeIds);
    idMap.set(originalId, id);
    const type = NODE_TYPES.includes(node.type as never) ? node.type : 'process';
    return { id, label, type: type as DiagramNode['type'] };
  });

  const usedEdgeIds = new Set<string>();
  const edges: DiagramEdge[] = (Array.isArray(source.edges) ? source.edges : []).map(
    (raw, index) => {
      const edge = record(raw);
      const fromRaw = stringValue(edge.from ?? edge.source, '');
      const toRaw = stringValue(edge.to ?? edge.target, '');
      const from = idMap.get(fromRaw) ?? slug(fromRaw, fromRaw);
      const to = idMap.get(toRaw) ?? slug(toRaw, toRaw);
      const type = EDGE_TYPES.includes(edge.type as never) ? edge.type : undefined;
      return {
        id: uniqueId(
          slug(stringValue(edge.id, `edge_${from}_${to}`), `edge_${index + 1}`),
          usedEdgeIds,
        ),
        from,
        to,
        label: typeof edge.label === 'string' ? edge.label : undefined,
        type: type as DiagramEdge['type'],
      };
    },
  );

  const rawType = source.diagramType ?? source.diagram_type;
  const diagramType = DIAGRAM_TYPES.includes(rawType as never)
    ? (rawType as Diagram['diagramType'])
    : 'flowchart';
  const rawLayout = recordOrEmpty(source.layout);
  const rawDirection = rawLayout.direction ?? rawLayout.layout_direction;
  const direction = rawDirection === 'left_to_right' ? 'left_to_right' : 'top_down';
  const diagram: Diagram = {
    id: slug(stringValue(source.id, `agent_${Date.now()}`), `agent_${Date.now()}`),
    title: stringValue(source.title, 'AI 生成图表'),
    diagramType,
    nodes,
    edges,
    groups: [],
    layout: { direction, spacingX: 90, spacingY: 80, autoLayout: true },
    theme: { name: diagramType === 'architecture' ? 'tech_dark' : 'business_blue' },
    metadata: { createdAt: now, updatedAt: now, version: 1 },
  };
  const validation = validateDiagram(diagram);
  if (!validation.success) {
    throw new Error(validation.errors.map((error) => error.message).join('；'));
  }

  return {
    kind: 'diagram',
    explanation: stringValue(payload.explanation, 'AI 已生成候选图表。'),
    summary: stringValue(
      payload.summary,
      `${nodes.length} 个节点，${edges.length} 条连线。`,
    ),
    diagram: defaultLayoutEngine.layout(validation.data),
  };
}

function normalizeOperations(value: unknown): DiagramOperation[] {
  if (!Array.isArray(value)) throw new Error('AI operations 必须是数组。');
  const now = new Date().toISOString();
  const usedIds = new Set<string>();
  return value.map((raw, index) => {
    const operation = record(raw);
    const type = stringValue(operation.type, '');
    const base = {
      id: uniqueId(
        slug(
          stringValue(operation.id, `agent_operation_${index + 1}`),
          `agent_operation_${index + 1}`,
        ),
        usedIds,
      ),
      timestamp: stringValue(operation.timestamp, now),
      description:
        typeof operation.description === 'string' ? operation.description : undefined,
    };
    switch (type) {
      case 'apply_layout':
        return {
          ...base,
          type,
          direction:
            operation.direction === 'left_to_right' ? 'left_to_right' : 'top_down',
        };
      case 'create_node':
        return { ...base, type, node: normalizeOperationNode(operation.node, index) };
      case 'delete_node':
        return { ...base, type, nodeId: requiredString(operation.nodeId, 'nodeId') };
      case 'update_node':
        return {
          ...base,
          type,
          nodeId: requiredString(operation.nodeId, 'nodeId'),
          patch: normalizeNodePatch(operation.patch),
        };
      case 'create_edge':
        return { ...base, type, edge: normalizeOperationEdge(operation.edge, index) };
      case 'delete_edge':
        return { ...base, type, edgeId: requiredString(operation.edgeId, 'edgeId') };
      case 'update_edge':
        return {
          ...base,
          type,
          edgeId: requiredString(operation.edgeId, 'edgeId'),
          patch: normalizeEdgePatch(operation.patch),
        };
      case 'insert_node_after':
        return {
          ...base,
          type,
          targetNodeId: requiredString(operation.targetNodeId, 'targetNodeId'),
          replacedEdgeId: requiredString(operation.replacedEdgeId, 'replacedEdgeId'),
          newNode: normalizeOperationNode(operation.newNode, index),
        };
      default:
        throw new Error(`AI 返回了不支持的 Operation 类型："${type}"。`);
    }
  });
}

function normalizeOperationNode(value: unknown, index: number): DiagramNode {
  const node = record(value);
  const label = requiredString(node.label ?? node.name, 'node.label');
  const type = NODE_TYPES.includes(node.type as never) ? node.type : 'process';
  return {
    id: slug(stringValue(node.id, `agent_node_${index + 1}`), `agent_node_${index + 1}`),
    label,
    type: type as DiagramNode['type'],
    style: normalizeNodeStyle(node.style),
  };
}

function normalizeOperationEdge(value: unknown, index: number): DiagramEdge {
  const edge = record(value);
  const type = EDGE_TYPES.includes(edge.type as never) ? edge.type : undefined;
  return {
    id: slug(stringValue(edge.id, `agent_edge_${index + 1}`), `agent_edge_${index + 1}`),
    from: requiredString(edge.from ?? edge.source, 'edge.from'),
    to: requiredString(edge.to ?? edge.target, 'edge.to'),
    label: typeof edge.label === 'string' ? edge.label : undefined,
    type: type as DiagramEdge['type'],
    style: normalizeEdgeStyle(edge.style),
  };
}

function normalizeNodePatch(value: unknown): Partial<DiagramNode> {
  const patch = record(value);
  const style = normalizeNodeStyle(patch.style);
  return {
    ...(typeof patch.label === 'string' ? { label: patch.label } : {}),
    ...(NODE_TYPES.includes(patch.type as never)
      ? { type: patch.type as DiagramNode['type'] }
      : {}),
    ...(style ? { style } : {}),
  };
}

function normalizeEdgePatch(value: unknown): Partial<DiagramEdge> {
  const patch = record(value);
  const style = normalizeEdgeStyle(patch.style);
  return {
    ...(typeof patch.label === 'string' ? { label: patch.label } : {}),
    ...(EDGE_TYPES.includes(patch.type as never)
      ? { type: patch.type as DiagramEdge['type'] }
      : {}),
    ...(style ? { style } : {}),
  };
}

function normalizeNodeStyle(value: unknown): DiagramNode['style'] {
  const style = recordOrEmpty(value);
  const normalized = pickStyle(style, [
    'background',
    'border',
    'color',
    'borderWidth',
    'borderRadius',
    'fontSize',
    'fontWeight',
  ]);
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeEdgeStyle(value: unknown): DiagramEdge['style'] {
  const style = recordOrEmpty(value);
  const normalized = pickStyle(style, [
    'stroke',
    'strokeWidth',
    'strokeDasharray',
    'color',
  ]);
  return Object.keys(normalized).length ? normalized : undefined;
}

function pickStyle(value: UnknownRecord, keys: string[]): UnknownRecord {
  return Object.fromEntries(
    keys
      .filter((key) => typeof value[key] === 'string' || typeof value[key] === 'number')
      .map((key) => [key, value[key]]),
  );
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`AI Operation 缺少 ${label}。`);
  }
  return value.trim();
}

function recordOrEmpty(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}
