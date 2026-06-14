import { describe, expect, it } from 'vitest';

import {
  diagramSvgDataUrl,
  serializeDiagramSvg,
} from '../core/export/diagramSvgSerializer';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';

describe('diagram SVG serializer', () => {
  it('creates a standalone diagram SVG with nodes, edges and arrows', () => {
    const svg = serializeDiagramSvg(loginFlowDiagram);

    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('marker-end="url(#arrow-');
    expect(svg).toContain('是否已登录？');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('foreignObject');
  });

  it('creates a decodable professional diagram SVG data URL', () => {
    const dataUrl = diagramSvgDataUrl(loginFlowDiagram);
    const svg = decodeURIComponent(dataUrl.split(',')[1]);

    expect(svg).toContain('用户登录流程');
    expect(svg).toContain('stroke-dasharray="7 5"');
    expect(svg).toContain('进入首页');
  });
});
