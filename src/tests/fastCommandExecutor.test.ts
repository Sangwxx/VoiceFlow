import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFastCommandExecutor } from '../commands/fast/fastCommandExecutor';
import { registerCanvasViewportApi } from '../services/canvasViewportService';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useVersionStore } from '../stores/versionStore';

const speechFeedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

describe('fastCommandExecutor', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useVoiceStore.getState().reset();
    useCommandStore.getState().reset();
    useVersionStore.getState().clear();
    vi.clearAllMocks();
    registerCanvasViewportApi({
      fitView: vi.fn().mockResolvedValue(true),
      zoomIn: vi.fn().mockResolvedValue(true),
      zoomOut: vi.fn().mockResolvedValue(true),
      focusNode: vi.fn().mockResolvedValue(true),
    });
  });

  it('saves an unnamed version through Fast Path', async () => {
    const execute = createFastCommandExecutor({ speechFeedback });
    await expect(execute('save_version')).resolves.toMatchObject({ status: 'success' });
    expect(useVersionStore.getState().versions).toHaveLength(1);
    expect(useVersionStore.getState().versions[0].sourceAction).toBe('fast_save');
  });

  it('executes viewport commands through the registered canvas service', async () => {
    const execute = createFastCommandExecutor({ speechFeedback });

    await expect(execute('fit_view')).resolves.toMatchObject({
      status: 'success',
      message: '已显示完整画布',
    });
    expect(speechFeedback.speak).toHaveBeenCalledWith('已显示完整画布');
  });

  it('applies a reversible layout operation', async () => {
    const execute = createFastCommandExecutor({ speechFeedback });

    await execute('layout_left_to_right');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');

    await execute('undo');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');

    await execute('redo');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
  });

  it('only accepts resume and cancel while commands are paused', async () => {
    const execute = createFastCommandExecutor({ speechFeedback });

    await execute('pause');
    await expect(execute('layout_left_to_right')).resolves.toMatchObject({
      status: 'ignored',
    });
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');

    await execute('resume');
    await execute('layout_left_to_right');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
  });
});
