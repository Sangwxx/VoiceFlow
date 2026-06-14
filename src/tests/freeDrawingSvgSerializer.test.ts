import { describe, expect, it } from 'vitest';

import {
  freeDrawingSvgDataUrl,
  serializeFreeDrawingSvg,
} from '../core/export/freeDrawingSvgSerializer';
import type { FreeDrawingScene } from '../core/freeDrawing/freeDrawingTypes';

const scene: FreeDrawingScene = {
  id: 'free-scene',
  title: '杯子 & 花朵',
  width: 1000,
  height: 700,
  updatedAt: new Date().toISOString(),
  objects: [
    {
      id: 'cup-body',
      type: 'path',
      label: '杯身',
      d: 'M 300 200 L 400 200 L 380 400 Z',
      fill: '#60a5fa',
      stroke: '#1e3a8a',
      strokeWidth: 5,
    },
    {
      id: 'flower-center',
      type: 'circle',
      label: '花心',
      cx: 600,
      cy: 300,
      radius: 50,
      fill: '#facc15',
    },
  ],
};

describe('free drawing SVG serializer', () => {
  it('creates a standalone SVG without foreignObject', () => {
    const svg = serializeFreeDrawingSvg(scene);

    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('<path');
    expect(svg).toContain('<circle');
    expect(svg).toContain('aria-label="杯子 &amp; 花朵"');
    expect(svg).not.toContain('foreignObject');
  });

  it('creates a decodable SVG data URL', () => {
    const dataUrl = freeDrawingSvgDataUrl(scene);
    const svg = decodeURIComponent(dataUrl.split(',')[1]);

    expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(svg).toContain('<circle');
    expect(svg).toContain('fill="#facc15"');
  });
});
