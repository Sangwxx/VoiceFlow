import { describe, expect, it } from 'vitest';

import {
  resolveEdge,
  resolveEdgeByEndpoints,
  resolveNode,
} from '../commands/simple/entityResolver';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('entityResolver', () => {
  it('resolves nodes by exact id, contained label and recent target', () => {
    expect(resolveNode(loginFlowDiagram, 'login-page')).toMatchObject({
      status: 'found',
      item: { id: 'login-page' },
    });
    expect(resolveNode(loginFlowDiagram, '登录页')).toMatchObject({
      status: 'found',
      item: { id: 'login-page' },
    });

    const duplicate = structuredClone(loginFlowDiagram);
    duplicate.nodes.push({ id: 'login-page-copy', label: '备用登录页', type: 'process' });
    expect(resolveNode(duplicate, '登录页')).toMatchObject({ status: 'multiple' });
    expect(resolveNode(duplicate, '登录页', 'login-page-copy')).toMatchObject({
      status: 'found',
      item: { id: 'login-page-copy' },
    });
  });

  it('resolves edge aliases and endpoints', () => {
    expect(resolveEdge(loginFlowDiagram, '失败分支')).toMatchObject({
      status: 'multiple',
    });
    expect(resolveEdgeByEndpoints(loginFlowDiagram, 'start', 'open-app')).toMatchObject({
      status: 'found',
      item: { id: 'e-start-open' },
    });
  });

  it('returns suggestions for a near node name', () => {
    expect(resolveNode(loginFlowDiagram, '登录')).toMatchObject({
      status: 'multiple',
    });
    expect(resolveNode(loginFlowDiagram, '首页页面')).toMatchObject({
      status: 'not_found',
      suggestions: expect.arrayContaining([expect.objectContaining({ id: 'home' })]),
    });
  });
});
