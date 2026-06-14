import type { Diagram } from './diagramTypes';

export type TemporaryObjectReference = {
  number: number;
  kind: 'node' | 'edge';
  id: string;
};

export function getTemporaryObjectReferences(
  diagram: Diagram,
): TemporaryObjectReference[] {
  return [
    ...diagram.nodes.map((node, index) => ({
      number: index + 1,
      kind: 'node' as const,
      id: node.id,
    })),
    ...diagram.edges.map((edge, index) => ({
      number: diagram.nodes.length + index + 1,
      kind: 'edge' as const,
      id: edge.id,
    })),
  ];
}

export function getTemporaryObjectNumber(
  diagram: Diagram,
  kind: TemporaryObjectReference['kind'],
  id: string,
): number | undefined {
  return getTemporaryObjectReferences(diagram).find(
    (reference) => reference.kind === kind && reference.id === id,
  )?.number;
}

export function resolveTemporaryObjectReference(
  diagram: Diagram,
  query: string,
): TemporaryObjectReference | undefined {
  const number = extractObjectNumber(query);
  if (number === undefined) return undefined;
  return getTemporaryObjectReferences(diagram).find(
    (reference) => reference.number === number,
  );
}

function extractObjectNumber(query: string): number | undefined {
  const normalized = query.replace(/\s+/g, '');
  const match =
    normalized.match(/(?:物体|对象|编号|物件|元素)([\d零〇一二两三四五六七八九十百]+)/) ??
    normalized.match(
      /([\d零〇一二两三四五六七八九十百]+)号(?:物体|对象|物件|元素|节点|图形|正方形|方形|圆形|圆|矩形|长方形|菱形|椭圆|三角形|六边形|五角星|星形)/,
    ) ??
    normalized.match(/([\d零〇一二两三四五六七八九十百]+)号(?:的)?/);
  if (!match) return undefined;
  const number = /^\d+$/.test(match[1]) ? Number(match[1]) : parseChineseNumber(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function parseChineseNumber(value: string): number {
  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
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
  };
  if (!/[十百]/.test(value)) {
    return [...value].reduce((number, character) => number * 10 + digits[character], 0);
  }

  let total = 0;
  let current = 0;
  for (const character of value) {
    if (character === '百') {
      total += (current || 1) * 100;
      current = 0;
    } else if (character === '十') {
      total += (current || 1) * 10;
      current = 0;
    } else {
      current = digits[character];
    }
  }
  return total + current;
}
