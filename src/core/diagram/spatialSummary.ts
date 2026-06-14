import type { Diagram, DiagramNode } from './diagramTypes';
import { getNodeSize } from './diagramUtils';
import { getTemporaryObjectNumber } from './temporaryObjectReferences';
import { applyCleanAutoLayout } from '../layout/cleanAutoLayout';

export function describeDiagramSpatially(diagram: Diagram): string {
  const source = diagram.nodes.every((node) => node.position)
    ? diagram
    : applyCleanAutoLayout({
        ...diagram,
        layout: { ...diagram.layout, autoLayout: true },
      });
  const positioned = source.nodes.filter(
    (node): node is DiagramNode & { position: { x: number; y: number } } =>
      node.position !== undefined,
  );
  if (!positioned.length) return '当前画布没有可描述的节点位置。';

  const bounds = canvasBounds(positioned);
  const nodeLines = positioned.map((node) => {
    const number = getTemporaryObjectNumber(source, 'node', node.id);
    const nearest = nearestNode(node, positioned);
    const relation = nearest ? relativeDescription(node, nearest) : '';
    return `- ${number ?? '?'}号节点“${node.label}”（ID: ${node.id}）：位于画布${regionOf(node, bounds)}${relation ? `，${relation}` : ''}`;
  });
  const edgeLines = source.edges.map((edge) => {
    const number = getTemporaryObjectNumber(source, 'edge', edge.id);
    const from = source.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
    const to = source.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
    return `- ${number ?? '?'}号连线（ID: ${edge.id}）：从“${from}”指向“${to}”`;
  });
  return ['节点空间关系：', ...nodeLines, '连线方向：', ...edgeLines].join('\n');
}

function canvasBounds(
  nodes: Array<DiagramNode & { position: { x: number; y: number } }>,
) {
  const centers = nodes.map(center);
  return {
    minX: Math.min(...centers.map((point) => point.x)),
    maxX: Math.max(...centers.map((point) => point.x)),
    minY: Math.min(...centers.map((point) => point.y)),
    maxY: Math.max(...centers.map((point) => point.y)),
  };
}

function regionOf(
  node: DiagramNode & { position: { x: number; y: number } },
  bounds: ReturnType<typeof canvasBounds>,
): string {
  const point = center(node);
  const horizontal = third(point.x, bounds.minX, bounds.maxX, ['左侧', '中央', '右侧']);
  const vertical = third(point.y, bounds.minY, bounds.maxY, ['上方', '中部', '下方']);
  return horizontal === '中央' && vertical === '中部'
    ? '中央'
    : `${vertical}${horizontal}`;
}

function third(
  value: number,
  min: number,
  max: number,
  labels: [string, string, string],
) {
  if (max === min) return labels[1];
  const ratio = (value - min) / (max - min);
  return ratio < 1 / 3 ? labels[0] : ratio > 2 / 3 ? labels[2] : labels[1];
}

function nearestNode(
  node: DiagramNode & { position: { x: number; y: number } },
  nodes: Array<DiagramNode & { position: { x: number; y: number } }>,
) {
  const point = center(node);
  return nodes
    .filter((candidate) => candidate.id !== node.id)
    .map((candidate) => {
      const target = center(candidate);
      return { candidate, distance: Math.hypot(point.x - target.x, point.y - target.y) };
    })
    .sort((first, second) => first.distance - second.distance)[0]?.candidate;
}

function relativeDescription(
  node: DiagramNode & { position: { x: number; y: number } },
  reference: DiagramNode & { position: { x: number; y: number } },
): string {
  const point = center(node);
  const target = center(reference);
  const dx = point.x - target.x;
  const dy = point.y - target.y;
  const relation =
    Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? '左侧' : '右侧') : dy < 0 ? '上方' : '下方';
  return `位于“${reference.label}”（ID: ${reference.id}）${relation}`;
}

function center(node: DiagramNode & { position: { x: number; y: number } }) {
  const size = getNodeSize(node);
  return { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 };
}
