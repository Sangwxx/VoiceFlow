import { describe, expect, it } from 'vitest';

import { describeDiagramSpatially } from '../core/diagram/spatialSummary';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('describeDiagramSpatially', () => {
  it('describes visible node identities, relative positions and edge directions', () => {
    const summary = describeDiagramSpatially(loginFlowDiagram);

    expect(summary).toContain('1号节点“开始”（ID: start）');
    expect(summary).toContain('位于“打开 App”（ID: open-app）');
    expect(summary).toContain('从“开始”指向“打开 App”');
  });
});
