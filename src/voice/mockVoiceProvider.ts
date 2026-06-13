import type { VoiceProvider, VoiceProviderCallbacks } from './voiceTypes';

export class MockVoiceProvider implements VoiceProvider {
  private callbacks: VoiceProviderCallbacks | null = null;
  private listening = false;

  isSupported(): boolean {
    return true;
  }

  start(callbacks: VoiceProviderCallbacks): void {
    this.callbacks = callbacks;
    this.listening = true;
    callbacks.onStart?.();
  }

  stop(): void {
    this.listening = false;
    this.callbacks?.onEnd?.();
  }

  emitInterim(text: string): void {
    if (this.listening) this.callbacks?.onResult({ text, isFinal: false });
  }

  emitFinal(text: string): void {
    if (this.listening) this.callbacks?.onResult({ text, isFinal: true });
  }

  emitError(error: Error): void {
    this.callbacks?.onError?.(error);
  }

  emitSilence(): void {
    if (this.listening) this.callbacks?.onSilence?.();
  }
}
