import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSimpleCommandExecutor } from '../commands/simple/simpleCommandExecutor';
import type { SpeechFeedbackService } from '../services/speechFeedbackService';
import { useCommandStore } from '../stores/commandStore';
import { useDiagramStore } from '../stores/diagramStore';
import { useVersionStore } from '../stores/versionStore';
import { createBlankDiagram } from '../core/diagram/blankDiagram';

const speechFeedback: SpeechFeedbackService = {
  isSupported: () => true,
  speak: vi.fn().mockResolvedValue(undefined),
};

describe('simpleCommandExecutor', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
    useCommandStore.getState().reset();
    useVersionStore.getState().clear();
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

  it('creates a basic shape locally without AI', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    await expect(executor.execute('画一个正方形')).resolves.toMatchObject({
      status: 'success',
    });
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.label === '正方形'),
    ).toMatchObject({
      size: { width: 150, height: 150 },
      style: { borderRadius: 0 },
    });
  });

  it('creates visible polygon shapes locally', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    await expect(executor.execute('画出一个三角形')).resolves.toMatchObject({
      status: 'success',
    });
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.label === '三角形'),
    ).toMatchObject({
      size: { width: 150, height: 150 },
      style: {
        background: '#dbeafe',
        clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
      },
    });
  });

  it('creates multiple generic shapes atomically from one command', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(executor.execute('画一个正方形和三角形')).resolves.toMatchObject({
      status: 'success',
      intent: 'create_node',
    });

    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
    expect(useDiagramStore.getState().past).toHaveLength(1);
    expect(useDiagramStore.getState().history[0]?.description).toContain('2');
    expect(useVersionStore.getState().versions[0]?.kind).toBe('auto');
  });

  it('adds shapes to the current canvas only for additive wording', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    const before = useDiagramStore.getState().diagram.nodes.length;

    await executor.execute('添加一个三角形和圆形');

    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(before + 2);
  });

  it('creates a local line between the two most recent nodes', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    useDiagramStore.getState().reset(createBlankDiagram());
    await executor.execute('添加一个三角形和圆形');

    await expect(executor.execute('生成一条线')).resolves.toMatchObject({
      status: 'success',
      intent: 'create_edge',
    });
    expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
  });

  it('creates and connects multiple shapes in one local command', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await executor.execute('画一个三角形连接圆形，连接线用箭头');

    expect(useDiagramStore.getState().diagram.nodes).toHaveLength(2);
    expect(useDiagramStore.getState().diagram.edges).toHaveLength(1);
  });

  it('preserves explicit left and right positions in a connected shape command', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await executor.execute('生成一个三角形连接圆形，三角形在左边，圆形在右边');

    const diagram = useDiagramStore.getState().diagram;
    const triangle = diagram.nodes.find((node) => node.label === '三角形');
    const circle = diagram.nodes.find((node) => node.label === '圆形');
    expect(diagram.nodes).toHaveLength(2);
    expect(diagram.edges).toHaveLength(1);
    expect(triangle?.position?.x).toBeLessThan(circle?.position?.x ?? 0);
    expect(diagram.layout.autoLayout).toBe(false);
  });

  it('understands natural left-right wording and routes the arrow horizontally', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await executor.execute('画一个圆做左边，右边是三角形，用箭头连接在一起');

    const diagram = useDiagramStore.getState().diagram;
    const circle = diagram.nodes.find((node) => node.label === '圆形')!;
    const triangle = diagram.nodes.find((node) => node.label === '三角形')!;
    expect(circle.position!.x).toBeLessThan(triangle.position!.x);
    expect(diagram.edges[0]).toMatchObject({
      from: circle.id,
      to: triangle.id,
      routing: { sourceSide: 'right', targetSide: 'left' },
    });
  });

  it('keeps comma placement clauses together and applies both positions', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await executor.execute('画一个正方形，放左边，圆形，放右边');

    const diagram = useDiagramStore.getState().diagram;
    const square = diagram.nodes.find((node) => node.label === '正方形')!;
    const circle = diagram.nodes.find((node) => node.label === '圆形')!;
    expect(square.position!.x).toBeLessThan(circle.position!.x);
    expect(diagram.nodes).toHaveLength(2);
  });

  it('renames a numbered shape by its visible object number', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    useDiagramStore.getState().reset(createBlankDiagram());
    await executor.execute('添加5个圆形');

    await expect(executor.execute('把5号圆形上的文字改成学校')).resolves.toMatchObject({
      status: 'success',
      intent: 'update_node_text',
    });
    expect(useDiagramStore.getState().diagram.nodes[4]?.label).toBe('学校');
  });

  it('moves a node locally and supports a descriptive numbered rename command', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(executor.execute('把登录页移动到最下方')).resolves.toMatchObject({
      status: 'success',
      intent: 'move_node',
    });
    const diagramAfterMove = useDiagramStore.getState().diagram;
    const moved = diagramAfterMove.nodes.find((node) => node.id === 'login-page');
    const otherMaxY = Math.max(
      ...diagramAfterMove.nodes
        .filter((node) => node.id !== 'login-page')
        .map((node) => node.position?.y ?? 0),
    );
    expect(moved?.position?.y).toBeGreaterThan(otherMaxY);
    expect(diagramAfterMove.layout.autoLayout).toBe(false);

    await expect(
      executor.execute('把1号的开始框中的开始文字改成开始训练'),
    ).resolves.toMatchObject({
      status: 'success',
      intent: 'update_node_text',
    });
    expect(useDiagramStore.getState().diagram.nodes[0]?.label).toBe('开始训练');
  });

  it('duplicates and resizes a referenced object locally', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(executor.execute('把登录页放大')).resolves.toMatchObject({
      status: 'success',
      intent: 'resize_node',
    });
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.id === 'login-page')
        ?.size,
    ).toEqual({ width: 225, height: 80 });

    await expect(executor.execute('把登录页设置为宽300高180')).resolves.toMatchObject({
      status: 'success',
      intent: 'resize_node',
    });
    expect(
      useDiagramStore.getState().diagram.nodes.find((node) => node.id === 'login-page')
        ?.size,
    ).toEqual({ width: 300, height: 180 });

    await expect(executor.execute('复制登录页')).resolves.toMatchObject({
      status: 'success',
      intent: 'duplicate_node',
    });
    expect(
      useDiagramStore
        .getState()
        .diagram.nodes.some((node) => node.label === '进入登录页副本'),
    ).toBe(true);
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

  it('selects the first best matching failure branch directly', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(executor.execute('把失败分支改成红色虚线')).resolves.toMatchObject({
      status: 'success',
      intent: 'update_edge_style',
    });
    expect(useCommandStore.getState().pendingClarification).toBeNull();
    expect(
      useDiagramStore
        .getState()
        .diagram.edges.some(
          (edge) => edge.type === 'dashed' && edge.style?.stroke === '#ff4d4f',
        ),
    ).toBe(true);
  });

  it('uses the first outgoing branch when inserting a node', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);

    await expect(
      executor.execute('在是否已登录后面加一个会话检查节点'),
    ).resolves.toMatchObject({ status: 'success' });
    expect(
      useDiagramStore.getState().diagram.nodes.some((node) => node.label === '会话检查'),
    ).toBe(true);
  });

  it('executes common irregular insert and connect wording locally', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    await executor.execute('把打开 App改名为库存校验');
    await executor.execute('在库存校验节点后面新增一个节点A');
    await executor.execute('加一个节点叫B');

    await expect(executor.execute('将节点A指向节点B')).resolves.toMatchObject({
      status: 'success',
      intent: 'create_edge',
    });
    const diagram = useDiagramStore.getState().diagram;
    const nodeA = diagram.nodes.find((node) => node.label === 'a');
    const nodeB = diagram.nodes.find((node) => node.label === 'b');
    expect(diagram.edges).toContainEqual(
      expect.objectContaining({ from: nodeA?.id, to: nodeB?.id }),
    );
  });

  it('does not leave pending clarification after deterministic selection', async () => {
    const executor = createSimpleCommandExecutor(speechFeedback);
    await executor.execute('把失败分支改成红色虚线');
    expect(useCommandStore.getState().pendingClarification).toBeNull();
  });
});
