import type { SpeechFeedbackService } from '../../services/speechFeedbackService';
import { useAgentStore } from '../../stores/agentStore';
import { useCommandStore } from '../../stores/commandStore';
import { useDiagramStore } from '../../stores/diagramStore';
import { saveCurrentDiagramVersion } from '../../services/diagramVersionService';
import type { FastCommandExecutionResult } from '../fast/fastCommandExecutor';
import { normalizeAgentResult } from './agentNormalizer';
import type { AgentIntent, AiProvider } from './agentTypes';
import { planLocalStructuralDiagram } from './structuralDiagramPlanner';
import { describeDiagramSpatially } from '../../core/diagram/spatialSummary';

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
      if (intent === 'create_diagram' && provider.mode === 'unconfigured') {
        const result = planLocalStructuralDiagram(originalCommand);
        if (result.kind !== 'diagram') throw new Error('本地结构图规划失败');
        useAgentStore.getState().setStateForTask({
          status: 'preview',
          previewDiagram: result.diagram,
          explanation: result.explanation,
          summary: result.summary,
          controller: null,
        });
        saveCurrentDiagramVersion('auto_before_diagram_replace', true);
        useDiagramStore.getState().replaceDiagram(result.diagram, '生成结构图');
        useAgentStore.getState().clear();
        const message = '未配置 AI，已使用本地规划器生成结构图';
        useCommandStore.getState().setLastMessage(message);
        void speechFeedback.speak(message);
        return { status: 'success', message } as const;
      }
      const agentRequest = {
        intent,
        originalCommand,
        conversation: state.conversation,
        currentDiagram: intent === 'modify_diagram' ? diagram : undefined,
        spatialSummary:
          intent === 'modify_diagram' ? describeDiagramSpatially(diagram) : undefined,
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
        ensureResultMatchesIntent(result, intent);
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
        ensureResultMatchesIntent(result, intent);
      }
      if (result.kind === 'clarification') {
        if (intent === 'create_diagram') {
          result = planLocalStructuralDiagram(originalCommand);
        }
      }
      if (result.kind === 'clarification') {
        const message = '无法确定具体修改目标，已保留当前画布';
        useAgentStore.getState().setStateForTask({
          status: 'error',
          explanation: result.explanation,
          summary: message,
          conversation: state.conversation,
          controller: null,
        });
        useCommandStore.getState().setLastMessage(message);
        void speechFeedback.speak(message);
        return { status: 'error', message } as const;
      }

      useAgentStore.getState().setStateForTask({
        status: 'preview',
        previewDiagram: result.diagram,
        explanation: result.explanation,
        summary: result.summary,
        controller: null,
      });
      if (result.kind === 'operations') {
        useDiagramStore.getState().applyOperations(result.operations, result.summary);
      } else {
        saveCurrentDiagramVersion('auto_before_diagram_replace', true);
        useDiagramStore.getState().replaceDiagram(result.diagram, result.summary);
      }
      useAgentStore.getState().clear();
      const message = result.kind === 'operations' ? 'AI 修改已应用' : 'AI 图表已生成';
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
  };
}

function ensureResultMatchesIntent(
  result: ReturnType<typeof normalizeAgentResult>,
  intent: AgentIntent,
): void {
  if (intent === 'create_diagram' && result.kind === 'operations') {
    throw new Error('完整图生成请求必须返回 diagram，不能返回 operations。');
  }
}
