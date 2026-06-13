import { describe, expect, it } from 'vitest';

import { executeOperation } from '../core/operations/operationExecutor';
import { verifyOperationResult } from '../core/operations/operationResultVerifier';
import type { DiagramOperation } from '../core/operations/operationTypes';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

const timestamp = '2026-06-13T12:00:00.000Z';

describe('operation result verifier', () => {
  it('confirms a created node exists after execution', () => {
    const operation: DiagramOperation = {
      id: 'create-review',
      type: 'create_node',
      timestamp,
      node: { id: 'review', label: '人工审核', type: 'process' },
    };
    const after = executeOperation(loginFlowDiagram, operation);
    expect(verifyOperationResult(loginFlowDiagram, after, operation)).toMatchObject({
      verified: true,
      changed: true,
    });
  });

  it('rejects an update that writes the existing value', () => {
    const operation: DiagramOperation = {
      id: 'same-label',
      type: 'update_node',
      timestamp,
      nodeId: 'start',
      patch: { label: loginFlowDiagram.nodes[0].label },
    };
    const after = executeOperation(loginFlowDiagram, operation);
    expect(verifyOperationResult(loginFlowDiagram, after, operation)).toMatchObject({
      verified: false,
      changed: false,
    });
  });
});
