import { afterEach, describe, expect, it, vi } from 'vitest';

import { BrowserSpeechFeedbackService } from '../services/speechFeedbackService';

class FakeUtterance {
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public readonly text: string) {}
}

describe('BrowserSpeechFeedbackService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pauses recognition before speaking and resumes after speech ends', async () => {
    const beforeSpeak = vi.fn();
    const afterSpeak = vi.fn();
    let utterance: FakeUtterance | null = null;
    const speechSynthesis = {
      cancel: vi.fn(),
      speak: vi.fn((value: FakeUtterance) => {
        utterance = value;
      }),
    };

    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: speechSynthesis,
    });

    const service = new BrowserSpeechFeedbackService({ beforeSpeak, afterSpeak });
    const speaking = service.speak('已撤销');

    expect(beforeSpeak).toHaveBeenCalledOnce();
    expect(speechSynthesis.cancel).toHaveBeenCalledOnce();
    expect(speechSynthesis.speak).toHaveBeenCalledOnce();
    expect(utterance).toMatchObject({ text: '已撤销', lang: 'zh-CN' });

    (utterance as FakeUtterance | null)?.onend?.();
    await speaking;
    expect(afterSpeak).toHaveBeenCalledOnce();
  });
});
