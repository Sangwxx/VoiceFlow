import type {
  FreeDrawingObject,
  FreeDrawingScene,
} from '../../core/freeDrawing/freeDrawingTypes';
import { createId } from '../../utils/id';

type UnknownRecord = Record<string, unknown>;

const MAX_OBJECTS = 60;
const PATH_PATTERN = /^[0-9eE.,+\-\sMLHVCSQTAZmlhvcsqtaz]+$/;
const COLOR_PATTERN = /^(?:none|#[0-9a-f]{3}|#[0-9a-f]{6})$/i;

export type FreeDrawingPlan = {
  title: string;
  groupLabel: string;
  objects: FreeDrawingObject[];
};

export function normalizeFreeDrawingPlan(
  input: unknown,
  scene: FreeDrawingScene,
): FreeDrawingPlan {
  const payload = parsePayload(input);
  const rawObjects = Array.isArray(payload.objects) ? payload.objects : [];
  if (!rawObjects.length) throw new Error('AI 未返回可绘制的自由画布图元');
  if (rawObjects.length > MAX_OBJECTS)
    throw new Error(`AI 图元数量不能超过 ${MAX_OBJECTS} 个`);

  const groupLabel = text(payload.groupLabel, 'AI 绘图');
  const groupId = createId('ai-drawing');
  const objects = rawObjects.map((value, index) =>
    normalizeObject(record(value), index, groupId, groupLabel, scene),
  );
  return {
    title: text(payload.title, `自由画布：${groupLabel}`),
    groupLabel,
    objects,
  };
}

function normalizeObject(
  value: UnknownRecord,
  index: number,
  groupId: string,
  groupLabel: string,
  scene: FreeDrawingScene,
): FreeDrawingObject {
  const common = {
    id: `${groupId}-${index + 1}`,
    label: text(value.label, `${groupLabel}部件 ${index + 1}`),
    groupId,
    groupLabel,
  };
  const fill = color(value.fill, '#dbeafe');
  const stroke = color(value.stroke, '#1e3a8a');
  const strokeWidth = number(value.strokeWidth, 3, 0, 30);
  switch (value.type) {
    case 'circle':
      return {
        ...common,
        type: 'circle',
        cx: number(value.cx, scene.width / 2, 0, scene.width),
        cy: number(value.cy, scene.height / 2, 0, scene.height),
        radius: number(value.radius, 60, 1, 300),
        fill,
        stroke,
        strokeWidth,
      };
    case 'ellipse':
      return {
        ...common,
        type: 'ellipse',
        cx: number(value.cx, scene.width / 2, 0, scene.width),
        cy: number(value.cy, scene.height / 2, 0, scene.height),
        rx: number(value.rx, 80, 1, 350),
        ry: number(value.ry, 50, 1, 300),
        rotate: number(value.rotate, 0, -360, 360),
        fill,
        stroke,
        strokeWidth,
      };
    case 'rect':
      return {
        ...common,
        type: 'rect',
        x: number(value.x, 400, 0, scene.width),
        y: number(value.y, 280, 0, scene.height),
        width: number(value.width, 200, 1, scene.width),
        height: number(value.height, 140, 1, scene.height),
        radius: number(value.radius, 0, 0, 300),
        fill,
        stroke,
        strokeWidth,
      };
    case 'line':
      return {
        ...common,
        type: 'line',
        x1: number(value.x1, 400, 0, scene.width),
        y1: number(value.y1, 350, 0, scene.height),
        x2: number(value.x2, 600, 0, scene.width),
        y2: number(value.y2, 350, 0, scene.height),
        stroke,
        strokeWidth: number(value.strokeWidth, 5, 1, 30),
        lineCap: value.lineCap === 'square' ? 'square' : 'round',
      };
    case 'path': {
      const d = text(value.d, '');
      if (!d || d.length > 4000 || !PATH_PATTERN.test(d)) {
        throw new Error('AI 返回了不安全或无效的 SVG 路径');
      }
      return { ...common, type: 'path', d, fill, stroke, strokeWidth };
    }
    default:
      throw new Error(`AI 返回了不支持的自由画布图元类型：“${String(value.type ?? '')}”`);
  }
}

function parsePayload(input: unknown): UnknownRecord {
  if (typeof input !== 'string') return record(input);
  const cleaned = input
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return record(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('AI 输出中没有可执行的 JSON 对象');
    return record(JSON.parse(cleaned.slice(start, end + 1)));
  }
}

function record(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI 输出必须是 JSON 对象');
  }
  return value as UnknownRecord;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 120)
    : fallback;
}

function number(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && COLOR_PATTERN.test(value) ? value : fallback;
}
