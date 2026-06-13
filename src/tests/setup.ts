import '@testing-library/jest-dom/vitest';

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class DOMMatrixReadOnlyMock {
  m22 = 1;
}

class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string; message: string }) => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;

  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
});

Object.defineProperty(globalThis, 'DOMMatrixReadOnly', {
  value: DOMMatrixReadOnlyMock,
  writable: true,
});

Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: {
    configurable: true,
    get: () => 1000,
  },
  offsetHeight: {
    configurable: true,
    get: () => 700,
  },
});

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: () => undefined,
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: MockSpeechRecognition,
  writable: true,
});
