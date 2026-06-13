import dagre from '@dagrejs/dagre';

import type { Diagram } from '../diagram/diagramTypes';
import { cloneDiagram, getNodeSize } from '../diagram/diagramUtils';

const DIRECTION_MAP = {
  top_down: 'TB',
  left_to_right: 'LR',
} as const;

export function applyDagreLayout(diagram: Diagram): Diagram {
  const nextDiagram = cloneDiagram(diagram);
  const needsLayout =
    diagram.layout.autoLayout ||
    diagram.nodes.some((node) => node.position === undefined);

  if (!needsLayout) return nextDiagram;

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: DIRECTION_MAP[diagram.layout.direction],
    nodesep: diagram.layout.spacingX,
    ranksep: diagram.layout.spacingY,
    marginx: 32,
    marginy: 32,
  });

  for (const node of diagram.nodes) {
    const size = getNodeSize(node);
    graph.setNode(node.id, { width: size.width, height: size.height });
  }

  for (const edge of diagram.edges) {
    graph.setEdge(edge.from, edge.to);
  }

  dagre.layout(graph);

  nextDiagram.nodes = nextDiagram.nodes.map((node) => {
    const position = graph.node(node.id);
    const size = getNodeSize(node);
    return {
      ...node,
      size,
      position: {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      },
    };
  });

  return nextDiagram;
}
