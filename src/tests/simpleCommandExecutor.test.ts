import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSimpleCommandExecutor } from '../commands/simple/simpleCommandExecutor';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';

const speechFeedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

describe('simpleCommandExecutor', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useCommandStore.getState().reset();
    vi.clearAllMocks();
  });

  it('inserts, styles and connects nodes with reversible operations', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(
      executor.execute('在登录页后面加一个验证码校验节点'),
    ).resolves.toMatchObject({ status: 'success', intent: 'insert_node_after' });
    const captcha = useDiagramStore
      .getState()
      .diagram.nodes.find((node) => node.label === '验证码校验');
    expect(captcha).toBeDefined();

    await executor.execute('把验证码校验改成蓝色');
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.id === captcha?.id)
        ?.style?.border,
    ).toBe('#2f80ed');

    await executor.execute('连接验证码校验到登录成功');
    expect(useDiagramStore.getState().diagram.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: captcha?.id, to: 'login-success' }),
      ]),
    );

    expect(useDiagramStore.getState().past.length).toBe(3);
    expect(useDiagramStore.getState().undo()).toBe(true);
    expect(useDiagramStore.getState().redo()).toBe(true);
  });

  it('creates an isolated node when no location is specified', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    await executor.execute('加一个节点叫人工审核');

    const node = useDiagramStore
      .getState()
      .diagram.nodes.find((item) => item.label === '人工审核');
    expect(node).toBeDefined();
    expect(
      useDiagramStore
        .getState()
        .diagram.edges.some((edge) => edge.from === node?.id || edge.to === node?.id),
    ).toBe(false);
  });

  it('renames, deletes and removes edges through Simple Path', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await executor.execute('把登录页改名为账号登录');
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.id === 'login-page')
        ?.label,
    ).toBe('账号登录');

    await executor.execute('删除开始到打开 App 的连线');
    expect(
      useDiagramStore
        .getState()
        .diagram.edges.some((edge) => edge.from === 'start' && edge.to === 'open-app'),
    ).toBe(false);

    await executor.execute('删除提示登录错误节点');
    expect(
      useDiagramStore.getState().diagram.nodes.some((node) => node.id === 'show-error'),
    ).toBe(false);
  });

  it('clarifies ambiguous failure branches by ordinal answer', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(executor.execute('把失败分支改成红色虚线')).resolves.toMatchObject({
      status: 'clarification',
    });
    expect(useCommandStore.getState().pendingClarification?.candidates.length).toBe(2);

    await expect(executor.answerClarification('第二个')).resolves.toMatchObject({
      status: 'success',
      intent: 'update_edge_style',
    });
    expect(useCommandStore.getState().pendingClarification).toBeNull();
    expect(
      useDiagramStore.getState().diagram.edges.find((edge) => edge.label === '失败')
        ?.style?.stroke,
    ).toBe('#ff4d4f');
  });

  it('clarifies which outgoing branch receives an inserted node', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(
      executor.execute('在是否已登录后面加一个会话检查节点'),
    ).resolves.toMatchObject({ status: 'clarification' });
    expect(useCommandStore.getState().pendingClarification?.resolutionField).toBe(
      'replacedEdgeId',
    );

    await executor.answerClarification('第一个');
    expect(
      useDiagramStore.getState().diagram.nodes.some((node) => node.label === '会话检查'),
    ).toBe(true);
  });

  it('accepts a clarification candidate by spoken name', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    await executor.execute('把失败分支改成红色虚线');
    const candidate = useCommandStore.getState().pendingClarification?.candidates[1];

    await executor.answerClarification(candidate?.label ?? '');

    expect(useCommandStore.getState().pendingClarification).toBeNull();
    expect(
      useDiagramStore.getState().diagram.edges.find((edge) => edge.label === '失败')
        ?.type,
    ).toBe('dashed');
  });
});
