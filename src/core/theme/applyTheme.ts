import type { Diagram, ThemeName } from '../diagram/diagramTypes';
import { cloneDiagram } from '../diagram/diagramUtils';
import { THEMES } from './themes';

export function applyTheme(
  diagram: Diagram,
  themeName: ThemeName,
  options: { preserveOverrides?: boolean } = { preserveOverrides: true },
): Diagram {
  const next = cloneDiagram(diagram);
  const theme = THEMES[themeName];
  const preserve = options.preserveOverrides ?? true;
  next.theme.name = themeName;
  next.nodes = next.nodes.map((node) => ({
    ...node,
    style: preserve
      ? { ...theme.nodeStyles[node.type], ...node.style }
      : { ...theme.nodeStyles[node.type] },
  }));
  next.edges = next.edges.map((edge) => ({
    ...edge,
    style: preserve ? { ...theme.edgeStyle, ...edge.style } : { ...theme.edgeStyle },
  }));
  return next;
}
