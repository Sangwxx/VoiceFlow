export type VoiceRecognitionResult = {
  text: string;
  isFinal: boolean;
};

export type VoiceProviderCallbacks = {
  onResult: (result: VoiceRecognitionResult) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
};

export interface VoiceProvider {
  start(callbacks: VoiceProviderCallbacks): void;
  stop(): void;
  isSupported(): boolean;
}

export type VoiceController = {
  startListening(): void;
  stopListening(): void;
  handleFinalTranscript(text: string): Promise<void>;
  pauseForFeedback(): void;
  resumeAfterFeedback(): void;
};
