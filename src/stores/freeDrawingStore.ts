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
  removeLatestGroupByLabel: (label: string) => boolean;
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
  removeLatestGroupByLabel: (label) => {
    let removed = false;
    set((state) => {
      const target = [...state.scene.objects]
        .reverse()
        .find(
          (object) =>
            object.groupLabel?.includes(label) ||
            (object.groupLabel ? label.includes(object.groupLabel) : false) ||
            object.label.includes(label),
        );
      if (!target) return state;
      const groupId = target.groupId ?? target.id;
      const objects = state.scene.objects.filter(
        (object) => (object.groupId ?? object.id) !== groupId,
      );
      removed = objects.length !== state.scene.objects.length;
      return {
        scene: {
          ...state.scene,
          title: objects.length ? state.scene.title : '自由画布',
          objects,
          updatedAt: new Date().toISOString(),
        },
      };
    });
    return removed;
  },
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
