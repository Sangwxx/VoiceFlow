import { create } from 'zustand';

import type { Diagram } from '../core/diagram/diagramTypes';
import type {
  AgentConversationTurn,
  AgentIntent,
  AgentStatus,
} from '../commands/agent/agentTypes';

export type AgentStoreState = {
  status: AgentStatus;
  providerMode: 'real' | 'unconfigured';
  model: string;
  originalCommand: string;
  intent: AgentIntent | null;
  conversation: AgentConversationTurn[];
  contextDiagramId: string;
  contextDiagramTitle: string;
  previewDiagram: Diagram | null;
  explanation: string;
  summary: string;
  clarificationQuestion: string;
  error: string | null;
  taskId: string | null;
  controller: AbortController | null;
  setStateForTask: (state: Partial<AgentStoreState>) => void;
  cancel: () => void;
  clear: () => void;
};

const initial = {
  status: 'idle' as AgentStatus,
  providerMode: 'unconfigured' as const,
  model: '',
  originalCommand: '',
  intent: null,
  conversation: [],
  contextDiagramId: '',
  contextDiagramTitle: '',
  previewDiagram: null,
  explanation: '',
  summary: '',
  clarificationQuestion: '',
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
