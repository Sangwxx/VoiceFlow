import type { NodeStyle } from '../../core/diagram/diagramTypes';
import { normalizeText } from '../../utils/text';
import type { SimpleOperationDraft } from './simpleTypes';

const SHAPES = [
  '正方形',
  '方形',
  '圆形',
  '圆',
  '矩形',
  '长方形',
  '菱形',
  '椭圆',
  '三角形',
  '六边形',
  '五角星',
  '星形',
] as const;

const COLORS: Record<string, NodeStyle> = {
  红色: { background: '#fee2e2', border: '#ef4444', color: '#991b1b' },
  蓝色: { background: '#dbeafe', border: '#3b82f6', color: '#1e3a8a' },
  绿色: { background: '#dcfce7', border: '#22c55e', color: '#166534' },
  黄色: { background: '#fef9c3', border: '#eab308', color: '#854d0e' },
  灰色: { background: '#f1f5f9', border: '#94a3b8', color: '#334155' },
  紫色: { background: '#f3e8ff', border: '#a855f7', color: '#6b21a8' },
  橙色: { background: '#ffedd5', border: '#f97316', color: '#9a3412' },
};

const COUNTS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

export function matchGenericDrawingActions(text: string): SimpleOperationDraft[] {
  const normalized = normalizeText(text);
  if (!/^(?:画出|画|绘制出|绘制|创建|生成|添加|加|放置)/.test(normalized)) return [];
  const content = normalized.replace(
    /^(?:画出|画|绘制出|绘制|创建|生成|添加|加|放置)/,
    '',
  );
  const pattern = new RegExp(
    `([一二两三四五六七八九十\\d]*)(?:个|张|颗|只)?(红色|蓝色|绿色|黄色|灰色|紫色|橙色)?(${SHAPES.join('|')})`,
    'g',
  );
  const seenShapes = new Set<string>();
  const matches = [...content.matchAll(pattern)].filter((match) => {
    const after = content.slice((match.index ?? 0) + match[0].length);
    const isPlacementReference =
      seenShapes.has(match[3]) &&
      /^(?:在|放在|位于)?(?:最左边|最左侧|左边|左侧|最右边|最右侧|右边|右侧|最上方|最上面|上方|上边|顶部|最下方|最下面|下方|下边|底部|中间|中央|中心)/.test(
        after,
      );
    seenShapes.add(match[3]);
    return !isPlacementReference;
  });
  return matches.flatMap((match) => {
    const placement = parseShapePlacement(content, match[3]);
    return Array.from({ length: parseCount(match[1]) }, () =>
      createShapeDraft(match[3], match[2], placement),
    );
  });
}

function createShapeDraft(
  shape: string,
  color?: string,
  placement?: Extract<SimpleOperationDraft, { intent: 'create_node' }>['placement'],
): SimpleOperationDraft {
  const square = shape === '正方形' || shape === '方形';
  const circle = shape === '圆形' || shape === '圆';
  const diamond = shape === '菱形';
  const ellipse = shape === '椭圆';
  const triangle = shape === '三角形';
  const hexagon = shape === '六边形';
  const star = shape === '五角星' || shape === '星形';
  const colorStyle = color ? COLORS[color] : undefined;
  return {
    intent: 'create_node',
    label: circle
      ? '圆形'
      : square
        ? '正方形'
        : diamond
          ? '菱形'
          : ellipse
            ? '椭圆'
            : triangle
              ? '三角形'
              : hexagon
                ? '六边形'
                : star
                  ? '五角星'
                  : '矩形',
    nodeType: diamond ? 'decision' : ellipse ? 'start' : 'process',
    size:
      circle || square || diamond || triangle || hexagon || star
        ? { width: 150, height: 150 }
        : { width: 220, height: 120 },
    style: {
      background: colorStyle?.background ?? '#dbeafe',
      border: colorStyle?.border ?? '#3b82f6',
      borderWidth: 2,
      borderRadius: circle || ellipse ? 999 : square ? 0 : 8,
      color: colorStyle?.color ?? '#1e3a5f',
      clipPath: triangle
        ? 'polygon(50% 0, 100% 100%, 0 100%)'
        : hexagon
          ? 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)'
          : star
            ? 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 70%, 21% 92%, 32% 57%, 2% 35%, 39% 35%)'
            : undefined,
    },
    placement,
  };
}

function parseShapePlacement(
  text: string,
  shape: string,
): Extract<SimpleOperationDraft, { intent: 'create_node' }>['placement'] {
  const escapedShape = shape.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(
    new RegExp(
      `${escapedShape}(?:在|放在|位于)?(最左边|最左侧|左边|左侧|最右边|最右侧|右边|右侧|最上方|最上面|上方|上边|顶部|最下方|最下面|下方|下边|底部|中间|中央|中心)`,
    ),
  );
  if (!match) return undefined;
  const placementText = match[1];
  if (/左边|左侧|最左/.test(placementText)) return 'left';
  if (/右边|右侧|最右/.test(placementText)) return 'right';
  if (/上边|上方|顶部|最上/.test(placementText)) return 'top';
  if (/下边|下方|底部|最下/.test(placementText)) return 'bottom';
  if (/中间|中央|中心/.test(placementText)) return 'center';
  return undefined;
}

function parseCount(value: string): number {
  if (!value) return 1;
  const numeric = Number(value);
  if (Number.isInteger(numeric)) return Math.min(Math.max(numeric, 1), 20);
  return COUNTS[value] ?? 1;
}
