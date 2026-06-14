import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFreeDrawingExecutor } from '../commands/freeDrawing/freeDrawingExecutor';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useFreeDrawingStore } from '../stores/freeDrawingStore';

const feedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

describe('freeDrawingExecutor', () => {
  beforeEach(() => useFreeDrawingStore.getState().reset());

  it('draws a flower from editable SVG parts', () => {
    const result = createFreeDrawingExecutor(feedback).execute('画一朵粉色的花');
    const scene = useFreeDrawingStore.getState().scene;

    expect(result).toMatchObject({ status: 'success' });
    expect(scene.title).toBe('自由画布：花朵');
    expect(scene.objects.some((object) => object.label === '花心')).toBe(true);
    expect(
      scene.objects.filter((object) => object.label.startsWith('花瓣')),
    ).toHaveLength(8);
  });

  it('adds a cup without replacing existing free drawing objects', () => {
    const executor = createFreeDrawingExecutor(feedback);
    executor.execute('画一朵花');
    const flowerCount = useFreeDrawingStore.getState().scene.objects.length;
    executor.execute('再画一个蓝色杯子');

    const scene = useFreeDrawingStore.getState().scene;
    expect(scene.objects.length).toBeGreaterThan(flowerCount);
    expect(scene.objects.some((object) => object.label === '杯把')).toBe(true);
  });

  it('clears the free drawing canvas locally', () => {
    const executor = createFreeDrawingExecutor(feedback);
    executor.execute('画一个杯子');
    expect(executor.execute('清空自由画布')).toMatchObject({ status: 'success' });
    expect(useFreeDrawingStore.getState().scene.objects).toHaveLength(0);
  });
});
