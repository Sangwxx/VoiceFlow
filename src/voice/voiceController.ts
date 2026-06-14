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
import { useCommandStore } from '../stores/commandStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { VoiceController, VoiceProvider } from './voiceTypes';
import { createWorkflowCommandExecutor } from '../commands/workflow/workflowCommandExecutor';
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
    const previous = tasks.at(-1);
    for (const [index, nextTask] of nextTasks.entries()) {
      if (index === 0 && shouldMergeFinalFragment(previous, nextTask, utteranceEnded)) {
        const text = `${previous.text}，${nextTask.text}`;
        previous.text = text;
        previous.route = routeCommand(text);
        previous.source = 'final';
        previous.readiness = 'after_recording';
        previous.status = 'waiting_recording_end';
      } else {
        tasks.push(nextTask);
      }
    }
    publishTasks();
    void drainTasks();
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
        task.status = 'executing';
        publishTasks();
        suppressFeedback = !utteranceEnded;
        try {
          const result = await controller.handleFinalTranscript(task.text);
          if (result.status === 'success' && isCanvasMutationTask(task)) {
            task.status = 'verifying';
            publishTasks();
            await Promise.resolve();
          }
          task.status =
            result.status === 'success'
              ? 'completed'
              : result.status === 'ignored'
                ? 'no_change'
                : 'failed';
        } catch {
          task.status = 'failed';
        } finally {
          suppressFeedback = false;
          taskCursor += 1;
          publishTasks();
        }
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
          useVoiceStore.getState().clearError();
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
      if (route.route === 'unknown') {
        route = {
          ...route,
          route: 'agent',
          confidence: 0.55,
          agentIntent: 'modify_diagram',
          reason: '规则未命中，交由上下文 Agent 判断并澄清',
        };
      }
      useCommandStore.getState().setRouteResult(route);
      useVoiceStore.getState().setStatus('processing');

      let result: FastCommandExecutionResult;
      if (route.route === 'fast' && route.fastCommand) {
        result = await executeFastCommand(route.fastCommand);
      } else if (useVoiceStore.getState().commandPaused) {
        result = { status: 'ignored', message: '命令执行已暂停，请说继续或取消' };
      } else if (route.route === 'simple') {
        result = await simpleExecutor.execute(executionText);
      } else if (route.route === 'workflow' && route.workflowIntent) {
        result = await workflowExecutor.execute(route.workflowIntent, executionText);
      } else if (route.route === 'agent' && route.agentIntent) {
        result = await agentExecutor.execute(executionText, route.agentIntent);
      } else {
        const message = '本地语音校准后仍无法确定命令，请换一种说法';
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
      return result;
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

function shouldMergeFinalFragment(
  previous: VoiceTask | undefined,
  next: VoiceTask,
  utteranceEnded: boolean,
): previous is VoiceTask {
  return Boolean(
    !utteranceEnded &&
    previous &&
    previous.status === 'waiting_recording_end' &&
    previous.acceptsFinalContinuation === true &&
    previous.readiness === 'after_recording' &&
    next.source === 'final' &&
    next.readiness === 'after_recording',
  );
}

function isCanvasMutationTask(task: VoiceTask): boolean {
  if (task.route.route === 'simple' || task.route.route === 'agent') return true;
  if (task.route.route === 'workflow') {
    return !['save_version', 'compare_version', 'focus_node'].includes(
      task.route.workflowIntent ?? '',
    );
  }
  return (
    task.route.route === 'fast' &&
    ['layout_top_down', 'layout_left_to_right', 'apply_layout'].includes(
      task.route.fastCommand ?? '',
    )
  );
}
