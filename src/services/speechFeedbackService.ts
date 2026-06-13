export type SpeechFeedbackHooks = {
  beforeSpeak?: () => void;
  afterSpeak?: () => void;
};

export interface SpeechFeedbackService {
  speak(text: string): Promise<void>;
  isSupported(): boolean;
}

export class BrowserSpeechFeedbackService implements SpeechFeedbackService {
  constructor(private readonly hooks: SpeechFeedbackHooks = {}) {}

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    );
  }

  speak(text: string): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();

    return new Promise((resolve) => {
      this.hooks.beforeSpeak?.();
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.08;

      const finish = () => {
        this.hooks.afterSpeak?.();
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }
}
