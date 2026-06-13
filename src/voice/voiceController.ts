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
  const executeFastCommand = createFastCommandExecutor({ speechFeedback });
  const simpleExecutor = createSimpleCommandExecutor(speechFeedback);
  const agentExecutor = createAgentCommandExecutor(aiProvider, speechFeedback);
  const workflowExecutor = createWorkflowCommandExecutor(speechFeedback);

  const controller: VoiceController = {
    startListening() {
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
          if (isFinal) {
            useVoiceStore.getState().setFinalTranscript(text);
            void controller.handleFinalTranscript(text);
          } else {
            useVoiceStore.getState().setInterimTranscript(text);
          }
        },
        onError: (error) => useVoiceStore.getState().setError(error.message),
      });
    },
    stopListening() {
      shouldListen = false;
      provider.stop();
      useVoiceStore.getState().setStatus('idle');
    },
    async handleFinalTranscript(text: string) {
      const startedAt = performance.now();
      let executionText = text;
      let route = routeCommand(text);
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
        aiProvider.interpretCommand
      ) {
        try {
          const diagram = useDiagramStore.getState().diagram;
          const interpretation = await aiProvider.interpretCommand({
            transcript: text,
            recentCommands: useCommandStore
              .getState()
              .executionLog.slice(0, 5)
              .map((log) => log.rawText),
            diagramTitle: diagram.title,
            nodeLabels: diagram.nodes.map((node) => node.label),
          });
          const correctedRoute = routeCommand(interpretation.correctedText);
          if (correctedRoute.route !== 'unknown') {
            useVoiceStore.getState().setCorrectedTranscript(interpretation.correctedText);
            executionText = interpretation.correctedText;
            route = {
              ...correctedRoute,
              rawText: text,
              confidence: Math.min(correctedRoute.confidence, interpretation.confidence),
              reason: `语义纠错：${interpretation.reason}`,
            };
          }
        } catch {
          // Semantic correction is a best-effort fallback; normal routing feedback remains.
        }
      }
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
            ? '没有识别到可执行的命令。当前使用 Mock AI，配置真实大模型后可进行上下文语义纠错'
            : 'AI 结合上下文后仍无法确定命令，请换一种说法';
        useCommandStore.getState().setLastMessage(message);
        void speechFeedback.speak(message);
        result = { status: 'ignored', message };
      }

      useCommandStore
        .getState()
        .addExecutionLog(createExecutionLog(route, result, startedAt));
      const voice = useVoiceStore.getState();
      if (voice.status !== 'speaking') {
        voice.setStatus(voice.commandPaused ? 'paused' : 'listening');
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
