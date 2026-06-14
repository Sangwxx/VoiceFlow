export type VoiceRecognitionResult = {
  text: string;
  isFinal: boolean;
};

export type VoiceProviderCallbacks = {
  onResult: (result: VoiceRecognitionResult) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onSilence?: () => void;
};

export interface VoiceProvider {
  start(callbacks: VoiceProviderCallbacks): void;
  stop(): void;
  isSupported(): boolean;
}

export type VoiceController = {
  startListening(): void;
  stopListening(): void;
  handleFinalTranscript(
    text: string,
  ): Promise<import('../commands/fast/fastCommandExecutor').FastCommandExecutionResult>;
  finishUtterance(): Promise<void>;
  pauseForFeedback(): void;
  resumeAfterFeedback(): void;
};
