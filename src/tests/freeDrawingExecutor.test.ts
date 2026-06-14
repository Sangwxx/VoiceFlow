import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFreeDrawingExecutor } from '../commands/freeDrawing/freeDrawingExecutor';
import type { AiProvider } from '../commands/agent/agentTypes';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useFreeDrawingStore } from '../stores/freeDrawingStore';

const feedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

const unconfiguredProvider: AiProvider = {
  mode: 'unconfigured',
  model: '',
  complete: vi.fn(),
};

describe('freeDrawingExecutor', () => {
  beforeEach(() => useFreeDrawingStore.getState().reset());

  it('draws a flower from editable SVG parts', async () => {
    const result = await createFreeDrawingExecutor(
      unconfiguredProvider,
      feedback,
    ).execute('画一朵粉色的花');
    const scene = useFreeDrawingStore.getState().scene;

    expect(result).toMatchObject({ status: 'success' });
    expect(scene.title).toBe('自由画布：花朵');
    expect(scene.objects.some((object) => object.label === '花心')).toBe(true);
    expect(
      scene.objects.filter((object) => object.label.startsWith('花瓣')),
    ).toHaveLength(8);
  });

  it('adds a cup without replacing existing free drawing objects', async () => {
    const executor = createFreeDrawingExecutor(unconfiguredProvider, feedback);
    await executor.execute('画一朵花');
    const flowerCount = useFreeDrawingStore.getState().scene.objects.length;
    await executor.execute('再画一个蓝色杯子');

    const scene = useFreeDrawingStore.getState().scene;
    expect(scene.objects.length).toBeGreaterThan(flowerCount);
    expect(scene.objects.some((object) => object.label === '杯把')).toBe(true);
  });

  it('clears the free drawing canvas locally', async () => {
    const executor = createFreeDrawingExecutor(unconfiguredProvider, feedback);
    await executor.execute('画一个杯子');
    await expect(executor.execute('清空自由画布')).resolves.toMatchObject({
      status: 'success',
    });
    expect(useFreeDrawingStore.getState().scene.objects).toHaveLength(0);
  });

  it('deletes the latest matching object group without calling AI', async () => {
    const complete = vi.fn();
    const executor = createFreeDrawingExecutor(
      { mode: 'real', model: 'test-model', complete },
      feedback,
    );
    await executor.execute('画一个杯子');
    await executor.execute('画一朵花');

    await expect(executor.execute('把杯子删除')).resolves.toMatchObject({
      status: 'success',
      message: '已从自由画布删除杯子',
    });
    const scene = useFreeDrawingStore.getState().scene;
    expect(scene.objects.some((object) => object.groupLabel === '杯子')).toBe(false);
    expect(scene.objects.some((object) => object.groupLabel === '花朵')).toBe(true);
    expect(complete).not.toHaveBeenCalled();
  });

  it('uses AI SVG planning for an unpreset drawing request', async () => {
    const complete = vi.fn().mockResolvedValue({
      title: '自由画布：小树',
      groupLabel: '小树',
      objects: [
        {
          type: 'rect',
          label: '树干',
          x: 470,
          y: 360,
          width: 60,
          height: 180,
          fill: '#92400e',
        },
        {
          type: 'circle',
          label: '树冠',
          cx: 500,
          cy: 300,
          radius: 120,
          fill: '#22c55e',
        },
      ],
    });
    const executor = createFreeDrawingExecutor(
      { mode: 'real', model: 'test-model', complete },
      feedback,
    );

    await expect(executor.execute('画一棵绿色的小树')).resolves.toMatchObject({
      status: 'success',
      message: 'AI 已在自由画布绘制小树',
    });
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'free_drawing',
        originalCommand: '画一棵绿色的小树',
      }),
    );
    expect(useFreeDrawingStore.getState().scene.objects).toHaveLength(2);
    expect(
      useFreeDrawingStore
        .getState()
        .scene.objects.every((object) => object.groupLabel === '小树'),
    ).toBe(true);
  });

  it('rejects unsafe AI SVG paths without changing the canvas', async () => {
    const executor = createFreeDrawingExecutor(
      {
        mode: 'real',
        model: 'test-model',
        complete: vi.fn().mockResolvedValue({
          groupLabel: '危险图形',
          objects: [{ type: 'path', label: '危险路径', d: '<script>alert(1)</script>' }],
        }),
      },
      feedback,
    );

    await expect(executor.execute('画一个未知图形')).resolves.toMatchObject({
      status: 'error',
    });
    expect(useFreeDrawingStore.getState().scene.objects).toHaveLength(0);
  });
});
