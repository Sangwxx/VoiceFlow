import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

import type { ReactFlowEdge } from './canvasTypes';
import styles from './NumberedEdge.module.css';

export function NumberedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  data,
}: EdgeProps<ReactFlowEdge>) {
  const fallback = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const routedPoints = data?.routing?.points;
  const path = routedPoints?.length
    ? `M ${routedPoints.map((point) => `${point.x} ${point.y}`).join(' L ')}`
    : fallback[0];
  const midpoint = routedPoints?.length
    ? routedPoints[Math.floor(routedPoints.length / 2)]
    : { x: fallback[1], y: fallback[2] };
  const labelX = midpoint.x;
  const labelY = midpoint.y;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={style}
        label={label}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        labelBgStyle={labelBgStyle}
        labelBgPadding={labelBgPadding}
        labelBgBorderRadius={labelBgBorderRadius}
        labelX={labelX}
        labelY={labelY}
      />
      <EdgeLabelRenderer>
        <span
          className={styles.objectNumber}
          data-voice-reference="true"
          aria-label={`物体 ${data?.temporaryNumber ?? ''}`}
          style={{ left: labelX, top: labelY - 18 }}
        >
          {data?.temporaryNumber}
        </span>
      </EdgeLabelRenderer>
    </>
  );
}
