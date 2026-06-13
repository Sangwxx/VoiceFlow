import type {
  Diagram,
  DiagramEdge,
  EdgeRouting,
  EdgeSide,
  Position,
} from '../diagram/diagramTypes';
import { getNodeSize } from '../diagram/diagramUtils';
import type { GraphAnalysis } from './graphAnalysis';

export function routeOrthogonalEdges(diagram: Diagram, analysis: GraphAnalysis): Diagram {
  return {
    ...diagram,
    edges: diagram.edges.map((edge, index) => ({
      ...edge,
      routing: routeEdge(diagram, edge, analysis, index),
    })),
  };
}

function routeEdge(
  diagram: Diagram,
  edge: DiagramEdge,
  analysis: GraphAnalysis,
  index: number,
): EdgeRouting {
  const source = diagram.nodes.find((node) => node.id === edge.from)!;
  const target = diagram.nodes.find((node) => node.id === edge.to)!;
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const back = analysis.backEdgeIds.has(edge.id);
  const horizontal = diagram.layout.direction === 'left_to_right';
  const kind = back ? 'back' : analysis.branchEdgeIds.has(edge.id) ? 'branch' : 'forward';
  let sourceSide: EdgeSide = horizontal ? 'right' : 'bottom';
  let targetSide: EdgeSide = horizontal ? 'left' : 'top';
  if (back) {
    sourceSide = horizontal ? 'top' : 'left';
    targetSide = horizontal ? 'top' : 'left';
  } else if (kind === 'branch') {
    const delta = horizontal
      ? targetCenter.y - sourceCenter.y
      : targetCenter.x - sourceCenter.x;
    sourceSide = horizontal
      ? delta >= 0
        ? 'bottom'
        : 'top'
      : delta >= 0
        ? 'right'
        : 'left';
    targetSide = horizontal ? 'left' : 'top';
  }
  const start = port(source, sourceSide);
  const end = port(target, targetSide);
  const laneOffset = 28 + (index % 4) * 10;
  let points: Position[];
  if (back) {
    const lane = horizontal
      ? Math.min(start.y, end.y) - laneOffset
      : Math.min(start.x, end.x) - laneOffset;
    points = horizontal
      ? [start, { x: start.x, y: lane }, { x: end.x, y: lane }, end]
      : [start, { x: lane, y: start.y }, { x: lane, y: end.y }, end];
  } else if (horizontal) {
    const middle = (start.x + end.x) / 2;
    points = [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
  } else {
    const middle = (start.y + end.y) / 2;
    points = [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
  }
  return { sourceSide, targetSide, points: removeDuplicatePoints(points), kind };
}

function center(node: Diagram['nodes'][number]): Position {
  const size = getNodeSize(node);
  return { x: node.position!.x + size.width / 2, y: node.position!.y + size.height / 2 };
}

function port(node: Diagram['nodes'][number], side: EdgeSide): Position {
  const size = getNodeSize(node);
  const position = node.position!;
  if (side === 'top') return { x: position.x + size.width / 2, y: position.y };
  if (side === 'bottom')
    return { x: position.x + size.width / 2, y: position.y + size.height };
  if (side === 'left') return { x: position.x, y: position.y + size.height / 2 };
  return { x: position.x + size.width, y: position.y + size.height / 2 };
}

function removeDuplicatePoints(points: Position[]): Position[] {
  return points.filter(
    (point, index) =>
      index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
  );
}
