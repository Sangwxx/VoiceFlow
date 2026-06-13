import type { Diagram, DiagramEdge } from '../diagram/diagramTypes';
import { cloneDiagram } from '../diagram/diagramUtils';
import { validateDiagram } from '../diagram/diagramValidators';
import { defaultLayoutEngine } from '../layout/layoutEngine';
import type { DiagramOperation } from './operationTypes';
import { validateOperation } from './operationValidator';

export class OperationExecutionError extends Error {
  constructor(
    message: string,
    public readonly operation: DiagramOperation,
  ) {
    super(message);
    this.name = 'OperationExecutionError';
  }
}

export function executeOperation(diagram: Diagram, operation: DiagramOperation): Diagram {
  try {
    validateOperation(diagram, operation);
    const next = applyOperation(cloneDiagram(diagram), operation);
    next.metadata = {
      ...next.metadata,
      updatedAt: operation.timestamp,
      version: next.metadata.version + 1,
    };
    const validation = validateDiagram(next);
    if (!validation.success) {
      throw new OperationExecutionError(validation.errors[0].message, operation);
    }
    return isStructuralOperation(operation)
      ? defaultLayoutEngine.layout({
          ...next,
          layout: { ...next.layout, autoLayout: true },
        })
      : next;
  } catch (error) {
    if (error instanceof OperationExecutionError) throw error;
    throw new OperationExecutionError(
      error instanceof Error ? error.message : 'Operation 执行失败。',
      operation,
    );
  }
}

export function executeOperations(
  diagram: Diagram,
  operations: DiagramOperation[],
): Diagram {
  return operations.reduce(executeOperation, diagram);
}

function applyOperation(diagram: Diagram, operation: DiagramOperation): Diagram {
  switch (operation.type) {
    case 'apply_layout':
      diagram.layout.direction = operation.direction ?? diagram.layout.direction;
      return diagram;
    case 'create_node':
      diagram.nodes.push(cloneNode(operation.node));
      return diagram;
    case 'delete_node':
      return deleteNode(diagram, operation.nodeId, operation);
    case 'update_node':
      diagram.nodes = diagram.nodes.map((node) =>
        node.id === operation.nodeId
          ? {
              ...node,
              ...operation.patch,
              style: operation.patch.style
                ? { ...node.style, ...operation.patch.style }
                : node.style,
            }
          : node,
      );
      return diagram;
    case 'move_node':
      diagram.nodes = diagram.nodes.map((node) =>
        node.id === operation.nodeId
          ? { ...node, position: { ...operation.position } }
          : node,
      );
      diagram.layout.autoLayout = false;
      return diagram;
    case 'create_edge':
      diagram.edges.push(cloneEdge(operation.edge));
      return diagram;
    case 'delete_edge':
      diagram.edges = diagram.edges.filter((edge) => edge.id !== operation.edgeId);
      return diagram;
    case 'update_edge':
      diagram.edges = diagram.edges.map((edge) =>
        edge.id === operation.edgeId
          ? {
              ...edge,
              ...operation.patch,
              style: operation.patch.style
                ? { ...edge.style, ...operation.patch.style }
                : edge.style,
            }
          : edge,
      );
      return diagram;
    case 'insert_node_after':
      return insertNodeAfter(diagram, operation);
  }
}

function deleteNode(
  diagram: Diagram,
  nodeId: string,
  operation: DiagramOperation,
): Diagram {
  const incoming = diagram.edges.filter((edge) => edge.to === nodeId);
  const outgoing = diagram.edges.filter((edge) => edge.from === nodeId);
  diagram.nodes = diagram.nodes.filter((node) => node.id !== nodeId);
  diagram.edges = diagram.edges.filter(
    (edge) => edge.from !== nodeId && edge.to !== nodeId,
  );

  if (incoming.length === 1 && outgoing.length === 1) {
    const from = incoming[0].from;
    const to = outgoing[0].to;
    const exists = diagram.edges.some((edge) => edge.from === from && edge.to === to);
    if (from !== to && !exists) {
      diagram.edges.push({
        id: `${operation.id}-reconnect`,
        from,
        to,
        label: outgoing[0].label,
        type: outgoing[0].type,
        style: outgoing[0].style ? { ...outgoing[0].style } : undefined,
      });
    }
  }
  return diagram;
}

function insertNodeAfter(
  diagram: Diagram,
  operation: Extract<DiagramOperation, { type: 'insert_node_after' }>,
): Diagram {
  const replaced = diagram.edges.find((edge) => edge.id === operation.replacedEdgeId);
  if (!replaced) throw new OperationExecutionError('待替换连线不存在。', operation);

  diagram.edges = diagram.edges.filter((edge) => edge.id !== operation.replacedEdgeId);
  diagram.nodes.push(cloneNode(operation.newNode));
  diagram.edges.push(
    {
      id: `${operation.id}-before`,
      from: operation.targetNodeId,
      to: operation.newNode.id,
    },
    {
      ...cloneEdge(replaced),
      id: `${operation.id}-after`,
      from: operation.newNode.id,
    },
  );
  return diagram;
}

function isStructuralOperation(operation: DiagramOperation): boolean {
  return [
    'apply_layout',
    'create_node',
    'delete_node',
    'create_edge',
    'delete_edge',
    'insert_node_after',
  ].includes(operation.type);
}

function cloneNode<T extends { style?: object; data?: object }>(node: T): T {
  return {
    ...node,
    style: node.style ? { ...node.style } : undefined,
    data: node.data ? { ...node.data } : undefined,
  };
}

function cloneEdge(edge: DiagramEdge): DiagramEdge {
  return { ...edge, style: edge.style ? { ...edge.style } : undefined };
}
