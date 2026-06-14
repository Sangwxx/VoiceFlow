import { useEffect } from 'react';

import type { FreeDrawingObject } from '../../core/freeDrawing/freeDrawingTypes';
import { registerCanvasElement } from '../../services/canvasElementService';
import { registerCanvasViewportApi } from '../../services/canvasViewportService';
import { useFreeDrawingStore } from '../../stores/freeDrawingStore';
import styles from './FreeDrawingCanvas.module.css';

export function FreeDrawingCanvas() {
  const scene = useFreeDrawingStore((state) => state.scene);

  useEffect(() => {
    registerCanvasViewportApi({
      fitView: async () => true,
      zoomIn: async () => false,
      zoomOut: async () => false,
      focusNode: async () => false,
    });
  }, []);

  return (
    <div
      ref={registerCanvasElement}
      className={styles.canvas}
      aria-label={`${scene.title}自由画布`}
    >
      <svg
        className={styles.scene}
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        role="img"
        aria-label={scene.title}
      >
        {scene.objects.length ? (
          scene.objects.map(renderObject)
        ) : (
          <text className={styles.emptyText} x="500" y="350">
            试着说：“画一朵粉色的花”或“画一个蓝色杯子”
          </text>
        )}
      </svg>
    </div>
  );
}

function renderObject(object: FreeDrawingObject) {
  const common = {
    'aria-label': object.label,
    fill: object.fill,
    stroke: object.stroke,
    strokeWidth: object.strokeWidth,
  };
  switch (object.type) {
    case 'circle':
      return (
        <circle
          key={object.id}
          {...common}
          cx={object.cx}
          cy={object.cy}
          r={object.radius}
        />
      );
    case 'ellipse':
      return (
        <ellipse
          key={object.id}
          {...common}
          cx={object.cx}
          cy={object.cy}
          rx={object.rx}
          ry={object.ry}
          transform={
            object.rotate
              ? `rotate(${object.rotate} ${object.cx} ${object.cy})`
              : undefined
          }
        />
      );
    case 'rect':
      return (
        <rect
          key={object.id}
          {...common}
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          rx={object.radius}
        />
      );
    case 'line':
      return (
        <line
          key={object.id}
          {...common}
          x1={object.x1}
          y1={object.y1}
          x2={object.x2}
          y2={object.y2}
          strokeLinecap={object.lineCap}
        />
      );
    case 'path':
      return <path key={object.id} {...common} d={object.d} strokeLinecap="round" />;
  }
}
