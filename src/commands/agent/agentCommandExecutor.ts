import type { SpeechFeedbackService } from '../../services/speechFeedbackService';
import { useAgentStore } from '../../stores/agentStore';
import { useCommandStore } from '../../stores/commandStore';
import { createDiagramProposal, useProposalStore } from '../../stores/proposalStore';
import { useDiagramStore } from '../../stores/diagramStore';
import type { FastCommandExecutionResult } from '../fast/fastCommandExecutor';
import { normalizeAgentResult } from './agentNormalizer';
import type { AgentIntent, AiProvider } from './agentTypes';
import { planLocalStructuralDiagram } from './structuralDiagramPlanner';

export function createAgentCommandExecutor(
  provider: AiProvider,
  speechFeedback: SpeechFeedbackService,
) {
  let inFlight: { key: string; promise: Promise<FastCommandExecutionResult> } | undefined;

  function request(
    originalCommand: string,
    intent: AgentIntent,
  ): Promise<FastCommandExecutionResult> {
    const key = `${intent}:${originalCommand.trim()}`;
    if (inFlight?.key === key) return inFlight.promise;
    const promise = runRequest(originalCommand, intent).finally(() => {
      if (inFlight?.key === key) inFlight = undefined;
    });
    inFlight = { key, promise };
    return promise;
  }

  async function runRequest(
    originalCommand: string,
    intent: AgentIntent,
  ): Promise<FastCommandExecutionResult> {
    const current = useAgentStore.getState();
    if (
      current.controller &&
      (current.originalCommand !== originalCommand || current.intent !== intent)
    ) {
      current.controller.abort();
    }
    const controller = new AbortController();
    const taskId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 120_000);
    useAgentStore.getState().setStateForTask({
      status: 'planning',
      providerMode: provider.mode,
      model: provider.model,
      originalCommand,
      intent,
      previewDiagram: null,
      explanation: '',
      summary: '',
      error: null,
      taskId,
      controller,
    });

    try {
      const state = useAgentStore.getState();
      const diagram = useDiagramStore.getState().diagram;
      if (intent === 'create_diagram') {
        const result = planLocalStructuralDiagram(originalCommand);
        if (result.kind !== 'diagram') throw new Error('本地结构图规划失败');
        useAgentStore.getState().setStateForTask({
          status: 'preview',
          previewDiagram: result.diagram,
          explanation: result.explanation,
          summary: result.summary,
          controller: null,
        });
        useProposalStore
          .getState()
          .setProposal(
            createDiagramProposal(
              'agent',
              result.diagram,
              '确认生成结构图',
              result.summary,
            ),
          );
        const message = '结构图预览已生成，请说确认或取消';
        useCommandStore.getState().setLastMessage(message);
        void speechFeedback.speak(message);
        return { status: 'success', message } as const;
      }
      const agentRequest = {
        intent,
        originalCommand,
        conversation: state.conversation,
        currentDiagram: intent === 'modify_diagram' ? diagram : undefined,
        recentCommands: useCommandStore
          .getState()
          .executionLog.slice(0, 5)
          .map((log) => log.rawText),
      };
      const output = await provider.complete(agentRequest, { signal: controller.signal });
      if (useAgentStore.getState().taskId !== taskId) {
        return { status: 'ignored', message: 'AI 请求已被替换' } as const;
      }
      let result;
      try {
        result = normalizeAgentResult(output, diagram);
      } catch (normalizationError) {
        const repairedOutput = await provider.complete(
          {
            ...agentRequest,
            conversation: [
              ...state.conversation,
              { role: 'assistant', content: String(output) },
              {
                role: 'user',
                content: `上一条输出无法执行：${
                  normalizationError instanceof Error
                    ? normalizationError.message
                    : String(normalizationError)
                }。请只返回修正后的合法 JSON。`,
              },
            ],
          },
          { signal: controller.signal },
        );
        result = normalizeAgentResult(repairedOutput, diagram);
      }
      if (result.kind === 'clarification') {
        useAgentStore.getState().setStateForTask({
          status: 'clarifying',
          explanation: result.explanation,
          summary: result.question,
          conversation: [
            ...state.conversation,
            { role: 'assistant', content: result.question },
          ],
          controller: null,
        });
        useCommandStore.getState().setLastMessage(result.question);
        void speechFeedback.speak(result.question);
        return { status: 'clarification', message: result.question } as const;
      }

      useAgentStore.getState().setStateForTask({
        status: 'preview',
        previewDiagram: result.diagram,
        explanation: result.explanation,
        summary: result.summary,
        controller: null,
      });
      useProposalStore
        .getState()
        .setProposal(
          createDiagramProposal(
            'agent',
            result.diagram,
            result.kind === 'operations' ? '确认 AI 修改图表' : '确认 AI 生成图表',
            result.summary,
            undefined,
            result.kind === 'operations' ? result.operations : undefined,
          ),
        );
      const message =
        result.kind === 'operations'
          ? 'AI 修改方案预览已生成，请说确认或取消'
          : 'AI 图表预览已生成，请说确认或取消';
      useCommandStore.getState().setLastMessage(message);
      void speechFeedback.speak(message);
      return { status: 'success', message } as const;
    } catch (error) {
      const cancelled = controller.signal.aborted && !timedOut;
      const message = timedOut
        ? 'AI 请求超时，请重试或简化描述'
        : cancelled
          ? 'AI 请求已取消'
          : error instanceof Error
            ? error.message
            : 'AI 图表生成失败';
      useAgentStore.getState().setStateForTask({
        status: cancelled ? 'cancelled' : 'error',
        previewDiagram: null,
        error: cancelled ? null : message,
        controller: null,
      });
      useCommandStore.getState().setLastMessage(message);
      return { status: cancelled ? 'ignored' : 'error', message } as const;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return {
    execute(text: string, intent: AgentIntent): Promise<FastCommandExecutionResult> {
      useAgentStore.getState().setStateForTask({ conversation: [] });
      return request(text, intent);
    },
    answerClarification(text: string): Promise<FastCommandExecutionResult> {
      const state = useAgentStore.getState();
      if (!state.intent || !state.originalCommand) {
        return Promise.resolve({
          status: 'ignored',
          message: '当前没有待澄清的 AI 请求',
        });
      }
      useAgentStore.getState().setStateForTask({
        conversation: [...state.conversation, { role: 'user', content: text }],
      });
      return request(state.originalCommand, state.intent);
    },
  };
}

export function confirmAgentPreview(): boolean {
  const confirmed = useProposalStore.getState().confirm();
  if (confirmed) useAgentStore.getState().clear();
  return confirmed;
}
