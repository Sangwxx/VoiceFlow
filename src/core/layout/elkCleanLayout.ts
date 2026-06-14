import ELK from 'elkjs/lib/elk.bundled.js';

import type { Diagram, EdgeRouting, LayoutDirection } from '../diagram/diagramTypes';
import { cloneDiagram, getNodeSize } from '../diagram/diagramUtils';
import { scoreLayout } from './aestheticScorer';
import {
  CLEAN_LAYOUT_CANDIDATE_SPACING,
  selectBestLayout,
  type CleanLayoutResult,
} from './cleanAutoLayout';
import { analyzeGraph } from './graphAnalysis';
import { routeOrthogonalEdges } from './orthogonalRouter';

export async function applyElkCleanAutoLayout(
  diagram: Diagram,
): Promise<CleanLayoutResult> {
  const needsLayout =
    diagram.layout.autoLayout || diagram.nodes.some((node) => !node.position);
  if (!needsLayout)
    return {
      diagram: cloneDiagram(diagram),
      score: scoreLayout(diagram),
      engine: 'elk',
      candidateCount: 1,
    };
  const candidates = await Promise.all(
    CLEAN_LAYOUT_CANDIDATE_SPACING.map(({ x, y }) => createElkCandidate(diagram, x, y)),
  );
  return {
    ...selectBestLayout(candidates),
    engine: 'elk',
    candidateCount: candidates.length,
  };
}

async function createElkCandidate(
  diagram: Diagram,
  spacingX: number,
  spacingY: number,
): Promise<Diagram> {
  const analysis = analyzeGraph(diagram);
  const result = await new ELK().layout({
    id: diagram.id,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': elkDirection(diagram.layout.direction),
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.cycleBreaking.strategy': 'GREEDY_MODEL_ORDER',
      'elk.spacing.nodeNode': String(spacingX),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacingY),
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: diagram.nodes.map((node) => {
      const size = getNodeSize(node);
      return {
        id: node.id,
        ...size,
        layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
        ports: ['NORTH', 'EAST', 'SOUTH', 'WEST'].map((side) => ({
          id: `${node.id}-${side}`,
          width: 1,
          height: 1,
          layoutOptions: { 'elk.port.side': side },
        })),
      };
    }),
    edges: diagram.edges.map((edge) => {
      const back = analysis.backEdgeIds.has(edge.id);
      const vertical = diagram.layout.direction === 'top_down';
      return {
        id: edge.id,
        sources: [
          `${edge.from}-${back ? (vertical ? 'WEST' : 'NORTH') : vertical ? 'SOUTH' : 'EAST'}`,
        ],
        targets: [
          `${edge.to}-${back ? (vertical ? 'WEST' : 'NORTH') : vertical ? 'NORTH' : 'WEST'}`,
        ],
        layoutOptions: { 'elk.layered.priority.direction': back ? '0' : '10' },
      };
    }),
  });
  const next = cloneDiagram(diagram);
  const childById = new Map(result.children?.map((child) => [child.id, child]));
  next.nodes = next.nodes.map((node) => {
    const child = childById.get(node.id);
    return {
      ...node,
      size: getNodeSize(node),
      position: { x: child?.x ?? 0, y: child?.y ?? 0 },
    };
  });
  const routed = routeOrthogonalEdges(next, analysis);
  const edgeById = new Map(result.edges?.map((edge) => [edge.id, edge]));
  routed.edges = routed.edges.map((edge) => {
    const section = edgeById.get(edge.id)?.sections?.[0];
    const points = section
      ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]
      : undefined;
    return points
      ? { ...edge, routing: { ...edge.routing!, points } as EdgeRouting }
      : edge;
  });
  return routed;
}

function elkDirection(direction: LayoutDirection): 'DOWN' | 'RIGHT' {
  return direction === 'top_down' ? 'DOWN' : 'RIGHT';
}
