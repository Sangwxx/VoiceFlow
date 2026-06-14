import { toPng, toSvg } from 'html-to-image';

import { getCanvasElement } from '../../services/canvasElementService';
import { getCanvasViewportApi } from '../../services/canvasViewportService';
import type { Diagram } from '../diagram/diagramTypes';
import type { FreeDrawingScene } from '../freeDrawing/freeDrawingTypes';
import { freeDrawingSvgDataUrl } from './freeDrawingSvgSerializer';

export type ExportFormat = 'json' | 'svg' | 'png';
export type ExportResult = { format: ExportFormat; filename: string; durationMs: number };
export type ExportDocument = Diagram | FreeDrawingScene;

export interface ExportService {
  export(document: ExportDocument, format: ExportFormat): Promise<ExportResult>;
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

export function shouldIncludeInExport(node: HTMLElement): boolean {
  return (
    typeof node.getAttribute !== 'function' ||
    node.getAttribute('data-voice-reference') !== 'true'
  );
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export class BrowserExportService implements ExportService {
  constructor(private readonly dependencies: ExportDependencies = {}) {}

  async export(document: ExportDocument, format: ExportFormat): Promise<ExportResult> {
    const startedAt = performance.now();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `voiceflow-${safeExportFilename(document.title)}-${stamp}.${format}`;
    let url: string;
    if (format === 'json') {
      url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
      );
    } else if (format === 'svg' && isFreeDrawingScene(document)) {
      url = freeDrawingSvgDataUrl(document);
    } else {
      const viewport = getCanvasViewportApi();
      const element = getCanvasElement();
      if (!viewport || !element) throw new Error('画布导出服务尚未就绪');
      await viewport.fitView();
      await (
        this.dependencies.wait ??
        ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
      )(250);
      const options = {
        backgroundColor: '#ffffff',
        cacheBust: true,
        filter: shouldIncludeInExport,
      };
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
    if (format === 'json') {
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }
    return { format, filename, durationMs: Math.round(performance.now() - startedAt) };
  }
}

function isFreeDrawingScene(document: ExportDocument): document is FreeDrawingScene {
  return 'objects' in document && 'width' in document && 'height' in document;
}
