import type { VoiceProvider, VoiceProviderCallbacks } from './voiceTypes';
import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionEventLike,
} from './webSpeechTypes';

export type WebSpeechProviderOptions = {
  restartDelayMs?: number;
  getWindow?: () => Window | undefined;
};

const SILENCE_TIMEOUT_MS = 3000;

export class WebSpeechProvider implements VoiceProvider {
  private recognition: ReturnType<SpeechRecognitionConstructor> | null = null;
  private callbacks: VoiceProviderCallbacks | null = null;
  private intentionallyStopped = true;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly restartDelayMs: number;
  private readonly getWindow: () => Window | undefined;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private hasReceivedSpeech = false;

  constructor(options: WebSpeechProviderOptions = {}) {
    this.restartDelayMs = options.restartDelayMs ?? 250;
    this.getWindow =
      options.getWindow ?? (() => (typeof window === 'undefined' ? undefined : window));
  }

  isSupported(): boolean {
    return this.getConstructor() !== undefined;
  }

  start(callbacks: VoiceProviderCallbacks): void {
    this.callbacks = callbacks;
    this.intentionallyStopped = false;
    this.hasReceivedSpeech = false;
    this.clearRestartTimer();
    this.clearSilenceTimer();

    if (!this.isSupported()) {
      callbacks.onError?.(new Error('当前浏览器不支持 Web Speech API'));
      return;
    }

    if (!this.recognition) this.recognition = this.createRecognition();

    try {
      this.recognition.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes('already started')) {
        callbacks.onError?.(new Error(message));
      }
    }
  }

  stop(): void {
    this.intentionallyStopped = true;
    this.clearRestartTimer();
    this.clearSilenceTimer();
    try {
      this.recognition?.stop();
    } catch {
      // Some browsers throw when stop is called before recognition starts.
    }
  }

  private getConstructor(): SpeechRecognitionConstructor | undefined {
    const browserWindow = this.getWindow();
    return browserWindow?.SpeechRecognition ?? browserWindow?.webkitSpeechRecognition;
  }

  private createRecognition() {
    const Recognition = this.getConstructor();
    if (!Recognition) throw new Error('当前浏览器不支持 Web Speech API');

    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => this.callbacks?.onStart?.();
    recognition.onend = () => {
      this.callbacks?.onEnd?.();
      if (!this.intentionallyStopped) this.scheduleRestart();
    };
    recognition.onerror = (event) => {
      const error = new Error(event.message || speechErrorMessage(event.error));
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        this.intentionallyStopped = true;
        this.clearRestartTimer();
      }
      this.callbacks?.onError?.(error);
    };
    recognition.onresult = (event) => this.handleResult(event);
    return recognition;
  }

  private handleResult(event: SpeechRecognitionEventLike): void {
    let foundText = false;
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0]?.transcript?.trim();
      if (text) {
        foundText = true;
        this.callbacks?.onResult({ text, isFinal: result.isFinal });
      }
    }
    if (foundText) {
      this.hasReceivedSpeech = true;
      this.resetSilenceTimer();
    }
  }

  private scheduleRestart(): void {
    this.clearRestartTimer();
    this.restartTimer = setTimeout(() => {
      if (this.callbacks && !this.intentionallyStopped) this.start(this.callbacks);
    }, this.restartDelayMs);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.callbacks && this.hasReceivedSpeech) {
        this.intentionallyStopped = true;
        this.clearRestartTimer();
        this.recognition?.stop();
        this.callbacks.onSilence?.();
      }
    }, SILENCE_TIMEOUT_MS);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}

function speechErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许访问。',
    'audio-capture': '未检测到可用麦克风。',
    network: '语音识别网络连接失败。',
    'no-speech': '没有听清，请再说一遍。',
  };
  return messages[error] ?? `语音识别失败：${error}`;
}
