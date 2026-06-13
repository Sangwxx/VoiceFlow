import { MarkerType } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import { diagramToReactFlow } from '../components/canvas/canvasTypes';
import { applyDagreLayout } from '../core/layout/dagreLayout';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('diagramToReactFlow', () => {
  it('maps diagram nodes, positions, sizes and labels', () => {
    const diagram = applyDagreLayout(loginFlowDiagram);
    const result = diagramToReactFlow(diagram);
    const decision = result.nodes.find((node) => node.id === 'check-login');

    expect(result.nodes).toHaveLength(diagram.nodes.length);
    expect(decision).toMatchObject({
      type: 'decision',
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        label: '是否已登录？',
        nodeType: 'decision',
      },
    });
    expect(decision?.position.x).toBeTypeOf('number');
    expect(decision?.style).toMatchObject({ width: 180, height: 100 });
  });

  it('maps edge labels, arrows and visual presets', () => {
    const diagram = applyDagreLayout(loginFlowDiagram);
    const result = diagramToReactFlow(diagram);
    const dashed = result.edges.find((edge) => edge.id === 'e-check-login');
    const highlighted = result.edges.find((edge) => edge.id === 'e-check-home');

    expect(dashed).toMatchObject({
      label: '否',
      selectable: false,
      focusable: false,
      reconnectable: false,
      style: { strokeDasharray: '7 5' },
      markerEnd: { type: MarkerType.ArrowClosed },
    });
    expect(highlighted?.style).toMatchObject({
      stroke: '#2563eb',
      strokeWidth: 3,
    });
  });
});
