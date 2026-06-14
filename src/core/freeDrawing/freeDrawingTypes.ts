export type FreeDrawingObject =
  | {
      id: string;
      type: 'circle';
      label: string;
      cx: number;
      cy: number;
      radius: number;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      id: string;
      type: 'ellipse';
      label: string;
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
      id: string;
      type: 'rect';
      label: string;
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
      id: string;
      type: 'line';
      label: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth: number;
      lineCap?: 'round' | 'square';
    }
  | {
      id: string;
      type: 'path';
      label: string;
      d: string;
      fill: string;
      stroke?: string;
      strokeWidth?: number;
    };

export type FreeDrawingScene = {
  id: string;
  title: string;
  width: number;
  height: number;
  objects: FreeDrawingObject[];
  updatedAt: string;
};
