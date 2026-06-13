import { describe, expect, it } from 'vitest';

import { normalizeAgentResult } from '../commands/agent/agentNormalizer';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('normalizeAgentResult', () => {
  it('parses fenced snake_case JSON, fills defaults and lays out nodes', () => {
    const result = normalizeAgentResult(`\`\`\`json
      {
        "kind":"diagram",
        "summary":"测试流程",
        "diagram":{
          "title":"审批流程",
          "diagram_type":"flowchart",
          "nodes":[
            {"label":"开始","type":"start"},
            {"id":"approve","label":"审批","type":"decision"},
            {"id":"done","label":"完成","type":"end"}
          ],
          "edges":[
            {"source":"approve","target":"done","label":"通过"}
          ]
        }
      }
    \`\`\``);

    expect(result.kind).toBe('diagram');
    if (result.kind !== 'diagram') return;
    expect(result.diagram.diagramType).toBe('flowchart');
    expect(result.diagram.nodes.every((node) => Number.isFinite(node.position?.x))).toBe(
      true,
    );
    expect(result.diagram.groups).toEqual([]);
  });

  it('rejects invalid edge references', () => {
    expect(() =>
      normalizeAgentResult({
        kind: 'diagram',
        diagram: {
          nodes: [{ id: 'one', label: 'One', type: 'process' }],
          edges: [{ from: 'one', to: 'missing' }],
        },
      }),
    ).toThrow();
  });

  it.each([
    ['usecase', '学生选课用例图'],
    ['organization', '公司组织结构图'],
    ['mindmap', '产品功能思维导图'],
    ['framework', '前端技术框架图'],
    ['table', '方案对比表格'],
  ])('normalizes a compact %s structural blueprint', (diagramType, title) => {
    const result = normalizeAgentResult({
      kind: 'diagram',
      title,
      diagramType,
      direction: 'left_to_right',
      nodes: [
        { id: 'a', label: '主体', type: 'user' },
        { id: 'b', label: '结构内容', type: 'process' },
      ],
      edges: [{ from: 'a', to: 'b' }],
      groups: [{ label: '结构分组', nodeIds: ['b'] }],
    });
    expect(result.kind).toBe('diagram');
    if (result.kind !== 'diagram') return;
    expect(result.diagram).toMatchObject({
      title,
      diagramType,
      layout: { direction: 'left_to_right' },
      groups: [{ label: '结构分组', nodeIds: ['b'] }],
    });
  });

  it('normalizes and validates contextual operations against the current diagram', () => {
    const result = normalizeAgentResult(
      {
        kind: 'operations',
        summary: '调整失败分支',
        operations: [
          {
            type: 'update_edge',
            edgeId: 'e-success-error',
            patch: { type: 'dashed', style: { stroke: '#dc2626' } },
          },
        ],
      },
      loginFlowDiagram,
    );

    expect(result.kind).toBe('operations');
    if (result.kind !== 'operations') return;
    expect(result.operations[0]).toMatchObject({
      type: 'update_edge',
      edgeId: 'e-success-error',
    });
    expect(
      result.diagram.edges.find((edge) => edge.id === 'e-success-error'),
    ).toMatchObject({
      type: 'dashed',
      style: { stroke: '#dc2626' },
    });
  });

  it('rejects unsafe or invalid contextual operations', () => {
    expect(() =>
      normalizeAgentResult(
        {
          kind: 'operations',
          operations: [{ type: 'delete_node', nodeId: 'missing' }],
        },
        loginFlowDiagram,
      ),
    ).toThrow(/不存在/);
  });
});
