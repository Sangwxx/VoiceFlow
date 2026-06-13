import type { Diagram } from '../../core/diagram/diagramTypes';
import { cloneDiagram } from '../../core/diagram/diagramUtils';
import { findMainPath } from '../../core/theme/reportMode';

const EXCEPTION_TERMS = ['否', '失败', '异常', '错误', '超时', '拒绝'];

export function hideExceptionPaths(diagram: Diagram): Diagram {
  const next = cloneDiagram(diagram);
  const mainNodeIds = new Set(findMainPath(next).nodeIds);
  const hiddenNodeIds = new Set<string>();
  const queue = next.edges
    .filter((edge) => EXCEPTION_TERMS.some((term) => edge.label?.includes(term)))
    .map((edge) => edge.to)
    .filter((nodeId) => !mainNodeIds.has(nodeId));

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || hiddenNodeIds.has(nodeId) || mainNodeIds.has(nodeId)) continue;
    hiddenNodeIds.add(nodeId);
    next.edges
      .filter((edge) => edge.from === nodeId && !mainNodeIds.has(edge.to))
      .forEach((edge) => queue.push(edge.to));
  }

  next.nodes = next.nodes.filter((node) => !hiddenNodeIds.has(node.id));
  const visibleIds = new Set(next.nodes.map((node) => node.id));
  next.edges = next.edges.filter(
    (edge) =>
      visibleIds.has(edge.from) &&
      visibleIds.has(edge.to) &&
      !EXCEPTION_TERMS.some((term) => edge.label?.includes(term)),
  );
  return next;
}
