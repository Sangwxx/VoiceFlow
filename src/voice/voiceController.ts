import { createAgentCommandExecutor } from '../commands/agent/agentCommandExecutor';
import { createConfiguredAiProvider } from '../commands/agent/aiProviders';
import type { AiProvider } from '../commands/agent/agentTypes';
import {
  createExecutionLog,
  createFastCommandExecutor,
  type FastCommandExecutionResult,
} from '../commands/fast/fastCommandExecutor';
import { routeCommand } from '../commands/router/commandRouter';
import { createSimpleCommandExecutor } from '../commands/simple/simpleCommandExecutor';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useAgentStore } from '../stores/agentStore';
import { useCommandStore } from '../stores/commandStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { VoiceController, VoiceProvider } from './voiceTypes';
import { createWorkflowCommandExecutor } from '../commands/workflow/workflowCommandExecutor';
import { useWorkflowStore } from '../stores/workflowStore';
import { useProposalStore } from '../stores/proposalStore';
import { useDiagramStore } from '../stores/diagramStore';
import { VoiceTaskSegmenter, type VoiceTask } from './voiceTaskSegmenter';
import { calibrateAsrTranscript } from './localAsrCalibrator';

export type VoiceControllerDependencies = {
  provider: VoiceProvider;
  speechFeedback: SpeechFeedbackService;
  aiProvider?: AiProvider;
};

export function createVoiceController({
  provider,
  speechFeedback,
  aiProvider = createConfiguredAiProvider(),
}: VoiceControllerDependencies): VoiceController {
  let shouldListen = false;
  let pausedForFeedback = false;
  let utteranceEnded = true;
  let drainingTasks = false;
  let drainRequested = false;
  let taskCursor = 0;
  let tasks: VoiceTask[] = [];
  const resolutionTaskIds = new Set<string>();
  let suppressFeedback = false;
  const segmenter = new VoiceTaskSegmenter();
  const executionFeedback: SpeechFeedbackService = {
    isSupported: () => speechFeedback.isSupported(),
    speak: (text) => (suppressFeedback ? Promise.resolve() : speechFeedback.speak(text)),
  };
  const executeFastCommand = createFastCommandExecutor({
    speechFeedback: executionFeedback,
  });
  const simpleExecutor = createSimpleCommandExecutor(executionFeedback);
  const agentExecutor = createAgentCommandExecutor(aiProvider, executionFeedback);
  const workflowExecutor = createWorkflowCommandExecutor(executionFeedback);

  function publishTasks(): void {
    useVoiceStore.getState().setTaskQueue([...tasks]);
  }

  function appendTasks(nextTasks: VoiceTask[]): void {
    if (!nextTasks.length) return;
    if (hasInteractionBlocker()) {
      nextTasks.forEach((task) => resolutionTaskIds.add(task.id));
      const insertionIndex =
        tasks[taskCursor]?.status === 'executing' ? taskCursor + 1 : taskCursor;
      tasks.splice(insertionIndex, 0, ...nextTasks);
    } else {
      tasks.push(...nextTasks);
    }
    publishTasks();
    void drainTasks();
  }

  function hasInteractionBlocker(): boolean {
    const workflow = useWorkflowStore.getState();
    return Boolean(
      useProposalStore.getState().proposal ||
      useCommandStore.getState().pendingClarification ||
      useAgentStore.getState().status === 'clarifying' ||
      workflow.pendingVersionClarification ||
      workflow.pendingFocusClarification,
    );
  }

  async function drainTasks(): Promise<void> {
    if (drainingTasks) {
      drainRequested = true;
      return;
    }
    drainingTasks = true;
    drainRequested = false;
    try {
      while (taskCursor < tasks.length) {
        const task = tasks[taskCursor];
        if (task.readiness === 'after_recording' && !utteranceEnded) break;
        if (hasInteractionBlocker() && !resolutionTaskIds.has(task.id)) break;
        task.status = 'executing';
        publishTasks();
        suppressFeedback = !utteranceEnded;
        try {
          await controller.handleFinalTranscript(task.text);
          task.status = 'completed';
        } catch {
          task.status = 'failed';
        } finally {
          suppressFeedback = false;
          resolutionTaskIds.delete(task.id);
          taskCursor += 1;
          publishTasks();
        }
        if (hasInteractionBlocker()) break;
      }
    } finally {
      drainingTasks = false;
      if (drainRequested) void drainTasks();
    }
  }

  const controller: VoiceController = {
    startListening() {
      if (utteranceEnded && taskCursor >= tasks.length) {
        tasks = [];
        taskCursor = 0;
        segmenter.reset();
        publishTasks();
      }
      utteranceEnded = false;
      shouldListen = true;
      if (!provider.isSupported()) {
        useVoiceStore.setState({
          status: 'unsupported',
          error: '当前浏览器不支持 Web Speech API，请使用桌面版 Chrome 或 Edge。',
        });
        return;
      }
      provider.start({
        onStart: () => {
          if (!pausedForFeedback) {
            useVoiceStore.setState({
              status: useVoiceStore.getState().commandPaused ? 'paused' : 'listening',
              error: null,
            });
          }
        },
        onEnd: () => {
          if (!shouldListen) useVoiceStore.getState().setStatus('idle');
        },
        onResult: ({ text, isFinal }) => {
          if (!shouldListen) return;
          const calibration = calibrateAsrTranscript(text, {
            diagram: useDiagramStore.getState().diagram,
            recentCommands: useCommandStore
              .getState()
              .executionLog.slice(0, 8)
              .map((entry) => entry.rawText),
          });
          if (isFinal) {
            useVoiceStore.getState().setFinalTranscript(text);
            if (calibration.changed) {
              useVoiceStore.getState().setCorrectionFeedback(calibration);
            }
            appendTasks(segmenter.ingestFinal(calibration.correctedText));
          } else {
            useVoiceStore.getState().setInterimTranscript(text);
            if (calibration.changed) {
              useVoiceStore.getState().setCorrectionFeedback(calibration);
            }
            appendTasks(segmenter.ingestInterim(calibration.correctedText));
          }
        },
        onError: (error) => useVoiceStore.getState().setError(error.message),
        onSilence: () => {
          shouldListen = false;
          void controller.finishUtterance();
        },
      });
    },
    stopListening() {
      shouldListen = false;
      provider.stop();
      void controller.finishUtterance();
    },
    async finishUtterance() {
      utteranceEnded = true;
      segmenter.reset();
      tasks = tasks.map((task) =>
        task.status === 'waiting_recording_end' ? { ...task, status: 'queued' } : task,
      );
      publishTasks();
      await drainTasks();
      const voice = useVoiceStore.getState();
      voice.setStatus(
        voice.commandPaused ? 'paused' : shouldListen ? 'listening' : 'idle',
      );
    },
    async handleFinalTranscript(text: string) {
      const startedAt = performance.now();
      const calibration = calibrateAsrTranscript(text, {
        diagram: useDiagramStore.getState().diagram,
        recentCommands: useCommandStore
          .getState()
          .executionLog.slice(0, 8)
          .map((entry) => entry.rawText),
      });
      const executionText = calibration.correctedText;
      let route = routeCommand(executionText);
      if (calibration.changed) {
        useVoiceStore.getState().setCorrectionFeedback(calibration);
        route = {
          ...route,
          rawText: text,
          reason: `本地语音校准：${calibration.reason}`,
        };
      }
      const pendingSimple = useCommandStore.getState().pendingClarification;
      const agentClarifying = useAgentStore.getState().status === 'clarifying';
      const workflowState = useWorkflowStore.getState();
      const workflowClarifying =
        workflowState.pendingVersionClarification ??
        workflowState.pendingFocusClarification;
      const hasPendingClarification = Boolean(
        pendingSimple || agentClarifying || workflowClarifying,
      );
      if (
        route.route === 'unknown' &&
        !hasPendingClarification &&
        aiProvider.mode === 'real'
      ) {
        route = {
          ...route,
          route: 'agent',
          confidence: 0.55,
          agentIntent: 'modify_diagram',
          reason: '规则未命中，交由上下文 Agent 判断并澄清',
        };
      }
      if (agentClarifying && route.route !== 'fast') {
        route = {
          ...route,
          route: 'agent',
          confidence: 0.95,
          agentIntent: useAgentStore.getState().intent ?? 'create_flowchart',
          reason: '处理待澄清的 AI 语音回答',
        };
      } else if (workflowClarifying && route.route !== 'fast') {
        route = {
          ...route,
          route: 'workflow',
          confidence: 0.95,
          workflowIntent:
            'action' in workflowClarifying ? workflowClarifying.action : 'focus_node',
          reason: '处理待澄清的工作流选择',
        };
      } else if (pendingSimple && route.route !== 'fast') {
        route = {
          ...route,
          route: 'simple',
          confidence: 0.95,
          simpleIntent: pendingSimple.draft.intent,
          reason: '处理待澄清的语音回答',
        };
      }
      useCommandStore.getState().setRouteResult(route);
      useVoiceStore.getState().setStatus('processing');

      let result: FastCommandExecutionResult;
      if (route.route === 'fast' && route.fastCommand) {
        result = await executeFastCommand(route.fastCommand);
      } else if (useVoiceStore.getState().commandPaused) {
        result = { status: 'ignored', message: '命令执行已暂停，请说继续或取消' };
      } else if (useProposalStore.getState().proposal) {
        result = { status: 'ignored', message: '当前候选图等待确认，请说确认或取消' };
      } else if (agentClarifying) {
        result = await agentExecutor.answerClarification(executionText);
      } else if (workflowClarifying) {
        result = await workflowExecutor.answerClarification(executionText);
      } else if (pendingSimple) {
        result = await simpleExecutor.answerClarification(executionText);
      } else if (route.route === 'simple') {
        result = await simpleExecutor.execute(executionText);
      } else if (route.route === 'workflow' && route.workflowIntent) {
        result = await workflowExecutor.execute(route.workflowIntent, executionText);
      } else if (route.route === 'agent' && route.agentIntent) {
        result = await agentExecutor.execute(executionText, route.agentIntent);
      } else {
        const message =
          aiProvider.mode === 'mock'
            ? '本地语音校准后仍没有识别到可执行命令，请换一种说法'
            : '本地语音校准后仍无法确定命令，请换一种说法';
        useCommandStore.getState().setLastMessage(message);
        void speechFeedback.speak(message);
        result = { status: 'ignored', message };
      }

      useCommandStore
        .getState()
        .addExecutionLog(createExecutionLog(route, result, startedAt));
      const voice = useVoiceStore.getState();
      if (voice.status !== 'speaking') {
        voice.setStatus(
          shouldListen ? (voice.commandPaused ? 'paused' : 'listening') : 'idle',
        );
      }
    },
    pauseForFeedback() {
      if (!shouldListen) return;
      pausedForFeedback = true;
      provider.stop();
      useVoiceStore.getState().setStatus('speaking');
    },
    resumeAfterFeedback() {
      if (!shouldListen) return;
      pausedForFeedback = false;
      controller.startListening();
    },
  };
  return controller;
}
