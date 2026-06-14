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
    expect(JSON.stringify(loginFlowDiagram)).not.toContain('temporaryNumber');
  });
});
