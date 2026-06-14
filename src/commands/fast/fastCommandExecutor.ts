import type { RouteResult } from '../router/routeTypes';
import { createApplyLayoutOperation } from '../../core/operations/operationFactory';
import { getCanvasViewportApi } from '../../services/canvasViewportService';
import type { SpeechFeedbackService } from '../../services/speechFeedbackService';
import { useAgentStore } from '../../stores/agentStore';
import { useCommandStore, type CommandExecutionStatus } from '../../stores/commandStore';
import { useDiagramStore } from '../../stores/diagramStore';
import { useVoiceStore } from '../../stores/voiceStore';
import type { FastCommandName } from './fastCommandTypes';
import {
  BrowserExportService,
  type ExportService,
} from '../../core/export/exportService';
import { useExportStore } from '../../stores/exportStore';
import { useProposalStore } from '../../stores/proposalStore';
import { useVersionStore } from '../../stores/versionStore';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useCanvasViewStore } from '../../stores/canvasViewStore';
import { useFreeDrawingStore } from '../../stores/freeDrawingStore';
import { useWorkspaceModeStore } from '../../stores/workspaceModeStore';

export type FastCommandExecutionResult = {
  status: CommandExecutionStatus;
  message: string;
};

export function createFastCommandExecutor({
  speechFeedback,
  exportService,
}: {
  speechFeedback: SpeechFeedbackService;
  exportService?: ExportService;
}) {
  const exporter = exportService ?? new BrowserExportService();
  return async function executeFastCommand(
    command: FastCommandName,
  ): Promise<FastCommandExecutionResult> {
    const voice = useVoiceStore.getState();
    if (voice.commandPaused && command !== 'resume' && command !== 'cancel') {
      return { status: 'ignored', message: '命令执行已暂停，请说继续或取消' };
    }

    if (command === 'undo' && useDiagramStore.getState().past.length === 0) {
      return noChange('暂无可撤销操作');
    }
    if (command === 'redo' && useDiagramStore.getState().future.length === 0) {
      return noChange('暂无可重做操作');
    }
    try {
      let message = '';
      switch (command) {
        case 'undo':
          message = useDiagramStore.getState().undo() ? '已撤销' : '暂无可撤销操作';
          break;
        case 'redo':
          message = useDiagramStore.getState().redo() ? '已重做' : '暂无可重做操作';
          break;
        case 'fit_view':
        case 'zoom_in':
        case 'zoom_out': {
          const viewport = getCanvasViewportApi();
          if (!viewport) throw new Error('画布控制服务尚未就绪');
          const method =
            command === 'fit_view'
              ? 'fitView'
              : command === 'zoom_in'
                ? 'zoomIn'
                : 'zoomOut';
          if (!(await viewport[method]())) throw new Error('画布视图操作未完成');
          message =
            command === 'fit_view'
              ? '已显示完整画布'
              : command === 'zoom_in'
                ? '已放大画布'
                : '已缩小画布';
          if (command === 'fit_view') {
            useCanvasViewStore.getState().setFocusedNodeId(null);
            useDiagramStore.getState().setSelectedNodeId(null);
          }
          break;
        }
        case 'layout_top_down':
          if (
            !useDiagramStore
              .getState()
              .applyOperation(createApplyLayoutOperation('top_down')).verified
          ) {
            return noChange('画布已经是纵向布局');
          }
          message = '已切换为纵向布局';
          break;
        case 'layout_left_to_right':
          if (
            !useDiagramStore
              .getState()
              .applyOperation(createApplyLayoutOperation('left_to_right')).verified
          ) {
            return noChange('画布已经是横向布局');
          }
          message = '已切换为横向布局';
          break;
        case 'apply_layout':
          if (
            !useDiagramStore.getState().applyOperation(createApplyLayoutOperation())
              .verified
          ) {
            return noChange('当前画布已经完成自动排版');
          }
          message = '已自动排版';
          break;
        case 'pause':
          useVoiceStore.getState().setCommandPaused(true);
          message = '命令执行已暂停';
          break;
        case 'resume':
          useVoiceStore.getState().setCommandPaused(false);
          message = '已继续执行';
          break;
        case 'cancel':
          useAgentStore.getState().cancel();
          useProposalStore.getState().cancel();
          useWorkflowStore.getState().clear();
          useCommandStore.getState().clearPending();
          useVoiceStore.getState().clearInterimTranscript();
          message = '已取消当前待处理命令';
          break;
        case 'list_versions': {
          const names = useVersionStore
            .getState()
            .versions.slice(0, 5)
            .map((version) => version.name);
          message = names.length ? `已有版本：${names.join('、')}` : '当前没有已保存版本';
          break;
        }
        case 'save_version': {
          const diagram = useDiagramStore.getState().diagram;
          const name = `快速保存 ${new Date().toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}`;
          useVersionStore.getState().saveVersion(name, 'manual', 'fast_save', diagram);
          message = `已保存当前版本 ${name}`;
          break;
        }
        case 'export_json':
        case 'export_svg':
        case 'export_png': {
          const format = command.replace('export_', '') as 'json' | 'svg' | 'png';
          useExportStore.getState().setExporting(format);
          const document =
            useWorkspaceModeStore.getState().mode === 'free_drawing'
              ? useFreeDrawingStore.getState().scene
              : useDiagramStore.getState().diagram;
          const result = await exporter.export(document, format);
          useExportStore.getState().setSuccess(result);
          message = `已导出 ${format.toUpperCase()}：${result.filename}`;
          break;
        }
      }
      useCommandStore.getState().setLastMessage(message);
      void speechFeedback.speak(message);
      return { status: 'success', message };
    } catch (error) {
      const message = error instanceof Error ? error.message : '快捷命令执行失败';
      if (command.startsWith('export_')) useExportStore.getState().setError(message);
      useCommandStore.getState().setLastMessage(message);
      return { status: 'error', message };
    }
    function noChange(message: string): FastCommandExecutionResult {
      useCommandStore.getState().setLastMessage(message);
      void speechFeedback.speak(message);
      return { status: 'ignored', message };
    }
  };
}

export function createExecutionLog(
  route: RouteResult,
  result: FastCommandExecutionResult & {
    intent?: import('../simple/simpleTypes').SimpleIntentName;
    simpleIntent?: import('../simple/simpleTypes').SimpleIntentName;
    operation?: import('../../core/operations/operationTypes').DiagramOperation;
  },
  startedAt: number,
) {
  const timestamp = new Date().toISOString();
  return {
    id: `command-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    rawText: route.rawText,
    normalizedText: route.normalizedText,
    route: route.route,
    confidence: route.confidence,
    status: result.status,
    message: result.message,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    timestamp,
    diagramId: useDiagramStore.getState().diagram.id,
    simpleIntent: result.simpleIntent ?? result.intent,
    operationType: result.operation?.type,
  };
}
