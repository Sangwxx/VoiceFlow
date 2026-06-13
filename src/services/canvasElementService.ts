let canvasElement: HTMLElement | null = null;

export function registerCanvasElement(element: HTMLElement | null): void {
  canvasElement = element;
}

export function getCanvasElement(): HTMLElement | null {
  return canvasElement;
}
