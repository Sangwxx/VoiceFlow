import { describe, expect, it } from 'vitest';

import {
  detectDiagramType,
  planLocalStructuralDiagram,
} from '../commands/agent/structuralDiagramPlanner';

describe('structuralDiagramPlanner', () => {
  it.each([
    ['画一个学生选课用例图', 'usecase'],
    ['画一个公司的组织结构图', 'organization'],
    ['生成产品功能思维导图', 'mindmap'],
    ['做一个方案对比表格', 'table'],
    ['画一个系统架构图', 'architecture'],
  ] as const)('detects %s as %s', (command, expected) => {
    expect(detectDiagramType(command)).toBe(expected);
  });

  it('creates a matching use case diagram locally without AI', () => {
    const result = planLocalStructuralDiagram('画一个学生选课用例图');
    expect(result.kind).toBe('diagram');
    if (result.kind !== 'diagram') return;
    expect(result.diagram).toMatchObject({
      title: '学生选课用例图',
      diagramType: 'usecase',
    });
    expect(result.diagram.nodes.map((node) => node.label)).toContain('选择课程');
  });

  it('uses explicitly named components instead of unrelated template content', () => {
    const result = planLocalStructuralDiagram(
      '画一个包含用户端、API网关、订单服务和数据库的架构图',
    );
    expect(result.kind).toBe('diagram');
    if (result.kind !== 'diagram') return;
    expect(result.diagram.nodes.map((node) => node.label)).toEqual([
      '用户端',
      'API网关',
      '订单服务',
      '数据库',
    ]);
  });

  it('creates a minimal default flow for a complete request without details', () => {
    const result = planLocalStructuralDiagram('生成一个最简单的流程图');
    expect(result.kind).toBe('diagram');
    if (result.kind !== 'diagram') return;

    expect(result.diagram.title).toBe('最简流程图');
    expect(result.diagram.nodes.map((node) => node.label)).toEqual([
      '开始',
      '执行操作',
      '结束',
    ]);
    expect(result.diagram.edges).toHaveLength(2);
  });
});
