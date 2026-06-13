import { create } from 'zustand';

import type { Diagram } from '../core/diagram/diagramTypes';
import { cloneDiagram } from '../core/diagram/diagramUtils';
import {
  executeOperation,
  executeOperations,
} from '../core/operations/operationExecutor';
import type { DiagramOperation } from '../core/operations/operationTypes';
import {
  diagramsHaveMeaningfulDifference,
  verifyOperationResult,
  type OperationVerificationResult,
} from '../core/operations/operationResultVerifier';
import { defaultLayoutEngine } from '../core/layout/layoutEngine';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

export type DiagramHistoryEntry = {
  id: string;
  description: string;
  timestamp: string;
  action: 'operation' | 'undo' | 'redo';
};

export type DiagramStoreState = {
  diagram: Diagram;
  past: Diagram[];
  future: Diagram[];
  history: DiagramHistoryEntry[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  applyOperation: (operation: DiagramOperation) => OperationVerificationResult;
  applyOperations: (
    operations: DiagramOperation[],
    description: string,
  ) => OperationVerificationResult;
  replaceDiagram: (diagram: Diagram, description: string) => OperationVerificationResult;
  undo: () => boolean;
  redo: () => boolean;
  reset: (diagram?: Diagram) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
};

function prepareInitialDiagram(): Diagram {
  return defaultLayoutEngine.layout(cloneDiagram(loginFlowDiagram));
}

function historyEntry(
  action: DiagramHistoryEntry['action'],
  description: string,
  timestamp = new Date().toISOString(),
): DiagramHistoryEntry {
  return {
    id: `${action}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    description,
    timestamp,
  };
}

export const useDiagramStore = create<DiagramStoreState>((set, get) => ({
  diagram: prepareInitialDiagram(),
  past: [],
  future: [],
  history: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId, selectedEdgeId: null }),
  setSelectedEdgeId: (selectedEdgeId) => set({ selectedEdgeId, selectedNodeId: null }),

  applyOperation: (operation) => {
    const { diagram, past, history } = get();
    const next = executeOperation(diagram, operation);
    const verification = verifyOperationResult(diagram, next, operation);
    if (!verification.verified) return verification;
    set({
      diagram: next,
      past: [...past, cloneDiagram(diagram)],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      history: [
        historyEntry(
          'operation',
          operation.description ?? operation.type,
          operation.timestamp,
        ),
        ...history,
      ].slice(0, 30),
    });
    return verification;
  },

  applyOperations: (operations, description) => {
    if (operations.length === 0)
      return { verified: false, changed: false, message: '没有可执行操作' };
    const { diagram, past, history } = get();
    const next = executeOperations(diagram, operations);
    const changed = diagramsHaveMeaningfulDifference(diagram, next);
    if (!changed)
      return { verified: false, changed: false, message: '批量操作未产生画布变化' };
    set({
      diagram: next,
      past: [...past, cloneDiagram(diagram)],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      history: [
        historyEntry('operation', description, operations.at(-1)?.timestamp),
        ...history,
      ].slice(0, 30),
    });
    return { verified: true, changed: true, message: '本地批量执行确认通过' };
  },

  replaceDiagram: (nextDiagram, description) => {
    const { diagram, past, history } = get();
    if (!diagramsHaveMeaningfulDifference(diagram, nextDiagram))
      return { verified: false, changed: false, message: '候选图与当前图相同' };
    set({
      diagram: cloneDiagram(nextDiagram),
      past: [...past, cloneDiagram(diagram)],
      future: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      history: [historyEntry('operation', description), ...history].slice(0, 30),
    });
    return { verified: true, changed: true, message: '本地图表替换确认通过' };
  },

  undo: () => {
    const { diagram, past, future, history } = get();
    const previous = past.at(-1);
    if (!previous) return false;

    set({
      diagram: cloneDiagram(previous),
      past: past.slice(0, -1),
      future: [cloneDiagram(diagram), ...future],
      history: [historyEntry('undo', '撤销上一步操作'), ...history].slice(0, 30),
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    return true;
  },

  redo: () => {
    const { diagram, past, future, history } = get();
    const next = future[0];
    if (!next) return false;

    set({
      diagram: cloneDiagram(next),
      past: [...past, cloneDiagram(diagram)],
      future: future.slice(1),
      history: [historyEntry('redo', '重做上一步操作'), ...history].slice(0, 30),
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    return true;
  },

  reset: (diagram = loginFlowDiagram) => {
    set({
      diagram: defaultLayoutEngine.layout(cloneDiagram(diagram)),
      past: [],
      future: [],
      history: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },
}));
