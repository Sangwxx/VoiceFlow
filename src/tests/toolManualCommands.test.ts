import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAgentCommandExecutor } from '../commands/agent/agentCommandExecutor';
import { UnconfiguredAiProvider } from '../commands/agent/aiProviders';
import { createFastCommandExecutor } from '../commands/fast/fastCommandExecutor';
import { routeCommand } from '../commands/router/commandRouter';
import { createSimpleCommandExecutor } from '../commands/simple/simpleCommandExecutor';
import { createWorkflowCommandExecutor } from '../commands/workflow/workflowCommandExecutor';
import { TOOL_MANUAL_COMMAND_GROUPS } from '../components/common/toolManualCommands';
import type { ExportFormat, ExportService } from '../core/export/exportService';
import { createApplyLayoutOperation } from '../core/operations/operationFactory';
import { registerCanvasViewportApi } from '../services/canvasViewportService';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useAgentStore } from '../stores/agentStore';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVersionStore } from '../stores/versionStore';
import { useVoiceStore } from '../stores/voiceStore';

const feedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

const expectedRoutes = {
  看全图: ['fast', 'fit_view'],
  放大画布: ['fast', 'zoom_in'],
  横向布局: ['fast', 'layout_left_to_right'],
  自动排版: ['fast', 'apply_layout'],
  撤销: ['fast', 'undo'],
  重做: ['fast', 'redo'],
  在登录页后面加一个验证码节点: ['simple', 'insert_node_after'],
  '删除物体 3': ['simple', 'delete_node'],
  '把物体 2 改名为账号登录': ['simple', 'update_node_text'],
  '把物体 10 改成红色虚线': ['simple', 'update_edge_style'],
  '连接打开 App 到进入登录页': ['simple', 'create_edge'],
  画一个强化学习的学习流程图: ['agent', 'create_diagram'],
  '画一个包含网关、订单服务和数据库的系统架构图': ['agent', 'create_diagram'],
  画一个学生选课用例图: ['agent', 'create_diagram'],
  画一个公司的组织结构图: ['agent', 'create_diagram'],
  生成产品功能思维导图: ['agent', 'create_diagram'],
  做一个方案对比表格: ['agent', 'create_diagram'],
  整理成适合汇报的版本: ['workflow', 'report_mode'],
  改成蓝色商务风: ['workflow', 'theme_business_blue'],
  突出主流程: ['workflow', 'report_mode'],
  加载电商订单演示场景: ['workflow', 'load_ecommerce_scene'],
  保存当前版本叫初始流程: ['workflow', 'save_version'],
  列出版本: ['fast', 'list_versions'],
  恢复初始流程: ['workflow', 'restore_version'],
  对比初始流程: ['workflow', 'compare_version'],
  '导出 JSON': ['fast', 'export_json'],
  '导出 SVG': ['fast', 'export_svg'],
  '导出 PNG': ['fast', 'export_png'],
} as const;

const manualCommands = TOOL_MANUAL_COMMAND_GROUPS.flatMap((group) => group.commands);

describe('工具手册命令覆盖', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useVoiceStore.getState().reset();
    useCommandStore.getState().reset();
    useVersionStore.getState().clear();
    useAgentStore.getState().clear();
    registerCanvasViewportApi({
      fitView: vi.fn().mockResolvedValue(true),
      zoomIn: vi.fn().mockResolvedValue(true),
      zoomOut: vi.fn().mockResolvedValue(true),
      focusNode: vi.fn().mockResolvedValue(true),
    });
    vi.clearAllMocks();
  });

  it('为手册中的每一条示例声明确定的执行路径', () => {
    expect(manualCommands).toHaveLength(Object.keys(expectedRoutes).length);
    for (const command of manualCommands) {
      const [route, intent] = expectedRoutes[command];
      const result = routeCommand(command);
      expect(result.route, command).toBe(route);
      expect(
        result.fastCommand ??
          result.simpleIntent ??
          result.workflowIntent ??
          result.agentIntent,
        command,
      ).toBe(intent);
    }
  });

  it.each(
    TOOL_MANUAL_COMMAND_GROUPS.find((group) => group.title === '增删改图形')!.commands,
  )('本地执行图形工具命令：%s', async (command) => {
    const result = await createSimpleCommandExecutor(feedback).execute(command);
    expect(result.status, `${command}：${result.message}`).toBe('success');
  });

  it.each(
    TOOL_MANUAL_COMMAND_GROUPS.find((group) => group.title === '生成结构图')!.commands,
  )('离线降级执行结构图命令：%s', async (command) => {
    const result = await createAgentCommandExecutor(
      new UnconfiguredAiProvider(),
      feedback,
    ).execute(command, 'create_diagram');
    expect(result.status, `${command}：${result.message}`).toBe('success');
  });

  it.each(
    TOOL_MANUAL_COMMAND_GROUPS.find((group) => group.title === '美化与场景')!.commands,
  )('本地执行美化与场景命令：%s', async (command) => {
    const route = routeCommand(command);
    if (route.route !== 'workflow' || !route.workflowIntent) {
      throw new Error(`${command} 未路由到 Workflow`);
    }
    const result = await createWorkflowCommandExecutor(feedback).execute(
      route.workflowIntent,
      command,
    );
    expect(result.status, `${command}：${result.message}`).toBe('success');
  });

  it('依次执行版本管理命令', async () => {
    const workflow = createWorkflowCommandExecutor(feedback);
    await expect(
      workflow.execute('save_version', '保存当前版本叫初始流程'),
    ).resolves.toMatchObject({ status: 'success' });
    await expect(executeFast('列出版本')).resolves.toMatchObject({ status: 'success' });
    await expect(
      workflow.execute('restore_version', '恢复初始流程'),
    ).resolves.toMatchObject({ status: 'success' });
    await expect(
      workflow.execute('compare_version', '对比初始流程'),
    ).resolves.toMatchObject({ status: 'success' });
  });

  it.each(['导出 JSON', '导出 SVG', '导出 PNG'] as const)(
    '本地执行导出命令：%s',
    async (command) => {
      const result = await executeFast(command);
      expect(result.status, `${command}：${result.message}`).toBe('success');
    },
  );

  it('依次执行画布控制命令', async () => {
    await expect(executeFast('看全图')).resolves.toMatchObject({ status: 'success' });
    await expect(executeFast('放大画布')).resolves.toMatchObject({ status: 'success' });
    await expect(executeFast('横向布局')).resolves.toMatchObject({ status: 'success' });
    await expect(executeFast('自动排版')).resolves.toMatchObject({
      status: expect.stringMatching(/success|ignored/),
    });
    useDiagramStore.getState().applyOperation(createApplyLayoutOperation('top_down'));
    await expect(executeFast('撤销')).resolves.toMatchObject({ status: 'success' });
    await expect(executeFast('重做')).resolves.toMatchObject({ status: 'success' });
  });
});

async function executeFast(command: string) {
  const route = routeCommand(command);
  if (route.route !== 'fast' || !route.fastCommand) {
    throw new Error(`${command} 未路由到 Fast Path`);
  }
  const exportService: ExportService = {
    export: vi.fn(async (_diagram, format: ExportFormat) => ({
      format,
      filename: `test.${format}`,
      durationMs: 1,
    })),
  };
  return createFastCommandExecutor({ speechFeedback: feedback, exportService })(
    route.fastCommand,
  );
}
