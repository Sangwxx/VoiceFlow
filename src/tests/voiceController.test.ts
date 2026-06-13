import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVoiceStore } from '../stores/voiceStore';
import { MockVoiceProvider } from '../voice/mockVoiceProvider';
import { createVoiceController } from '../voice/voiceController';
import { useProposalStore } from '../stores/proposalStore';
import { useVersionStore } from '../stores/versionStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { useCanvasViewStore } from '../stores/canvasViewStore';
import { UnconfiguredAiProvider } from '../commands/agent/aiProviders';
import { useAgentStore } from '../stores/agentStore';

const speechFeedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

function createTestController(provider: MockVoiceProvider) {
  return createVoiceController({
    provider,
    speechFeedback,
    aiProvider: new UnconfiguredAiProvider(),
  });
}

describe('voiceController integration', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useVoiceStore.getState().reset();
    useCommandStore.getState().reset();
    useProposalStore.getState().cancel();
    useVersionStore.getState().clear();
    useWorkflowStore.getState().clear();
    useCanvasViewStore.getState().reset();
    useAgentStore.getState().clear();
    vi.clearAllMocks();
  });

  it('routes final voice text through layout, undo and redo', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    await controller.handleFinalTranscript('横向布局');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');

    await controller.handleFinalTranscript('撤销');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');

    await controller.handleFinalTranscript('重做');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
    expect(useCommandStore.getState().executionLog).toHaveLength(3);
    expect(useCommandStore.getState().executionLog[0]).toMatchObject({
      route: 'fast',
      confidence: 1,
    });
    expect(useCommandStore.getState().executionLog[0].durationMs).toBeGreaterThanOrEqual(
      0,
    );
  });

  it('ignores ordinary commands while paused and resumes by voice', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    await controller.handleFinalTranscript('暂停');
    await controller.handleFinalTranscript('横向布局');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');

    await controller.handleFinalTranscript('继续');
    await controller.handleFinalTranscript('横向布局');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
  });

  it('updates interim and final transcripts from the provider', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    provider.emitInterim('横向');
    expect(useVoiceStore.getState().interimTranscript).toBe('横向');

    provider.emitFinal('横向布局');
    await vi.waitFor(() => {
      expect(useVoiceStore.getState().finalTranscript).toBe('横向布局');
      expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
    });
  });

  it('executes a complete low-risk interim task while speech continues', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    provider.emitInterim('横向布局，然后我继续说');

    await vi.waitFor(() => {
      expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
      expect(useVoiceStore.getState().taskQueue[0]).toMatchObject({
        text: '横向布局',
        status: 'completed',
      });
    });
  });

  it('locally calibrates an interim task before immediate execution', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    provider.emitInterim('横向布橘，然后我继续说');

    await vi.waitFor(() => {
      expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
    });
    expect(useVoiceStore.getState().correctedTranscript).toBe('横向布局，然后我继续说');
  });

  it('keeps strict order when a complex task precedes an immediate task', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    provider.emitFinal('加一个节点叫人工审核，然后横向布局');
    await Promise.resolve();

    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');
    expect(
      useDiagramStore.getState().diagram.nodes.some((node) => node.label === '人工审核'),
    ).toBe(false);

    provider.emitSilence();
    await vi.waitFor(() => {
      expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
      expect(
        useDiagramStore
          .getState()
          .diagram.nodes.some((node) => node.label === '人工审核'),
      ).toBe(true);
    });
    expect(useCommandStore.getState().executionLog.map((entry) => entry.rawText)).toEqual(
      ['横向布局', '加一个节点叫人工审核'],
    );
    expect(useVoiceStore.getState().taskQueue.map((task) => task.status)).toEqual([
      'completed',
      'completed',
    ]);
  });

  it('pauses the ordered queue for confirmation and resumes after the answer', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    provider.emitFinal('整理成适合汇报的版本，然后横向布局');
    provider.emitSilence();
    await vi.waitFor(() => {
      expect(useProposalStore.getState().proposal?.source).toBe('report_mode');
    });
    await vi.waitFor(() => {
      expect(useVoiceStore.getState().taskQueue[0].status).toBe('awaiting_confirmation');
    });
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');

    controller.startListening();
    provider.emitFinal('确认');
    expect(useVoiceStore.getState().taskQueue.map((task) => task.text)).toEqual([
      '整理成适合汇报的版本',
      '确认',
      '横向布局',
    ]);
    provider.emitSilence();
    await vi.waitFor(() => {
      expect(useProposalStore.getState().proposal).toBeNull();
      expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
      expect(useVoiceStore.getState().taskQueue.map((task) => task.status)).toEqual([
        'completed',
        'completed',
        'completed',
      ]);
    });
  });

  it('cancels a proposal and resumes the remaining ordered tasks', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    provider.emitFinal('整理成适合汇报的版本，然后横向布局');
    provider.emitSilence();
    await vi.waitFor(() => {
      expect(useProposalStore.getState().proposal).not.toBeNull();
    });

    controller.startListening();
    provider.emitFinal('取消');
    provider.emitSilence();

    await vi.waitFor(() => {
      expect(useProposalStore.getState().proposal).toBeNull();
      expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
      expect(useVoiceStore.getState().taskQueue.map((task) => task.status)).toEqual([
        'no_change',
        'completed',
        'completed',
      ]);
    });
  });

  it('marks a repeated canvas modification as no_change instead of completed', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);
    controller.startListening();
    provider.emitInterim('纵向布局，然后继续');
    await vi.waitFor(() => {
      expect(useVoiceStore.getState().taskQueue[0]?.status).toBe('no_change');
    });
    expect(useDiagramStore.getState().past).toHaveLength(0);
  });

  it('ignores recognition results that arrive after listening stops', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    controller.stopListening();
    provider.emitFinal('横向布局');
    await Promise.resolve();

    expect(useVoiceStore.getState().status).toBe('idle');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('top_down');
    expect(useCommandStore.getState().executionLog).toHaveLength(0);
  });

  it('executes Simple Path commands and handles clarification answers', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    await controller.handleFinalTranscript('加一个节点叫人工审核');
    expect(
      useDiagramStore.getState().diagram.nodes.some((node) => node.label === '人工审核'),
    ).toBe(true);

    await controller.handleFinalTranscript('把失败分支改成红色虚线');
    expect(useCommandStore.getState().pendingClarification).not.toBeNull();

    await controller.handleFinalTranscript('第二个');
    expect(useCommandStore.getState().pendingClarification).toBeNull();
    expect(
      useDiagramStore.getState().diagram.edges.find((edge) => edge.label === '失败')
        ?.type,
    ).toBe('dashed');
    expect(useCommandStore.getState().executionLog[0]).toMatchObject({
      route: 'simple',
      simpleIntent: 'update_edge_style',
      operationType: 'update_edge',
    });
  });

  it('allows Fast Path cancel to clear a pending clarification', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    await controller.handleFinalTranscript('把失败分支改成红色虚线');
    expect(useCommandStore.getState().pendingClarification).not.toBeNull();

    await controller.handleFinalTranscript('取消');
    expect(useCommandStore.getState().pendingClarification).toBeNull();
  });

  it('previews and confirms a stage 5 report workflow by voice', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);
    const originalTheme = useDiagramStore.getState().diagram.theme.name;

    await controller.handleFinalTranscript('整理成适合汇报的版本');
    expect(useProposalStore.getState().proposal?.source).toBe('report_mode');
    expect(useDiagramStore.getState().diagram.theme.name).toBe(originalTheme);

    await controller.handleFinalTranscript('确认');
    expect(useProposalStore.getState().proposal).toBeNull();
    expect(useDiagramStore.getState().diagram.theme.name).toBe('report_clean');
    expect(useVersionStore.getState().versions).toHaveLength(0);
  });

  it('uses local calibration before giving up on an unknown transcript', async () => {
    const provider = new MockVoiceProvider();
    const complete = vi.fn().mockResolvedValue({
      kind: 'diagram',
      summary: '强化学习流程',
      diagram: {
        ...structuredClone(useDiagramStore.getState().diagram),
        title: '强化学习学习流程',
      },
    });
    const controller = createVoiceController({
      provider,
      speechFeedback,
      aiProvider: { mode: 'real', model: 'test-model', complete },
    });
    await controller.handleFinalTranscript('声成一张强化学西的流成图');
    expect(useVoiceStore.getState().correctedTranscript).toBe('生成一张强化学习的流程图');
    expect(useProposalStore.getState().proposal?.diagram.title).toBe('强化学习流程图');
    expect(useVoiceStore.getState().correctionFeedback?.reason).toContain('错词映射');
  });

  it('corrects and generates a matching use case diagram without AI', async () => {
    const provider = new MockVoiceProvider();
    const complete = vi.fn();
    const controller = createVoiceController({
      provider,
      speechFeedback,
      aiProvider: { mode: 'real', model: 'test-model', complete },
    });

    await controller.handleFinalTranscript('画一个学生选课用力图');

    expect(complete).not.toHaveBeenCalled();
    expect(useProposalStore.getState().proposal?.diagram).toMatchObject({
      title: '学生选课用例图',
      diagramType: 'usecase',
    });
  });

  it('confirms a generated structural diagram and continues later voice tasks', async () => {
    const provider = new MockVoiceProvider();
    const controller = createTestController(provider);

    controller.startListening();
    provider.emitFinal('画一个学生选课用力图，然后纵向布局');
    provider.emitSilence();
    await vi.waitFor(() => {
      expect(useProposalStore.getState().proposal?.diagram.diagramType).toBe('usecase');
    });

    controller.startListening();
    provider.emitFinal('确认');
    provider.emitSilence();

    await vi.waitFor(() => {
      expect(useProposalStore.getState().proposal).toBeNull();
      expect(useDiagramStore.getState().diagram).toMatchObject({
        title: '学生选课用例图',
        diagramType: 'usecase',
        layout: { direction: 'top_down' },
      });
      expect(
        useVoiceStore.getState().taskQueue.every((task) => task.status === 'completed'),
      ).toBe(true);
    });
  });

  it('never calls AI for local speech calibration', async () => {
    const provider = new MockVoiceProvider();
    const complete = vi.fn();
    const controller = createVoiceController({
      provider,
      speechFeedback,
      aiProvider: {
        mode: 'real',
        model: 'test-model',
        complete,
      },
    });

    await controller.handleFinalTranscript('横向布橘');
    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
    expect(complete).not.toHaveBeenCalled();
  });

  it('keeps Fast Path commands local without calling AI', async () => {
    const provider = new MockVoiceProvider();
    const complete = vi.fn();
    const controller = createVoiceController({
      provider,
      speechFeedback,
      aiProvider: {
        mode: 'real',
        model: 'test-model',
        complete,
      },
    });

    await controller.handleFinalTranscript('撤销');

    expect(complete).not.toHaveBeenCalled();
    expect(useCommandStore.getState().executionLog[0]).toMatchObject({
      route: 'fast',
      rawText: '撤销',
    });
  });

  it('sends unmatched speech to a real contextual Agent with the current diagram', async () => {
    const provider = new MockVoiceProvider();
    const complete = vi.fn().mockResolvedValue({
      kind: 'operations',
      summary: '让登录页更清楚',
      operations: [
        {
          type: 'update_node',
          nodeId: 'login-page',
          patch: { label: '进入账号登录页' },
        },
      ],
    });
    const controller = createVoiceController({
      provider,
      speechFeedback,
      aiProvider: { mode: 'real', model: 'test-model', complete },
    });

    await controller.handleFinalTranscript('登录这里看起来不够清楚');

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: 'modify_diagram',
        currentDiagram: expect.objectContaining({ id: 'login-flow' }),
      }),
      expect.anything(),
    );
    expect(useProposalStore.getState().proposal?.operations).toHaveLength(1);
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.id === 'login-page'),
    ).toMatchObject({ label: '进入登录页' });
  });
});
