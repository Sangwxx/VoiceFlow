import type { Diagram } from '../diagram/diagramTypes';

export type GraphAnalysis = {
  roots: string[];
  levels: Map<string, number>;
  mainPathNodeIds: string[];
  mainPathEdgeIds: string[];
  branchEdgeIds: Set<string>;
  backEdgeIds: Set<string>;
  groupByNodeId: Map<string, string>;
};

const POSITIVE_LABELS = ['是', '成功', '正常', '通过', 'yes', 'ok'];

export function analyzeGraph(diagram: Diagram): GraphAnalysis {
  const incoming = new Map(diagram.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(
    diagram.nodes.map((node) => [node.id, [] as typeof diagram.edges]),
  );
  for (const edge of diagram.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge);
  }
  const roots = diagram.nodes
    .filter((node) => node.type === 'start' || incoming.get(node.id) === 0)
    .map((node) => node.id);
  if (!roots.length && diagram.nodes[0]) roots.push(diagram.nodes[0].id);

  const levels = new Map<string, number>();
  const backEdgeIds = new Set<string>();
  const queue = roots.map((id) => ({ id, level: 0, path: new Set<string>() }));
  while (queue.length) {
    const current = queue.shift()!;
    levels.set(current.id, Math.max(levels.get(current.id) ?? 0, current.level));
    const path = new Set(current.path).add(current.id);
    for (const edge of outgoing.get(current.id) ?? []) {
      if (path.has(edge.to)) backEdgeIds.add(edge.id);
      else if (current.level < diagram.nodes.length)
        queue.push({ id: edge.to, level: current.level + 1, path });
    }
  }
  for (const node of diagram.nodes) if (!levels.has(node.id)) levels.set(node.id, 0);

  const mainPathNodeIds: string[] = [];
  const mainPathEdgeIds: string[] = [];
  const visited = new Set<string>();
  let current = roots[0];
  while (current && !visited.has(current)) {
    visited.add(current);
    mainPathNodeIds.push(current);
    const candidates = (outgoing.get(current) ?? []).filter(
      (edge) => !backEdgeIds.has(edge.id),
    );
    const next =
      candidates.find((edge) =>
        POSITIVE_LABELS.some((label) => edge.label?.toLowerCase().includes(label)),
      ) ?? candidates[0];
    if (!next) break;
    mainPathEdgeIds.push(next.id);
    current = next.to;
  }

  const mainEdges = new Set(mainPathEdgeIds);
  const branchEdgeIds = new Set(
    diagram.edges
      .filter((edge) => !mainEdges.has(edge.id) && !backEdgeIds.has(edge.id))
      .map((edge) => edge.id),
  );
  const groupByNodeId = new Map<string, string>();
  for (const group of diagram.groups ?? [])
    for (const nodeId of group.nodeIds) groupByNodeId.set(nodeId, group.id);

  return {
    roots,
    levels,
    mainPathNodeIds,
    mainPathEdgeIds,
    branchEdgeIds,
    backEdgeIds,
    groupByNodeId,
  };
}
