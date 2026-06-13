import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWorkflowCommandExecutor } from '../commands/workflow/workflowCommandExecutor';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useDiagramStore } from '../stores/diagramStore';
import { useProposalStore } from '../stores/proposalStore';
import { useVersionStore } from '../stores/versionStore';
import { useWorkflowStore } from '../stores/workflowStore';
import { registerCanvasViewportApi } from '../services/canvasViewportService';
import { useCanvasViewStore } from '../stores/canvasViewStore';

const feedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

describe('workflowCommandExecutor', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useProposalStore.getState().cancel();
    useVersionStore.getState().clear();
    useWorkflowStore.getState().clear();
    useCanvasViewStore.getState().reset();
    registerCanvasViewportApi({
      fitView: vi.fn().mockResolvedValue(true),
      zoomIn: vi.fn().mockResolvedValue(true),
      zoomOut: vi.fn().mockResolvedValue(true),
      focusNode: vi.fn().mockResolvedValue(true),
    });
  });

  it('focuses nodes and toggles exception branch visibility', async () => {
    const execute = createWorkflowCommandExecutor(feedback);
    await expect(execute.execute('focus_node', '聚焦登录页')).resolves.toMatchObject({
      status: 'success',
    });
    expect(useCanvasViewStore.getState().focusedNodeId).toBe('login-page');
    expect(useDiagramStore.getState().selectedNodeId).toBe('login-page');
    await execute.execute('hide_exception_paths', '隐藏异常分支');
    expect(useCanvasViewStore.getState().exceptionPathsHidden).toBe(true);
    await execute.execute('show_exception_paths', '显示异常分支');
    expect(useCanvasViewStore.getState().exceptionPathsHidden).toBe(false);
  });

  it('clarifies ambiguous focus targets', async () => {
    const duplicate = structuredClone(useDiagramStore.getState().diagram);
    duplicate.nodes.push({ id: 'login-page-copy', label: '进入登录页', type: 'process' });
    useDiagramStore.getState().reset(duplicate);
    const execute = createWorkflowCommandExecutor(feedback);
    const result = await execute.execute('focus_node', '聚焦登录页');
    expect(result.status).toBe('clarification');
    expect(useWorkflowStore.getState().pendingFocusClarification).toHaveLength(2);
    await execute.answerClarification('第二个');
    expect(useCanvasViewStore.getState().focusedNodeId).toBe('login-page-copy');
  });

  it('clarifies duplicate version names and resolves ordinal answers', async () => {
    const execute = createWorkflowCommandExecutor(feedback);
    await execute.execute('save_version', '保存当前版本叫方案');
    await execute.execute('save_version', '保存当前版本叫方案');
    const result = await execute.execute('restore_version', '恢复版本方案');
    expect(result.status).toBe('clarification');
    expect(
      useWorkflowStore.getState().pendingVersionClarification?.candidates,
    ).toHaveLength(2);
    await execute.answerClarification('第二个');
    expect(useProposalStore.getState().proposal?.source).toBe('version_restore');
  });

  it('previews report mode and demo scenes', async () => {
    const execute = createWorkflowCommandExecutor(feedback);
    await execute.execute('report_mode', '整理成适合汇报的版本');
    expect(useProposalStore.getState().proposal?.source).toBe('report_mode');
    useProposalStore.getState().cancel();
    await execute.execute('load_ecommerce_scene', '加载电商订单演示场景');
    expect(useProposalStore.getState().proposal?.diagram.title).toBe('电商订单流程');
  });

  it('saves, compares and previews restoration of named versions', async () => {
    const execute = createWorkflowCommandExecutor(feedback);
    await execute.execute('save_version', '保存当前版本叫初始流程');
    expect(useVersionStore.getState().versions[0].name).toBe('初始流程');
    await execute.execute('compare_version', '对比版本初始流程');
    expect(useVersionStore.getState().lastDiff).not.toBeNull();
    await execute.execute('restore_version', '恢复版本初始流程');
    expect(useProposalStore.getState().proposal?.source).toBe('version_restore');
  });
});
