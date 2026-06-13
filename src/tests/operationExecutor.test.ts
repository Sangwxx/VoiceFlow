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

  it('moves a node without triggering automatic layout', () => {
    const result = executeOperation(loginFlowDiagram, {
      id: 'move-login',
      type: 'move_node',
      nodeId: 'login-page',
      position: { x: 40, y: 900 },
      timestamp: '2026-06-12T10:00:00.000Z',
    });

    expect(result.nodes.find((node) => node.id === 'login-page')?.position).toEqual({
      x: 40,
      y: 900,
    });
    expect(result.layout.autoLayout).toBe(false);
  });

  it('solves semantic relative positions and reroutes the edge', () => {
    const result = executeOperation(loginFlowDiagram, {
      id: 'position-login',
      type: 'set_relative_position',
      nodeId: 'login-page',
      referenceNodeId: 'open-app',
      relation: 'right_of',
      timestamp: '2026-06-12T10:00:00.000Z',
    });
    const login = result.nodes.find((node) => node.id === 'login-page')!;
    const openApp = result.nodes.find((node) => node.id === 'open-app')!;

    expect(login.position!.x).toBeGreaterThan(openApp.position!.x);
    expect(login.position!.y).toBe(openApp.position!.y);
    expect(result.layout.autoLayout).toBe(false);
    expect(result.edges.every((edge) => edge.routing?.points.length)).toBe(true);
  });

  it('aligns nodes and changes an edge direction through semantic operations', () => {
    const aligned = executeOperation(loginFlowDiagram, {
      id: 'align-login',
      type: 'align_nodes',
      nodeIds: ['open-app', 'login-page'],
      axis: 'horizontal',
      timestamp: '2026-06-12T10:00:00.000Z',
    });
    const openApp = aligned.nodes.find((node) => node.id === 'open-app')!;
    const login = aligned.nodes.find((node) => node.id === 'login-page')!;
    expect(openApp.position!.y + 32).toBe(login.position!.y + 32);

    const reversed = executeOperation(aligned, {
      id: 'reverse-edge',
      type: 'set_edge_endpoints',
      edgeId: 'e-start-open',
      from: 'open-app',
      to: 'start',
      timestamp: '2026-06-12T10:01:00.000Z',
    });
    expect(reversed.edges.find((edge) => edge.id === 'e-start-open')).toMatchObject({
      from: 'open-app',
      to: 'start',
    });
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
