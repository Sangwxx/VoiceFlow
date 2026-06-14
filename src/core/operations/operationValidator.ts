import { EDGE_TYPES, NODE_TYPES, type Diagram } from '../diagram/diagramTypes';
import { ALIGNMENT_AXES, SPATIAL_RELATIONS } from '../diagram/spatialTypes';
import type { DiagramOperation } from './operationTypes';

export class OperationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationValidationError';
  }
}

export function validateOperation(diagram: Diagram, operation: DiagramOperation): void {
  const nodeIds = new Set(diagram.nodes.map((node) => node.id));
  const edgeIds = new Set(diagram.edges.map((edge) => edge.id));

  switch (operation.type) {
    case 'apply_layout':
      return;
    case 'create_node':
      validateNewNode(
        nodeIds,
        operation.node.id,
        operation.node.label,
        operation.node.type,
      );
      return;
    case 'delete_node':
    case 'update_node':
    case 'move_node':
      requireExisting(nodeIds, operation.nodeId, '节点');
      if (
        operation.type === 'move_node' &&
        (!Number.isFinite(operation.position.x) || !Number.isFinite(operation.position.y))
      ) {
        throw new OperationValidationError('节点位置必须是有效坐标。');
      }
      if (
        operation.type === 'update_node' &&
        operation.patch.id !== undefined &&
        operation.patch.id !== operation.nodeId
      ) {
        throw new OperationValidationError('不允许通过更新操作修改节点 ID。');
      }
      if (
        operation.type === 'update_node' &&
        operation.patch.label !== undefined &&
        !operation.patch.label.trim()
      ) {
        throw new OperationValidationError('节点名称不能为空。');
      }
      if (
        operation.type === 'update_node' &&
        operation.patch.type !== undefined &&
        !NODE_TYPES.includes(operation.patch.type)
      ) {
        throw new OperationValidationError('节点类型不受支持。');
      }
      return;
    case 'set_relative_position':
      requireExisting(nodeIds, operation.nodeId, '节点');
      requireExisting(nodeIds, operation.referenceNodeId, '参考节点');
      if (operation.nodeId === operation.referenceNodeId) {
        throw new OperationValidationError('节点不能相对自身定位。');
      }
      if (!SPATIAL_RELATIONS.includes(operation.relation)) {
        throw new OperationValidationError('相对位置关系不受支持。');
      }
      if (
        operation.gap !== undefined &&
        (!Number.isFinite(operation.gap) || operation.gap < 0)
      ) {
        throw new OperationValidationError('节点间距必须是非负有效数字。');
      }
      return;
    case 'align_nodes':
      if (operation.nodeIds.length < 2) {
        throw new OperationValidationError('对齐操作至少需要两个节点。');
      }
      operation.nodeIds.forEach((id) => requireExisting(nodeIds, id, '节点'));
      if (!ALIGNMENT_AXES.includes(operation.axis)) {
        throw new OperationValidationError('对齐方向不受支持。');
      }
      return;
    case 'create_edge':
      validateNewEdge(
        diagram,
        edgeIds,
        operation.edge.id,
        operation.edge.from,
        operation.edge.to,
      );
      if (
        operation.edge.type !== undefined &&
        !EDGE_TYPES.includes(operation.edge.type)
      ) {
        throw new OperationValidationError('连线类型不受支持。');
      }
      return;
    case 'delete_edge':
    case 'update_edge':
      requireExisting(edgeIds, operation.edgeId, '连线');
      if (
        operation.type === 'update_edge' &&
        (operation.patch.id !== undefined ||
          operation.patch.from !== undefined ||
          operation.patch.to !== undefined)
      ) {
        throw new OperationValidationError('不允许通过样式更新修改连线标识或端点。');
      }
      if (
        operation.type === 'update_edge' &&
        operation.patch.type !== undefined &&
        !EDGE_TYPES.includes(operation.patch.type)
      ) {
        throw new OperationValidationError('连线类型不受支持。');
      }
      return;
    case 'set_edge_endpoints':
      requireExisting(edgeIds, operation.edgeId, '连线');
      requireExisting(nodeIds, operation.from, '连线起点');
      requireExisting(nodeIds, operation.to, '连线终点');
      if (operation.from === operation.to) {
        throw new OperationValidationError('不允许节点连接到自身。');
      }
      if (
        diagram.edges.some(
          (edge) =>
            edge.id !== operation.edgeId &&
            edge.from === operation.from &&
            edge.to === operation.to,
        )
      ) {
        throw new OperationValidationError('相同起点和终点的连线已存在。');
      }
      return;
    case 'insert_node_after':
      requireExisting(nodeIds, operation.targetNodeId, '目标节点');
      requireExisting(edgeIds, operation.replacedEdgeId, '待替换连线');
      validateNewNode(
        nodeIds,
        operation.newNode.id,
        operation.newNode.label,
        operation.newNode.type,
      );
      if (
        diagram.edges.find((edge) => edge.id === operation.replacedEdgeId)?.from !==
        operation.targetNodeId
      ) {
        throw new OperationValidationError('待替换连线并非从目标节点发出。');
      }
  }
}

function validateNewNode(
  nodeIds: Set<string>,
  id: string,
  label: string,
  type: string,
): void {
  if (!id.trim() || !label.trim()) {
    throw new OperationValidationError('节点 ID 和名称不能为空。');
  }
  if (nodeIds.has(id)) throw new OperationValidationError(`节点 ID "${id}" 已存在。`);
  if (!NODE_TYPES.includes(type as (typeof NODE_TYPES)[number])) {
    throw new OperationValidationError('节点类型不受支持。');
  }
}

function validateNewEdge(
  diagram: Diagram,
  edgeIds: Set<string>,
  id: string,
  from: string,
  to: string,
): void {
  if (!id.trim()) throw new OperationValidationError('连线 ID 不能为空。');
  if (edgeIds.has(id)) throw new OperationValidationError(`连线 ID "${id}" 已存在。`);
  requireExisting(new Set(diagram.nodes.map((node) => node.id)), from, '连线起点');
  requireExisting(new Set(diagram.nodes.map((node) => node.id)), to, '连线终点');
  if (from === to) throw new OperationValidationError('不允许节点连接到自身。');
  if (diagram.edges.some((edge) => edge.from === from && edge.to === to)) {
    throw new OperationValidationError('相同起点和终点的连线已存在。');
  }
}

function requireExisting(ids: Set<string>, id: string, label: string): void {
  if (!ids.has(id)) throw new OperationValidationError(`${label} "${id}" 不存在。`);
}
