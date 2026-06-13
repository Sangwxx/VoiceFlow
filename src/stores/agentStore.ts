import { create } from 'zustand';

import type { Diagram } from '../core/diagram/diagramTypes';
import type {
  AgentConversationTurn,
  AgentIntent,
  AgentStatus,
} from '../commands/agent/agentTypes';

export type AgentStoreState = {
  status: AgentStatus;
  providerMode: 'mock' | 'real';
  model: string;
  originalCommand: string;
  intent: AgentIntent | null;
  conversation: AgentConversationTurn[];
  previewDiagram: Diagram | null;
  explanation: string;
  summary: string;
  error: string | null;
  taskId: string | null;
  controller: AbortController | null;
  setStateForTask: (state: Partial<AgentStoreState>) => void;
  cancel: () => void;
  clear: () => void;
};

const initial = {
  status: 'idle' as AgentStatus,
  providerMode: 'mock' as const,
  model: '',
  originalCommand: '',
  intent: null,
  conversation: [],
  previewDiagram: null,
  explanation: '',
  summary: '',
  error: null,
  taskId: null,
  controller: null,
};

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  ...initial,
  setStateForTask: (state) => set(state),
  cancel: () => {
    get().controller?.abort();
    set({
      ...initial,
      status: 'cancelled',
      providerMode: get().providerMode,
      model: get().model,
    });
  },
  clear: () => set(initial),
}));
