import { describe, expect, it } from 'vitest';

import { applyTheme } from '../core/theme/applyTheme';
import { createReportDiagram, findMainPath } from '../core/theme/reportMode';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('theme and report mode', () => {
  it('applies themes immutably and preserves overrides by default', () => {
    const before = structuredClone(loginFlowDiagram);
    const themed = applyTheme(loginFlowDiagram, 'business_blue');
    expect(loginFlowDiagram).toEqual(before);
    expect(themed.theme.name).toBe('business_blue');
    expect(themed.nodes.find((node) => node.id === 'show-error')?.style?.background).toBe(
      '#fff1f0',
    );
  });

  it('finds the positive main path and creates a report diagram', () => {
    const main = findMainPath(loginFlowDiagram);
    expect(main.edgeIds).toContain('e-check-home');
    expect(main.edgeIds).not.toContain('e-check-login');

    const report = createReportDiagram(loginFlowDiagram);
    expect(report.theme.name).toBe('report_clean');
    expect(report.edges.find((edge) => edge.label === '失败')?.type).toBe('weak');
    expect(report.edges.find((edge) => edge.label === '是')?.type).toBe('highlight');
    expect(report.nodes.every((node) => Number.isFinite(node.position?.x))).toBe(true);
  });
});
