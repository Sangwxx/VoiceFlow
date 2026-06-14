import { describe, expect, it } from 'vitest';

import {
  getTemporaryObjectReferences,
  resolveTemporaryObjectReference,
} from '../core/diagram/temporaryObjectReferences';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('temporary object references', () => {
  it('assigns one stable, sequential number across nodes and edges', () => {
    const before = structuredClone(loginFlowDiagram);
    const references = getTemporaryObjectReferences(loginFlowDiagram);

    expect(references).toHaveLength(
      loginFlowDiagram.nodes.length + loginFlowDiagram.edges.length,
    );
    expect(references[0]).toEqual({ number: 1, kind: 'node', id: 'start' });
    expect(references[loginFlowDiagram.nodes.length]).toEqual({
      number: loginFlowDiagram.nodes.length + 1,
      kind: 'edge',
      id: loginFlowDiagram.edges[0].id,
    });
    expect(loginFlowDiagram).toEqual(before);
  });

  it('resolves common spoken object-number forms', () => {
    expect(resolveTemporaryObjectReference(loginFlowDiagram, '物体1')).toMatchObject({
      kind: 'node',
      id: 'start',
    });
    expect(resolveTemporaryObjectReference(loginFlowDiagram, '对象 2')).toMatchObject({
      kind: 'node',
      id: loginFlowDiagram.nodes[1].id,
    });
    expect(resolveTemporaryObjectReference(loginFlowDiagram, '物体一')).toMatchObject({
      kind: 'node',
      id: 'start',
    });
    expect(resolveTemporaryObjectReference(loginFlowDiagram, '5号圆形')).toMatchObject({
      kind: 'node',
      id: loginFlowDiagram.nodes[4].id,
    });
    expect(
      resolveTemporaryObjectReference(
        loginFlowDiagram,
        `${loginFlowDiagram.nodes.length + 1}号物体`,
      ),
    ).toMatchObject({
      kind: 'edge',
      id: loginFlowDiagram.edges[0].id,
    });
  });
});
