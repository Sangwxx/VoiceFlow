import type { Diagram } from '../diagram/diagramTypes';
import { cloneDiagram } from '../diagram/diagramUtils';
import { scoreLayout, type AestheticScore } from './aestheticScorer';
import { applyDagreLayout } from './dagreLayout';
import { analyzeGraph } from './graphAnalysis';
import { routeOrthogonalEdges } from './orthogonalRouter';

export type CleanLayoutResult = {
  diagram: Diagram;
  score: AestheticScore;
  engine: 'elk' | 'dagre';
  candidateCount: number;
};

export const CLEAN_LAYOUT_CANDIDATE_SPACING = [
  { x: 56, y: 72 },
  { x: 76, y: 92 },
  { x: 96, y: 112 },
] as const;

export function applyCleanAutoLayout(diagram: Diagram): Diagram {
  const needsLayout =
    diagram.layout.autoLayout || diagram.nodes.some((node) => !node.position);
  if (!needsLayout) return cloneDiagram(diagram);
  return selectBestLayout(
    CLEAN_LAYOUT_CANDIDATE_SPACING.map(({ x, y }) => {
      const candidate = applyDagreLayout({
        ...cloneDiagram(diagram),
        layout: { ...diagram.layout, autoLayout: true, spacingX: x, spacingY: y },
      });
      return routeOrthogonalEdges(candidate, analyzeGraph(candidate));
    }),
  ).diagram;
}

export function selectBestLayout(candidates: Diagram[]): {
  diagram: Diagram;
  score: AestheticScore;
} {
  return candidates
    .map((candidate) => ({ diagram: candidate, score: scoreLayout(candidate) }))
    .sort((first, second) => second.score.score - first.score.score)[0];
}
