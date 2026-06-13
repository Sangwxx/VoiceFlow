import type { DiagramEdge, DiagramNode, LayoutDirection } from '../diagram/diagramTypes';

export type BaseOperation = {
  id: string;
  timestamp: string;
  description?: string;
};

export type ApplyLayoutOperation = BaseOperation & {
  type: 'apply_layout';
  direction?: LayoutDirection;
};

export type CreateNodeOperation = BaseOperation & {
  type: 'create_node';
  node: DiagramNode;
};

export type DeleteNodeOperation = BaseOperation & {
  type: 'delete_node';
  nodeId: string;
};

export type UpdateNodeOperation = BaseOperation & {
  type: 'update_node';
  nodeId: string;
  patch: Partial<DiagramNode>;
};

export type CreateEdgeOperation = BaseOperation & {
  type: 'create_edge';
  edge: DiagramEdge;
};

export type DeleteEdgeOperation = BaseOperation & {
  type: 'delete_edge';
  edgeId: string;
};

export type UpdateEdgeOperation = BaseOperation & {
  type: 'update_edge';
  edgeId: string;
  patch: Partial<DiagramEdge>;
};

export type InsertNodeAfterOperation = BaseOperation & {
  type: 'insert_node_after';
  targetNodeId: string;
  replacedEdgeId: string;
  newNode: DiagramNode;
};

export type DiagramOperation =
  | ApplyLayoutOperation
  | CreateNodeOperation
  | DeleteNodeOperation
  | UpdateNodeOperation
  | CreateEdgeOperation
  | DeleteEdgeOperation
  | UpdateEdgeOperation
  | InsertNodeAfterOperation;
