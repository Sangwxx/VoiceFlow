import { create } from 'zustand';

import type { DiagramVersion } from './versionStore';
import type { DiagramNode } from '../core/diagram/diagramTypes';

export type PendingVersionClarification = {
  action: 'restore_version' | 'compare_version';
  candidates: DiagramVersion[];
};

export type WorkflowStoreState = {
  pendingVersionClarification: PendingVersionClarification | null;
  pendingFocusClarification: DiagramNode[] | null;
  setPendingVersionClarification: (pending: PendingVersionClarification | null) => void;
  setPendingFocusClarification: (candidates: DiagramNode[] | null) => void;
  clear: () => void;
};

export const useWorkflowStore = create<WorkflowStoreState>((set) => ({
  pendingVersionClarification: null,
  pendingFocusClarification: null,
  setPendingVersionClarification: (pendingVersionClarification) =>
    set({ pendingVersionClarification }),
  setPendingFocusClarification: (pendingFocusClarification) =>
    set({ pendingFocusClarification }),
  clear: () =>
    set({ pendingVersionClarification: null, pendingFocusClarification: null }),
}));
