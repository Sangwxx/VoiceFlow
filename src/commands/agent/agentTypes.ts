import type { Diagram } from '../../core/diagram/diagramTypes';
import type { DiagramOperation } from '../../core/operations/operationTypes';

export type AgentIntent = 'create_diagram' | 'modify_diagram';

export type AgentStatus =
  | 'idle'
  | 'planning'
  | 'clarifying'
  | 'preview'
  | 'confirming'
  | 'error'
  | 'cancelled';

export type AgentConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AgentRequest = {
  intent: AgentIntent;
  originalCommand: string;
  conversation: AgentConversationTurn[];
  currentDiagram?: Diagram;
  spatialSummary?: string;
  recentCommands?: string[];
};

export type AgentPlanResult =
  | {
      kind: 'diagram';
      explanation: string;
      summary: string;
      diagram: Diagram;
    }
  | {
      kind: 'operations';
      explanation: string;
      summary: string;
      operations: DiagramOperation[];
      diagram: Diagram;
    }
  | {
      kind: 'clarification';
      explanation: string;
      question: string;
    };

export interface AiProvider {
  readonly mode: 'real' | 'unconfigured';
  readonly model: string;
  complete(request: AgentRequest, options?: { signal?: AbortSignal }): Promise<unknown>;
}
