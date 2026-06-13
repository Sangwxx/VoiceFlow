import { create } from 'zustand';

export type CanvasViewStoreState = {
  exceptionPathsHidden: boolean;
  focusedNodeId: string | null;
  setExceptionPathsHidden: (hidden: boolean) => void;
  setFocusedNodeId: (nodeId: string | null) => void;
  reset: () => void;
};

export const useCanvasViewStore = create<CanvasViewStoreState>((set) => ({
  exceptionPathsHidden: false,
  focusedNodeId: null,
  setExceptionPathsHidden: (exceptionPathsHidden) => set({ exceptionPathsHidden }),
  setFocusedNodeId: (focusedNodeId) => set({ focusedNodeId }),
  reset: () => set({ exceptionPathsHidden: false, focusedNodeId: null }),
}));
