import type { CanvasViewportApi } from '../components/canvas/FlowRenderer';

let viewportApi: CanvasViewportApi | null = null;

export function registerCanvasViewportApi(api: CanvasViewportApi | null): void {
  viewportApi = api;
}

export function getCanvasViewportApi(): CanvasViewportApi | null {
  return viewportApi;
}
