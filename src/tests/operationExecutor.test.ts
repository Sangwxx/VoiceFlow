import { describe, expect, it } from 'vitest';

import { executeOperation } from '../core/operations/operationExecutor';
import type {
  ApplyLayoutOperation,
  DiagramOperation,
} from '../core/operations/operationTypes';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('executeOperation', () => {
  it('applies a layout direction without mutating the input', () => {
    const input = structuredClone(loginFlowDiagram);
    const snapshot = structuredClone(input);
    const operation: ApplyLayoutOperation = {
      id: 'layout-1',
      type: 'apply_layout',
      direction: 'left_to_right',
      timestamp: '2026-06-12T10:00:00.000Z',
    };

    const result = executeOperation(input, operation);

    expect(input).toEqual(snapshot);
    expect(result.layout.direction).toBe('left_to_right');
    expect(result.metadata.updatedAt).toBe(operation.timestamp);
    expect(result.metadata.version).toBe(input.metadata.version + 1);
    expect(result.nodes.every((node) => node.position)).toBe(true);
  });

  it('rejects operations that target missing entities', () => {
    expect(() =>
      executeOperation(loginFlowDiagram, {
        id: 'node-1',
        type: 'delete_node',
        nodeId: 'missing',
        timestamp: '2026-06-12T10:00:00.000Z',
      }),
    ).toThrow('节点 "missing" 不存在');
  });

  it('creates, updates and deletes nodes and edges without mutating input', () => {
    const input = structuredClone(loginFlowDiagram);
    const snapshot = structuredClone(input);
    const createNode: DiagramOperation = {
      id: 'create-captcha',
      type: 'create_node',
      node: { id: 'captcha', label: '验证码校验', type: 'process' },
      timestamp: '2026-06-12T10:00:00.000Z',
    };
    const withNode = executeOperation(input, createNode);
    const withEdge = executeOperation(withNode, {
      id: 'create-edge',
      type: 'create_edge',
      edge: { id: 'captcha-edge', from: 'login-page', to: 'captcha' },
      timestamp: '2026-06-12T10:01:00.000Z',
    });
    const styled = executeOperation(withEdge, {
      id: 'style-node',
      type: 'update_node',
      nodeId: 'captcha',
      patch: { style: { background: '#00f' } },
      timestamp: '2026-06-12T10:02:00.000Z',
    });
    const withoutEdge = executeOperation(styled, {
      id: 'delete-edge',
      type: 'delete_edge',
      edgeId: 'captcha-edge',
      timestamp: '2026-06-12T10:03:00.000Z',
    });

    expect(input).toEqual(snapshot);
    expect(styled.nodes.find((node) => node.id === 'captcha')?.style?.background).toBe(
      '#00f',
    );
    expect(withoutEdge.edges.some((edge) => edge.id === 'captcha-edge')).toBe(false);
  });

  it('inserts a node by replacing one outgoing edge', () => {
    const result = executeOperation(loginFlowDiagram, {
      id: 'insert-captcha',
      type: 'insert_node_after',
      targetNodeId: 'login-page',
      replacedEdgeId: 'e-login-submit',
      newNode: { id: 'captcha', label: '验证码校验', type: 'process' },
      timestamp: '2026-06-12T10:00:00.000Z',
    });

    expect(result.edges.some((edge) => edge.id === 'e-login-submit')).toBe(false);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'login-page', to: 'captcha' }),
        expect.objectContaining({ from: 'captcha', to: 'submit-login' }),
      ]),
    );
  });

  it('reconnects a single predecessor and successor when deleting a node', () => {
    const result = executeOperation(loginFlowDiagram, {
      id: 'delete-submit',
      type: 'delete_node',
      nodeId: 'submit-login',
      timestamp: '2026-06-12T10:00:00.000Z',
    });

    expect(result.nodes.some((node) => node.id === 'submit-login')).toBe(false);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'login-page', to: 'login-success' }),
      ]),
    );
  });

  it('rejects self links and duplicate endpoint links', () => {
    expect(() =>
      executeOperation(loginFlowDiagram, {
        id: 'self',
        type: 'create_edge',
        edge: { id: 'self-edge', from: 'home', to: 'home' },
        timestamp: '2026-06-12T10:00:00.000Z',
      }),
    ).toThrow('不允许节点连接到自身');
    expect(() =>
      executeOperation(loginFlowDiagram, {
        id: 'duplicate',
        type: 'create_edge',
        edge: { id: 'duplicate-edge', from: 'start', to: 'open-app' },
        timestamp: '2026-06-12T10:00:00.000Z',
      }),
    ).toThrow('相同起点和终点的连线已存在');
  });
});
