import type { Diagram } from './diagramTypes';

export function createBlankDiagram(): Diagram {
  const timestamp = new Date().toISOString();
  return {
    id: `blank-${Date.now()}`,
    title: '空白画布',
    diagramType: 'generic',
    nodes: [],
    edges: [],
    groups: [],
    layout: {
      direction: 'top_down',
      spacingX: 90,
      spacingY: 80,
      autoLayout: true,
    },
    theme: { name: 'default' },
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    },
  };
}
