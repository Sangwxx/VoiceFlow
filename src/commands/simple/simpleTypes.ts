import type {
  DiagramEdge,
  DiagramNode,
  NodeStyle,
  NodeType,
  Size,
} from '../../core/diagram/diagramTypes';
import type { DiagramOperation } from '../../core/operations/operationTypes';

export type SimpleIntentName =
  | 'create_node'
  | 'delete_node'
  | 'update_node_text'
  | 'update_node_style'
  | 'duplicate_node'
  | 'resize_node'
  | 'move_node'
  | 'create_edge'
  | 'delete_edge'
  | 'update_edge_style'
  | 'insert_node_after';

export type SimpleOperationDraft =
  | {
      intent: 'create_node';
      label: string;
      nodeType: NodeType;
      size?: Size;
      style?: NodeStyle;
    }
  | {
      intent: 'delete_node';
      targetText: string;
      resolved?: Record<string, string>;
    }
  | {
      intent: 'update_node_text';
      targetText: string;
      newLabel: string;
      resolved?: Record<string, string>;
    }
  | {
      intent: 'update_node_style';
      targetText: string;
      colorName: string;
      resolved?: Record<string, string>;
    }
  | {
      intent: 'duplicate_node';
      targetText: string;
      resolved?: Record<string, string>;
    }
  | {
      intent: 'resize_node';
      targetText: string;
      scale?: number;
      width?: number;
      height?: number;
      resolved?: Record<string, string>;
    }
  | {
      intent: 'move_node';
      targetText: string;
      placement: 'left' | 'right' | 'top' | 'bottom' | 'center';
      resolved?: Record<string, string>;
    }
  | {
      intent: 'create_edge';
      sourceText: string;
      targetText: string;
      label?: string;
      useRecentNodes?: boolean;
      resolved?: Record<string, string>;
    }
  | {
      intent: 'delete_edge';
      edgeText?: string;
      sourceText?: string;
      targetText?: string;
      resolved?: Record<string, string>;
    }
  | {
      intent: 'update_edge_style';
      edgeText: string;
      colorName?: string;
      lineType?: 'solid' | 'dashed';
      resolved?: Record<string, string>;
    }
  | {
      intent: 'insert_node_after';
      targetText: string;
      newLabel: string;
      nodeType: NodeType;
      resolved?: Record<string, string>;
    };

export type ClarificationCandidate = {
  id: string;
  label: string;
  kind: 'node' | 'edge';
  detail?: string;
};

export type ClarificationRequest = {
  id: string;
  originalCommand: string;
  question: string;
  candidates: ClarificationCandidate[];
  draft: SimpleOperationDraft;
  resolutionField: string;
};

export type SimpleParseResult =
  | { status: 'ready'; intent: SimpleIntentName; draft: SimpleOperationDraft }
  | { status: 'needs_clarification'; request: ClarificationRequest }
  | { status: 'invalid'; message: string };

export type ResolveResult<T> =
  | { status: 'found'; item: T; confidence: number }
  | { status: 'multiple'; candidates: T[] }
  | { status: 'not_found'; suggestions: T[] };

export type ResolvedTarget = {
  kind: 'node' | 'edge';
  id: string;
  label: string;
};

export type SimpleExecutionResult = {
  status: 'success' | 'error' | 'ignored' | 'clarification';
  message: string;
  intent?: SimpleIntentName;
  target?: ResolvedTarget;
  operation?: DiagramOperation;
};

export type NodeResolveResult = ResolveResult<DiagramNode>;
export type EdgeResolveResult = ResolveResult<DiagramEdge>;
