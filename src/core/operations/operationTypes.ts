import type { DiagramEdge, DiagramNode, LayoutDirection } from '../diagram/diagramTypes';
import type { AlignmentAxis, SpatialRelation } from '../diagram/spatialTypes';

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

export type MoveNodeOperation = BaseOperation & {
  type: 'move_node';
  nodeId: string;
  position: DiagramNode['position'] & {};
};

export type SetRelativePositionOperation = BaseOperation & {
  type: 'set_relative_position';
  nodeId: string;
  referenceNodeId: string;
  relation: SpatialRelation;
  gap?: number;
};

export type AlignNodesOperation = BaseOperation & {
  type: 'align_nodes';
  nodeIds: string[];
  axis: AlignmentAxis;
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

export type SetEdgeEndpointsOperation = BaseOperation & {
  type: 'set_edge_endpoints';
  edgeId: string;
  from: string;
  to: string;
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
  | MoveNodeOperation
  | SetRelativePositionOperation
  | AlignNodesOperation
  | CreateEdgeOperation
  | DeleteEdgeOperation
  | UpdateEdgeOperation
  | SetEdgeEndpointsOperation
  | InsertNodeAfterOperation;
