import { describe, expect, it } from 'vitest';

import type { DiagramNode } from '../core/diagram/diagramTypes';
import { getNodeSize } from '../core/diagram/diagramUtils';
import { applyDagreLayout } from '../core/layout/dagreLayout';
import { architectureDiagram } from '../mock/architectureDiagram';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

function nodesOverlap(first: DiagramNode, second: DiagramNode): boolean {
  const firstSize = getNodeSize(first);
  const secondSize = getNodeSize(second);
  const firstPosition = first.position!;
  const secondPosition = second.position!;

  return !(
    firstPosition.x + firstSize.width <= secondPosition.x ||
    secondPosition.x + secondSize.width <= firstPosition.x ||
    firstPosition.y + firstSize.height <= secondPosition.y ||
    secondPosition.y + secondSize.height <= firstPosition.y
  );
}

describe('applyDagreLayout', () => {
  it.each([
    ['top-down', loginFlowDiagram],
    ['left-to-right', architectureDiagram],
  ])(
    'lays out the %s diagram with finite non-overlapping coordinates',
    (_name, input) => {
      const result = applyDagreLayout(input);

      for (const node of result.nodes) {
        expect(Number.isFinite(node.position?.x)).toBe(true);
        expect(Number.isFinite(node.position?.y)).toBe(true);
      }

      for (let first = 0; first < result.nodes.length; first += 1) {
        for (let second = first + 1; second < result.nodes.length; second += 1) {
          expect(nodesOverlap(result.nodes[first], result.nodes[second])).toBe(false);
        }
      }
    },
  );

  it('does not mutate its input', () => {
    const snapshot = structuredClone(loginFlowDiagram);

    applyDagreLayout(loginFlowDiagram);

    expect(loginFlowDiagram).toEqual(snapshot);
  });

  it('preserves provided positions when auto layout is disabled', () => {
    const input = structuredClone(architectureDiagram);
    input.layout.autoLayout = false;
    input.nodes = input.nodes.map((node, index) => ({
      ...node,
      position: { x: index * 20, y: index * 10 },
    }));

    const result = applyDagreLayout(input);

    expect(result).not.toBe(input);
    expect(result.nodes.map((node) => node.position)).toEqual(
      input.nodes.map((node) => node.position),
    );
  });
});
