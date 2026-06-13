import { describe, expect, it } from 'vitest';

import { scoreLayout } from '../core/layout/aestheticScorer';
import { applyCleanAutoLayout } from '../core/layout/cleanAutoLayout';
import { applyElkCleanAutoLayout } from '../core/layout/elkCleanLayout';
import { analyzeGraph } from '../core/layout/graphAnalysis';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('clean auto layout', () => {
  it('analyses main paths, branches and back edges deterministically', () => {
    const analysis = analyzeGraph(loginFlowDiagram);
    expect(analysis.roots).toContain('start');
    expect(analysis.mainPathNodeIds[0]).toBe('start');
    expect(analysis.branchEdgeIds.size).toBeGreaterThan(0);
    expect(analysis.backEdgeIds).toContain('e-error-login');
  });

  it('selects a routed candidate without mutating input', () => {
    const snapshot = structuredClone(loginFlowDiagram);
    const result = applyCleanAutoLayout(loginFlowDiagram);
    expect(result).not.toBe(loginFlowDiagram);
    expect(loginFlowDiagram).toEqual(snapshot);
    expect(result.edges.every((edge) => (edge.routing?.points.length ?? 0) >= 2)).toBe(
      true,
    );
    expect(scoreLayout(result).overlaps).toBe(0);
  });

  it('uses ELK layered orthogonal routing for asynchronous clean layout', async () => {
    const result = await applyElkCleanAutoLayout(loginFlowDiagram);
    expect(result.engine).toBe('elk');
    expect(result.candidateCount).toBe(3);
    expect(
      result.diagram.edges.every((edge) => (edge.routing?.points.length ?? 0) >= 2),
    ).toBe(true);
    expect(result.score.overlaps).toBe(0);
  });
});
