import type { Diagram, DiagramEdge, DiagramNode } from '../../core/diagram/diagramTypes';
import { resolveTemporaryObjectReference } from '../../core/diagram/temporaryObjectReferences';
import { normalizeText } from '../../utils/text';
import type { EdgeResolveResult, NodeResolveResult } from './simpleTypes';

const EDGE_ALIASES: Record<string, string[]> = {
  失败: ['失败', '否', '异常', '错误'],
  异常: ['失败', '否', '异常', '错误'],
  成功: ['成功', '是', '正常'],
};

export function resolveNode(
  diagram: Diagram,
  query: string,
  recentTargetId?: string,
): NodeResolveResult {
  const reference = resolveTemporaryObjectReference(diagram, query);
  if (reference?.kind === 'node') {
    const node = diagram.nodes.find((item) => item.id === reference.id);
    if (node) return { status: 'found', item: node, confidence: 1 };
  }
  return resolveItems(diagram.nodes, query, recentTargetId, (node) => node.label);
}

export function resolveEdge(
  diagram: Diagram,
  query: string,
  recentTargetId?: string,
): EdgeResolveResult {
  const reference = resolveTemporaryObjectReference(diagram, query);
  if (reference?.kind === 'edge') {
    const edge = diagram.edges.find((item) => item.id === reference.id);
    if (edge) return { status: 'found', item: edge, confidence: 1 };
  }
  const normalized = normalizeText(query);
  const aliasTerms = Object.entries(EDGE_ALIASES).find(([key]) =>
    normalized.includes(key),
  )?.[1];
  if (aliasTerms) {
    const candidates = diagram.edges.filter((edge) =>
      aliasTerms.some((term) => edge.label?.includes(term)),
    );
    if (candidates.length === 1) {
      return { status: 'found', item: candidates[0], confidence: 0.9 };
    }
    if (candidates.length > 1) return { status: 'multiple', candidates };
  }
  return resolveItems(diagram.edges, query, recentTargetId, edgeLabel);
}

export function resolveEdgeByEndpoints(
  diagram: Diagram,
  sourceId: string,
  targetId: string,
): EdgeResolveResult {
  const candidates = diagram.edges.filter(
    (edge) => edge.from === sourceId && edge.to === targetId,
  );
  if (candidates.length === 1)
    return { status: 'found', item: candidates[0], confidence: 1 };
  if (candidates.length > 1) return { status: 'multiple', candidates };
  return { status: 'not_found', suggestions: [] };
}

export function describeEdge(diagram: Diagram, edge: DiagramEdge): string {
  const from = diagram.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
  const to = diagram.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
  return `${from} → ${to}${edge.label ? `（${edge.label}）` : ''}`;
}

function resolveItems<T extends { id: string }>(
  items: T[],
  query: string,
  recentTargetId: string | undefined,
  getLabel: (item: T) => string,
):
  | { status: 'found'; item: T; confidence: number }
  | { status: 'multiple'; candidates: T[] }
  | { status: 'not_found'; suggestions: T[] } {
  const normalized = normalizeText(query);
  const idMatch = items.find((item) => normalizeText(item.id) === normalized);
  if (idMatch) return { status: 'found', item: idMatch, confidence: 1 };

  const exact = items.filter((item) => normalizeText(getLabel(item)) === normalized);
  if (exact.length === 1) return { status: 'found', item: exact[0], confidence: 1 };

  const contains = items.filter((item) => {
    const label = normalizeText(getLabel(item));
    return label.includes(normalized) || normalized.includes(label);
  });
  if (contains.length === 1)
    return { status: 'found', item: contains[0], confidence: 0.92 };
  if (contains.length > 1) {
    const recent = contains.find((item) => item.id === recentTargetId);
    return recent
      ? { status: 'found', item: recent, confidence: 0.88 }
      : { status: 'multiple', candidates: contains };
  }

  const suggestions = items
    .map((item) => ({
      item,
      score: characterOverlap(normalized, normalizeText(getLabel(item))),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => item);
  return { status: 'not_found', suggestions };
}

function edgeLabel(edge: DiagramEdge): string {
  return edge.label ?? `${edge.from}到${edge.to}`;
}

function characterOverlap(first: string, second: string): number {
  const chars = new Set(first);
  return [...new Set(second)].filter((character) => chars.has(character)).length;
}

export function isDiagramNode(item: DiagramNode | DiagramEdge): item is DiagramNode {
  return 'type' in item && 'label' in item && !('from' in item);
}
