export const DIAGRAM_TYPES = [
  'flowchart',
  'architecture',
  'organization',
  'dataflow',
  'usecase',
  'mindmap',
  'framework',
  'table',
  'generic',
] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export const NODE_TYPES = [
  'start',
  'end',
  'process',
  'decision',
  'database',
  'service',
  'user',
  'external',
  'group',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const LAYOUT_DIRECTIONS = ['top_down', 'left_to_right'] as const;
export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number];

export const THEME_NAMES = [
  'default',
  'business_blue',
  'report_clean',
  'tech_dark',
] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const EDGE_TYPES = ['solid', 'dashed', 'highlight', 'weak'] as const;
export type DiagramEdgeType = (typeof EDGE_TYPES)[number];

export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type NodeStyle = {
  background?: string;
  border?: string;
  color?: string;
  borderWidth?: number;
  borderRadius?: number;
  fontSize?: number;
  fontWeight?: number | string;
  clipPath?: string;
};

export type EdgeStyle = {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  color?: string;
};

export type DiagramNode = {
  id: string;
  label: string;
  type: NodeType;
  position?: Position;
  size?: Size;
  style?: NodeStyle;
  locked?: boolean;
  data?: Record<string, unknown>;
};

export type DiagramEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: DiagramEdgeType;
  style?: EdgeStyle;
  locked?: boolean;
  routing?: EdgeRouting;
};

export type EdgeSide = 'top' | 'right' | 'bottom' | 'left';

export type EdgeRouting = {
  sourceSide: EdgeSide;
  targetSide: EdgeSide;
  points: Position[];
  kind: 'forward' | 'branch' | 'back';
};

export type DiagramGroup = {
  id: string;
  label: string;
  nodeIds: string[];
  style?: NodeStyle;
};

export type DiagramLayout = {
  direction: LayoutDirection;
  spacingX: number;
  spacingY: number;
  autoLayout: boolean;
};

export type DiagramTheme = {
  name: ThemeName;
};

export type DiagramMetadata = {
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type Diagram = {
  id: string;
  title: string;
  diagramType: DiagramType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
  layout: DiagramLayout;
  theme: DiagramTheme;
  metadata: DiagramMetadata;
};
