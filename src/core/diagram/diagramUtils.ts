import type { Diagram, DiagramNode, NodeType, Size } from './diagramTypes';

export const DEFAULT_NODE_SIZES: Record<NodeType, Size> = {
  start: { width: 140, height: 56 },
  end: { width: 140, height: 56 },
  process: { width: 180, height: 64 },
  decision: { width: 180, height: 100 },
  database: { width: 180, height: 78 },
  service: { width: 180, height: 70 },
  user: { width: 160, height: 70 },
  external: { width: 180, height: 70 },
  group: { width: 300, height: 200 },
};

export function getNodeSize(node: DiagramNode): Size {
  return node.size ?? DEFAULT_NODE_SIZES[node.type];
}

export function cloneDiagram(diagram: Diagram): Diagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => ({
      ...node,
      position: node.position ? { ...node.position } : undefined,
      size: node.size ? { ...node.size } : undefined,
      style: node.style ? { ...node.style } : undefined,
      data: node.data ? { ...node.data } : undefined,
    })),
    edges: diagram.edges.map((edge) => ({
      ...edge,
      style: edge.style ? { ...edge.style } : undefined,
      routing: edge.routing
        ? {
            ...edge.routing,
            points: edge.routing.points.map((point) => ({ ...point })),
          }
        : undefined,
    })),
    groups: diagram.groups?.map((group) => ({
      ...group,
      nodeIds: [...group.nodeIds],
      style: group.style ? { ...group.style } : undefined,
    })),
    layout: { ...diagram.layout },
    theme: { ...diagram.theme },
    metadata: { ...diagram.metadata },
  };
}
