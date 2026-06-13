import type { SpeechFeedbackService } from '../../services/speechFeedbackService';
import { applyTheme } from '../../core/theme/applyTheme';
import { createReportDiagram } from '../../core/theme/reportMode';
import { defaultLayoutEngine } from '../../core/layout/layoutEngine';
import { architectureDiagram } from '../../mock/architectureDiagram';
import { ecommerceDiagram } from '../../mock/ecommerceDiagram';
import { loginFlowDiagram } from '../../mock/loginFlowDiagram';
import { useCommandStore } from '../../stores/commandStore';
import { useDiagramStore } from '../../stores/diagramStore';
import { useVersionStore } from '../../stores/versionStore';
import type { FastCommandExecutionResult } from '../fast/fastCommandExecutor';
import type { WorkflowIntent } from './workflowTypes';
import { useCanvasViewStore } from '../../stores/canvasViewStore';
import { resolveNode } from '../simple/entityResolver';
import { getCanvasViewportApi } from '../../services/canvasViewportService';

function extractVersionName(text: string): string {
  return (
    text
      .replace(
        /^(保存当前版本|保存版本|保存为版本|恢复版本|恢复|回到版本|对比版本|和版本)/,
        '',
      )
      .replace(/^(叫|为|到)/, '')
      .trim() || '当前版本'
  );
}

export function createWorkflowCommandExecutor(speechFeedback: SpeechFeedbackService) {
  async function execute(
    intent: WorkflowIntent,
    text: string,
  ): Promise<FastCommandExecutionResult> {
    const diagram = useDiagramStore.getState().diagram;
    let message: string;
    try {
      if (intent === 'focus_node') {
        const query = text.replace(/^(聚焦|查看节点|查看|定位到|定位)/, '').trim();
        const resolved = resolveNode(diagram, query);
        if (resolved.status === 'multiple') {
          const viewport = getCanvasViewportApi();
          const node = resolved.candidates[0];
          if (!viewport || !(await viewport.focusNode(node.id))) {
            throw new Error('画布聚焦服务尚未就绪');
          }
          useCanvasViewStore.getState().setFocusedNodeId(node.id);
          useDiagramStore.getState().setSelectedNodeId(node.id);
          message = `已聚焦最匹配节点 ${node.label}`;
          useCommandStore.getState().setLastMessage(message);
          void speechFeedback.speak(message);
          return { status: 'success', message };
        }
        if (resolved.status === 'not_found') {
          throw new Error(
            resolved.suggestions.length
              ? `未找到节点 ${query}，可能是 ${resolved.suggestions.map((node) => node.label).join('、')}`
              : `未找到节点 ${query}`,
          );
        }
        const viewport = getCanvasViewportApi();
        if (!viewport || !(await viewport.focusNode(resolved.item.id))) {
          throw new Error('画布聚焦服务尚未就绪');
        }
        useCanvasViewStore.getState().setFocusedNodeId(resolved.item.id);
        useDiagramStore.getState().setSelectedNodeId(resolved.item.id);
        message = `已聚焦节点 ${resolved.item.label}`;
      } else if (intent === 'hide_exception_paths') {
        useCanvasViewStore.getState().setExceptionPathsHidden(true);
        message = '已隐藏异常分支';
      } else if (intent === 'show_exception_paths') {
        useCanvasViewStore.getState().setExceptionPathsHidden(false);
        message = '已显示异常分支';
      } else if (intent === 'save_version') {
        const name = extractVersionName(text);
        useVersionStore.getState().saveVersion(name, 'manual', 'voice_save', diagram);
        message = `已保存版本 ${name}`;
      } else if (intent === 'restore_version' || intent === 'compare_version') {
        const name = extractVersionName(text);
        const matches = useVersionStore.getState().findVersions(name);
        if (matches.length === 0) throw new Error(`未找到版本 ${name}`);
        if (matches.length > 1) {
          matches.splice(1);
        }
        const version = matches[0];
        if (intent === 'compare_version') {
          const diff = useVersionStore.getState().compare(version.diagram, diagram);
          message = `版本对比完成：新增节点 ${diff.addedNodes}，删除节点 ${diff.removedNodes}，修改节点 ${diff.changedNodes}`;
        } else {
          useDiagramStore
            .getState()
            .replaceDiagram(
              defaultLayoutEngine.layout(version.diagram),
              `恢复版本 ${version.name}`,
            );
          message = `已恢复版本 ${version.name}`;
        }
      } else {
        let candidate;
        let title = '应用图表美化';
        if (intent === 'report_mode') {
          candidate = createReportDiagram(diagram);
          title = '确认汇报美化';
        } else if (intent.startsWith('theme_')) {
          const theme = intent.replace('theme_', '') as
            | 'business_blue'
            | 'report_clean'
            | 'tech_dark';
          candidate = defaultLayoutEngine.layout(applyTheme(diagram, theme));
          title = `应用主题 ${theme}`;
        } else {
          candidate =
            intent === 'load_ecommerce_scene'
              ? ecommerceDiagram
              : intent === 'load_architecture_scene'
                ? architectureDiagram
                : loginFlowDiagram;
          candidate = defaultLayoutEngine.layout(candidate);
          title = `载入演示场景 ${candidate.title}`;
        }
        useDiagramStore.getState().replaceDiagram(candidate, title);
        message = `已应用 ${candidate.title}`;
      }
      useCommandStore.getState().setLastMessage(message);
      void speechFeedback.speak(message);
      return { status: 'success', message };
    } catch (error) {
      message = error instanceof Error ? error.message : '工作流执行失败';
      useCommandStore.getState().setLastMessage(message);
      void speechFeedback.speak(message);
      return { status: 'error', message };
    }
  }

  return { execute };
}
