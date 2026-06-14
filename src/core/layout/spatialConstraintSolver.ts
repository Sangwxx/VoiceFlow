import type { Diagram, DiagramNode } from '../diagram/diagramTypes';
import type { AlignmentAxis, SpatialRelation } from '../diagram/spatialTypes';
import { cloneDiagram, getNodeSize } from '../diagram/diagramUtils';
import { analyzeGraph } from './graphAnalysis';
import { applyCleanAutoLayout } from './cleanAutoLayout';
import { routeOrthogonalEdges } from './orthogonalRouter';

const DEFAULT_GAP = 120;

export function setRelativePosition(
  diagram: Diagram,
  nodeId: string,
  referenceNodeId: string,
  relation: SpatialRelation,
  gap = DEFAULT_GAP,
): Diagram {
  const next = ensurePositions(diagram);
  const node = requirePositionedNode(next, nodeId);
  const reference = requirePositionedNode(next, referenceNodeId);
  const nodeSize = getNodeSize(node);
  const referenceSize = getNodeSize(reference);
  const position = { ...node.position! };

  if (relation === 'left_of') {
    position.x = reference.position!.x - nodeSize.width - gap;
    position.y = reference.position!.y + (referenceSize.height - nodeSize.height) / 2;
  } else if (relation === 'right_of') {
    position.x = reference.position!.x + referenceSize.width + gap;
    position.y = reference.position!.y + (referenceSize.height - nodeSize.height) / 2;
  } else if (relation === 'above') {
    position.x = reference.position!.x + (referenceSize.width - nodeSize.width) / 2;
    position.y = reference.position!.y - nodeSize.height - gap;
  } else {
    position.x = reference.position!.x + (referenceSize.width - nodeSize.width) / 2;
    position.y = reference.position!.y + referenceSize.height + gap;
  }

  node.position = position;
  return finishSpatialChange(next);
}

export function alignNodes(
  diagram: Diagram,
  nodeIds: string[],
  axis: AlignmentAxis,
): Diagram {
  const next = ensurePositions(diagram);
  const nodes = nodeIds.map((id) => requirePositionedNode(next, id));
  if (axis === 'horizontal') {
    const centerY =
      nodes.reduce(
        (sum, node) => sum + node.position!.y + getNodeSize(node).height / 2,
        0,
      ) / nodes.length;
    nodes.forEach((node) => {
      node.position!.y = centerY - getNodeSize(node).height / 2;
    });
  } else {
    const centerX =
      nodes.reduce(
        (sum, node) => sum + node.position!.x + getNodeSize(node).width / 2,
        0,
      ) / nodes.length;
    nodes.forEach((node) => {
      node.position!.x = centerX - getNodeSize(node).width / 2;
    });
  }
  return finishSpatialChange(next);
}

export function setEdgeEndpoints(
  diagram: Diagram,
  edgeId: string,
  from: string,
  to: string,
): Diagram {
  const next = ensurePositions(diagram);
  next.edges = next.edges.map((edge) =>
    edge.id === edgeId ? { ...edge, from, to, routing: undefined } : edge,
  );
  return finishSpatialChange(next);
}

function requirePositionedNode(diagram: Diagram, nodeId: string): DiagramNode {
  const node = diagram.nodes.find((item) => item.id === nodeId);
  if (!node?.position) throw new Error(`节点 "${nodeId}" 缺少可用位置。`);
  return node;
}

function finishSpatialChange(diagram: Diagram): Diagram {
  diagram.layout.autoLayout = false;
  return routeOrthogonalEdges(diagram, analyzeGraph(diagram));
}

function ensurePositions(diagram: Diagram): Diagram {
  if (diagram.nodes.every((node) => node.position)) return cloneDiagram(diagram);
  return applyCleanAutoLayout({
    ...cloneDiagram(diagram),
    layout: { ...diagram.layout, autoLayout: true },
  });
}
