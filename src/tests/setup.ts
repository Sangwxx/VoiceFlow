import '@testing-library/jest-dom/vitest';

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class DOMMatrixReadOnlyMock {
  m22 = 1;
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
