import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BrowserExportService,
  safeExportFilename,
  shouldIncludeInExport,
} from '../core/export/exportService';
import { loginFlowDiagram } from '../mock/loginFlowDiagram';
import { registerCanvasElement } from '../services/canvasElementService';
import { registerCanvasViewportApi } from '../services/canvasViewportService';

describe('export service', () => {
  beforeEach(() => {
    registerCanvasElement(document.createElement('div'));
    registerCanvasViewportApi({
      fitView: vi.fn().mockResolvedValue(true),
      zoomIn: vi.fn().mockResolvedValue(true),
      zoomOut: vi.fn().mockResolvedValue(true),
      focusNode: vi.fn().mockResolvedValue(true),
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('sanitizes filenames and exports JSON', async () => {
    const download = vi.fn();
    const service = new BrowserExportService({ download });
    const result = await service.export(
      { ...loginFlowDiagram, title: '登录/流程:*' },
      'json',
    );
    expect(safeExportFilename('登录/流程:*')).toBe('登录-流程-');
    expect(result.filename).toMatch(/\.json$/);
    expect(download).toHaveBeenCalled();
  });

  it('exports the active free drawing document with its own title', async () => {
    const download = vi.fn();
    const service = new BrowserExportService({ download });
    const result = await service.export(
      {
        id: 'free-scene',
        title: '花朵与杯子',
        width: 1000,
        height: 700,
        objects: [],
        updatedAt: new Date().toISOString(),
      },
      'json',
    );

    expect(result.filename).toContain('花朵与杯子');
  });

  it('mounts a browser download link before clicking it', async () => {
    vi.useFakeTimers();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const append = vi.spyOn(document.body, 'appendChild');
    const service = new BrowserExportService();

    await service.export(loginFlowDiagram, 'json');

    expect(append).toHaveBeenCalledWith(expect.any(HTMLAnchorElement));
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    vi.useRealTimers();
  });

  it.each([
    ['svg', 'data:image/svg+xml,test'],
    ['png', 'data:image/png,test'],
  ] as const)('fits and captures %s', async (format, dataUrl) => {
    const download = vi.fn();
    const service = new BrowserExportService({
      download,
      captureSvg: vi.fn().mockResolvedValue(dataUrl),
      capturePng: vi.fn().mockResolvedValue(dataUrl),
      wait: vi.fn().mockResolvedValue(undefined),
    });
    await service.export(loginFlowDiagram, format);
    expect(download).toHaveBeenCalledWith(
      dataUrl,
      expect.stringMatching(new RegExp(`\\.${format}$`)),
    );
  });

  it('excludes temporary voice-reference numbers from image exports', () => {
    const number = document.createElement('span');
    number.dataset.voiceReference = 'true';
    const node = document.createElement('div');

    expect(shouldIncludeInExport(number)).toBe(false);
    expect(shouldIncludeInExport(node)).toBe(true);
    expect(shouldIncludeInExport({} as HTMLElement)).toBe(true);
    expect(JSON.stringify(loginFlowDiagram)).not.toContain('temporaryNumber');
  });
});
