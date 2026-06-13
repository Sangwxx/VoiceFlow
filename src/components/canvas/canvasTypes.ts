import { MarkerType, type Edge, type Node } from '@xyflow/react';

import type {
  Diagram,
  DiagramEdge,
  DiagramEdgeType,
  LayoutDirection,
  NodeStyle,
  NodeType,
} from '../../core/diagram/diagramTypes';
import { getNodeSize } from '../../core/diagram/diagramUtils';

export type CanvasNodeData = {
  label: string;
  nodeType: NodeType;
  layoutDirection: LayoutDirection;
  visualStyle?: NodeStyle;
  [key: string]: unknown;
};

export type ReactFlowNode = Node<CanvasNodeData, NodeType>;
export type ReactFlowEdge = Edge<Record<string, unknown>, 'smoothstep'>;

const EDGE_PRESETS: Record<
  DiagramEdgeType,
  { stroke: string; strokeWidth: number; strokeDasharray?: string }
> = {
  solid: { stroke: '#718096', strokeWidth: 2 },
  dashed: { stroke: '#718096', strokeWidth: 2, strokeDasharray: '7 5' },
  highlight: { stroke: '#2563eb', strokeWidth: 3 },
  weak: { stroke: '#aab5c5', strokeWidth: 1.5, strokeDasharray: '6 5' },
};

function toReactFlowEdge(edge: DiagramEdge): ReactFlowEdge {
  const preset = EDGE_PRESETS[edge.type ?? 'solid'];
  const stroke = edge.style?.stroke ?? preset.stroke;

  return {
    id: edge.id,
    source: edge.from,
    target: edge.to,
    type: 'smoothstep',
    label: edge.label,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: stroke,
      width: 18,
      height: 18,
    },
    style: {
      stroke,
      strokeWidth: edge.style?.strokeWidth ?? preset.strokeWidth,
      strokeDasharray: edge.style?.strokeDasharray ?? preset.strokeDasharray,
    },
    labelStyle: {
      fill: edge.style?.color ?? '#40516a',
      fontSize: 12,
      fontWeight: 700,
    },
    labelBgStyle: {
      fill: '#ffffff',
      fillOpacity: 0.92,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 6,
    selectable: false,
    focusable: false,
    deletable: false,
    reconnectable: false,
    interactionWidth: 0,
    data: {
      diagramEdgeType: edge.type ?? 'solid',
    },
  };
}

export function diagramToReactFlow(diagram: Diagram): {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
} {
  return {
    nodes: diagram.nodes.map((node) => {
      const size = getNodeSize(node);
      return {
        id: node.id,
        type: node.type,
        position: node.position ?? { x: 0, y: 0 },
        data: {
          label: node.label,
          nodeType: node.type,
          layoutDirection: diagram.layout.direction,
          visualStyle: node.style,
        },
        style: {
          width: size.width,
          height: size.height,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
        deletable: false,
        ariaLabel: node.label,
      };
    }),
    edges: diagram.edges.map(toReactFlowEdge),
  };
}
