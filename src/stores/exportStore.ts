import { create } from 'zustand';

import type { ExportFormat, ExportResult } from '../core/export/exportService';

export type ExportStoreState = {
  status: 'idle' | 'exporting' | 'success' | 'error';
  lastResult: ExportResult | null;
  error: string | null;
  setExporting: (format: ExportFormat) => void;
  setSuccess: (result: ExportResult) => void;
  setError: (message: string) => void;
};

export const useExportStore = create<ExportStoreState>((set) => ({
  status: 'idle',
  lastResult: null,
  error: null,
  setExporting: () => set({ status: 'exporting', error: null }),
  setSuccess: (lastResult) => set({ status: 'success', lastResult, error: null }),
  setError: (error) => set({ status: 'error', error }),
}));
