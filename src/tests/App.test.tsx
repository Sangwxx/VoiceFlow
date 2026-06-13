import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '../app/App';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVoiceStore } from '../stores/voiceStore';
import type { ClarificationRequest } from '../commands/simple/simpleTypes';

describe('phase 3 app', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useVoiceStore.getState().reset();
    useCommandStore.getState().reset();
  });

  afterEach(() => {
    useVoiceStore.getState().reset();
  });

  it('shows the phase 3 voice, command, history and transcript surfaces', async () => {
    render(<App />);

    expect(screen.getByText('阶段 3')).toBeInTheDocument();
    expect(screen.getByText('Simple Path 示例')).toBeInTheDocument();
    expect(screen.getByText('历史状态')).toBeInTheDocument();
    expect(screen.getByText('最近命令')).toBeInTheDocument();
    expect(screen.getByText('实时字幕')).toBeInTheDocument();
    expect(screen.getAllByText('浏览器不支持')).toHaveLength(2);
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

    expect(screen.getByText('需要语音澄清')).toBeInTheDocument();
    expect(screen.getByText('你指的是哪条连线？')).toBeInTheDocument();
    expect(screen.getByText('登录成功 → 错误提示（失败）')).toBeInTheDocument();
  });
});
