import { create } from 'zustand';

import type { RouteResult } from '../commands/router/routeTypes';
import type {
  ClarificationRequest,
  ResolvedTarget,
  SimpleIntentName,
} from '../commands/simple/simpleTypes';
import type { DiagramOperation } from '../core/operations/operationTypes';

export type CommandExecutionStatus = 'success' | 'error' | 'ignored' | 'clarification';

export type CommandExecutionLog = {
  id: string;
  rawText: string;
  normalizedText: string;
  route: RouteResult['route'];
  confidence: number;
  status: CommandExecutionStatus;
  message: string;
  durationMs: number;
  timestamp: string;
  diagramId: string;
  simpleIntent?: SimpleIntentName;
  operationType?: DiagramOperation['type'];
};

export type CommandStoreState = {
  lastRouteResult: RouteResult | null;
  executionLog: CommandExecutionLog[];
  lastMessage: string;
  pendingClarification: ClarificationRequest | null;
  lastTarget: ResolvedTarget | null;
  lastOperation: DiagramOperation | null;
  setRouteResult: (result: RouteResult) => void;
  addExecutionLog: (log: CommandExecutionLog) => void;
  setLastMessage: (message: string) => void;
  setPendingClarification: (request: ClarificationRequest | null) => void;
  setLastTarget: (target: ResolvedTarget | null) => void;
  setLastOperation: (operation: DiagramOperation | null) => void;
  clearPending: () => void;
  reset: () => void;
};

export const useCommandStore = create<CommandStoreState>((set) => ({
  lastRouteResult: null,
  executionLog: [],
  lastMessage: '等待语音指令',
  pendingClarification: null,
  lastTarget: null,
  lastOperation: null,
  setRouteResult: (lastRouteResult) => set({ lastRouteResult }),
  addExecutionLog: (log) =>
    set((state) => ({ executionLog: [log, ...state.executionLog].slice(0, 30) })),
  setLastMessage: (lastMessage) => set({ lastMessage }),
  setPendingClarification: (pendingClarification) => set({ pendingClarification }),
  setLastTarget: (lastTarget) => set({ lastTarget }),
  setLastOperation: (lastOperation) => set({ lastOperation }),
  clearPending: () =>
    set({
      lastRouteResult: null,
      pendingClarification: null,
      lastMessage: '已取消当前待处理指令',
    }),
  reset: () =>
    set({
      lastRouteResult: null,
      executionLog: [],
      lastMessage: '等待语音指令',
      pendingClarification: null,
      lastTarget: null,
      lastOperation: null,
    }),
}));
