import type { EdgeStyle, NodeStyle, NodeType, ThemeName } from '../diagram/diagramTypes';

export type ThemePreset = {
  name: ThemeName;
  nodeStyles: Record<NodeType, NodeStyle>;
  edgeStyle: EdgeStyle;
  canvasBackground: string;
};

const nodeTypes: NodeType[] = [
  'start',
  'end',
  'process',
  'decision',
  'database',
  'service',
  'user',
  'external',
  'group',
];

function uniform(style: NodeStyle): Record<NodeType, NodeStyle> {
  return Object.fromEntries(nodeTypes.map((type) => [type, { ...style }])) as Record<
    NodeType,
    NodeStyle
  >;
}

export const THEMES: Record<ThemeName, ThemePreset> = {
  default: {
    name: 'default',
    nodeStyles: uniform({ background: '#ffffff', border: '#94a3b8', color: '#334155' }),
    edgeStyle: { stroke: '#718096', strokeWidth: 2 },
    canvasBackground: '#fbfdff',
  },
  business_blue: {
    name: 'business_blue',
    nodeStyles: uniform({ background: '#eff6ff', border: '#3b82f6', color: '#1e3a8a' }),
    edgeStyle: { stroke: '#3971c7', strokeWidth: 2 },
    canvasBackground: '#f7faff',
  },
  report_clean: {
    name: 'report_clean',
    nodeStyles: uniform({
      background: '#ffffff',
      border: '#49698f',
      color: '#23364d',
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 700,
    }),
    edgeStyle: { stroke: '#6e829a', strokeWidth: 2 },
    canvasBackground: '#ffffff',
  },
  tech_dark: {
    name: 'tech_dark',
    nodeStyles: uniform({ background: '#172033', border: '#60a5fa', color: '#e2e8f0' }),
    edgeStyle: { stroke: '#7da2d8', strokeWidth: 2 },
    canvasBackground: '#101827',
  },
};
