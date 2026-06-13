import { toPng, toSvg } from 'html-to-image';

import { getCanvasElement } from '../../services/canvasElementService';
import { getCanvasViewportApi } from '../../services/canvasViewportService';
import type { Diagram } from '../diagram/diagramTypes';

export type ExportFormat = 'json' | 'svg' | 'png';
export type ExportResult = { format: ExportFormat; filename: string; durationMs: number };

export interface ExportService {
  export(diagram: Diagram, format: ExportFormat): Promise<ExportResult>;
}

export type ExportDependencies = {
  download?: (url: string, filename: string) => void;
  captureSvg?: (element: HTMLElement) => Promise<string>;
  capturePng?: (element: HTMLElement) => Promise<string>;
  wait?: (milliseconds: number) => Promise<void>;
};

export function safeExportFilename(title: string): string {
  return (
    title
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-') || 'diagram'
  );
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

export class BrowserExportService implements ExportService {
  constructor(private readonly dependencies: ExportDependencies = {}) {}

  async export(diagram: Diagram, format: ExportFormat): Promise<ExportResult> {
    const startedAt = performance.now();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `voiceflow-${safeExportFilename(diagram.title)}-${stamp}.${format}`;
    let url: string;
    if (format === 'json') {
      url = URL.createObjectURL(
        new Blob([JSON.stringify(diagram, null, 2)], { type: 'application/json' }),
      );
    } else {
      const viewport = getCanvasViewportApi();
      const element = getCanvasElement();
      if (!viewport || !element) throw new Error('画布导出服务尚未就绪');
      await viewport.fitView();
      await (
        this.dependencies.wait ??
        ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
      )(250);
      const options = { backgroundColor: '#ffffff', cacheBust: true };
      url =
        format === 'svg'
          ? await (this.dependencies.captureSvg ?? ((node) => toSvg(node, options)))(
              element,
            )
          : await (this.dependencies.capturePng ?? ((node) => toPng(node, options)))(
              element,
            );
    }
    (this.dependencies.download ?? triggerDownload)(url, filename);
    if (format === 'json') URL.revokeObjectURL(url);
    return { format, filename, durationMs: Math.round(performance.now() - startedAt) };
  }
}
