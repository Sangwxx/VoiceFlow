import { describe, expect, it, vi } from 'vitest';

import {
  createConfiguredAiProvider,
  MockAiProvider,
  OpenAiCompatibleProvider,
} from '../commands/agent/aiProviders';

describe('AI providers', () => {
  it('returns deterministic mock diagrams and clarification', async () => {
    const provider = new MockAiProvider();
    await expect(
      provider.complete({
        intent: 'create_architecture',
        originalCommand: '画系统架构图',
        conversation: [],
      }),
    ).resolves.toMatchObject({ kind: 'diagram' });
    await expect(
      provider.complete({
        intent: 'create_flowchart',
        originalCommand: '画点东西',
        conversation: [],
      }),
    ).resolves.toMatchObject({ kind: 'clarification' });
    await expect(
      provider.complete({
        intent: 'create_flowchart',
        originalCommand: '生成一张强化学习的学习流程图',
        conversation: [],
      }),
    ).resolves.toMatchObject({
      kind: 'diagram',
      diagram: { title: '强化学习学习流程' },
    });
  });

  it('corrects common speech recognition errors in Mock mode', async () => {
    const provider = new MockAiProvider();
    await expect(
      provider.interpretCommand({
        transcript: '声成一张强化学西的流成图',
        recentCommands: [],
        diagramTitle: '当前图',
        nodeLabels: [],
      }),
    ).resolves.toMatchObject({
      correctedText: '生成一张强化学习的流程图',
    });
  });

  it('allows recording mode to force the deterministic Mock provider', () => {
    expect(
      createConfiguredAiProvider({
        mode: 'mock',
        baseUrl: 'https://example.test/v1',
        apiKey: 'secret',
        model: 'real-model',
      }),
    ).toBeInstanceOf(MockAiProvider);
  });

  it('sends an OpenAI-compatible request and surfaces HTTP errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"kind":"clarification","question":"补充"}' } }],
      }),
    });
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://example.test/v1/',
      apiKey: 'secret',
      model: 'demo',
      fetchImpl,
    });
    await provider.complete({
      intent: 'create_flowchart',
      originalCommand: '画流程图',
      conversation: [],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );

    const failing = new OpenAiCompatibleProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      model: 'demo',
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    });
    await expect(
      failing.complete({
        intent: 'create_flowchart',
        originalCommand: '画流程图',
        conversation: [],
      }),
    ).rejects.toThrow('HTTP 500');
  });

  it('calls the browser fetch function without an illegal receiver binding', async () => {
    const browserFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"kind":"clarification","question":"补充"}' } }],
      }),
    });
    vi.stubGlobal('fetch', browserFetch);
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'secret',
      model: 'gpt-4.1-mini',
    });

    await provider.complete({
      intent: 'create_flowchart',
      originalCommand: '画流程图',
      conversation: [],
    });

    expect(browserFetch).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
