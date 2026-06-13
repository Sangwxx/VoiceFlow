import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '../app/App';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVersionStore } from '../stores/versionStore';
import { useVoiceStore } from '../stores/voiceStore';

describe('competition app', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useVoiceStore.getState().reset();
    useCommandStore.getState().reset();
    useVersionStore.getState().clear();
  });

  afterEach(() => useVoiceStore.getState().reset());

  it('shows the one-quarter workbench and canvas information architecture', () => {
    render(<App />);

    expect(screen.getByRole('complementary', { name: '语音工作区' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '画布区' })).toBeInTheDocument();
    expect(screen.getByText('实时文字')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: '文字指令测试' })).toBeInTheDocument();
    expect(screen.getByText('任务列表')).toBeInTheDocument();
    expect(screen.queryByText('系统反问')).not.toBeInTheDocument();
    expect(screen.getByText('版本管理')).toBeInTheDocument();
    expect(screen.getByText('仅收录明确语音保存的版本')).toBeInTheDocument();
  });

  it('executes typed commands through the voice command controller', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole('textbox', { name: '输入测试指令' }), '横向布局');
    await user.click(screen.getByRole('button', { name: '执行指令' }));

    expect(useDiagramStore.getState().diagram.layout.direction).toBe('left_to_right');
    expect(useCommandStore.getState().executionLog[0]).toMatchObject({
      rawText: '横向布局',
      route: 'fast',
      status: 'success',
    });
    expect(screen.getByRole('textbox', { name: '输入测试指令' })).toHaveValue('');
  });

  it('starts and stops microphone input explicitly', async () => {
    const user = userEvent.setup();
    render(<App />);

    const start = screen.getByRole('button', { name: '开始语音输入' });
    await user.click(start);
    expect(screen.getByRole('button', { name: '停止语音输入' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '停止语音输入' }));
    expect(screen.getByRole('button', { name: '开始语音输入' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows only explicitly saved manual versions', () => {
    useVersionStore
      .getState()
      .saveVersion(
        '明确收录版本',
        'manual',
        'voice_save',
        useDiagramStore.getState().diagram,
      );
    render(<App />);
    expect(screen.getByText('明确收录版本')).toBeInTheDocument();
  });

  it('opens the categorized tool manual from the canvas header', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByText('说“保存当前版本叫初始流程”，需要时说“恢复初始流程”。'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '打开工具手册' }));
    expect(screen.getByRole('dialog', { name: '工具手册' })).toBeInTheDocument();
    expect(screen.getByText('增删改图形')).toBeInTheDocument();
    expect(screen.getByText('“删除物体 3”')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭工具手册' }));
    expect(screen.queryByRole('dialog', { name: '工具手册' })).not.toBeInTheDocument();
  });

  it('shows task status and confidence in the ordered scrolling list', () => {
    useVoiceStore.getState().setTaskQueue([
      {
        id: 'task-1',
        sequence: 1,
        text: '横向布局',
        source: 'final',
        readiness: 'immediate',
        status: 'executing',
        route: {
          route: 'fast',
          confidence: 0.92,
          rawText: '横向布局',
          normalizedText: '横向布局',
          fastCommand: 'layout_left_to_right',
        },
      },
    ]);
    render(<App />);
    expect(screen.getByText('横向布局')).toBeInTheDocument();
    expect(screen.getByText('正在执行')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.queryByText('针对任务：横向布局')).not.toBeInTheDocument();
  });
});
