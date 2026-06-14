import { create } from 'zustand';

import type {
  FreeDrawingObject,
  FreeDrawingScene,
} from '../core/freeDrawing/freeDrawingTypes';

function createEmptyScene(): FreeDrawingScene {
  return {
    id: 'free-drawing-scene',
    title: '自由画布',
    width: 1000,
    height: 700,
    objects: [],
    updatedAt: new Date().toISOString(),
  };
}

type FreeDrawingStore = {
  scene: FreeDrawingScene;
  addObjects: (objects: FreeDrawingObject[], title: string) => void;
  clear: () => void;
  reset: () => void;
};

export const useFreeDrawingStore = create<FreeDrawingStore>((set) => ({
  scene: createEmptyScene(),
  addObjects: (objects, title) =>
    set((state) => ({
      scene: {
        ...state.scene,
        title,
        objects: [...state.scene.objects, ...objects],
        updatedAt: new Date().toISOString(),
      },
    })),
  clear: () =>
    set((state) => ({
      scene: {
        ...state.scene,
        title: '自由画布',
        objects: [],
        updatedAt: new Date().toISOString(),
      },
    })),
  reset: () => set({ scene: createEmptyScene() }),
}));
