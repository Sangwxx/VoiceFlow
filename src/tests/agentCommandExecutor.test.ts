import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAgentCommandExecutor } from '../commands/agent/agentCommandExecutor';
import type { AiProvider } from '../commands/agent/agentTypes';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useAgentStore } from '../stores/agentStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVersionStore } from '../stores/versionStore';

const feedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

describe('agentCommandExecutor', () => {
  beforeEach(() => {
    useAgentStore.getState().clear();
    useDiagramStore.getState().reset();
    useVersionStore.getState().clear();
  });

  it('applies generated diagrams directly and supports undo', async () => {
    const original = useDiagramStore.getState().diagram;
    const executor = createAgentCommandExecutor(
      diagramProvider('architecture'),
      feedback,
    );
    await executor.execute('画一个包含网关、服务和数据库的系统架构图', 'create_diagram');

    expect(useDiagramStore.getState().diagram.diagramType).toBe('architecture');
    expect(useVersionStore.getState().versions[0]?.kind).toBe('auto');
    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(useDiagramStore.getState().undo()).toBe(true);
    expect(useDiagramStore.getState().diagram.id).toBe(original.id);
  });

  it('returns an error instead of blocking on Agent clarification', async () => {
    const executor = createAgentCommandExecutor(clarificationProvider(), feedback);
    await expect(
      executor.execute('把当前图整理清楚', 'modify_diagram'),
    ).resolves.toMatchObject({ status: 'error' });
    expect(useAgentStore.getState().status).toBe('error');
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
    const task = executor.execute('调整当前图', 'modify_diagram');
    useAgentStore.getState().cancel();
    await task;
    expect(useAgentStore.getState().previewDiagram).toBeNull();
    expect(useDiagramStore.getState().diagram.id).toBe(originalId);
  });

  it('applies contextual operations directly as one history entry', async () => {
    const executor = createAgentCommandExecutor(operationProvider(), feedback);
    await executor.execute('把失败分支改成红色虚线', 'modify_diagram');

    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(
      useDiagramStore
        .getState()
        .diagram.edges.find((edge) => edge.id === 'e-success-error'),
    ).toMatchObject({ type: 'dashed', style: { stroke: '#dc2626' } });
  });

  it('coalesces duplicate in-flight Agent requests instead of cancelling the first', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    const complete = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const executor = createAgentCommandExecutor(
      { mode: 'real', model: 'test-model', complete },
      feedback,
    );
    const first = executor.execute('调整高中数学学习流程', 'modify_diagram');
    const second = executor.execute('调整高中数学学习流程', 'modify_diagram');
    expect(complete).toHaveBeenCalledTimes(1);
    resolveRequest?.({
      kind: 'diagram',
      diagram: {
        id: 'math',
        title: '高中数学学习流程',
        nodes: [{ id: 'learn', label: '学习', type: 'process' }],
        edges: [],
      },
    });
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ status: 'success' }),
      expect.objectContaining({ status: 'success' }),
    ]);
  });

  it('retries once only when the Agent output is invalid', async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce('not-json')
      .mockResolvedValueOnce({
        kind: 'diagram',
        diagram: {
          id: 'repaired',
          title: '修复后的图',
          nodes: [{ id: 'step', label: '步骤', type: 'process' }],
          edges: [],
        },
      });
    const executor = createAgentCommandExecutor(
      { mode: 'real', model: 'test-model', complete },
      feedback,
    );
    await expect(
      executor.execute('调整学习流程', 'modify_diagram'),
    ).resolves.toMatchObject({ status: 'success' });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('uses AI as the primary generator for complete structural diagrams', async () => {
    const complete = vi.fn().mockResolvedValue({
      kind: 'diagram',
      title: '学生选课用例图',
      diagramType: 'usecase',
      nodes: [
        { id: 'student', label: '学生', type: 'user' },
        { id: 'select', label: '选择课程', type: 'process' },
      ],
      edges: [{ from: 'student', to: 'select' }],
    });
    const executor = createAgentCommandExecutor(
      { mode: 'real', model: 'test-model', complete },
      feedback,
    );

    await executor.execute('画一个学生选课用例图', 'create_diagram');

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'create_diagram',
        originalCommand: '画一个学生选课用例图',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(useDiagramStore.getState().diagram).toMatchObject({
      title: '学生选课用例图',
      diagramType: 'usecase',
    });
  });

  it('provides a semantic canvas summary for contextual modifications', async () => {
    const complete = vi.fn().mockResolvedValue({
      kind: 'operations',
      operations: [
        {
          type: 'set_relative_position',
          nodeId: 'login-page',
          referenceNodeId: 'open-app',
          relation: 'right_of',
        },
      ],
    });
    const executor = createAgentCommandExecutor(
      { mode: 'real', model: 'test-model', complete },
      feedback,
    );

    await executor.execute('把登录页放到打开 App 右边', 'modify_diagram');

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        spatialSummary: expect.stringContaining('节点空间关系'),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('uses the local planner only when AI is not configured', async () => {
    const executor = createAgentCommandExecutor(
      { mode: 'unconfigured', model: '', complete: vi.fn() },
      feedback,
    );

    await expect(
      executor.execute('画一个学生选课用例图', 'create_diagram'),
    ).resolves.toMatchObject({
      status: 'success',
      message: '未配置 AI，已使用本地规划器生成结构图',
    });
    expect(useDiagramStore.getState().diagram.diagramType).toBe('usecase');
  });
});

function diagramProvider(diagramType: 'architecture' | 'flowchart'): AiProvider {
  return {
    mode: 'real',
    model: 'test-model',
    complete: vi.fn().mockResolvedValue({
      kind: 'diagram',
      summary: '测试候选图',
      diagram: {
        id: 'generated',
        title: '测试图',
        diagramType,
        nodes: [
          { id: 'start', label: '开始', type: 'start' },
          { id: 'end', label: '结束', type: 'end' },
        ],
        edges: [{ id: 'edge', from: 'start', to: 'end' }],
      },
    }),
  };
}

function clarificationProvider(): AiProvider {
  let calls = 0;
  return {
    mode: 'real',
    model: 'test-model',
    complete: vi.fn().mockImplementation(() => {
      calls += 1;
      return calls === 1
        ? { kind: 'clarification', question: '请补充具体流程' }
        : diagramProvider('flowchart').complete({
            intent: 'create_diagram',
            originalCommand: '',
            conversation: [],
          });
    }),
  };
}

function operationProvider(): AiProvider {
  return {
    mode: 'real',
    model: 'test-model',
    complete: vi.fn().mockResolvedValue({
      kind: 'operations',
      summary: '修改失败分支',
      operations: [
        {
          type: 'update_edge',
          edgeId: 'e-success-error',
          patch: { type: 'dashed', style: { stroke: '#dc2626' } },
        },
      ],
    }),
  };
}
