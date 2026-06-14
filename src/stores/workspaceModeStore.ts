import { create } from 'zustand';

export type WorkspaceMode = 'diagram' | 'free_drawing';

type WorkspaceModeStore = {
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
};

export const useWorkspaceModeStore = create<WorkspaceModeStore>((set) => ({
  mode: 'diagram',
  setMode: (mode) => set({ mode }),
}));
