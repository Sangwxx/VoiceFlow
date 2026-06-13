import { describe, expect, it } from 'vitest';

import { routeCommand } from '../commands/router/commandRouter';

describe('routeCommand', () => {
  it.each([
    ['撤销。', 'undo'],
    ['恢复回来', 'redo'],
    ['看 全 图', 'fit_view'],
    ['放大画布', 'zoom_in'],
    ['缩小', 'zoom_out'],
    ['改成横向布局', 'layout_left_to_right'],
    ['从上到下', 'layout_top_down'],
    ['重新排版', 'apply_layout'],
    ['停一下', 'pause'],
    ['继续执行', 'resume'],
    ['取消当前操作', 'cancel'],
  ])('routes "%s" to %s', (text, command) => {
    expect(routeCommand(text)).toMatchObject({
      route: 'fast',
      fastCommand: command,
    });
  });

  it('recognizes future simple and agent paths without executing them', () => {
    expect(routeCommand('添加节点')).toMatchObject({ route: 'simple' });
    expect(routeCommand('画一个登录流程图')).toMatchObject({ route: 'agent' });
  });

  it('returns unknown for unsupported text', () => {
    expect(routeCommand('今天天气怎么样')).toMatchObject({ route: 'unknown' });
  });

  it('routes natural contextual modifications to the Agent path', () => {
    expect(routeCommand('把登录这块弄得更清楚一点')).toMatchObject({
      route: 'agent',
      agentIntent: 'modify_diagram',
    });
    expect(routeCommand('在失败以后补一个人工审核')).toMatchObject({
      route: 'agent',
      agentIntent: 'modify_diagram',
    });
  });

  it('classifies flowchart and architecture Agent intents', () => {
    expect(routeCommand('画一个完整登录流程图')).toMatchObject({
      route: 'agent',
      agentIntent: 'create_flowchart',
    });
    expect(routeCommand('生成一个订单系统架构图')).toMatchObject({
      route: 'agent',
      agentIntent: 'create_architecture',
    });
    expect(routeCommand('确认')).toMatchObject({ route: 'fast', fastCommand: 'confirm' });
    expect(routeCommand('生成一张强化学习的学习流程图')).toMatchObject({
      route: 'agent',
      agentIntent: 'create_flowchart',
    });
  });

  it('routes stage 5 workflow and export commands', () => {
    expect(routeCommand('整理成适合汇报的版本')).toMatchObject({
      route: 'workflow',
      workflowIntent: 'report_mode',
    });
    expect(routeCommand('保存当前版本叫初始流程')).toMatchObject({
      route: 'workflow',
      workflowIntent: 'save_version',
    });
    expect(routeCommand('加载电商订单演示场景')).toMatchObject({
      route: 'workflow',
      workflowIntent: 'load_ecommerce_scene',
    });
    expect(routeCommand('导出 PNG')).toMatchObject({
      route: 'fast',
      fastCommand: 'export_png',
    });
    expect(routeCommand('聚焦登录页')).toMatchObject({
      route: 'workflow',
      workflowIntent: 'focus_node',
    });
    expect(routeCommand('隐藏异常分支')).toMatchObject({
      route: 'workflow',
      workflowIntent: 'hide_exception_paths',
    });
    expect(routeCommand('保存当前版本')).toMatchObject({
      route: 'fast',
      fastCommand: 'save_version',
    });
    expect(routeCommand('保存当前版本叫初始流程')).toMatchObject({
      route: 'workflow',
      workflowIntent: 'save_version',
    });
  });
});
