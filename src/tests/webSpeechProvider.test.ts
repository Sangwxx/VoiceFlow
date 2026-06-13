import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebSpeechProvider } from '../voice/webSpeechProvider';
import type {
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
} from '../voice/webSpeechTypes';

class FakeRecognition implements SpeechRecognitionLike {
  static instance: FakeRecognition;
  lang = '';
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: SpeechRecognitionLike['onerror'] = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());

  constructor() {
    FakeRecognition.instance = this;
  }
}

function fakeWindow(): Window {
  return { SpeechRecognition: FakeRecognition } as unknown as Window;
}

describe('WebSpeechProvider', () => {
  afterEach(() => vi.useRealTimers());

  it('configures Chinese continuous interim recognition and emits results', () => {
    const onResult = vi.fn();
    const provider = new WebSpeechProvider({ getWindow: fakeWindow });

    provider.start({ onResult });

    expect(FakeRecognition.instance).toMatchObject({
      lang: 'zh-CN',
      continuous: true,
      interimResults: true,
    });

    FakeRecognition.instance.onresult?.({
      resultIndex: 0,
      results: {
        length: 2,
        0: { length: 1, isFinal: false, 0: { transcript: '横向' } },
        1: { length: 1, isFinal: true, 0: { transcript: '横向布局' } },
      },
    } as SpeechRecognitionEventLike);

    expect(onResult).toHaveBeenNthCalledWith(1, { text: '横向', isFinal: false });
    expect(onResult).toHaveBeenNthCalledWith(2, {
      text: '横向布局',
      isFinal: true,
    });
  });

  it('restarts after an unexpected end but not after an intentional stop', () => {
    vi.useFakeTimers();
    const provider = new WebSpeechProvider({
      getWindow: fakeWindow,
      restartDelayMs: 10,
    });
    provider.start({ onResult: vi.fn() });

    FakeRecognition.instance.onend?.();
    vi.advanceTimersByTime(10);
    expect(FakeRecognition.instance.start).toHaveBeenCalledTimes(2);

    provider.stop();
    vi.advanceTimersByTime(10);
    expect(FakeRecognition.instance.start).toHaveBeenCalledTimes(2);
  });

  it('does not restart after a fatal permission error', () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const provider = new WebSpeechProvider({
      getWindow: fakeWindow,
      restartDelayMs: 10,
    });
    provider.start({ onResult: vi.fn(), onError });

    FakeRecognition.instance.onerror?.({
      error: 'not-allowed',
    } as SpeechRecognitionErrorEventLike);
    FakeRecognition.instance.onend?.();
    vi.advanceTimersByTime(10);

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('权限被拒绝') }),
    );
    expect(FakeRecognition.instance.start).toHaveBeenCalledTimes(1);
  });
});
