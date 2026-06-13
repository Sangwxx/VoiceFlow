import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAgentCommandExecutor,
  confirmAgentPreview,
} from '../commands/agent/agentCommandExecutor';
import { MockAiProvider } from '../commands/agent/aiProviders';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useAgentStore } from '../stores/agentStore';
import { useDiagramStore } from '../stores/diagramStore';

const feedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

describe('agentCommandExecutor', () => {
  beforeEach(() => {
    useAgentStore.getState().clear();
    useDiagramStore.getState().reset();
  });

  it('previews without mutating, confirms atomically and supports undo', async () => {
    const original = useDiagramStore.getState().diagram;
    const executor = createAgentCommandExecutor(new MockAiProvider(), feedback);
    await executor.execute(
      '画一个包含网关、服务和数据库的系统架构图',
      'create_architecture',
    );

    expect(useAgentStore.getState().status).toBe('preview');
    expect(useDiagramStore.getState().diagram).toEqual(original);
    expect(confirmAgentPreview()).toBe(true);
    expect(useDiagramStore.getState().diagram.diagramType).toBe('architecture');
    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(useDiagramStore.getState().undo()).toBe(true);
    expect(useDiagramStore.getState().diagram.id).toBe(original.id);
  });

  it('enters clarification and resubmits the answer', async () => {
    const executor = createAgentCommandExecutor(new MockAiProvider(), feedback);
    await executor.execute('画点东西', 'create_flowchart');
    expect(useAgentStore.getState().status).toBe('clarifying');
    await executor.answerClarification('用户登录流程');
    expect(useAgentStore.getState().status).toBe('preview');
  });

  it('cancels in-flight requests without changing the diagram', async () => {
    const originalId = useDiagramStore.getState().diagram.id;
    const provider = {
      mode: 'real' as const,
      model: 'slow',
      complete: (_request: unknown, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    };
    const executor = createAgentCommandExecutor(provider, feedback);
    const task = executor.execute('画流程图', 'create_flowchart');
    useAgentStore.getState().cancel();
    await task;
    expect(useAgentStore.getState().previewDiagram).toBeNull();
    expect(useDiagramStore.getState().diagram.id).toBe(originalId);
  });

  it('previews contextual operations and commits them as one history entry', async () => {
    const original = useDiagramStore.getState().diagram;
    const executor = createAgentCommandExecutor(new MockAiProvider(), feedback);
    await executor.execute('把失败分支改成红色虚线', 'modify_diagram');

    expect(useDiagramStore.getState().diagram).toEqual(original);
    expect(useAgentStore.getState().status).toBe('preview');
    expect(confirmAgentPreview()).toBe(true);
    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(
      useDiagramStore
        .getState()
        .diagram.edges.find((edge) => edge.id === 'e-success-error'),
    ).toMatchObject({ type: 'dashed', style: { stroke: '#dc2626' } });
  });
});
