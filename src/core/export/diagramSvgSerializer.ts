import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  Position,
} from '../diagram/diagramTypes';
import { getNodeSize } from '../diagram/diagramUtils';
import { defaultLayoutEngine } from '../layout/layoutEngine';

const PADDING = 60;

const NODE_PRESETS = {
  start: { fill: '#dff8ed', stroke: '#68b99c', color: '#18634b' },
  end: { fill: '#edf1f6', stroke: '#9caec5', color: '#40516a' },
  process: { fill: '#ffffff', stroke: '#b9c6d8', color: '#213147' },
  decision: { fill: '#fff2c9', stroke: '#d9ad43', color: '#72520b' },
  database: { fill: '#e6effd', stroke: '#8ba8d6', color: '#244f85' },
  service: { fill: '#e7f1ff', stroke: '#72a7e8', color: '#24568f' },
  user: { fill: '#eee8ff', stroke: '#a48ae3', color: '#553994' },
  external: { fill: '#f2fafb', stroke: '#7fa6b5', color: '#2f6571' },
  group: { fill: '#f1f5f9', stroke: '#94a3b8', color: '#475569' },
} as const;

const TYPE_LABELS: Record<DiagramNode['type'], string> = {
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

export function serializeDiagramSvg(source: Diagram): string {
  const diagram = defaultLayoutEngine.layout(source);
  const bounds = diagramBounds(diagram);
  const width = Math.max(320, bounds.maxX - bounds.minX + PADDING * 2);
  const height = Math.max(240, bounds.maxY - bounds.minY + PADDING * 2);
  const offset = { x: PADDING - bounds.minX, y: PADDING - bounds.minY };
  const groups = (diagram.groups ?? []).map((group) =>
    serializeGroup(diagram, group.nodeIds, group.label, offset),
  );
  const edges = diagram.edges.map((edge) => serializeEdge(edge, offset));
  const nodes = diagram.nodes.map((node) => serializeNode(node, offset));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(diagram.title)}">`,
    '  <defs>',
    '    <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#718096"/></marker>',
    '    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"/></marker>',
    '    <marker id="arrow-weak" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#aab5c5"/></marker>',
    '  </defs>',
    '  <rect width="100%" height="100%" fill="#ffffff"/>',
    ...groups.map((item) => `  ${item}`),
    ...edges.map((item) => `  ${item}`),
    ...nodes.map((item) => `  ${item}`),
    '</svg>',
  ].join('\n');
}

export function diagramSvgDataUrl(diagram: Diagram): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializeDiagramSvg(diagram))}`;
}

function serializeNode(node: DiagramNode, offset: Position): string {
  const position = node.position!;
  const size = getNodeSize(node);
  const x = position.x + offset.x;
  const y = position.y + offset.y;
  const preset = NODE_PRESETS[node.type];
  const fill = node.style?.background ?? preset.fill;
  const stroke = node.style?.border ?? preset.stroke;
  const color = node.style?.color ?? preset.color;
  const borderWidth = node.style?.borderWidth ?? 1.5;
  const shape = serializeNodeShape(
    node,
    x,
    y,
    size.width,
    size.height,
    fill,
    stroke,
    borderWidth,
  );
  const centerX = x + size.width / 2;
  const centerY = y + size.height / 2;
  const kindY = centerY - 8;
  const labelY = centerY + 14;
  return [
    `<g aria-label="${escapeXml(node.label)}">`,
    shape,
    `<text x="${centerX}" y="${kindY}" text-anchor="middle" fill="#73849b" font-family="Arial, sans-serif" font-size="10" font-weight="700">${TYPE_LABELS[node.type]}</text>`,
    `<text x="${centerX}" y="${labelY}" text-anchor="middle" fill="${escapeXml(color)}" font-family="Arial, sans-serif" font-size="${node.style?.fontSize ?? 15}" font-weight="${node.style?.fontWeight ?? 700}">${escapeXml(node.label)}</text>`,
    '</g>',
  ].join('');
}

function serializeNodeShape(
  node: DiagramNode,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
): string {
  const common = `fill="${escapeXml(fill)}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}"`;
  if (node.type === 'decision') {
    return `<polygon ${common} points="${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}"/>`;
  }
  if (node.type === 'database') {
    return `<path ${common} d="M ${x} ${y + 14} A ${width / 2} 14 0 0 1 ${x + width} ${y + 14} L ${x + width} ${y + height - 14} A ${width / 2} 14 0 0 1 ${x} ${y + height - 14} Z M ${x} ${y + 14} A ${width / 2} 14 0 0 0 ${x + width} ${y + 14}"/>`;
  }
  const radius =
    node.style?.borderRadius ??
    (node.type === 'start' || node.type === 'end' ? height / 2 : 14);
  const dash =
    node.type === 'external' || node.type === 'group' ? ' stroke-dasharray="7 5"' : '';
  return `<rect ${common}${dash} x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/>`;
}

function serializeEdge(edge: DiagramEdge, offset: Position): string {
  const points = edge.routing?.points ?? [];
  if (points.length < 2) return '';
  const preset = edgePreset(edge);
  const shifted = points.map((point) => ({
    x: point.x + offset.x,
    y: point.y + offset.y,
  }));
  const path = `M ${shifted.map((point) => `${point.x} ${point.y}`).join(' L ')}`;
  const midpoint = shifted[Math.floor(shifted.length / 2)];
  const label = edge.label
    ? `<text x="${midpoint.x}" y="${midpoint.y - 7}" text-anchor="middle" fill="${escapeXml(edge.style?.color ?? '#40516a')}" font-family="Arial, sans-serif" font-size="12" font-weight="700">${escapeXml(edge.label)}</text>`
    : '';
  return `<g aria-label="${escapeXml(edge.label ?? `${edge.from} 到 ${edge.to}`)}"><path d="${path}" fill="none" stroke="${preset.stroke}" stroke-width="${preset.width}"${preset.dash ? ` stroke-dasharray="${preset.dash}"` : ''} marker-end="url(#${preset.marker})"/>${label}</g>`;
}

function edgePreset(edge: DiagramEdge): {
  stroke: string;
  width: number;
  dash?: string;
  marker: string;
} {
  const type = edge.type ?? 'solid';
  const defaults = {
    solid: { stroke: '#718096', width: 2, marker: 'arrow-gray' },
    dashed: { stroke: '#718096', width: 2, dash: '7 5', marker: 'arrow-gray' },
    highlight: { stroke: '#2563eb', width: 3, marker: 'arrow-blue' },
    weak: { stroke: '#aab5c5', width: 1.5, dash: '6 5', marker: 'arrow-weak' },
  }[type];
  return {
    ...defaults,
    stroke: edge.style?.stroke ?? defaults.stroke,
    width: edge.style?.strokeWidth ?? defaults.width,
    dash: edge.style?.strokeDasharray ?? defaults.dash,
  };
}

function serializeGroup(
  diagram: Diagram,
  nodeIds: string[],
  label: string,
  offset: Position,
): string {
  const nodes = diagram.nodes.filter((node) => nodeIds.includes(node.id));
  if (!nodes.length) return '';
  const bounds = nodeBounds(nodes);
  const x = bounds.minX + offset.x - 24;
  const y = bounds.minY + offset.y - 34;
  const width = bounds.maxX - bounds.minX + 48;
  const height = bounds.maxY - bounds.minY + 58;
  return `<g aria-label="${escapeXml(label)}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8 6"/><text x="${x + 16}" y="${y + 22}" fill="#475569" font-family="Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(label)}</text></g>`;
}

function diagramBounds(diagram: Diagram) {
  const nodes = nodeBounds(diagram.nodes);
  const points = diagram.edges.flatMap((edge) => edge.routing?.points ?? []);
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    nodes,
  );
}

function nodeBounds(nodes: DiagramNode[]) {
  return nodes.reduce(
    (bounds, node) => {
      const position = node.position!;
      const size = getNodeSize(node);
      return {
        minX: Math.min(bounds.minX, position.x),
        minY: Math.min(bounds.minY, position.y),
        maxX: Math.max(bounds.maxX, position.x + size.width),
        maxY: Math.max(bounds.maxY, position.y + size.height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
