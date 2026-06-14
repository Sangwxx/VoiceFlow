import { useAgentStore } from '../stores/agentStore';
import { useCommandStore } from '../stores/commandStore';
import { useWorkspaceModeStore, type WorkspaceMode } from '../stores/workspaceModeStore';

export function switchWorkspaceMode(mode: WorkspaceMode): string {
  useAgentStore.getState().clear();
  useWorkspaceModeStore.getState().setMode(mode);
  const message = mode === 'diagram' ? '已切换到专业图表模式' : '已切换到自由画图模式';
  useCommandStore.getState().setLastMessage(message);
  return message;
}
