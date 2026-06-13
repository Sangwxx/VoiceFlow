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
