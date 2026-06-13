import { create } from 'zustand';
import type { VoiceTask } from '../voice/voiceTaskSegmenter';

export type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'processing'
  | 'paused'
  | 'speaking'
  | 'error'
  | 'unsupported';

export type CorrectionFeedback = {
  originalText: string;
  correctedText: string;
  confidence: number;
  reason: string;
};

export type VoiceStoreState = {
  status: VoiceStatus;
  interimTranscript: string;
  finalTranscript: string;
  correctedTranscript: string;
  correctionFeedback: CorrectionFeedback | null;
  pendingCorrection: CorrectionFeedback | null;
  error: string | null;
  commandPaused: boolean;
  taskQueue: VoiceTask[];
  setStatus: (status: VoiceStatus) => void;
  setInterimTranscript: (text: string) => void;
  setFinalTranscript: (text: string) => void;
  setCorrectedTranscript: (text: string) => void;
  setCorrectionFeedback: (feedback: CorrectionFeedback | null) => void;
  setPendingCorrection: (correction: CorrectionFeedback | null) => void;
  setError: (error: string | null) => void;
  setCommandPaused: (paused: boolean) => void;
  setTaskQueue: (tasks: VoiceTask[]) => void;
  clearInterimTranscript: () => void;
  reset: () => void;
};

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  status: 'idle',
  interimTranscript: '',
  finalTranscript: '',
  correctedTranscript: '',
  correctionFeedback: null,
  pendingCorrection: null,
  error: null,
  commandPaused: false,
  taskQueue: [],
  setStatus: (status) => set({ status }),
  setInterimTranscript: (interimTranscript) =>
    set({ interimTranscript, status: interimTranscript ? 'recognizing' : 'listening' }),
  setFinalTranscript: (finalTranscript) =>
    set({ finalTranscript, correctedTranscript: '', interimTranscript: '' }),
  setCorrectedTranscript: (correctedTranscript) => set({ correctedTranscript }),
  setCorrectionFeedback: (correctionFeedback) =>
    set({
      correctionFeedback,
      correctedTranscript: correctionFeedback?.correctedText ?? '',
    }),
  setPendingCorrection: (pendingCorrection) => set({ pendingCorrection }),
  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),
  setCommandPaused: (commandPaused) =>
    set({ commandPaused, status: commandPaused ? 'paused' : 'listening' }),
  setTaskQueue: (taskQueue) => set({ taskQueue }),
  clearInterimTranscript: () => set({ interimTranscript: '' }),
  reset: () =>
    set({
      status: 'idle',
      interimTranscript: '',
      finalTranscript: '',
      correctedTranscript: '',
      correctionFeedback: null,
      pendingCorrection: null,
      error: null,
      commandPaused: false,
      taskQueue: [],
    }),
}));
