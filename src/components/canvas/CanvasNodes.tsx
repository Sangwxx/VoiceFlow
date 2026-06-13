import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';

import type { NodeStyle, NodeType } from '../../core/diagram/diagramTypes';
import type { ReactFlowNode } from './canvasTypes';
import styles from './CanvasNodes.module.css';

type VisualNodeProps = NodeProps<ReactFlowNode>;

const TYPE_LABELS: Record<NodeType, string> = {
  start: '起点',
  end: '终点',
  process: '流程',
  decision: '判断',
  database: '数据',
  service: '服务',
  user: '用户',
  external: '外部',
  group: '分组',
};

function toVisualStyle(style: NodeStyle | undefined): CSSProperties {
  if (!style) return {};
  return {
    background: style.background,
    borderColor: style.border,
    color: style.color,
    borderWidth: style.borderWidth,
    borderRadius: style.borderRadius,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
  };
}

function CanvasNode({ data }: VisualNodeProps) {
  const horizontal = data.layoutDirection === 'left_to_right';
  const targetPosition = horizontal ? Position.Left : Position.Top;
  const sourcePosition = horizontal ? Position.Right : Position.Bottom;

  return (
    <div
      className={`${styles.node} ${styles[data.nodeType]}`}
      style={toVisualStyle(data.visualStyle)}
      data-node-type={data.nodeType}
    >
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={false}
        className={styles.handle}
      />
      <span className={styles.kind}>{TYPE_LABELS[data.nodeType]}</span>
      <span className={styles.label}>{data.label}</span>
      <Handle
        type="source"
        position={sourcePosition}
        isConnectable={false}
        className={styles.handle}
      />
    </div>
  );
}

export function StartNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function EndNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function ProcessNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function DecisionNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function DatabaseNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function ServiceNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function UserNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function ExternalNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}

export function GroupNode(props: VisualNodeProps) {
  return <CanvasNode {...props} />;
}
