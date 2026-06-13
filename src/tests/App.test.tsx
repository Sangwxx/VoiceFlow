import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '../app/App';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { ClarificationRequest } from '../commands/simple/simpleTypes';

describe('competition app', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useVoiceStore.getState().reset();
    useCommandStore.getState().reset();
  });

  afterEach(() => {
    useVoiceStore.getState().reset();
  });

  it('shows voice, decision metrics, command history and transcript surfaces', async () => {
    render(<App />);

    expect(screen.getByText('AI 语音绘图')).toBeInTheDocument();
    expect(screen.getByText('Simple Path 示例')).toBeInTheDocument();
    expect(screen.getByText('智能决策指标')).toBeInTheDocument();
    expect(
      screen.getByText('分层低延迟路由 · 上下文消歧 · 安全预览确认'),
    ).toBeInTheDocument();
    expect(screen.getByText('历史状态')).toBeInTheDocument();
    expect(screen.getByText('最近命令')).toBeInTheDocument();
    expect(screen.getByText('实时字幕')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始语音输入' })).toBeInTheDocument();
    expect(screen.getAllByText('等待启动')).toHaveLength(2);
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

  it('shows pending clarification candidates', () => {
    const request: ClarificationRequest = {
      id: 'clarification-1',
      originalCommand: '把失败分支改成红色虚线',
      question: '你指的是哪条连线？',
      candidates: [
        { id: 'e1', kind: 'edge', label: '登录判断 → 登录页（否）' },
        { id: 'e2', kind: 'edge', label: '登录成功 → 错误提示（失败）' },
      ],
      resolutionField: 'edgeId',
      draft: {
        intent: 'update_edge_style',
        edgeText: '失败',
        colorName: '红色',
        lineType: 'dashed',
      },
    };
    useCommandStore.getState().setPendingClarification(request);

    render(<App />);

    expect(screen.getByText('视觉化消歧')).toBeInTheDocument();
    expect(screen.getByText('原始语音')).toBeInTheDocument();
    expect(screen.getByText(/把失败分支改成红色虚线/)).toBeInTheDocument();
    expect(screen.getByText('登录成功 → 错误提示（失败）')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
