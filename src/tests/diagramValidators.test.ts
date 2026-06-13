import { describe, expect, it } from 'vitest';

import { validateDiagram } from '../core/diagram/diagramValidators';
import { architectureDiagram } from '../mock/architectureDiagram';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('validateDiagram', () => {
  it('accepts both phase 1 mock diagrams', () => {
    expect(validateDiagram(loginFlowDiagram).success).toBe(true);
    expect(validateDiagram(architectureDiagram).success).toBe(true);
  });

  it('rejects duplicate node ids', () => {
    const input = structuredClone(loginFlowDiagram);
    input.nodes[1].id = input.nodes[0].id;

    const result = validateDiagram(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'duplicate_id', path: 'nodes[1].id' }),
      );
    }
  });

  it('rejects edges that reference missing nodes', () => {
    const input = structuredClone(loginFlowDiagram);
    input.edges[0].to = 'missing-node';

    const result = validateDiagram(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'invalid_reference',
          path: 'edges[0].to',
        }),
      );
    }
  });

  it('rejects invalid layout configuration', () => {
    const input: unknown = {
      ...structuredClone(loginFlowDiagram),
      layout: {
        ...loginFlowDiagram.layout,
        direction: 'diagonal',
        spacingX: -1,
      },
    };

    const result = validateDiagram(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.path)).toEqual(
        expect.arrayContaining(['layout.direction', 'layout.spacingX']),
      );
    }
  });

  it('rejects non-empty groups during phase 1', () => {
    const input = {
      ...structuredClone(loginFlowDiagram),
      groups: [{ id: 'g1', label: '暂不支持', nodeIds: ['start'] }],
    };

    const result = validateDiagram(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'unsupported', path: 'groups' }),
      );
    }
  });

  it('rejects invalid coordinates and dimensions', () => {
    const input: unknown = {
      ...structuredClone(loginFlowDiagram),
      nodes: [
        {
          ...loginFlowDiagram.nodes[0],
          position: { x: Number.POSITIVE_INFINITY, y: 0 },
          size: { width: 0, height: 20 },
        },
        ...loginFlowDiagram.nodes.slice(1),
      ],
    };

    const result = validateDiagram(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.path)).toEqual(
        expect.arrayContaining(['nodes[0].position', 'nodes[0].size']),
      );
    }
  });

  it('rejects self links and duplicate endpoint links', () => {
    const input = structuredClone(loginFlowDiagram);
    input.edges.push(
      { id: 'self', from: 'home', to: 'home' },
      { id: 'duplicate-endpoints', from: 'start', to: 'open-app' },
    );

    const result = validateDiagram(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.map((error) => error.message)).toEqual(
        expect.arrayContaining(['不允许节点连接到自身。', '相同起点和终点的连线重复。']),
      );
    }
  });
});
