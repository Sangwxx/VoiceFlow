import { beforeEach, describe, expect, it } from 'vitest';

import { createApplyLayoutOperation } from '../core/operations/operationFactory';
import { useDiagramStore } from '../stores/diagramStore';

describe('diagramStore', () => {
  beforeEach(() => useDiagramStore.getState().reset());

  it('tracks operations and supports undo and redo', () => {
    useDiagramStore
      .getState()
      .applyOperation(createApplyLayoutOperation('left_to_right'));

    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(useDiagramStore.getState().future).toHaveLength(0);

    expect(useDiagramStore.getState().undo()).toBe(true);
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');
    expect(useDiagramStore.getState().future).toHaveLength(1);

    expect(useDiagramStore.getState().redo()).toBe(true);
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
  });

  it('clears redo after a new operation', () => {
    useDiagramStore
      .getState()
      .applyOperation(createApplyLayoutOperation('left_to_right'));
    useDiagramStore.getState().undo();
    useDiagramStore.getState().applyOperation({
      id: 'create-after-undo',
      type: 'create_node',
      timestamp: '2026-06-13T12:00:00.000Z',
      node: { id: 'after-undo', label: '新操作', type: 'process' },
    });

    expect(useDiagramStore.getState().future).toHaveLength(0);
    expect(useDiagramStore.getState().redo()).toBe(false);
  });

  it('safely rejects undo and redo with empty history', () => {
    expect(useDiagramStore.getState().undo()).toBe(false);
    expect(useDiagramStore.getState().redo()).toBe(false);
  });

  it('does not commit or create history for an operation with no expected change', () => {
    const before = structuredClone(useDiagramStore.getState().diagram);
    const result = useDiagramStore.getState().applyOperation({
      id: 'same-label',
      type: 'update_node',
      timestamp: '2026-06-13T12:00:00.000Z',
      nodeId: 'start',
      patch: { label: before.nodes.find((node) => node.id === 'start')!.label },
    });
    expect(result.verified).toBe(false);
    expect(useDiagramStore.getState().diagram).toEqual(before);
    expect(useDiagramStore.getState().past).toHaveLength(0);
  });

  it('replaces a complete diagram as one undoable history entry', () => {
    const original = structuredClone(useDiagramStore.getState().diagram);
    const replacement = structuredClone(original);
    replacement.id = 'replacement';
    replacement.title = 'AI candidate';
    useDiagramStore.getState().replaceDiagram(replacement, '确认 AI 图表');
    expect(useDiagramStore.getState().diagram.id).toBe('replacement');
    expect(useDiagramStore.getState().past).toHaveLength(1);
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().diagram.id).toBe(original.id);
  });

  it('applies an operation batch as one history snapshot and fails atomically', () => {
    const before = structuredClone(useDiagramStore.getState().diagram);
    const timestamp = '2026-06-12T10:00:00.000Z';
    useDiagramStore.getState().applyOperations(
      [
        {
          id: 'create-a',
          type: 'create_node',
          node: { id: 'a', label: '节点 A', type: 'process' },
          timestamp,
        },
        {
          id: 'create-b',
          type: 'create_node',
          node: { id: 'b', label: '节点 B', type: 'process' },
          timestamp,
        },
      ],
      '创建两个节点',
    );
    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(
      before.nodes.length + 2,
    );

    const snapshot = structuredClone(useDiagramStore.getState().diagram);
    expect(() =>
      useDiagramStore.getState().applyOperations(
        [
          {
            id: 'create-c',
            type: 'create_node',
            node: { id: 'c', label: '节点 C', type: 'process' },
            timestamp,
          },
          {
            id: 'invalid-edge',
            type: 'create_edge',
            edge: { id: 'invalid', from: 'c', to: 'missing' },
            timestamp,
          },
        ],
        '失败批次',
      ),
    ).toThrow();
    expect(useDiagramStore.getState().diagram).toEqual(snapshot);
    expect(useDiagramStore.getState().past).toHaveLength(1);
  });
});
