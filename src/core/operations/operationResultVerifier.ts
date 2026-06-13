import type { Diagram } from '../diagram/diagramTypes';
import type { DiagramOperation } from './operationTypes';

export type OperationVerificationResult = {
  verified: boolean;
  changed: boolean;
  message: string;
};

export function verifyOperationResult(
  before: Diagram,
  after: Diagram,
  operation: DiagramOperation,
): OperationVerificationResult {
  const result = verifyExpectedChange(before, after, operation);
  return result
    ? { verified: true, changed: true, message: '本地执行确认通过' }
    : {
        verified: false,
        changed: false,
        message: `操作 ${operation.type} 未产生预期画布变化`,
      };
}

export function diagramsHaveMeaningfulDifference(before: Diagram, after: Diagram) {
  return (
    JSON.stringify(toMeaningfulDiagram(before)) !==
    JSON.stringify(toMeaningfulDiagram(after))
  );
}

function verifyExpectedChange(
  before: Diagram,
  after: Diagram,
  operation: DiagramOperation,
) {
  switch (operation.type) {
    case 'create_node':
      return (
        !findNode(before, operation.node.id) &&
        Boolean(findNode(after, operation.node.id))
      );
    case 'delete_node':
      return (
        Boolean(findNode(before, operation.nodeId)) && !findNode(after, operation.nodeId)
      );
    case 'update_node': {
      const oldNode = findNode(before, operation.nodeId);
      const newNode = findNode(after, operation.nodeId);
      return Boolean(
        oldNode && newNode && patchChanged(oldNode, newNode, operation.patch),
      );
    }
    case 'create_edge':
      return (
        !findEdge(before, operation.edge.id) &&
        Boolean(findEdge(after, operation.edge.id))
      );
    case 'delete_edge':
      return (
        Boolean(findEdge(before, operation.edgeId)) && !findEdge(after, operation.edgeId)
      );
    case 'update_edge': {
      const oldEdge = findEdge(before, operation.edgeId);
      const newEdge = findEdge(after, operation.edgeId);
      return Boolean(
        oldEdge && newEdge && patchChanged(oldEdge, newEdge, operation.patch),
      );
    }
    case 'insert_node_after':
      return (
        !findNode(before, operation.newNode.id) &&
        Boolean(findNode(after, operation.newNode.id)) &&
        Boolean(findEdge(before, operation.replacedEdgeId)) &&
        !findEdge(after, operation.replacedEdgeId)
      );
    case 'apply_layout':
      return (
        before.layout.direction !== after.layout.direction ||
        before.nodes.some((node) => {
          const next = findNode(after, node.id);
          return (
            next?.position?.x !== node.position?.x ||
            next?.position?.y !== node.position?.y
          );
        })
      );
  }
}

function patchChanged<T extends object>(before: T, after: T, patch: Partial<T>) {
  return Object.keys(patch).some(
    (key) =>
      JSON.stringify(before[key as keyof T]) !== JSON.stringify(after[key as keyof T]),
  );
}

function findNode(diagram: Diagram, id: string) {
  return diagram.nodes.find((node) => node.id === id);
}

function findEdge(diagram: Diagram, id: string) {
  return diagram.edges.find((edge) => edge.id === id);
}

function toMeaningfulDiagram(diagram: Diagram) {
  return {
    ...diagram,
    metadata: { ...diagram.metadata, updatedAt: '', version: 0 },
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      type: edge.type,
      style: edge.style,
      locked: edge.locked,
    })),
  };
}
