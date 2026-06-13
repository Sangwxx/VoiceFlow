import type { FastCommandName } from '../fast/fastCommandTypes';
import type { SimpleIntentName } from '../simple/simpleTypes';
import type { AgentIntent } from '../agent/agentTypes';
import type { WorkflowIntent } from '../workflow/workflowTypes';

export type CommandRoute = 'fast' | 'simple' | 'workflow' | 'agent' | 'unknown';

export type RouteResult = {
  route: CommandRoute;
  confidence: number;
  rawText: string;
  normalizedText: string;
  fastCommand?: FastCommandName;
  simpleIntent?: SimpleIntentName;
  agentIntent?: AgentIntent;
  workflowIntent?: WorkflowIntent;
  reason?: string;
};
