import type { Diagram, Position } from '../diagram/diagramTypes';
import { getNodeSize } from '../diagram/diagramUtils';

export type AestheticScore = {
  score: number;
  crossings: number;
  bends: number;
  totalEdgeLength: number;
  overlaps: number;
  alignmentPenalty: number;
  groupPenalty: number;
};

export function scoreLayout(diagram: Diagram): AestheticScore {
  const segments = diagram.edges.flatMap((edge) =>
    toSegments(edge.routing?.points ?? []),
  );
  let crossings = 0;
  for (let first = 0; first < segments.length; first += 1)
    for (let second = first + 1; second < segments.length; second += 1)
      if (segmentsCross(segments[first], segments[second])) crossings += 1;

  let overlaps = 0;
  for (let first = 0; first < diagram.nodes.length; first += 1)
    for (let second = first + 1; second < diagram.nodes.length; second += 1)
      if (nodesOverlap(diagram.nodes[first], diagram.nodes[second])) overlaps += 1;

  const bends = diagram.edges.reduce(
    (total, edge) => total + Math.max(0, (edge.routing?.points.length ?? 2) - 2),
    0,
  );
  const totalEdgeLength = segments.reduce(
    (total, [from, to]) => total + Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
    0,
  );
  const alignmentPenalty = calculateAlignmentPenalty(diagram);
  const groupPenalty = calculateGroupPenalty(diagram);
  return {
    crossings,
    bends,
    totalEdgeLength,
    overlaps,
    alignmentPenalty,
    groupPenalty,
    score:
      100000 -
      overlaps * 10000 -
      crossings * 1400 -
      bends * 24 -
      totalEdgeLength * 0.08 -
      alignmentPenalty * 2 -
      groupPenalty * 3,
  };
}
function calculateGroupPenalty(diagram: Diagram) {
  return (diagram.groups ?? []).reduce((penalty, group) => {
    const nodes = diagram.nodes.filter((node) => group.nodeIds.includes(node.id));
    if (nodes.length < 2) return penalty;
    const xs = nodes.map((node) => node.position!.x);
    const ys = nodes.map((node) => node.position!.y);
    return (
      penalty + (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys))
    );
  }, 0);
}

type Segment = [Position, Position];
function toSegments(points: Position[]): Segment[] {
  return points.slice(1).map((point, index) => [points[index], point]);
}
function segmentsCross([a, b]: Segment, [c, d]: Segment): boolean {
  const shared = [a, b].some((point) =>
    [c, d].some((other) => point.x === other.x && point.y === other.y),
  );
  if (shared) return false;
  const abHorizontal = a.y === b.y;
  const cdHorizontal = c.y === d.y;
  if (abHorizontal === cdHorizontal) return false;
  const h = abHorizontal ? [a, b] : [c, d];
  const v = abHorizontal ? [c, d] : [a, b];
  return between(v[0].x, h[0].x, h[1].x) && between(h[0].y, v[0].y, v[1].y);
}
function between(value: number, first: number, second: number) {
  return value > Math.min(first, second) && value < Math.max(first, second);
}
function nodesOverlap(first: Diagram['nodes'][number], second: Diagram['nodes'][number]) {
  const a = getNodeSize(first);
  const b = getNodeSize(second);
  return !(
    first.position!.x + a.width <= second.position!.x ||
    second.position!.x + b.width <= first.position!.x ||
    first.position!.y + a.height <= second.position!.y ||
    second.position!.y + b.height <= first.position!.y
  );
}
function calculateAlignmentPenalty(diagram: Diagram) {
  const coordinate = diagram.layout.direction === 'top_down' ? 'x' : 'y';
  return diagram.edges.reduce((total, edge) => {
    const source = diagram.nodes.find((node) => node.id === edge.from)!;
    const target = diagram.nodes.find((node) => node.id === edge.to)!;
    return (
      total +
      Math.min(100, Math.abs(source.position![coordinate] - target.position![coordinate]))
    );
  }, 0);
}
