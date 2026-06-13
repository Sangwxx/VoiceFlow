import type { Diagram } from '../diagram/diagramTypes';
import { defaultLayoutEngine } from '../layout/layoutEngine';
import { applyTheme } from './applyTheme';

const POSITIVE = ['是', '成功', '正常', '通过'];
const EXCEPTION = ['否', '失败', '异常', '错误', '超时', '拒绝'];

export function findMainPath(diagram: Diagram): { nodeIds: string[]; edgeIds: string[] } {
  const start = diagram.nodes.find((node) => node.type === 'start') ?? diagram.nodes[0];
  if (!start) return { nodeIds: [], edgeIds: [] };
  const nodeIds = [start.id];
  const edgeIds: string[] = [];
  const visited = new Set([start.id]);
  let current = start.id;
  while (true) {
    const outgoing = diagram.edges.filter(
      (edge) => edge.from === current && !visited.has(edge.to),
    );
    if (outgoing.length === 0) break;
    const selected =
      outgoing.find((edge) => POSITIVE.some((word) => edge.label?.includes(word))) ??
      outgoing.find((edge) => !EXCEPTION.some((word) => edge.label?.includes(word))) ??
      outgoing[0];
    edgeIds.push(selected.id);
    nodeIds.push(selected.to);
    visited.add(selected.to);
    current = selected.to;
  }
  return { nodeIds, edgeIds };
}

export function createReportDiagram(diagram: Diagram): Diagram {
  const next = applyTheme(diagram, 'report_clean', { preserveOverrides: false });
  const main = findMainPath(next);
  next.nodes = next.nodes.map((node) => ({
    ...node,
    size:
      node.type === 'decision' ? { width: 190, height: 104 } : { width: 190, height: 68 },
    style: main.nodeIds.includes(node.id)
      ? { ...node.style, border: '#2563eb', borderWidth: 2 }
      : node.style,
  }));
  next.edges = next.edges.map((edge) => {
    const exception = EXCEPTION.some((word) => edge.label?.includes(word));
    if (exception) {
      return {
        ...edge,
        type: 'weak',
        style: { stroke: '#b0b7c3', strokeDasharray: '6 4', strokeWidth: 1.5 },
      };
    }
    if (main.edgeIds.includes(edge.id)) {
      return { ...edge, type: 'highlight', style: { stroke: '#2563eb', strokeWidth: 3 } };
    }
    return edge;
  });
  next.layout = { ...next.layout, spacingX: 110, spacingY: 95, autoLayout: true };
  next.metadata = {
    ...next.metadata,
    updatedAt: new Date().toISOString(),
    version: next.metadata.version + 1,
  };
  return defaultLayoutEngine.layout(next);
}
