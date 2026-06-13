import type { VoiceProvider, VoiceProviderCallbacks } from './voiceTypes';
import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionEventLike,
} from './webSpeechTypes';

export type WebSpeechProviderOptions = {
  restartDelayMs?: number;
  noResultTimeoutMs?: number;
  getWindow?: () => Window | undefined;
};

const SILENCE_TIMEOUT_MS = 3000;

export class WebSpeechProvider implements VoiceProvider {
  private recognition: ReturnType<SpeechRecognitionConstructor> | null = null;
  private callbacks: VoiceProviderCallbacks | null = null;
  private intentionallyStopped = true;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly restartDelayMs: number;
  private readonly noResultTimeoutMs: number;
  private readonly getWindow: () => Window | undefined;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private noResultTimer: ReturnType<typeof setTimeout> | null = null;
  private hasReceivedSpeech = false;

  constructor(options: WebSpeechProviderOptions = {}) {
    this.restartDelayMs = options.restartDelayMs ?? 250;
    this.noResultTimeoutMs = options.noResultTimeoutMs ?? 12_000;
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
    this.clearNoResultTimer();

    if (!this.isSupported()) {
      callbacks.onError?.(new Error('当前浏览器不支持 Web Speech API'));
      return;
    }

    void this.startAfterMicrophoneCheck();
  }

  stop(): void {
    this.intentionallyStopped = true;
    this.clearRestartTimer();
    this.clearSilenceTimer();
    this.clearNoResultTimer();
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
    recognition.onstart = () => {
      this.callbacks?.onStart?.();
      this.resetNoResultTimer();
    };
    recognition.onend = () => {
      this.clearNoResultTimer();
      this.callbacks?.onEnd?.();
      if (!this.intentionallyStopped) this.scheduleRestart();
    };
    recognition.onerror = (event) => {
      const error = new Error(event.message || speechErrorMessage(event.error));
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        this.intentionallyStopped = true;
        this.clearRestartTimer();
      }
      this.clearNoResultTimer();
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
      this.clearNoResultTimer();
      this.resetSilenceTimer();
    }
  }

  private async startAfterMicrophoneCheck(): Promise<void> {
    const browserWindow = this.getWindow();
    const getUserMedia = browserWindow?.navigator?.mediaDevices?.getUserMedia;
    if (!getUserMedia) {
      this.startRecognition();
      return;
    }
    try {
      const stream = await getUserMedia.call(browserWindow.navigator.mediaDevices, {
        audio: true,
      });
      stream.getTracks().forEach((track) => track.stop());
      if (this.intentionallyStopped) return;
      this.startRecognition();
    } catch (error) {
      this.intentionallyStopped = true;
      const name = error instanceof DOMException ? error.name : '';
      const message =
        name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请点击地址栏左侧权限图标并允许麦克风。'
          : name === 'NotFoundError'
            ? '未检测到可用麦克风，请检查 Windows 输入设备。'
            : error instanceof Error
              ? error.message
              : String(error);
      this.callbacks?.onError?.(new Error(message));
    }
  }

  private startRecognition(): void {
    if (!this.recognition) this.recognition = this.createRecognition();
    try {
      this.recognition.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes('already started')) {
        this.callbacks?.onError?.(new Error(message));
      }
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

  private resetNoResultTimer(): void {
    this.clearNoResultTimer();
    this.noResultTimer = setTimeout(() => {
      if (!this.callbacks || this.hasReceivedSpeech) return;
      this.intentionallyStopped = true;
      this.recognition?.stop();
      this.callbacks.onError?.(
        new Error(
          '麦克风已启动，但 12 秒内没有识别到文字。请检查浏览器麦克风权限、Windows 默认输入设备和网络连接。',
        ),
      );
    }, this.noResultTimeoutMs);
  }

  private clearNoResultTimer(): void {
    if (this.noResultTimer) clearTimeout(this.noResultTimer);
    this.noResultTimer = null;
  }
}

function speechErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许访问。',
    'audio-capture': '未检测到可用麦克风。',
    network: '语音识别网络连接失败。',
    'no-speech': '没有听清，请再说一遍。',
    'service-not-allowed': '浏览器语音识别服务不可用，请检查网络或更换 Edge/Chrome。',
    'language-not-supported': '浏览器语音识别服务不支持中文。',
  };
  return messages[error] ?? `语音识别失败：${error}`;
}
