type FreeDrawingObjectBase = {
  id: string;
  label: string;
  groupId?: string;
  groupLabel?: string;
};

export type FreeDrawingObject = FreeDrawingObjectBase &
  (
    | {
        type: 'circle';
        cx: number;
        cy: number;
        radius: number;
        fill: string;
        stroke?: string;
        strokeWidth?: number;
      }
    | {
        type: 'ellipse';
        cx: number;
        cy: number;
        rx: number;
        ry: number;
        fill: string;
        stroke?: string;
        strokeWidth?: number;
        rotate?: number;
      }
    | {
        type: 'rect';
        x: number;
        y: number;
        width: number;
        height: number;
        radius?: number;
        fill: string;
        stroke?: string;
        strokeWidth?: number;
      }
    | {
        type: 'line';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        stroke: string;
        strokeWidth: number;
        lineCap?: 'round' | 'square';
      }
    | {
        type: 'path';
        d: string;
        fill: string;
        stroke?: string;
        strokeWidth?: number;
      }
  );

export type FreeDrawingScene = {
  id: string;
  title: string;
  width: number;
  height: number;
  objects: FreeDrawingObject[];
  updatedAt: string;
};
