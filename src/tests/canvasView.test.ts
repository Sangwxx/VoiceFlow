import { describe, expect, it } from 'vitest';

import { hideExceptionPaths } from '../components/canvas/canvasView';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('canvas view projection', () => {
  it('hides exception branches without mutating Diagram JSON', () => {
    const before = structuredClone(loginFlowDiagram);
    const visible = hideExceptionPaths(loginFlowDiagram);
    expect(loginFlowDiagram).toEqual(before);
    expect(visible.nodes.some((node) => node.id === 'show-error')).toBe(false);
    expect(visible.edges.some((edge) => edge.label === '失败')).toBe(false);
    expect(visible.nodes.some((node) => node.id === 'home')).toBe(true);
  });
});
